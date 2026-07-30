import assert from "node:assert/strict"
import { readFile, readdir, access } from "node:fs/promises"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import {
    buildFrozenGraph,
    LinkGraphError,
    validateFrozenGraph,
    validatePublicationUrlPattern,
} from "../lib/harvest/link-graph.ts"
import {
    auditCheckoutFreshness,
    selectQualifiedProgramScope,
} from "../lib/harvest/program-contract.ts"
import {
    roundRobinCap,
    selectSerpSeeds,
} from "../lib/harvest/scope-cap.ts"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const text = (relativePath) =>
    readFile(path.join(root, relativePath), "utf8")

function clusterArticles(clusterId, offset = 0) {
    return [
        {
            id: `${clusterId}-pillar`,
            clusterId,
            title: `Complete guide ${clusterId}`,
            mainKeyword: `complete guide ${clusterId}`,
            isPillar: true,
            embedding: [1, 0 + offset],
        },
        {
            id: `${clusterId}-leaf-a`,
            clusterId,
            title: `First question ${clusterId}`,
            mainKeyword: `first question ${clusterId}`,
            isPillar: false,
            embedding: [0.9, 0.1 + offset],
        },
        {
            id: `${clusterId}-leaf-b`,
            clusterId,
            title: `Second question ${clusterId}`,
            mainKeyword: `second question ${clusterId}`,
            isPillar: false,
            embedding: [0.8, 0.2 + offset],
        },
    ]
}

test("publication URL patterns are absolute, HTTPS, same-host, and single-placeholder", () => {
    assert.equal(
        validatePublicationUrlPattern(
            "https://example.com/blog/{slug}/",
            "https://www.example.com",
        ),
        "https://example.com/blog/{slug}/",
    )
    for (const pattern of [
        "http://example.com/{slug}",
        "https://other.example/{slug}",
        "https://example.com/no-placeholder",
        "https://example.com/{slug}/{slug}",
        "https://example.com/?article={slug}",
    ]) {
        assert.throws(
            () =>
                validatePublicationUrlPattern(
                    pattern,
                    "https://example.com",
                ),
            LinkGraphError,
        )
    }
})

test("frozen graph contains the complete deterministic pillar/leaf/sibling contract", () => {
    const articles = Array.from({ length: 6 }, (_, index) =>
        clusterArticles(`cluster-${index + 1}`, index / 10),
    ).flat()
    const graph = buildFrozenGraph(
        "https://example.com/blog/{slug}/",
        "https://example.com",
        articles,
        [
            {
                url: "https://example.com/products/core",
                title: "Core product page",
                embedding: [1, 0],
            },
            {
                url: "https://example.com/blog/complete-guide-cluster-1/",
                title: "Existing complete guide",
                embedding: [1, 0],
            },
        ],
    )

    assert.equal(graph.articles.length, 18)
    assert.equal(new Set(graph.articles.map((item) => item.slug)).size, 18)
    assert.equal(
        graph.articles.find((item) => item.id === "cluster-1-pillar").slug,
        "complete-guide-cluster-1-2",
    )
    assert.ok(
        graph.edges.every(
            (edge) => new URL(edge.targetUrl).hostname === "example.com",
        ),
    )
    for (const article of graph.articles) {
        const anchors = graph.edges
            .filter((edge) => edge.sourceArticleId === article.id)
            .map((edge) => edge.anchorText.toLowerCase())
        assert.equal(new Set(anchors).size, anchors.length)
    }
    validateFrozenGraph(graph)

    const tampered = structuredClone(graph)
    const firstLeaf = articles.find((article) => !article.isPillar)
    tampered.edges = tampered.edges.filter(
        (edge) =>
            !(
                edge.sourceArticleId === firstLeaf.id &&
                edge.relationship === "leaf_to_pillar"
            ),
    )
    assert.throws(() => validateFrozenGraph(tampered), LinkGraphError)
})

test("legacy flat scope selects six priority unsold qualified clusters", () => {
    const clusters = Array.from({ length: 9 }, (_, index) => ({
        id: `cluster-${index + 1}`,
        priority: index + 1,
        articleCount: index === 0 ? 2 : 5,
    }))
    const selection = selectQualifiedProgramScope(
        clusters,
        ["cluster-2"],
        false,
    )
    assert.equal(selection.eligible, true)
    assert.deepEqual(
        selection.selected.map((cluster) => cluster.id),
        [
            "cluster-3",
            "cluster-4",
            "cluster-5",
            "cluster-6",
            "cluster-7",
            "cluster-8",
        ],
    )
    assert.equal(selection.selectedArticleCount, 30)

    const small = selectQualifiedProgramScope(clusters.slice(0, 6), [], false)
    assert.equal(small.eligible, false)
    assert.match(small.reason, /requires six/i)

    const legacy = selectQualifiedProgramScope(clusters, [], true)
    assert.equal(legacy.eligible, false)
    assert.match(legacy.reason, /refreshed/i)
})

test("six-cluster selection represents confirmed business families before taking depth", () => {
    const clusters = [
        ...Array.from({ length: 7 }, (_, index) => ({
            id: `restoration-${index + 1}`,
            priority: index,
            articleCount: 5,
            scopeFamilyId: "restoration",
            scopeFamilyPriority: 0,
        })),
        ...["animation", "portrait", "add-person", "hug", "memory-book"].map(
            (family, index) => ({
                id: `${family}-1`,
                priority: 20 + index,
                articleCount: 5,
                scopeFamilyId: family,
                scopeFamilyPriority: index + 1,
            }),
        ),
    ]
    const selection = selectQualifiedProgramScope(clusters, [], false)
    assert.equal(selection.eligible, true)
    assert.deepEqual(
        selection.selected.map((cluster) => cluster.scopeFamilyId),
        [
            "restoration",
            "animation",
            "portrait",
            "add-person",
            "hug",
            "memory-book",
        ],
    )
})

test("query and SERP caps preserve smaller confirmed families", () => {
    const rows = [
        ...Array.from({ length: 10 }, (_, index) => ({
            id: `restoration-${index}`,
            group: "restoration",
        })),
        { id: "animation-0", group: "animation" },
        { id: "memory-0", group: "memory" },
    ]
    assert.deepEqual(
        roundRobinCap(
            rows,
            6,
            (row) => row.group,
            ["restoration", "animation", "memory"],
        ).map((row) => row.group),
        [
            "restoration",
            "animation",
            "memory",
            "restoration",
            "restoration",
            "restoration",
        ],
    )

    assert.deepEqual(
        selectSerpSeeds(
            [
                { seedKeywords: ["restore photos", "repair photos", "fix photos"] },
                { seedKeywords: ["animate photos", "photo motion"] },
                { seedKeywords: ["memory book"] },
            ],
            5,
        ),
        [
            "restore photos",
            "animate photos",
            "memory book",
            "repair photos",
            "photo motion",
        ],
    )
})

test("checkout eligibility expires 30 days after audit completion", () => {
    const now = Date.parse("2026-07-29T00:00:00.000Z")
    assert.equal(
        auditCheckoutFreshness("2026-07-01T00:00:00.000Z", now).fresh,
        true,
    )
    const stale = auditCheckoutFreshness("2026-06-01T00:00:00.000Z", now)
    assert.equal(stale.fresh, false)
    assert.match(stale.reason, /30 days/i)
})

test("prospect audit retries keep the immutable run open until terminal failure", async () => {
    const source = await text("trigger/run-prospect-audit.ts")
    assert.match(source, /maxAttempts:\s*2/)
    assert.match(source, /onFailure:/)
    assert.match(source, /generation_phase:\s*"retrying"/)
    assert.match(source, /source_call_ledger:\s*progress\.sourceCallLedger/)
    const runBody = source.slice(source.indexOf("run: async"))
    assert.doesNotMatch(
        runBody,
        /catch \(error\)[\s\S]{0,500}run_status:\s*"failed"/,
    )
})

test("verify and production use the same authoritative assembly function", async () => {
    const [verify, production, assembly, policy] = await Promise.all([
        text("app/api/harvest/verify/route.ts"),
        text("lib/harvest/run-harvest.ts"),
        text("lib/harvest/assembly.ts"),
        text("lib/harvest/policy.ts"),
    ])
    assert.match(verify, /assembleHarvest\(input\)/)
    assert.match(verify, /scopeFamilies is required/)
    assert.doesNotMatch(verify, /body\.seeds/)
    assert.match(production, /assembleHarvest\(\s*\{/)
    assert.match(production, /persistHarvestOutput\(options\.auditId, output\)/)
    assert.match(production, /initialSourceCallLedger/)
    assert.match(assembly, /filterToSearchedQueries/)
    assert.match(assembly, /roundRobinCap/)
    assert.match(assembly, /HARVEST_POLICY\.maxPreScopeQueries/)
    assert.match(assembly, /HARVEST_POLICY\.maxQueries/)
    assert.match(assembly, /sourceFamilyHint/)
    assert.match(assembly, /resultHash/)
    assert.match(assembly, /onProgress/)
    assert.match(assembly, /phase:\s*"scanning_user_site"/)
    assert.match(assembly, /phase:\s*"scanning_competitors"/)
    assert.match(policy, /maxCompetitors:\s*4/)
    assert.match(policy, /maxPreScopeQueries:\s*600/)
    assert.match(policy, /maxQueries:\s*400/)
    assert.match(policy, /maxCompetitorCorpusPages:\s*120/)
    // Bounded so the worst-case audit fits the 900s task budget:
    // 150 subject + 4x80 competitor coverage + 120 corpus = 590 page fetches.
    assert.match(policy, /maxCoveragePages:\s*150/)
    assert.match(policy, /maxCompetitorCoveragePages:\s*80/)
    assert.match(
        await text("lib/harvest/assembly.ts"),
        /scanCoverage\([\s\S]{0,120}"competitor",/,
    )
    assert.match(policy, /maxSitemapFiles:\s*20/)
    assert.match(policy, /maxSitemapUrls:\s*5000/)
    assert.match(policy, /maxClusterArticles:\s*15/)
    assert.match(
        await text("trigger/run-audit.ts"),
        /competitor_discovery_tavily|recordDiscoveryCall/,
    )
    assert.match(
        await text("lib/harvest/competitor-corpus.ts"),
        /remainingPageBudget\s*=\s*HARVEST_POLICY\.maxCompetitorCorpusPages/,
    )
})

test("a failed audit cannot be restarted by refreshing the page", async () => {
    const [route, console_] = await Promise.all([
        text("app/api/topical-audit/route.ts"),
        text("components/audit/audit-console.tsx"),
    ])

    // GET must report a failed run. finalize_audit_run only sets
    // current_audit_id on success, so without this lookup GET answered
    // "not_found" and the console auto-started a brand new expensive audit on
    // every single page refresh.
    assert.match(route, /run_status", "failed"/)
    assert.match(route, /const auditId = running\?\.id \|\| brand\?\.current_audit_id \|\| failed\?\.id/)

    // POST must refuse to re-run inside the cooldown, and stop entirely after
    // repeated failures.
    assert.match(route, /AUDIT_RETRY_COOLDOWN_MINUTES\s*=\s*\d+/)
    assert.match(route, /MAX_FAILURES_PER_COOLDOWN\s*=\s*\d+/)
    assert.match(route, /retryAfterSeconds/)
    assert.match(route, /status:\s*429/)

    // The console may only auto-start when an audit has genuinely never run.
    // Network errors and failed runs must surface, never launch work.
    const recover = console_.slice(console_.indexOf("const recoverOrStart"))
    const autoStarts = recover.match(/await startAudit\(\)/g) || []
    assert.equal(
        autoStarts.length,
        1,
        "recoverOrStart must call startAudit exactly once, only for status not_found",
    )
    assert.match(recover, /if \(data\.status === "not_found"\) \{\s*await startAudit\(\)/)

    // GET and POST must derive the cooldown from one helper, so the countdown
    // the customer sees is the same rule the endpoint enforces.
    assert.match(route, /async function retryState/)
    assert.equal((route.match(/retryState\(db, user\.id, brandId\)/g) || []).length, 2)

    // An abandoned `running` row must self-heal into a retryable failure.
    // Without this a stuck row blocked POST ("Audit already running") and made
    // GET report "running" forever, which the UI rendered as an endless loader.
    assert.match(route, /async function reclaimStaleRuns/)
    assert.match(route, /AUDIT_STALE_AFTER_MINUTES\s*=\s*\d+/)
    assert.match(route, /failure_code:\s*"worker_never_ran"/)
    assert.equal(
        (route.match(/reclaimStaleRuns\(db, user\.id, brandId\)/g) || []).length,
        2,
        "both GET and POST must reclaim stale runs before reading or triggering",
    )

    // The failure state must offer a deliberate retry, never an automatic one.
    assert.match(console_, /Run the audit again/)
    assert.match(console_, /Refreshing this page will not start a new audit/)
    assert.match(console_, /disabled=\{!canRetry \|\| isRetrying\}/)
    // And it must not bounce the customer back to re-enter their brand.
    assert.doesNotMatch(console_, /onError/)
})

test("a founder target search can never be silently dropped from scope", async () => {
    const { validateGroundedScope, verifyQuote } = await import("../lib/brand-scope.ts")

    const pages = [{ url: "https://drawgle.com/", content: "Turn a prompt into a mobile screen." }]

    // The extractor returns one narrow family that ignores what the founder
    // said they sell. Previously the founder's searches simply came back as an
    // "assign these" error and the wrong family owned the whole audit.
    const result = validateGroundedScope(
        [
            {
                name: "Design Handoff and Implementation",
                description: "Converting design concepts into developer-ready assets.",
                seed_keywords: ["design handoff"],
                evidence: [{ url: "https://drawgle.com/", quote: "Turn a prompt into a mobile screen." }],
                source: "extracted",
            },
        ],
        pages,
        "https://drawgle.com",
        ["ai mobile app ui designer", "text to mobile ui design"],
    )

    assert.equal(result.unassignedTargetSeeds.length, 0, "founder searches must all be claimed")
    for (const seed of ["ai mobile app ui designer", "text to mobile ui design"]) {
        const owner = result.families.find((family) => family.seed_keywords.includes(seed))
        assert.ok(owner, `no family claimed "${seed}"`)
        assert.equal(owner.source, "founder")
    }

    // An extracted family whose quote cannot be verified is kept for the
    // founder to judge, never deleted — silent deletion is what reduced a
    // multi-product business to a single vague area.
    const unverifiable = validateGroundedScope(
        [
            {
                name: "Invented Area",
                description: "A capability the site never mentions anywhere.",
                seed_keywords: ["invented area"],
                evidence: [{ url: "https://drawgle.com/", quote: "we also sell industrial beehives" }],
                source: "extracted",
            },
        ],
        pages,
        "https://drawgle.com",
        [],
    )
    assert.equal(unverifiable.families.length, 1, "unverified families must be kept, not deleted")
    assert.equal(unverifiable.families[0].verified, false)
    assert.ok(unverifiable.issues.some((issue) => /could not match/i.test(issue.message)))

    // Quote verification must survive paraphrase but still reject invention.
    const page = "turn any text prompt into a production ready mobile ui screen"
    assert.equal(verifyQuote("turn any text prompt into a production ready mobile ui screen", page), true)
    assert.equal(verifyQuote("turn any text prompt into a production-ready mobile UI screen today", page), true)
    assert.equal(verifyQuote("we manufacture industrial beehives for commercial apiaries", page), false)
})

test("scope extraction is its own call, not a field on the persona prompt", async () => {
    const [route, extraction] = await Promise.all([
        text("app/api/analyze-brand/route.ts"),
        text("lib/scope-extraction.ts"),
    ])

    // Scope was field 10 of an 11-field persona prompt that also produced
    // "Style DNA". The most consequential decision in the product must not
    // compete for attention with prose about tone of voice.
    assert.doesNotMatch(route, /Commercial Scope Families/)
    assert.match(route, /extractScopeFamilies\(/)
    assert.match(extraction, /gemini-3-flash-preview/)

    // Started before the persona await so the split costs no wall-clock time.
    assert.ok(
        route.indexOf("const scopePromise") < route.indexOf("const response = await client"),
        "scope extraction must start before the persona call is awaited",
    )
})

test("multi-table trigger functions dispatch on TG_TABLE_NAME before touching fields", async () => {
    // `guard_audit_snapshot_row` serves query_pool, audit_clusters and
    // planned_articles. Written as a flat chain:
    //
    //     IF    TG_TABLE_NAME = 'query_pool'     AND (NEW.query ...) THEN
    //     ELSIF TG_TABLE_NAME = 'audit_clusters' AND (NEW.name  ...) THEN
    //
    // PL/pgSQL prepares a branch's whole condition as one SQL statement when
    // that branch is reached, so `NEW.name` must resolve even though the table
    // check is false — and NEW is a query_pool record there:
    //
    //     ERROR: 42703: record "new" has no field "name"
    //
    // Latent from the day it shipped; it only fired the first time an UPDATE
    // touched a completed audit's rows. The table check must be its own IF.
    const names = (await readdir(path.join(root, "supabase/migrations")))
        .filter((name) => name.endsWith(".sql"))
        .sort()

    let effective = null
    for (const name of names) {
        const sql = await text(`supabase/migrations/${name}`)
        const at = sql.indexOf("CREATE OR REPLACE FUNCTION public.guard_audit_snapshot_row")
        if (at !== -1) effective = { name, body: sql.slice(at, sql.indexOf("$$;", at)) }
    }

    assert.ok(effective, "guard_audit_snapshot_row is not defined in any migration")
    assert.doesNotMatch(
        effective.body,
        /TG_TABLE_NAME\s*=\s*'\w+'\s*AND\s*\(/,
        `${effective.name}: flat TG_TABLE_NAME dispatch evaluates another table's columns`,
    )
    assert.match(effective.body, /IF\s+TG_TABLE_NAME\s*=\s*'query_pool'\s*THEN/)
})

test("every brand field the writer reads exists on BrandDetailsSchema", async () => {
    // `brandDetails.features` and `brandDetails.unique_value_proposition` were
    // read for months by the outline prompt. The real schema names are
    // `core_features` and `uvp`, so the model was handed "Features: N/A" and
    // "UVP: undefined" in the same block instructing it to position the product
    // against competitors. TypeScript could not catch it: brandDetails is typed
    // `any` in the prompt builders, so every access silently returns undefined.
    //
    // This closes that hole for good — the writer may only read fields the
    // schema actually declares.
    const [writer, schema] = await Promise.all([
        text("trigger/generate-blog.ts"),
        text("lib/schemas/brand.ts"),
    ])

    // Top-level keys declared on BrandDetailsSchema.
    const schemaBody = schema.slice(schema.indexOf("BrandDetailsSchema = z.object({"))
    const declared = new Set(
        [...schemaBody.matchAll(/^\s{2}([a-z_]+):\s/gm)].map((match) => match[1]),
    )
    assert.ok(declared.has("core_features"), "schema parse failed — expected core_features")
    assert.ok(declared.has("uvp"), "schema parse failed — expected uvp")
    assert.ok(declared.size > 10, `schema parse found only ${declared.size} fields`)

    // Strip comments first: prose explaining the bug names the very fields it
    // warns about, and a comment is not an access.
    const writerCode = writer
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "")

    const accessed = new Set(
        [...writerCode.matchAll(/brandDetails\??\.([a-z_]+)/g)].map((match) => match[1]),
    )
    assert.ok(accessed.size > 0, "found no brandDetails accesses — regex is wrong")

    const unknown = [...accessed].filter((field) => !declared.has(field)).sort()
    assert.deepEqual(
        unknown,
        [],
        `trigger/generate-blog.ts reads brand fields that BrandDetailsSchema does not declare: ` +
        `${unknown.join(", ")}. brandDetails is typed \`any\` there, so these return undefined ` +
        `silently and reach the model as the string "undefined".`,
    )

    // A missing brand fact must read as missing, never as "undefined" or blank.
    assert.match(writer, /const brandList = /)
    assert.match(writer, /'Not provided'/)
    for (const field of ["core_features", "pricing", "uvp", "how_it_works"]) {
        assert.match(
            writer,
            new RegExp(`brandList\\(brandDetails\\.${field}\\)`),
            `${field} must render through brandList so an empty value cannot render blank`,
        )
    }
})

test("no two articles in a cluster get the same intro shape", async () => {
    // Imported from lib/writer/composition.ts, not the trigger task: that file
    // uses "@/..." aliases which plain node cannot resolve.
    const { selectIntroPattern } = await import("../lib/writer/composition.ts")

    // INTRO_TEMPLATES mandated one fixed "GOLDEN ORDER" per article type, so
    // every article in a delivered cluster opened identically — definition,
    // bulleted list, "By the end of this guide...". Variety must be structural,
    // not a hope.
    const MAX_CLUSTER_ARTICLES = 15
    for (const clusterId of ["cluster-a", "d308da5a-af56-42fe-9bdc-9d5206b04538", ""]) {
        for (const type of ["informational", "commercial", "howto"]) {
            const seen = new Set()
            for (let position = 0; position < MAX_CLUSTER_ARTICLES; position++) {
                const pattern = selectIntroPattern(type, position, clusterId)
                const combo = `${pattern.framing}+${pattern.secondMove}`
                assert.ok(
                    !seen.has(combo),
                    `${type} in ${clusterId || "(no cluster)"}: position ${position} repeats "${combo}"`,
                )
                seen.add(combo)
            }
        }
    }

    // Deterministic: a retry must not change an article's opening.
    const first = selectIntroPattern("informational", 3, "cluster-a")
    const again = selectIntroPattern("informational", 3, "cluster-a")
    assert.deepEqual(first, again)

    // Answer-first is an INVARIANT, not one option among many. ~44% of AI
    // citations come from the first 30% of a page; a pattern that delays the
    // answer to build tension would cost citations.
    for (const type of ["informational", "commercial", "howto"]) {
        const { brief } = selectIntroPattern(type, 0, "c")
        assert.match(brief, /THE ANSWER \(first, always\)/)
        assert.match(brief, /NON-NEGOTIABLE/)
    }

    // The "By the end of this guide" promise was mandatory in all three old
    // templates and is the most recognisable tell. It must not come back.
    const informational = selectIntroPattern("informational", 0, "c").brief
    assert.match(informational, /Do not write one/)
    assert.match(informational, /never use the phrase "by the end of this guide"|by the end of this guide/i)

    // Rules decomposed out of INTRO_TEMPLATES must still exist somewhere.
    const writer = await text("trigger/generate-blog.ts")
    for (const preserved of [
        "Visual Speed Bumps",
        "3 lines",
        "Let's dive in",
        "Top 10 Best",
        "Getting started is easy",
    ]) {
        assert.ok(writer.includes(preserved), `invariant lost from INTRO_TEMPLATES: "${preserved}"`)
    }
})

test("the two protocol blocks stay distinct and headings are unique", async () => {
    const writer = await text("trigger/generate-blog.ts")

    // These govern completely different things and were only ever confusable
    // because they shared the "ANTI-FLUFF" name. Merging them would destroy
    // both. The citation block is renamed; neither block's rules change.
    for (const citationRule of [
        "NEVER CITE COMPETITORS",
        "SUPER-AUTHORITIES",
        "FIRST-PARTY",
    ]) {
        assert.ok(writer.includes(citationRule), `citation policy rule lost: ${citationRule}`)
    }
    for (const verbosityRule of ["THE STOP RULE", "DENSITY > LENGTH"]) {
        assert.ok(writer.includes(verbosityRule), `verbosity rule lost: ${verbosityRule}`)
    }
    assert.match(writer, /### 4\. CITATION & ATTRIBUTION POLICY/)
    assert.match(writer, /### 9\. ANTI-FLUFF PROTOCOL — LENGTH & DENSITY/)

    // Intro strategy must not be injected into every section's prompt.
    assert.match(writer, /\$\{isIntro \? introStrategy : ''\}/)

    // The intro must not be told the whole article is "already covered".
    assert.match(writer, /const isIntro = currentSectionIndex < 0/)
})

test("required links are retried in place, never appended as a callout", async () => {
    const { requiredLinksMissingFrom } = await import("../lib/writer/composition.ts")

    const section = {
        external_link: { url: "https://www.statista.com/photo-restoration" },
        internal_link: { url: "https://bringback.pro/blog/scanning" },
    }
    assert.deepEqual(requiredLinksMissingFrom("no links here", section).length, 2)
    assert.deepEqual(
        requiredLinksMissingFrom(
            "…as [industry data](https://www.statista.com/photo-restoration) shows, and " +
            "[scanning flat](https://bringback.pro/blog/scanning) avoids glare.",
            section,
        ),
        [],
    )
    // Only the destination is checked — the anchor is deliberately the writer's
    // choice so the link reads naturally.
    assert.deepEqual(requiredLinksMissingFrom("x", { external_link: null, internal_link: null }), [])

    const writer = await text("trigger/generate-blog.ts")
    assert.match(writer, /REWRITE — REQUIRED LINK WAS OMITTED/)
    assert.match(writer, /Do NOT append it as a trailing/)
    assert.match(writer, /BANNED CONSTRUCTIONS/)
    // The deterministic append must remain a last resort for frozen links only.
    assert.match(writer, /LAST RESORT, not the normal path/)
})

test("competitor URLs can never be offered as citation targets", async () => {
    const writer = await text("trigger/generate-blog.ts")

    // The research search uses the article's own keyword, so top results ARE
    // the ranking competitors. They reached `external_link`, where §4 forbids
    // citing them — the model resolved that contradiction by dropping the link.
    assert.match(writer, /forbiddenCitationHosts/)
    assert.match(writer, /clusterCompetitorUrls/)
    assert.match(writer, /competitorsDropped/)
    // Host comparison must be www-insensitive or the filter silently misses.
    assert.match(writer, /replace\(\/\^www\\\.\/, ""\)/)
})

test("sections only receive the product knowledge they were flagged as needing", async () => {
    const [writer, outlineSchema] = await Promise.all([
        text("trigger/generate-blog.ts"),
        text("lib/schemas/outline.ts"),
    ])

    // The writer had only product_name + audience — it could not describe how
    // the product works even when the section was entirely about that. That is
    // starvation, not overload, and it is also the only first-party originality
    // lever available against the unoriginal-content penalty.
    assert.match(outlineSchema, /needs_product_detail/)
    assert.match(outlineSchema, /product_aspect/)
    assert.match(outlineSchema, /is_comparison/)

    assert.match(writer, /currentSection\?\.needs_product_detail/)
    assert.match(writer, /FIRST-PARTY FACTS FOR THIS SECTION/)
    assert.match(writer, /COMPARISON REQUIREMENT/)
    // Must render through brandList so an empty field cannot print "undefined".
    assert.match(writer, /brandList\(brandDetails\[aspect\]\)/)
    // And must stay silent when the outline did not ask for it.
    assert.match(writer, /if \(!brandDetails \|\| !currentSection\?\.needs_product_detail\) return ""/)
    // The outline must be told the writer gets nothing unless it flags the section.
    assert.match(writer, /The writer receives NO product knowledge unless you flag it here/)
})

test("audit evidence reaches the writer and degrades safely without it", async () => {
    const [shipCluster, writer, dryRun] = await Promise.all([
        text("trigger/ship-cluster.ts"),
        text("trigger/generate-blog.ts"),
        text("app/api/writer/dry-run/route.ts"),
    ])

    // The audit's claim is that every query is real and traceable. Until this
    // was wired the writer never saw one: it received a title and keyword, then
    // re-researched the topic with a generic Tavily search, so the evidence the
    // customer paid for stopped at the plan.
    assert.match(shipCluster, /source_query_ids/)
    assert.match(shipCluster, /async function loadClusterEvidence/)
    for (const field of ["cluster:", "sourceQueries:", "clusterCompetitorUrls:", "isPillar:"]) {
        assert.ok(
            shipCluster.includes(field),
            `ship-cluster must forward ${field} in the generate-blog payload`,
        )
    }

    // Batched: two queries per cluster, not per article.
    assert.match(shipCluster, /\.in\("id", wantedIds\)/)

    // Losing enrichment must never block a paid cluster that is ready to run.
    assert.match(
        shipCluster,
        /catch \(evidenceError\)[\s\S]{0,220}return empty/,
        "loadClusterEvidence must degrade to empty rather than throw",
    )

    // Writer accepts them, and they are optional so a run without them behaves
    // exactly as before.
    assert.match(writer, /sourceQueries\?: string\[\]/)
    assert.match(writer, /sourceQueries = \[\]/)
    assert.match(writer, /clusterCompetitorUrls = \[\]/)
    assert.match(writer, /MEASURED SEARCH DEMAND/)
    // The whole block is conditional on evidence existing.
    assert.match(writer, /auditEvidence\.sourceQueries\?\.length \?/)
    // Pillar vs supporting must change the instruction, or cluster structure is
    // just a label.
    assert.match(writer, /auditEvidence\.isPillar \?/)
    // Never recommend the competitors we surface as ranking rivals.
    assert.match(writer, /never recommend them/)

    // The dry-run harness must assemble the prompt through the real builder,
    // or it proves nothing about production.
    assert.match(dryRun, /generateOutlineSystemPrompt\(/)
    assert.match(dryRun, /NODE_ENV === "production"/)
    // It must never call a paid provider or write anything.
    for (const forbidden of ["generateBlogPost.trigger", ".insert(", ".update("]) {
        assert.ok(
            !dryRun.includes(forbidden),
            `dry-run must not ${forbidden} — it is read-only by contract`,
        )
    }
})

test("the writer's other input surfaces fail loudly, not silently", async () => {
    const [writer, outlineSchema] = await Promise.all([
        text("trigger/generate-blog.ts"),
        text("lib/schemas/outline.ts"),
    ])
    const writerCode = writer
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "")

    // 1. THE OUTLINE is Zod-validated, so a renamed key throws instead of
    //    quietly producing empty sections. Every field the writer reads off it
    //    must therefore be declared, or validation passes and the read still
    //    returns undefined.
    const declared = new Set(
        [...outlineSchema.matchAll(/^\s+([a-z_]+):\s/gm)].map((match) => match[1]),
    )
    for (const extra of ["sections", "intro", "title"]) {
        assert.ok(declared.has(extra), `outline schema parse failed — missing ${extra}`)
    }
    const readOffSection = new Set(
        [...writerCode.matchAll(/\bsection\??\.([a-z_]+)/g)].map((match) => match[1]),
    )
    const unknownSection = [...readOffSection].filter(
        (field) => !declared.has(field) && field !== "length",
    ).sort()
    assert.deepEqual(
        unknownSection,
        [],
        `writer reads outline section fields not declared in ArticleOutlineSchema: ${unknownSection.join(", ")}`,
    )
    assert.match(writer, /cleanParseAndValidate\(outlineText, dynamicOutlineSchema/)

    // 2. FROZEN LINKS are a delivery contract: a cluster is withheld if the
    //    exact anchor and destination are not present as real anchors. The
    //    model omitting one must not cost a paid cluster, so the edge is
    //    appended deterministically before HTML is saved.
    assert.match(writer, /function ensureFrozenLinksInMarkdown/)
    assert.match(
        writer,
        /frozenLinks\.length > 0\s*\?\s*ensureFrozenLinksInMarkdown\(currentDraft, frozenLinks\)/,
        "the frozen-link safety net must remain wired into the final markdown path",
    )
    // ship-cluster sends { title: anchor_text }, and the anchor is derived from
    // `title`. If either side is renamed the contract breaks silently.
    assert.match(writer, /anchor: link\.title\.replace/)
    const shipCluster = await text("trigger/ship-cluster.ts")
    assert.match(shipCluster, /title: row\.anchor_text/)

    // 3. ANGLE INSIGHTS are enrichment. They must degrade to null, never
    //    half-apply or abort a paid generation.
    assert.match(
        writer,
        /catch[\s\S]{0,200}angleInsights = null/,
        "angle insights must fail closed to null rather than aborting generation",
    )
})

test("scope classification rejects undeliverable topics, not just irrelevant ones", async () => {
    // Imported from types.ts, not scope-classifier.ts: the classifier is
    // server-only and cannot be loaded under plain node.
    const { findThirdPartyBrand } = await import("../lib/harvest/types.ts")
    const classifier = await text("lib/harvest/scope-classifier.ts")

    // These ten titles all shipped into a real bringback.pro plan. Every one
    // passed provenance, demand, family relevance, cluster sizing and the
    // duplicate check — relevance was never the problem. Four name a third
    // party's product; six can only be answered by whoever published the page.
    const thirdPartyBranded = [
        "Using Adobe Firefly to Colorize and Restore Any Old Image",
        "Easy Steps to Scan and Upload Photos to Forever Studios",
        "How to Animate Faded Memories Using Fotor's AI Tools",
        "Using Clipfly AI to Quickly Add New People to Any Image",
    ]
    const publisherSpecific = [
        "Understanding Our Turnaround Times for Your Photo Projects",
        "Our Full List of Scannable Media: Photos, Film, and Beyond",
        "Items We Accept: From Slides and Negatives to Physical Prints",
        "Real Reviews: See What Our Clients Say About Their Restored Photos",
        "How We Protect Your Privacy and Uploaded Family Images",
        "Understanding Our Easy Cancellation Policy and Subscription Terms",
    ]

    // Both classes must exist as machine-readable decisions, so a drop can be
    // told apart from a merely-adjacent one in diagnostics.
    assert.match(classifier, /"third_party_branded"/)
    assert.match(classifier, /"publisher_specific"/)
    // Deliverability must outrank relevance, or an on-subject branded topic
    // still lands in the plan.
    assert.match(classifier, /Deliverability outranks relevance/)
    // The model needs the real examples; these classes are easy to get wrong
    // when described only in the abstract.
    for (const example of ["Adobe Firefly", "Turnaround Times", "Items We Accept"]) {
        assert.ok(
            classifier.includes(example),
            `classifier prompt must show a worked example containing "${example}"`,
        )
    }

    // The deterministic half: a query naming a crawled competitor is rejected
    // before it costs a classification token.
    const competitorTokens = ["foreverstudios", "pixreunion", "kinpict"]
    assert.equal(
        findThirdPartyBrand(
            "Easy Steps to Scan and Upload Photos to Forever Studios",
            competitorTokens,
        ),
        "foreverstudios",
        "a domain token must still match its spaced display form",
    )
    assert.equal(
        findThirdPartyBrand("Can I order prints through PixReunion?", competitorTokens),
        "pixreunion",
    )
    // The customer's own subject brand is never passed in, so their own name
    // can never be rejected as third-party.
    assert.equal(findThirdPartyBrand("bringback photo restoration", competitorTokens), null)
    assert.equal(findThirdPartyBrand("how to restore a faded photograph", competitorTokens), null)
    // Short tokens collide with ordinary words once spaces are stripped and are
    // deliberately left to the model.
    assert.equal(findThirdPartyBrand("best ai photo tools", ["ai"]), null)

    // Brands we never crawled (Adobe, Fotor, Clipfly appear only *on* competitor
    // pages) cannot be caught deterministically — that is exactly why the LLM
    // rule exists alongside this check.
    assert.equal(findThirdPartyBrand(thirdPartyBranded[0], competitorTokens), null)

    // Assembly must pass competitor tokens only — never the subject's own brand.
    const assembly = await text("lib/harvest/assembly.ts")
    assert.match(assembly, /brandTokensFromUrls\(input\.competitors\)/)
    assert.doesNotMatch(
        assembly,
        /classifyQueriesToScope\([\s\S]{0,200}excludeBrands/,
        "excludeBrands includes the subject's own brand and must not be reused as competitor tokens",
    )

    // A deliverability rejection must not suggest a family to reinstate into.
    assert.match(classifier, /assignment\.decision === "adjacent" \? familyId : null/)

    assert.ok(thirdPartyBranded.length === 4 && publisherSpecific.length === 6)
})

test("the demand check never blocks the brand-analysis response", async () => {
    // findSeedsWithoutDemand was awaited inline in POST /api/analyze-brand,
    // unbounded, over every seed across every extracted family (up to ~90 on a
    // multi-family brand) — a burst of near-simultaneous requests to an
    // undocumented, rate-limit-prone Google endpoint. Google throttled it, the
    // retry/backoff correctly waited out the throttle on each one, and
    // onboarding's "Analyzing..." screen hung for three minutes in production.
    const [analyzeBrandRoute, queryValidation, demandCheckRoute] = await Promise.all([
        text("app/api/analyze-brand/route.ts"),
        text("lib/harvest/query-validation.ts"),
        text("app/api/analyze-brand/demand-check/route.ts"),
    ])

    // Matches an import or a call, not the incident comment that names the
    // function to explain why it is deliberately absent from this file.
    assert.doesNotMatch(
        analyzeBrandRoute,
        /findSeedsWithoutDemand\(|import\s*\{[^}]*findSeedsWithoutDemand/,
        "app/api/analyze-brand/route.ts must not call the demand check inline — " +
        "it belongs in the separate, non-blocking /demand-check endpoint",
    )

    // Bounded concurrency and a hard input cap so a burst can never recur,
    // regardless of what any future caller passes in.
    assert.doesNotMatch(
        queryValidation,
        /Promise\.all\(\s*testable\.map/,
        "findSeedsWithoutDemand must use bounded concurrency (mapWithConcurrency), not a raw Promise.all",
    )
    assert.match(queryValidation, /mapWithConcurrency\(testable,/)
    assert.match(queryValidation, /MAX_SEEDS_PER_DEMAND_CHECK/)
    assert.match(queryValidation, /\.slice\(0, MAX_SEEDS_PER_DEMAND_CHECK\)/)

    // The endpoint must fail open — a slow or broken Google Suggest must never
    // surface as a user-visible error, only as the absence of a badge.
    assert.match(demandCheckRoute, /catch/)
    assert.match(demandCheckRoute, /seedsWithoutDemand:\s*\[\]/)

    for (const [file, client] of [
        ["app/(onboarding)/onboarding/page.tsx", await text("app/(onboarding)/onboarding/page.tsx")],
        ["components/brand-onboarding.tsx", await text("components/brand-onboarding.tsx")],
    ]) {
        assert.match(
            client,
            /\/api\/analyze-brand\/demand-check/,
            `${file}: must call the decoupled demand-check endpoint`,
        )
        // setBrandData must not be waiting on the demand-check fetch — the
        // fetch call must appear strictly after setBrandData(data) is invoked,
        // not be awaited before it.
        const setBrandDataIdx = client.indexOf("setBrandData(data)")
        const demandFetchIdx = client.indexOf("/api/analyze-brand/demand-check")
        assert.ok(setBrandDataIdx !== -1 && demandFetchIdx !== -1)
        assert.ok(
            setBrandDataIdx < demandFetchIdx,
            `${file}: setBrandData must render before the demand-check fetch starts`,
        )
    }
})

test("guard_audit_snapshot_row's effective search_path resolves pgvector", async () => {
    // CREATE OR REPLACE FUNCTION overwrites a function's search_path along with
    // its body. 20260731 added the pgvector extension schema so this trigger
    // could compare `embedding` values with IS DISTINCT FROM. 20260801 then
    // re-emitted the same function, to add a discard escape hatch, with a bare
    // `public` — silently undoing that fix in production:
    //
    //   assert_harvest_schema_ready() -> 'cannot resolve pgvector: guard_audit_snapshot_row'
    //   POST /api/topical-audit       -> 503 'temporarily unavailable'
    //
    // Any migration that re-declares this function must be followed —
    // anywhere later in file-sorted order, same file or a later one — by an
    // ALTER restoring the vector-visible search_path.
    const names = (await readdir(path.join(root, "supabase/migrations")))
        .filter((name) => name.endsWith(".sql"))
        .sort()

    let lastEvent = null

    for (const name of names) {
        const sql = await text(`supabase/migrations/${name}`)
        const events = []

        for (const match of sql.matchAll(
            /CREATE OR REPLACE FUNCTION public\.guard_audit_snapshot_row\(\)[\s\S]*?SET search_path\s*=\s*([^\n]+)\nAS \$\$/g,
        )) {
            events.push({ index: match.index, kind: "create", searchPath: match[1].trim() })
        }
        for (const match of sql.matchAll(
            /ALTER FUNCTION public\.guard_audit_snapshot_row\(\)\s+SET search_path/g,
        )) {
            events.push({ index: match.index, kind: "alter" })
        }
        for (const match of sql.matchAll(
            /format\(\s*['"]ALTER FUNCTION public\.guard_audit_snapshot_row\(\) SET search_path/g,
        )) {
            events.push({ index: match.index, kind: "alter-dynamic" })
        }

        events.sort((a, b) => a.index - b.index)
        for (const event of events) lastEvent = { file: name, ...event }
    }

    assert.ok(lastEvent, "guard_audit_snapshot_row is never defined or altered by any migration")
    if (lastEvent.kind === "create") {
        assert.notEqual(
            lastEvent.searchPath.replace(/\s+/g, ""),
            "public",
            `${lastEvent.file}: guard_audit_snapshot_row was (re-)declared with a bare "public" ` +
            `search_path and nothing after it restores the pgvector schema — this exact ` +
            `regression broke every audit in production`,
        )
    }
})

test("every pivot migration survives being re-run", async () => {
    // A migration is not write-once. It gets pasted into the SQL editor twice,
    // replayed onto a fresh branch, or run against a database that is already
    // ahead of it. `20260728_harvest_pool.sql` carried a bare
    //
    //     COMMENT ON COLUMN topical_audits.niche_blueprint IS '...'
    //
    // and `20260730_closed_pool_v2.sql` later dropped that column, so re-running
    // the earlier file aborted the entire script with
    // `ERROR: 42703: column "niche_blueprint" ... does not exist`.
    // Scan the directory rather than a hardcoded list. A list silently stops
    // covering migrations added after it was written, which is the same shape
    // of hole as the bug it is here to catch.
    const names = await readdir(path.join(root, "supabase/migrations"))
    const files = names
        .filter((name) => /^2026(07|08|09|1[012])/.test(name) && name.endsWith(".sql"))
        .map((name) => `supabase/migrations/${name}`)

    assert.ok(files.length >= 4, "expected the pivot migrations to be discovered")

    for (const file of files) {
        const sql = await text(file)

        const unguarded = []
        for (const line of sql.split("\n")) {
            // Indented statements live inside a DO $$ ... $$ existence check.
            if (/^COMMENT ON /.test(line)) unguarded.push(line.trim())
            if (/^CREATE TABLE (?!IF NOT EXISTS)/.test(line)) unguarded.push(line.trim())
            if (/^CREATE (UNIQUE )?INDEX (?!IF NOT EXISTS)/.test(line)) unguarded.push(line.trim())
            if (/^CREATE TYPE /.test(line)) unguarded.push(line.trim())
        }
        assert.deepEqual(unguarded, [], `${file}: statement is not safe to re-run`)

        // CREATE TRIGGER has no IF NOT EXISTS, so each one needs a preceding drop.
        for (const [, name] of sql.matchAll(/^CREATE TRIGGER (\w+)/gm)) {
            assert.ok(
                sql.includes(`DROP TRIGGER IF EXISTS ${name} `),
                `${file}: CREATE TRIGGER ${name} has no DROP TRIGGER IF EXISTS`,
            )
        }
    }
})

test("every tier divides the six-cluster scope into whole billing periods", async () => {
    // The invariant is documented at the top of config/product-truth.ts but was
    // never enforced, and it has already been violated once in production copy:
    // Dominate shipped 4 clusters/month, leaving a half-empty second period that
    // charged a full month for two clusters and made the fastest tier the most
    // expensive overall. A comment did not stop that; a test does.
    const source = await text("config/product-truth.ts")

    const total = Number(source.match(/programClusters:\s*(\d+)/)?.[1])
    assert.ok(total > 0, "programClusters not found")

    const tiers = [
        ...source.matchAll(
            /(\w+):\s*\{[^}]*?clustersPerMonth:\s*(\d+)[^}]*?billingPeriods:\s*(\d+)/gs,
        ),
    ]
    assert.equal(tiers.length, 3, "expected three tiers")

    for (const [, name, perMonth, periods] of tiers) {
        assert.equal(
            Number(perMonth) * Number(periods),
            total,
            `${name}: ${perMonth}/month x ${periods} periods must equal ${total} clusters`,
        )
    }
})

test("every base closed-pool column has a reconciling ALTER", async () => {
    const [base, reconcile] = await Promise.all([
        text("supabase/migrations/20260728_harvest_pool.sql"),
        text("supabase/migrations/20260730_reconcile_harvest_columns.sql"),
    ])

    // The base migration uses CREATE TABLE IF NOT EXISTS, so any column added
    // to it later never reaches a database that already has the table. That is
    // how a build shipped referencing query_pool.observed_value against a
    // schema without it — discovered only at write time, after a full audit.
    assert.match(base, /DO NOT EDIT THIS FILE/)

    const structural = new Set([
        "id", "user_id", "brand_id", "query", "query_norm", "source",
        "title", "main_keyword", "cluster_id", "name", "status",
        "created_at", "updated_at", "started_at", "embedding", "article_id",
    ])

    const missing = []
    for (const match of base.matchAll(
        /CREATE TABLE IF NOT EXISTS (\w+) \(([\s\S]*?)\n\);/g,
    )) {
        const [, table, body] = match
        for (const line of body.split("\n")) {
            const column = line.trim().match(/^([a-z_]+)\s+[A-Z]/)
            if (!column) continue
            const name = column[1]
            if (structural.has(name)) continue
            if (!reconcile.includes(`${table} ADD COLUMN IF NOT EXISTS ${name} `)) {
                missing.push(`${table}.${name}`)
            }
        }
    }

    assert.deepEqual(
        missing,
        [],
        "add these to 20260730_reconcile_harvest_columns.sql so existing databases converge",
    )
})

test("near-duplicate articles are rejected directly, not via the collapse ratio", async () => {
    const [assembly, clusterer, policy] = await Promise.all([
        text("lib/harvest/assembly.ts"),
        text("lib/harvest/clusterer.ts"),
        text("lib/harvest/policy.ts"),
    ])

    // The real invariant: two article units may never survive above the merge
    // threshold, because that is the only way a customer receives two articles
    // about the same thing.
    assert.match(clusterer, /export function findDuplicateArticlePairs/)

    // The merge loop must absorb EVERY near-duplicate. It used to `break` at
    // MAX_SUPPORTING_KEYWORDS, leaving the overflow unassigned — and an
    // unassigned query becomes its own article, so eight identical phrasings
    // shipped as one article plus three duplicates of it.
    assert.doesNotMatch(
        clusterer,
        /supporting\.length >= MAX_SUPPORTING_KEYWORDS\) break/,
        "the merge loop must not stop scanning at the supporting-keyword cap",
    )
    assert.match(clusterer, /const absorbed: GapItem\[\] = \[\]/)
    assert.match(clusterer, /const members = \[gap, \.\.\.supporting, \.\.\.absorbed\]/)

    // Business and language relevance are a positive assignment to a
    // customer-confirmed family. A growing language/keyword blacklist would
    // encode one incident at a time and fail on the next industry or locale.
    const [assemblySource, classifier, queryTypes] = await Promise.all([
        text("lib/harvest/assembly.ts"),
        text("lib/harvest/scope-classifier.ts"),
        text("lib/harvest/types.ts"),
    ])
    await assert.rejects(
        access(path.join(root, "lib/harvest/language-filter.ts")),
    )
    assert.doesNotMatch(assemblySource, /filterByLanguage/)
    assert.match(assemblySource, /filterToSearchedQueries\(deduped/)
    assert.match(assemblySource, /classifyQueriesToScope/)
    assert.match(classifier, /positive business-scope assignment/i)
    assert.match(classifier, /same language as at least one confirmed search phrase/i)
    assert.doesNotMatch(queryTypes, /NON_QUERY_PATTERNS|CONTENTLESS_WORDS/)
    assert.match(assembly, /findDuplicateArticlePairs\(/)
    assert.match(
        assembly,
        /articleUnits\.filter\([\s\S]{0,160}?article\.scopeFamilyId === family\.id/,
    )
    assert.match(assembly, /"duplicate_articles"/)

    // Collapse ratio must NOT gate on the expected band. It measures a niche's
    // phrasing redundancy, not clustering quality — a healthy 13-cluster audit
    // was rejected at 48.4% because its competitors published many FAQ pages.
    assert.match(policy, /collapseCeiling:\s*0\.80/)
    assert.match(policy, /collapseExpectedMin:\s*0\.25/)
    assert.match(policy, /collapseExpectedMax:\s*0\.55/)
    assert.doesNotMatch(policy, /collapseMin:|collapseMax:/)
    assert.match(assembly, /collapseRatio > HARVEST_POLICY\.collapseCeiling/)
    // The expected band may only warn.
    assert.match(
        assembly,
        /collapseExpectedMin[\s\S]{0,400}?console\.warn/,
    )
})

test("confirmed business scope is the only production relevance contract", async () => {
    const [
        analysis,
        onboarding,
        review,
        auditRoute,
        assembly,
        production,
        queryTypes,
        migration,
        prospectRoute,
        brandActions,
        demandFilter,
    ] = await Promise.all([
        text("app/api/analyze-brand/route.ts"),
        text("app/(onboarding)/onboarding/page.tsx"),
        text("components/onboarding/scope-family-review.tsx"),
        text("app/api/topical-audit/route.ts"),
        text("lib/harvest/assembly.ts"),
        text("lib/harvest/run-harvest.ts"),
        text("lib/harvest/types.ts"),
        text("supabase/migrations/20260731_confirmed_business_scope.sql"),
        text("app/api/founder/prospect-audits/route.ts"),
        text("actions/brand.ts"),
        text("lib/harvest/query-validation.ts"),
    ])

    assert.match(analysis, /Founder-provided target searches/)
    // Scope extraction moved out of the persona prompt into its own call.
    const scopeExtraction = await text("lib/scope-extraction.ts")
    assert.match(scopeExtraction, /Identify every distinct thing this business sells/)
    assert.match(scopeExtraction, /EXACT sentence copied character-for-character/)
    // The question must ask for search phrases. "What should this audit help you
    // become known for" asked for brand positioning, so founders supplied
    // positioning and the audit researched the wrong thing.
    assert.match(onboarding, /What do people type into Google to find a tool like yours/)
    assert.match(onboarding, /Find my business areas/)
    assert.match(onboarding, /<ScopeFamilyReview/)
    assert.match(onboarding, /onboarding_competitors/)
    assert.match(review, /Rename, remove,[\s\S]*add, or reorder/)
    assert.match(review, /Why we found this area/)

    const snapshotWrite = auditRoute.indexOf(
        '"create_customer_audit_with_scope"',
    )
    const queue = auditRoute.indexOf("tasks.trigger")
    assert.ok(snapshotWrite >= 0 && snapshotWrite < queue)
    assert.match(assembly, /scopeFamilies:\s*AuditScopeFamily\[\]/)
    assert.match(assembly, /classifyQueriesToScope/)
    assert.doesNotMatch(assembly, /\bbrandContext\b|\bexcludeContext\b/)
    assert.doesNotMatch(
        assembly,
        /input\.competitors[\s\S]{0,80}?\.slice\(/,
    )
    assert.doesNotMatch(production, /deriveSeeds/)
    assert.doesNotMatch(queryTypes, /NON_QUERY_PATTERNS|CONTENTLESS_WORDS/)
    for (const retiredFilter of [
        "lib/harvest/pool.ts",
        "lib/harvest/niche-filter.ts",
        "lib/harvest/language-filter.ts",
    ]) {
        await assert.rejects(access(path.join(root, retiredFilter)))
    }

    for (const table of ["query_pool", "audit_clusters", "planned_articles"]) {
        assert.ok(
            migration.includes(`ALTER TABLE public.${table}`),
            `${table} has no scope migration`,
        )
    }
    assert.match(migration, /ALTER COLUMN scope_family_id SET NOT NULL/)
    assert.match(migration, /Query references scope outside its audit/)
    assert.match(migration, /Article references a cluster outside its confirmed scope/)
    assert.match(migration, /Business scope cannot change while an audit is running/)
    assert.match(
        migration,
        /create_customer_audit_with_scope[\s\S]*?FOR UPDATE[\s\S]*?An audit is already running for this brand/,
    )
    assert.match(migration, /Completed audit scope contract is immutable/)
    assert.match(migration, /guard_completed_row_scope_family/)
    assert.match(migration, /scope_hash = v_audit\.scope_hash/)
    assert.match(migration, /create_scoped_prospect_audit/)
    assert.match(prospectRoute, /\.rpc\("create_scoped_prospect_audit"/)
    assert.match(migration, /save_onboarding_brand_with_scope/)
    assert.match(migration, /ta\.subject_url IS DISTINCT FROM p_website_url/)
    assert.match(migration, /ta\.input_competitors/)
    assert.match(
        brandActions,
        /\.rpc\(\s*"save_onboarding_brand_with_scope"/,
    )
    assert.doesNotMatch(
        prospectRoute,
        /rawFamilies[\s\S]{0,120}?\.slice\(/,
    )
    assert.match(demandFilter, /\\p\{L\}\\p\{N\}/)
})

test("database migration encodes immutable audit, graph, billing, claim, and delivery invariants", async () => {
    const migration = await text(
        "supabase/migrations/20260730_closed_pool_v2.sql",
    )
    const required = [
        "query_pool_audit_query_norm_key",
        "guard_completed_audit_run",
        "guard_audit_snapshot_row",
        "guard_brand_audit_subject",
        "The website cannot change while a finite program is active or paused",
        "The current audit must be a completed immutable run owned by this website",
        "finalize_audit_run",
        "ON DELETE RESTRICT",
        "program_clusters_sold_once",
        "programs_dodo_subscription_key",
        "subscription_period_grants",
        "program_cost_events",
        "UNIQUE(dodo_subscription_id, period_start)",
        "UNIQUE(planned_article_id)",
        "deliver_program_cluster",
        "Pillar-to-leaf graph is incomplete",
        "Leaf-to-pillar graph is incomplete",
        "Sibling graph is incomplete",
        "create_prospect_audit",
        "claim_prospect_audit",
        "claim_email_normalized",
        "scope_delivered",
        'DROP POLICY IF EXISTS "Users manage own planned_articles"',
        'CREATE POLICY "Users read own planned articles"',
        'DROP POLICY IF EXISTS "Users can update own articles"',
    ]
    for (const invariant of required) {
        assert.ok(
            migration.includes(invariant),
            `migration is missing ${invariant}`,
        )
    }
})

test("webhook and scheduler preserve finite lifecycle semantics", async () => {
    const [webhook, scheduler, billing, restore] = await Promise.all([
        text("app/api/dodopayments/webhook/route.ts"),
        text("trigger/ship-cluster.ts"),
        text("lib/harvest/billing-lifecycle.ts"),
        text("app/api/dodopayments/subscription/restore/route.ts"),
    ])
    const updatedBlock = webhook.slice(webhook.indexOf("subscription.updated"))
    assert.doesNotMatch(updatedBlock, /grantBillingPeriodOnce/)
    assert.doesNotMatch(updatedBlock, /scheduled_for/)
    assert.match(webhook, /program\?\.scope_status !== 'scope_delivered'/)
    assert.match(webhook, /Payment may arrive before subscription\.activated/)
    assert.match(webhook, /\.in\('status', \['checkout_created', 'provisioned'\]\)/)
    assert.match(scheduler, /cron:\s*"0 \* \* \* \*"/)
    assert.match(scheduler, /queue:\s*\{\s*concurrencyLimit:\s*1\s*\}/)
    assert.match(scheduler, /idempotencyKey:\s*`\$\{planned\.id\}:\$\{nextRetryCount\}`/)
    assert.match(scheduler, /scope_status === "paused"/)
    assert.match(scheduler, /\["active", "error", "request_pending"\]/)
    assert.match(scheduler, /consume_program_credit/)
    assert.match(scheduler, /deliver_program_cluster/)
    assert.match(billing, /cancel_at_next_billing_date:\s*true/)
    assert.match(billing, /Remain request_pending until a Dodo webhook confirms/)
    assert.match(
        await text("supabase/migrations/20260730_closed_pool_v2.sql"),
        /v_clusters_remaining = 0[\s\S]*scope_status = 'scope_delivered'/,
    )
    assert.match(
        await text("supabase/migrations/20260730_closed_pool_v2.sql"),
        /Confirm the publication URL pattern and frozen link graph before resuming/,
    )
    assert.match(restore, /scope_status', 'scope_delivered'/)
})

test("retired jobs and unsupported public surfaces cannot remain active", async () => {
    const proxy = await text("proxy.ts")
    for (const route of [
        "/compare",
        "/solutions",
        "/tools",
        "/case-studies",
        "/blog/boost-ecommerce-ai-search-visibility",
        "/api/shopify/",
        "/api/webflow/",
        "/features/undetectable-ai-content",
        "/features/one-click-article-writer",
    ]) {
        assert.ok(proxy.includes(route), `retired route is missing: ${route}`)
    }
    for (const removedFile of [
        "trigger/generate-plan.ts",
        "trigger/scheduler.ts",
        "trigger/gsc-sync.ts",
        "trigger/seo-health.ts",
    ]) {
        await assert.rejects(access(path.join(root, removedFile)))
    }
    const lifecycle = await text("trigger/ship-cluster.ts")
    assert.equal((lifecycle.match(/schedules\.task/g) || []).length, 1)
    assert.match(
        await text("app/sitemap.ts"),
        /boost-ecommerce-ai-search-visibility/,
    )

    for (const retiredApi of [
        "app/api/content-plan/sync-links/route.ts",
        "app/api/shopify/publish/route.ts",
        "app/api/webflow/publish/route.ts",
        "app/api/credits/check/route.ts",
        "app/api/deduct-credits/route.ts",
        "app/api/generate/route.ts",
        "app/api/pillar-pages/route.ts",
    ]) {
        const route = await text(retiredApi)
        assert.match(route, /status:\s*410/, `${retiredApi} is not retired`)
    }
})

test("active product copy has no retired contract claims", async () => {
    const activeFiles = [
        "app/page.tsx",
        "app/about/page.tsx",
        "app/pricing/page.tsx",
        "app/features/page.tsx",
        "app/features/data.ts",
        "app/llms.txt/route.ts",
        "config/seo.ts",
        "config/product-truth.ts",
        "components/blog-cta-banner.tsx",
        "components/landing/CTASection.tsx",
        "components/landing/FeaturesSection.tsx",
        "components/landing/FounderNote.tsx",
        "components/landing/Hero.tsx",
        "components/landing/HowItWorksSection.tsx",
        "components/landing/Navbar.tsx",
        "components/landing/PricingSection.tsx",
        "components/landing/Footer.tsx",
        "components/audit/scope-results.tsx",
        "components/subscribe/ProgramCheckout.tsx",
    ]
    const forbidden = [
        /\$79\b/i,
        /\b30 articles(?:\s*\/\s*month|\s+per\s+month)?\b/i,
        /\bendless autopilot\b/i,
        /\bguaranteed E-E-A-T\b/i,
        /\bforces structured data\b/i,
        /\bniche (?:complete|closed)\b/i,
        /\bevery gap closed\b/i,
        /\bclaim my 2 free articles\b/i,
        /\byour first two articles are on me\b/i,
        /\bget cited by\b/i,
        /\b(?:become|becoming) (?:the )?(?:AI(?:'s)? )?source of truth\b/i,
        /\bpublish content\b[\s\S]{0,20}\bon autopilot\b/i,
        /\bcoverage is complete\b/i,
        /\btopic is genuinely yours\b/i,
        /\bShopify\b/i,
        /\bWebflow\b/i,
    ]
    for (const file of activeFiles) {
        const source = await text(file)
        for (const pattern of forbidden) {
            assert.doesNotMatch(source, pattern, `${file} contains ${pattern}`)
        }
    }
})

test("the public buyer is founder-led B2B SaaS and signup credits are retired", async () => {
    const [hero, founderNote, seo, migration, auditRoute, harvestPolicy] = await Promise.all([
        text("components/landing/Hero.tsx"),
        text("components/landing/FounderNote.tsx"),
        text("config/seo.ts"),
        text("supabase/migrations/20260730_retire_free_signup_credits.sql"),
        text("app/api/topical-audit/route.ts"),
        text("lib/harvest/policy.ts"),
    ])

    assert.match(hero, /FOR FOUNDER-LED B2B SAAS/)
    assert.match(founderNote, /full evidence audit is on me/i)
    assert.match(seo, /founder-led B2B SaaS/i)
    assert.match(migration, /ALTER COLUMN credits SET DEFAULT 0/)
    assert.match(migration, /ALTER COLUMN credits_remaining SET DEFAULT 0/)
    assert.match(migration, /subscription_period_grants/)
    assert.match(migration, /guard_legacy_credit_mirror/)
    assert.match(migration, /c\.credits <= 2/)
    assert.match(harvestPolicy, /checkoutFreshnessDays:\s*30/)
    assert.match(auditRoute, /HARVEST_POLICY\.checkoutFreshnessDays/)
    assert.match(auditRoute, /\.eq\("requires_reaudit", false\)/)
    assert.match(auditRoute, /reused:\s*true/)
})

test("audit schema drift fails before an expensive task is queued", async () => {
    const [route, migration] = await Promise.all([
        text("app/api/topical-audit/route.ts"),
        text("supabase/migrations/20260730_fix_finalize_vector_search_path.sql"),
    ])

    const readinessCall = route.indexOf('"assert_harvest_schema_ready"')
    const taskTrigger = route.indexOf("tasks.trigger")
    assert.ok(readinessCall >= 0, "audit route does not run the schema preflight")
    assert.ok(taskTrigger > readinessCall, "audit task is queued before schema readiness")
    assert.match(route, /No audit was started/)
    assert.match(migration, /pg_extension/)
    assert.match(migration, /ALTER FUNCTION public\.finalize_audit_run/)
    assert.match(migration, /SET search_path = public, %I/)
    assert.match(migration, /query_pool\.embedding is not pgvector/)
    assert.match(
        migration,
        /GRANT EXECUTE ON FUNCTION public\.assert_harvest_schema_ready\(\)/,
    )
})

test("onboarding uses a focused authenticated shell outside the dashboard sidebar", async () => {
    await assert.rejects(
        access(path.join(root, "app/(protected)/onboarding/page.tsx")),
    )
    const [layout, page, consent] = await Promise.all([
        text("app/(onboarding)/layout.tsx"),
        text("app/(onboarding)/onboarding/page.tsx"),
        text("components/CookieConsent.tsx"),
    ])
    assert.match(layout, /supabase\.auth\.getUser\(\)/)
    assert.match(layout, /redirect\("\/login\?next=\/onboarding"\)/)
    assert.doesNotMatch(layout, /AppSidebar|SidebarProvider|DynamicBreadcrumb/)
    assert.doesNotMatch(layout, /<header|border-b/)
    // The "Leave setup" link back to /content-plan was deliberately removed.
    // What the shell must still guarantee is an exit that is not the browser
    // back button, so sign-out is now the pinned escape hatch.
    assert.match(layout, /async function handleSignOut\(\): Promise<void>/)
    assert.match(layout, /form action=\{handleSignOut\}/)
    assert.match(page, /min-h-\[calc\(100vh-5rem\)\]/)
    assert.match(consent, /isFocusedOnboarding/)
    assert.match(consent, /\["do", "chat:hide"\]/)
})

test("the completed audit remains inspectable before purchase", async () => {
    const [
        accessAction,
        auditPage,
        contentPlan,
        scopeResults,
        publicAudit,
        sidebar,
        subscribe,
    ] = await Promise.all([
        text("actions/onboarding.ts"),
        text("app/(protected)/audit/page.tsx"),
        text("app/(protected)/content-plan/page.tsx"),
        text("components/audit/scope-results.tsx"),
        text("app/audit/[token]/page.tsx"),
        text("components/dashboard/app-sidebar.tsx"),
        text("app/(protected)/subscribe/page.tsx"),
    ])

    assert.match(accessAction, /currentStep === "audit"/)
    assert.match(accessAction, /currentStep === "audit-results"/)
    assert.match(accessAction, /redirectTo: "\/audit"/)
    assert.doesNotMatch(accessAction, /redirectTo: "\/content-plan"/)

    for (const source of [auditPage, contentPlan]) {
        assert.match(source, /getAuditScope/)
        assert.match(source, /getGapEvidence/)
        assert.match(source, /getPlannedArticles/)
        assert.match(source, /articles=\{articles\}/)
    }

    assert.match(scopeResults, /Your six-cluster program/)
    assert.match(scopeResults, /Expand all articles/)
    assert.match(scopeResults, /sourceQueryIds/)
    assert.match(scopeResults, /source-linked/)
    assert.match(scopeResults, /Show all \$\{gaps\.length\} evidence rows/)
    assert.match(publicAudit, /from\("planned_articles"\)/)
    assert.match(publicAudit, /articles=\{data\.articles\}/)
    assert.match(sidebar, /title: "Evidence Audit"/)
    assert.match(sidebar, /url: "\/audit"/)
    assert.match(subscribe, /href="\/audit"/)
})

test("checkout remains disabled by default and consent gates optional analytics", async () => {
    const [checkout, consent, layout] = await Promise.all([
        text("app/api/dodopayments/checkout/route.ts"),
        text("components/CookieConsent.tsx"),
        text("app/layout.tsx"),
    ])
    assert.match(
        checkout,
        /process\.env\.CLOSED_POOL_CHECKOUT_ENABLED !== "true"/,
    )
    assert.match(consent, /analytics/)
    assert.match(consent, /support/)
    assert.match(consent, /localStorage/)
    assert.doesNotMatch(layout, /GoogleAnalytics/)
    assert.doesNotMatch(layout, /clarity\.start/)
    assert.match(
        await text("lib/harvest/purchase-intent.ts"),
        /plan price does not match the product contract/,
    )
})

test("WordPress publication fails closed on a missing or changed frozen permalink", async () => {
    const route = await text("app/api/wordpress/publish/route.ts")
    assert.match(route, /!returnedUrl/)
    assert.match(route, /WordPress changed the permalink while publishing/)
    assert.match(route, /updatePostStatus\(credentials, result\.post!\.id, "draft"\)/)
})

test("program generation records provider usage for the manual margin gate", async () => {
    const [writer, accounting] = await Promise.all([
        text("trigger/generate-blog.ts"),
        text("lib/harvest/cost-accounting.ts"),
    ])
    assert.match(writer, /trackGeminiClient/)
    assert.match(writer, /trackTavilyClient/)
    assert.match(writer, /costCollector\.recordRequest\("fal"/)
    assert.match(writer, /costCollector\.persist/)
    assert.match(writer, /onFailure:/)
    assert.match(writer, /generation_task_failed/)
    assert.match(
        writer,
        /markdown\.includes\(`\[\$\{link\.anchor\}\]\(<\$\{link\.url\}>\)`\)/,
    )
    assert.match(accounting, /PROGRAM_COST_RATES_JSON/)
    assert.match(accounting, /input_units/)
    assert.match(accounting, /output_units/)
    assert.match(accounting, /usage_complete/)
    assert.match(accounting, /usage_unavailable/)
    assert.match(accounting, /cost_usd/)
})
