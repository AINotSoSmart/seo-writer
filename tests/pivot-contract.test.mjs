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
import {
    capabilityFactIdsForOperation,
    selectIntentSizedLength,
} from "../lib/writer/article-contract.ts"
import { selectRepresentativeBrandUrls } from "../lib/brand/representative-pages.ts"
import { normalizeContractOutline } from "../lib/writer/section-packet.ts"
import {
    articleQualityVerdict,
    countProseWords,
    firstPartyClaimCandidates,
    removeSentences,
    truncationReason,
} from "../lib/writer/draft-quality.ts"
import { isEvidenceQuoteSupported, isKnownCompetitorUrl } from "../lib/writer/research-evidence.ts"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const text = (relativePath) =>
    readFile(path.join(root, relativePath), "utf8")

const ONBOARDING_ROUTE = "app/(onboarding)/onboarding/page.tsx"
const ONBOARDING_STEPS_DIR = "components/onboarding/steps"

/**
 * The whole onboarding surface: the route plus every step screen it renders.
 *
 * COPY AND JSX ASSERTIONS MUST READ THIS, never `page.tsx` alone. The route was
 * a single 1,300-line component holding five screens; splitting it is the right
 * move, but a test that greps one file turns every extraction into a silent
 * assertion loss — the string is still on screen, the test just stopped looking
 * at the file it moved to. Reading the directory makes the assertion about what
 * the user sees rather than about where a developer happened to put it.
 *
 * Assertions about the route's OWN behaviour — its state machine, storage keys,
 * recovery effects — keep reading `page.tsx` directly, because that is exactly
 * what they are about.
 */
async function onboardingSurface() {
    let stepFiles = []
    try {
        stepFiles = (await readdir(path.join(root, ONBOARDING_STEPS_DIR)))
            .filter((name) => name.endsWith(".tsx"))
            .sort()
    } catch {
        // Not split yet. The route alone is the whole surface.
    }
    const parts = await Promise.all([
        text(ONBOARDING_ROUTE),
        ...stepFiles.map((name) => text(`${ONBOARDING_STEPS_DIR}/${name}`)),
    ])
    return parts.join("\n")
}

test("brand analysis selects a bounded, diverse product corpus", () => {
    const bringBack = selectRepresentativeBrandUrls(
        "https://bringback.pro",
        [
            "https://bringback.pro/pricing",
            "https://bringback.pro/features/old-photo-restoration",
            "https://bringback.pro/features/animate-old-photos",
            "https://bringback.pro/add-person-to-photo",
            "https://bringback.pro/features/family-portrait",
            "https://bringback.pro/blog/photo-tips",
            "https://bringback.pro/privacy",
        ],
        ["old photo restoration", "animate old photos", "add person to photo"],
    )
    assert.ok(bringBack.includes("https://bringback.pro/add-person-to-photo"))
    assert.ok(bringBack.includes("https://bringback.pro/pricing"))
    assert.ok(!bringBack.some((url) => url.includes("/blog/") || url.includes("privacy")))

    const ecommerce = selectRepresentativeBrandUrls(
        "https://shop.example",
        [
            ...Array.from({ length: 100 }, (_, index) => `https://shop.example/products/item-${index}`),
            "https://shop.example/pricing",
            "https://shop.example/solutions/wholesale",
            "https://shop.example/docs/api",
            "https://shop.example/features/inventory",
        ],
        ["ecommerce inventory api"],
    )
    assert.ok(ecommerce.length <= 8)
    assert.ok(ecommerce.filter((url) => url.includes("/products/")).length <= 2)
    assert.ok(ecommerce.some((url) => url.includes("/docs/api")))
    assert.ok(ecommerce.some((url) => url.includes("/features/inventory")))
})

test("section packets own every intent once and bind only matching evidence", () => {
    const intent = (queryId, factId) => ({
        queryId, query: queryId, sourceUrl: "https://source.example", sourceContext: queryId,
        operationKey: "op", capabilityFit: "explicit", capabilityFactIds: [factId],
    })
    const contract = {
        version: "article-contract-v1",
        entity: { name: "Example", entityType: "software", deliveryMode: "browser software" },
        primaryIntent: intent("intent-a", "fact-a"),
        requiredIntents: [intent("intent-b", "fact-b")],
        scopeFamilyId: "family", solutionMode: "product_led",
        capabilityFactIds: ["fact-a", "fact-b"], researchQuery: "example", articleLength: "medium",
    }
    const outline = {
        intro: { instruction_note: "Direct answer", keywords_to_include: [] },
        sections: [
            { heading: "A", intent_ids: ["intent-a", "intent-b"], needs_image: true },
            { heading: "B", intent_ids: ["intent-b"], needs_image: true },
            { heading: "C", intent_ids: [], needs_image: true },
        ],
    }
    const normalized = normalizeContractOutline(
        outline,
        contract,
        [
            { id: "fact-a", url: "https://brand.example/a", quote: "A" },
            { id: "fact-b", url: "https://brand.example/b", quote: "B" },
        ],
        [
            { id: "research-a", url: "https://research.example/a", supportsIntentIds: ["intent-a"] },
            { id: "research-b", url: "https://research.example/b", supportsIntentIds: ["intent-b"] },
        ],
    )
    assert.deepEqual(normalized.sections.flatMap((section) => section.intent_ids).sort(), ["intent-a", "intent-b"])
    assert.deepEqual(normalized.sections[0].capability_fact_ids.sort(), ["fact-a", "fact-b"])
    assert.deepEqual(normalized.sections[0].research_evidence_ids.sort(), ["research-a", "research-b"])
    assert.equal(normalized.sections.filter((section) => section.needs_image).length, 1)
    assert.equal(normalized.sections[0].word_budget, Math.floor((1900 - 200) / 3))

    // No section may leave normalization empty. Surplus sections previously got
    // no intent, no facts and no evidence, so the only instruction left to them
    // was the tail of the previous paragraph.
    for (const section of normalized.sections) {
        const readable = [...section.intent_ids, ...section.supporting_intent_ids]
        assert.ok(readable.length > 0, `section "${section.heading}" has no intent`)
        assert.ok(
            section.capability_fact_ids.length > 0 || section.research_evidence_ids.length > 0,
            `section "${section.heading}" has no evidence`,
        )
    }
    // The intro answers the primary intent, so it must carry that intent's evidence.
    assert.deepEqual(normalized.intro.intent_ids, ["intent-a"])
    assert.deepEqual(normalized.intro.capability_fact_ids, ["fact-a"])
    assert.deepEqual(normalized.intro.research_evidence_ids, ["research-a"])
})

test("draft quality tests catch truncation, thin sections and unbacked claims", () => {
    // finishReason is authoritative when the provider supplies it.
    assert.equal(truncationReason("A complete sentence.", "MAX_TOKENS"), "max_tokens")
    // ...and the textual checks cover the streamed responses where it is absent,
    // which is exactly the case the 176-word article fell through.
    assert.equal(truncationReason("You need a"), "unterminated_sentence")
    assert.equal(truncationReason("We ship it. **Bold start"), "unterminated_emphasis")
    assert.equal(truncationReason("Intro text.\n\n### Next up"), "dangling_heading")
    assert.equal(truncationReason("| A | B |\n| --- | --- |"), "dangling_table")
    assert.equal(truncationReason("   "), "empty")
    assert.equal(truncationReason("Upload the photo. Then crop it."), null)
    assert.equal(truncationReason("| A | B |\n| --- | --- |\n| 1 | 2 |"), null)
    assert.equal(truncationReason("The result is **sharp**."), null)

    // Images, comment placeholders and table rules are not prose.
    assert.equal(countProseWords("![alt](https://x.example/a.webp)\n\nTwo real words here."), 4)

    const draft = "BringBack uses latent diffusion. Choose a photo taken in daylight. We match the grain."
    const candidates = firstPartyClaimCandidates(draft, "BringBack")
    assert.ok(candidates.some((sentence) => sentence.includes("latent diffusion")))
    assert.ok(candidates.some((sentence) => sentence.startsWith("We match")))
    assert.equal(candidates.length, 2)
    assert.equal(
        removeSentences(draft, ["BringBack uses latent diffusion."]),
        "Choose a photo taken in daylight. We match the grain.",
    )

    // A broken response must never be recorded as successful work.
    assert.deepEqual(
        articleQualityVerdict({ wordCount: 176, articleLength: "medium", defects: [] }).ok,
        false,
    )
    assert.equal(
        articleQualityVerdict({ wordCount: 1900, articleLength: "medium", defects: [] }).ok,
        true,
    )
    assert.equal(
        articleQualityVerdict({
            wordCount: 1900,
            articleLength: "medium",
            defects: [{ heading: "A", kind: "truncated", detail: "max_tokens" }],
        }).ok,
        false,
    )
    assert.equal(
        articleQualityVerdict({
            wordCount: 1900,
            articleLength: "medium",
            defects: [{ heading: "A", kind: "missing_citation", detail: "https://x.example" }],
        }).ok,
        false,
    )
    // Removed fabrications are not themselves blocking — the word floor is what
    // catches an article that lost too much to survive.
    assert.equal(
        articleQualityVerdict({
            wordCount: 1900,
            articleLength: "medium",
            defects: [{ heading: "A", kind: "unsupported_claim", detail: "2 removed" }],
        }).ok,
        true,
    )
})

test("the writer proves each section finished before completing an article", async () => {
    const writer = await text("trigger/generate-blog.ts")

    // Gemini 3 reasons by default and bills thinking against maxOutputTokens, so
    // a 700-token ceiling starved every section. Thinking is now explicit and
    // the ceiling carries a reserve.
    assert.doesNotMatch(writer, /maxOutputTokens: 700/)
    assert.doesNotMatch(writer, /word_budget \|\| 300\) \* 1\.8/)
    assert.match(writer, /thinkingConfig: \{ thinkingLevel: "LOW" \}/)
    assert.match(writer, /Math\.min\(16_000, Math\.ceil\(input\.wordBudget \* 5 \* multiplier\) \+ 3_000\)/)

    // Every writing call must read the finish reason and act on it.
    assert.match(writer, /candidates\?\.\[0\]\?\.finishReason/)
    assert.match(writer, /truncationReason\(text, finishReason\)/)
    assert.match(writer, /writeContractProse/)
    assert.doesNotMatch(writer, /Retry did not add the link\(s\); keeping original draft/)

    // A defect must be able to stop the article, not just log.
    assert.match(writer, /Article failed the writer quality gate and was not published/)
    assert.match(writer, /articleQualityVerdict\(\{/)
    assert.match(writer, /unsupportedFirstPartyClaims/)
    assert.match(writer, /kind: "missing_citation"/)

    // The quality gate must sit before the completed write, or it gates nothing.
    assert.ok(
        writer.indexOf("Article failed the writer quality gate") <
            writer.indexOf('status: "completed"'),
        "quality gate must run before the article is marked completed",
    )
})

test("research evidence rejects fabricated quotes and identifies competitor subdomains", () => {
    const source = "The API accepts a trace ID and returns a trace timeline."
    assert.equal(isEvidenceQuoteSupported(source, "accepts a trace ID and returns a trace timeline"), true)
    assert.equal(isEvidenceQuoteSupported(source, "returns results in under two seconds"), false)
    assert.equal(
        isKnownCompetitorUrl("https://docs.competitor.example/guide", ["https://competitor.example"]),
        true,
    )
    assert.equal(
        isKnownCompetitorUrl("https://independent.example/guide", ["https://competitor.example"]),
        false,
    )
})

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

test("parent scope family links persist and steer absorption", async () => {
    const [migration, absorption, brandScope, assembly, runHarvest] =
        await Promise.all([
            text("supabase/migrations/20260804_parent_scope_family.sql"),
            text("lib/harvest/absorption.ts"),
            text("lib/brand-scope.ts"),
            text("lib/harvest/assembly.ts"),
            text("lib/harvest/run-harvest.ts"),
        ])

    assert.match(migration, /parent_scope_family_id/)
    assert.match(migration, /confirm_brand_scope/)
    assert.match(migration, /create_customer_audit_with_scope/)
    assert.match(migration, /claim_prospect_audit/)
    assert.match(absorption, /parentByFamilyId/)
    assert.match(absorption, /preferredParentId/)
    assert.match(brandScope, /resolveParentScopeFamilyIds/)
    assert.match(assembly, /buildParentByFamilyId/)
    assert.match(runHarvest, /parent_scope_family_id/)
})

test("absorbed sub-node intents survive all the way to the writer", async () => {
    const [runHarvest, migration, shipCluster, writer, dryRun, extraction, review] =
        await Promise.all([
            text("lib/harvest/run-harvest.ts"),
            text("supabase/migrations/20260803_sub_nodes_and_origin_family.sql"),
            text("trigger/ship-cluster.ts"),
            text("trigger/generate-blog.ts"),
            text("app/api/writer/dry-run/route.ts"),
            text("lib/scope-extraction.ts"),
            text("components/onboarding/scope-family-review.tsx"),
        ])

    // Absorption keeps a thin domain's demand alive, but every hop after it can
    // drop the payload again — which would be the same 33% loss, one layer
    // further down. Each link in the chain is pinned.

    // 1. assembly -> persistence payload
    assert.match(runHarvest, /sub_node_intents: article\.subNodes\.map/)
    assert.match(runHarvest, /sub_node_query_ids: article\.subNodes\.flatMap/)
    assert.match(runHarvest, /origin_scope_family_id: article\.originScopeFamilyId/)

    // 2. persistence columns + the finalize_audit_run patch
    for (const column of [
        "sub_node_intents",
        "sub_node_query_ids",
        "origin_scope_family_id",
    ]) {
        assert.ok(migration.includes(column), `migration must add ${column}`)
    }
    // The patch must fail loudly rather than leave sub-nodes unpersisted.
    assert.match(migration, /Could not patch finalize_audit_run/)

    // 3. ship-cluster -> writer payload
    assert.match(shipCluster, /sub_node_intents/)
    assert.match(shipCluster, /subNodeIntents:/)

    // 4. writer accepts and RENDERS them as required sections
    assert.match(writer, /subNodeIntents\?: string\[\]/)
    assert.match(writer, /subNodeIntents = \[\]/)
    assert.match(writer, /REQUIRED SUB-SECTIONS/)
    assert.match(writer, /auditEvidence\.subNodeIntents\?\.length \?/)
    // This article is the only page that will ever answer them.
    assert.match(writer, /only page that will ever answer them/)
    // And they must not be turned into filler to look substantial.
    assert.match(writer, /Do NOT pad them/)

    // 5. inspectable for free before paying to generate
    assert.match(dryRun, /absorbedSubNodes/)

    // Peer-level extraction: emitting a broad area beside its own sub-case is
    // what produced areas too thin to sustain a cluster in the first place.
    assert.match(extraction, /PEER-LEVEL RULE/)
    assert.match(extraction, /parent_hint/)
    assert.match(review, /parent_hint/)
})

test("finalize accepts absorbed and parent-rolled query ownership", async () => {
    // Parent rollup / absorption set article.scope_family_id to the host while
    // source_query_ids still point at query_pool rows under the origin family.
    // The strict equality check aborted completed harvests with
    // "An article references a query outside its confirmed scope".
    const migration = await text(
        "supabase/migrations/20260806_fix_finalize_absorbed_query_scope.sql",
    )
    assert.match(migration, /pa\.origin_scope_family_id IS NOT NULL/)
    assert.match(
        migration,
        /child_family\.parent_scope_family_id = pa\.scope_family_id/,
    )
    assert.match(migration, /AND qp\.scope_family_id = pa\.scope_family_id/)
    assert.match(migration, /already accepts absorbed\/parent-rolled/)
})

test("a family with enough collapsed units still qualifies when themes split", async () => {
    const clusterer = await text("lib/harvest/clusterer.ts")
    const assembly = await text("lib/harvest/assembly.ts")

    // BringBack.pro: 25 gaps → 8 article units → 0 clusters because thematic
    // grouping split eight intents into sub-groups below the floor. The demand
    // was real; the second-level split was the bottleneck.
    assert.match(
        clusterer,
        /family demand supports/,
        "groupIntoClusters must qualify a family whose total units clear the floor",
    )
    assert.match(
        assembly,
        /unitsForClusterRoot|clusterRoots/,
        "assembly must roll sub-areas into parent domains before clustering",
    )
})

test("no measured query can be silently destroyed by clustering", async () => {
    // From absorption.ts, not clusterer.ts: the clusterer imports "@/..."
    // aliases that plain node cannot resolve.
    const { absorbOrphanedUnits, STANDALONE_MIN_BACKING_QUERIES } = await import(
        "../lib/harvest/absorption.ts"
    )

    const unit = (id, familyId, backing, embedding) => ({
        scopeFamilyId: familyId,
        mainKeyword: id,
        supportingKeywords: [],
        sourceQueryIds: Array.from({ length: backing }, (_, i) => `${id}-q${i}`),
        subNodes: [],
        articleType: "informational",
        priority: 1,
        competitorUrls: [],
        title: id,
        embedding,
    })

    // A qualifying host cluster, plus a thin domain that would previously have
    // been deleted: two corroborated intents and two single-query intents.
    const host = {
        scopeFamilyId: "host",
        name: "Host",
        priority: 1,
        competitorUrls: [],
        articles: Array.from({ length: 8 }, (_, i) =>
            unit(`host-${i}`, "host", 2, [1, 0.1 * i]),
        ),
    }
    const orphans = [
        unit("thin-strong-a", "thin", 3, [0.9, 0.2]),
        unit("thin-strong-b", "thin", 2, [0.88, 0.25]),
        unit("thin-weak-a", "thin", 1, [0.87, 0.22]),
        unit("thin-weak-b", "thin", 1, [0.86, 0.21]),
    ]

    const queriesIn = [
        ...host.articles.flatMap((a) => a.sourceQueryIds),
        ...orphans.flatMap((o) => o.sourceQueryIds),
    ]

    const result = absorbOrphanedUnits([host], orphans)

    // CONSERVATION: every query that entered leaves as either an article's own
    // source query or a sub-node's. One audit lost 52 of 156 gap queries (33%)
    // because undersized groups were filtered into a counter and dropped.
    const queriesOut = result.clusters.flatMap((cluster) =>
        cluster.articles.flatMap((article) => [
            ...article.sourceQueryIds,
            ...article.subNodes.flatMap((node) => node.sourceQueryIds),
        ]),
    )
    assert.deepEqual(
        queriesOut.slice().sort(),
        queriesIn.slice().sort(),
        "clustering must neither lose nor duplicate a measured query",
    )
    assert.equal(result.unsold.length, 0)

    // Corroborated intents become real, addressable articles — not buried H2s.
    const allArticles = result.clusters.flatMap((c) => c.articles)
    for (const keyword of ["thin-strong-a", "thin-strong-b"]) {
        const promoted = allArticles.find((a) => a.mainKeyword === keyword)
        assert.ok(promoted, `${keyword} must be promoted to a standalone article`)
        // FK planned_articles_cluster_scope_fkey requires article family ===
        // cluster family, so it adopts the host's — origin keeps the truth.
        assert.equal(promoted.scopeFamilyId, "host")
        assert.equal(promoted.originScopeFamilyId, "thin")
    }
    // Single-query intents are sub-nodes of their OWN family's articles.
    const subNodeIntents = allArticles.flatMap((a) => a.subNodes.map((n) => n.intent))
    assert.deepEqual(subNodeIntents.slice().sort(), ["thin-weak-a", "thin-weak-b"])
    assert.equal(STANDALONE_MIN_BACKING_QUERIES, 2)

    // With nothing to absorb into, evidence is surfaced rather than deleted.
    const nowhere = absorbOrphanedUnits([], orphans)
    assert.equal(nowhere.unsold.length, 4)

    // Absorption grows the host, so the ceiling must still hold afterwards.
    // Without the injected splitter this same input yields one cluster of 24.
    const MAX = 15
    const split = (arts) => {
        if (arts.length <= MAX) return [arts]
        const parts = Math.ceil(arts.length / MAX)
        const size = Math.ceil(arts.length / parts)
        const out = []
        for (let i = 0; i < arts.length; i += size) out.push(arts.slice(i, i + size))
        return out
    }
    const bigHost = {
        scopeFamilyId: "host",
        name: "Host",
        priority: 1,
        competitorUrls: [],
        articles: Array.from({ length: 14 }, (_, i) => unit(`big-${i}`, "host", 2, [1, 0.05 * i])),
    }
    const manyOrphans = Array.from({ length: 10 }, (_, i) =>
        unit(`orphan-${i}`, "thin2", 2, [0.9, 0.2 + 0.01 * i]),
    )
    const split_result = absorbOrphanedUnits([bigHost], manyOrphans, split)
    for (const cluster of split_result.clusters) {
        assert.ok(
            cluster.articles.length <= MAX,
            `absorption produced a cluster of ${cluster.articles.length}, over the ${MAX} ceiling`,
        )
    }
    assert.equal(split_result.unsold.length, 0)
})

test("thin domains absorb into their declared parent before embedding proximity", async () => {
    const { absorbOrphanedUnits } = await import("../lib/harvest/absorption.ts")

    const unit = (id, familyId, backing, embedding) => ({
        scopeFamilyId: familyId,
        mainKeyword: id,
        supportingKeywords: [],
        sourceQueryIds: Array.from({ length: backing }, (_, i) => `${id}-q${i}`),
        subNodes: [],
        articleType: "informational",
        priority: 1,
        competitorUrls: [],
        title: id,
        embedding,
    })

    const parentCluster = {
        scopeFamilyId: "parent",
        name: "Parent",
        priority: 1,
        competitorUrls: [],
        articles: Array.from({ length: 8 }, (_, i) =>
            unit(`parent-${i}`, "parent", 2, [1, 0.1 * i]),
        ),
    }
    const decoyCluster = {
        scopeFamilyId: "decoy",
        name: "Decoy",
        priority: 2,
        competitorUrls: [],
        articles: Array.from({ length: 8 }, (_, i) =>
            unit(`decoy-${i}`, "decoy", 2, [0, 1 - 0.1 * i]),
        ),
    }
    const orphans = [
        unit("thin-strong", "thin", 2, [0, 1]),
        unit("thin-weak", "thin", 1, [0, 0.99]),
    ]

    const byEmbedding = absorbOrphanedUnits([parentCluster, decoyCluster], orphans)
    const promotedByEmbedding = byEmbedding.clusters
        .flatMap((cluster) => cluster.articles)
        .find((article) => article.mainKeyword === "thin-strong")
    assert.equal(
        promotedByEmbedding?.scopeFamilyId,
        "decoy",
        "without a parent link, embedding proximity wins",
    )

    const byParent = absorbOrphanedUnits(
        [parentCluster, decoyCluster],
        orphans,
        (articles) => [articles],
        { parentByFamilyId: new Map([["thin", "parent"]]) },
    )
    const promotedByParent = byParent.clusters
        .flatMap((cluster) => cluster.articles)
        .find((article) => article.mainKeyword === "thin-strong")
    assert.equal(
        promotedByParent?.scopeFamilyId,
        "parent",
        "declared parent must steer absorption before embedding adjacency",
    )
    assert.equal(promotedByParent?.originScopeFamilyId, "thin")
})

test("scope is whatever the audit measured — no fixed cluster count", () => {
    // A hard six turned away any business whose audit measured fewer. One real
    // audit measured 4 qualified clusters of genuine demand and was told
    // "Not eligible… the program requires six", with no checkout offered.
    const clusters = Array.from({ length: 9 }, (_, index) => ({
        id: `cluster-${index + 1}`,
        priority: index + 1,
        // Floor is 8 — cluster-1 stays unqualified; sold cluster-2 is skipped.
        articleCount: index === 0 ? 2 : 8,
    }))
    const selection = selectQualifiedProgramScope(clusters, ["cluster-2"], false)
    assert.equal(selection.eligible, true)
    // Every qualified, unsold cluster is sold — not the first six of them.
    assert.deepEqual(
        selection.selected.map((cluster) => cluster.id),
        ["cluster-3", "cluster-4", "cluster-5", "cluster-6", "cluster-7", "cluster-8", "cluster-9"],
    )
    assert.equal(selection.selectedArticleCount, 56)

    // A narrow product with 3 qualified clusters must be able to buy.
    const narrow = selectQualifiedProgramScope(clusters.slice(0, 4), [], false)
    assert.equal(narrow.eligible, true, "a 3-cluster audit must reach checkout")
    assert.equal(narrow.selected.length, 3)
    assert.equal(narrow.reason, null)

    // The only remaining rejections are "unusable" and "nothing left to sell".
    const nothing = selectQualifiedProgramScope([{ id: "thin", priority: 1, articleCount: 2 }], [], false)
    assert.equal(nothing.eligible, false)
    assert.match(nothing.reason, /no qualified clusters/i)
    assert.doesNotMatch(nothing.reason, /six/i)

    const legacy = selectQualifiedProgramScope(clusters, [], true)
    assert.equal(legacy.eligible, false)
    assert.match(legacy.reason, /refreshed/i)
})

test("selection represents confirmed business families before taking depth", () => {
    const clusters = [
        ...Array.from({ length: 7 }, (_, index) => ({
            id: `restoration-${index + 1}`,
            priority: index,
            articleCount: 8,
            scopeFamilyId: "restoration",
            scopeFamilyPriority: 0,
        })),
        ...["animation", "portrait", "add-person", "hug", "memory-book"].map(
            (family, index) => ({
                id: `${family}-1`,
                priority: 20 + index,
                articleCount: 8,
                scopeFamilyId: family,
                scopeFamilyPriority: index + 1,
            }),
        ),
    ]
    const selection = selectQualifiedProgramScope(clusters, [], false)
    assert.equal(selection.eligible, true)
    // Round-robin still governs ORDER — every represented domain is served
    // before any domain gets a second cluster — but nothing is truncated now,
    // so the verbose family's remaining 6 clusters follow rather than vanish.
    assert.deepEqual(
        selection.selected.slice(0, 6).map((cluster) => cluster.scopeFamilyId),
        [
            "restoration",
            "animation",
            "portrait",
            "add-person",
            "hug",
            "memory-book",
        ],
    )
    assert.equal(selection.selected.length, 12, "no qualified cluster may be dropped")
    assert.equal(
        new Set(selection.selected.map((c) => c.id)).size,
        12,
        "selection must not duplicate a cluster",
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
    // Bounded so the worst-case audit fits the 1800s task budget:
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

test("SERP harvest uses bounded concurrency and a per-seed timeout under the Tavily default", async () => {
    // Sequential SERP with ~60s hung seeds burned the Trigger ceiling
    // (animatememories.com: five "Request timed out after 60 seconds" lines
    // then MAX_DURATION_EXCEEDED). Parallelism + a tighter race keep wall
    // clock proportional to ⌈seeds/concurrency⌉ × timeout, not seeds × 60s.
    const serp = await text("lib/harvest/serp-questions.ts")
    assert.match(serp, /SERP_CONCURRENCY\s*=\s*3/)
    assert.match(serp, /SERP_SEED_TIMEOUT_MS\s*=\s*25_000/)
    assert.match(serp, /mapWithConcurrency\([\s\S]{0,80}SERP_CONCURRENCY/)
    assert.match(serp, /withTimeout\([\s\S]{0,120}SERP_SEED_TIMEOUT_MS/)
    // hardFailure comes from buildSourceReport when every seed fails —
    // partial SERP success must still soft-fail closed, not abort the audit.
    assert.match(serp, /buildSourceReport\("paa",\s*seedsToProcess\.length,\s*failed/)
    assert.match(serp, /if\s*\(report\.hardFailure\)/)
})

test("audit Trigger maxDuration is 30 minutes with matching stale reclaim", async () => {
    const [audit, prospect, route] = await Promise.all([
        text("trigger/run-audit.ts"),
        text("trigger/run-prospect-audit.ts"),
        text("app/api/topical-audit/route.ts"),
    ])
    assert.match(audit, /maxDuration:\s*1800/)
    assert.match(prospect, /maxDuration:\s*1800/)
    assert.match(route, /AUDIT_STALE_AFTER_MINUTES\s*=\s*40/)
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
    assert.match(console_, /disabled=\{!canRetry \|\| isRetrying\}/)
    // And it must not bounce the customer back to re-enter their brand.
    assert.doesNotMatch(console_, /onError/)
})

test("each onboarding screen is its own file, and the route keeps the machine", async () => {
    const route = await text(ONBOARDING_ROUTE)
    const stepFiles = (await readdir(path.join(root, ONBOARDING_STEPS_DIR)))
        .filter((name) => name.endsWith(".tsx"))
        .sort()

    assert.deepEqual(stepFiles, [
        "extras-step.tsx",
        "profile-step.tsx",
        "prompts-step.tsx",
        "scope-step.tsx",
        "site-step.tsx",
    ])
    for (const name of stepFiles) {
        assert.match(await text(`${ONBOARDING_STEPS_DIR}/${name}`), /^"use client"/)
    }

    // The route renders each screen and owns nothing of their markup.
    for (const component of ["SiteStep", "ProfileStep", "ScopeStep", "PromptsStep", "ExtrasStep"]) {
        assert.match(route, new RegExp(`<${component}\\b`), `route must render ${component}`)
    }

    // …and it KEEPS the state machine, the data calls and the recovery effects.
    // Those are the route's job; pushing them into a screen would scatter the
    // flow across five files and put us back where this started.
    for (const owned of [
        /type Step =/,
        /const resetToBrandStep = useCallback/,
        /handleAnalyzeBrand/,
        /handleFindScope/,
        /handleSaveBrand/,
        /STORAGE_KEYS/,
        /migrateLegacyStep/,
    ]) {
        assert.match(route, owned, `route must own ${owned}`)
    }

    // The screens are presentational: no fetching, no storage, no routing.
    for (const name of stepFiles) {
        const source = await text(`${ONBOARDING_STEPS_DIR}/${name}`)
        assert.doesNotMatch(source, /fetch\(/, `${name}: screens must not fetch`)
        assert.doesNotMatch(source, /localStorage/, `${name}: screens must not touch storage`)
        assert.doesNotMatch(source, /useRouter|setStep\(/, `${name}: screens must not navigate`)
    }

    // Splitting must not have shrunk the file by moving copy somewhere unread.
    // Every one of these lives in a step file now, and the surface helper is the
    // only reason the assertions elsewhere in this suite still see them.
    const surface = await onboardingSurface()
    for (const literal of [
        "Find my business areas",
        "What do people type into Google to find a tool like yours",
        "keep yours and find others",
        "Usually 1–3 minutes",
    ]) {
        assert.ok(surface.includes(literal), `surface lost: ${literal}`)
        assert.ok(!route.includes(literal), `expected ${literal} to live in a step file`)
    }
})

test("onboarding asks one question, and scope generates itself", async () => {
    const [analyze, scope, page] = await Promise.all([
        text("app/api/analyze-brand/route.ts"),
        text("app/api/analyze-brand/scope/route.ts"),
        onboardingSurface(),
    ])

    // STEP 1 TAKES A URL AND NOTHING ELSE. Competitors were never read by this
    // endpoint, and the extractor has an explicit "no target searches supplied"
    // branch — yet both sat on the first screen, in front of any value. The
    // destructure is the contract: if a third field appears here, the first
    // screen has grown a field it does not need.
    assert.match(analyze, /const \{ url, targetSeeds: rawTargetSeeds = \[\] \} = await req\.json\(\)/)
    assert.doesNotMatch(analyze, /competitors/)

    // Competitors and country/topic live on their own skippable screen, after
    // the founder has seen something worth the input.
    assert.match(page, /step === "extras"/)
    assert.match(page, /keep yours and find others/)

    // SCOPE MUST GENERATE ITSELF. Returning zero areas and handing the founder a
    // blank form is the failure this endpoint exists to prevent. The crawl
    // checkpoint is tried first; empty markdown falls back to unpaid HTML
    // snapshots (meta / JSON-LD / body), then titles — not a second Tavily search.
    assert.match(scope, /batchExtractHtmlSnapshots/)
    assert.match(scope, /corpusTier = "html"/)
    assert.match(scope, /familyFromConfirmedBrand/)
    assert.match(scope, /usableChars\(pages\) < THIN_CORPUS_CHARS/)
    assert.match(scope, /batchExtractTitles/)
    assert.match(scope, /readCorpus/)
    assert.doesNotMatch(scope, /tvly\.search/)
    assert.doesNotMatch(scope, /searchDepth:\s*"advanced"/)
    assert.doesNotMatch(scope, /fetchAllSitemapUrls/)
    // Titles are the signal a JS-rendered site still exposes; they were being
    // dropped in pagesFromCrawl and again in the crawl_done payload.
    assert.match(analyze, /title: String\(rawPage\.title \|\| ""\)/)
    // And when both fail, ONE question — never a grid of fields.
    assert.match(scope, /Add a short search phrase and look again/)
    assert.doesNotMatch(scope, /Tell us in one line/)
    const scopeStep = await text("components/onboarding/steps/scope-step.tsx")
    assert.match(scopeStep, /failedEmpty \? null/)
    assert.doesNotMatch(scopeStep, /add a category yourself/)
    assert.doesNotMatch(scopeStep, /Research hit a time limit/)
})

test("the confirm gate is one rule, and the UI can always satisfy it", async () => {
    const { mechanicsGaps, isPlaceholderAction, MECHANICS_GAP_COPY } = await import(
        "../lib/scope-mechanics.ts"
    )
    const { validateConfirmedScope } = await import("../lib/brand-scope.ts")

    // The server must delegate, not keep a second copy. Two implementations of
    // this rule is how the UI ended up unable to tell the founder what was wrong.
    const brandScope = await text("lib/brand-scope.ts")
    assert.match(brandScope, /mechanicsGaps\(family\.capability_contract\)/)
    assert.doesNotMatch(brandScope, /\/\^describe\\b\/i\.test/)

    // scope-mechanics must stay importable by a client component: brand-scope.ts
    // pulls in `crypto`, which is why the rule could not live there.
    const mechanics = await text("lib/scope-mechanics.ts")
    assert.doesNotMatch(mechanics, /from "(node:)?(crypto|fs|path)"/)

    assert.equal(isPlaceholderAction("Describe what your product or service does"), true)
    assert.equal(isPlaceholderAction(""), true)
    assert.equal(isPlaceholderAction("abc"), true)
    assert.equal(isPlaceholderAction("Generate mobile screens from a prompt"), false)

    const contract = (patch) => ({
        version: "capability-v1",
        deliveryMode: "browser software",
        operations: [{
            key: "op1", customerJob: "Repair a damaged photo", inputs: [], action: "Restore an old photo",
            outputs: [], limits: [], evidenceRefs: ["f1"],
        }],
        facts: [{ id: "f1", url: "founder-confirmed:onboarding", quote: "Action: Restore an old photo." }],
        ...patch,
    })
    assert.deepEqual(mechanicsGaps(contract()), [])
    assert.deepEqual(mechanicsGaps(null), ["missing_contract"])
    assert.deepEqual(mechanicsGaps(contract({ deliveryMode: "" })), ["missing_delivery_mode"])
    assert.deepEqual(mechanicsGaps(contract({ facts: [] })), ["no_confirmed_facts"])
    for (const gap of Object.keys(MECHANICS_GAP_COPY)) {
        assert.ok(MECHANICS_GAP_COPY[gap].length > 20, `${gap} needs actionable copy`)
    }

    // Client and server must agree for every state, or Continue lies again.
    const brand = (families) => ({
        product_name: "X",
        product_identity: { literally: "a", emotionally: "b", not: "c" },
        mission: "m",
        audience: { primary: "p", psychology: "q" },
        scope_families: families,
        target_seed_keywords: [],
    })
    for (const patch of [{}, { deliveryMode: "" }, { facts: [] }]) {
        const family = {
            id: "11111111-1111-4111-8111-111111111111",
            name: "Photo restoration",
            description: "Repairing damaged family photos.",
            seed_keywords: ["restore old photos"],
            evidence: [],
            capability_contract: contract(patch),
            source: "user", verified: true, priority: 0, enabled: true,
        }
        // The invariant is directional: anything the client flags, the server
        // must refuse. Not message-equality — an empty deliveryMode fails
        // `CapabilityContractSchema.min(2)` before the mechanics check runs, so
        // the server answers "Brand details are invalid." That masking is
        // precisely why `findScopeBlockers` exists on the client.
        const serverErrors = validateConfirmedScope(brand([family])).errors
        const clientGaps = mechanicsGaps(family.capability_contract)
        if (clientGaps.length > 0) {
            assert.ok(
                serverErrors.length > 0,
                `client flags ${JSON.stringify(clientGaps)} but server accepts ${JSON.stringify(patch)}`,
            )
        } else {
            assert.deepEqual(
                serverErrors,
                [],
                `client sees no gap but server rejects ${JSON.stringify(patch)}`,
            )
        }
    }

    // The UI must not ship the rejection condition as a default. The cure is
    // the four visible fields; description mints a founder fact via
    // withFounderVisibleFields — not a collapsed mechanics disclosure.
    const review = await text("components/onboarding/scope-family-review.tsx")
    assert.doesNotMatch(review, /action: "Describe what your product/)
    assert.doesNotMatch(review, /customerJob: "Describe the customer job"/)
    assert.match(review, /withFounderVisibleFields/)
    assert.match(review, />What this helps with</)
    assert.match(review, />Delivered as</)
    assert.match(review, /isPlaceholderAction\(operation\.action\)/)
    // A null contract must still render an editor, or the family is unfixable.
    assert.doesNotMatch(review, /\{family\.capability_contract \? \(/)
    // Continue must be able to explain itself before the server ever answers.
    for (const [label, source] of [
        ["onboarding", await onboardingSurface()],
        ["components/brand-onboarding.tsx", await text("components/brand-onboarding.tsx")],
    ]) {
        assert.match(source, /findScopeBlockers\(/, `${label}: must pre-flight`)
    }
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

    // THE ASSERTION WHOSE ABSENCE LET THE DEAD END SHIP.
    //
    // Claiming the seed was never enough: `validateGroundedScope` built these
    // rescue families from `fallbackCapabilityContract` (empty facts, empty
    // evidenceRefs) and `validateConfirmedScope` rejects exactly that shape. One
    // validator created families so demand would not be lost; the other refused
    // every one of them, and a real founder was stuck on that screen with no way
    // forward. A rescue path must always be asserted against the gate it feeds.
    const { validateConfirmedScope } = await import("../lib/brand-scope.ts")
    const { mechanicsGaps } = await import("../lib/scope-mechanics.ts")
    const brand = {
        product_name: "Drawgle",
        product_identity: { literally: "a", emotionally: "b", not: "c" },
        mission: "m",
        audience: { primary: "p", psychology: "q" },
        scope_families: result.families,
        target_seed_keywords: ["ai mobile app ui designer", "text to mobile ui design"],
    }

    // Before mechanics: blocked, and the message must name the fixable field
    // rather than the bare "needs confirmed mechanics" it used to stop at.
    const blocked = validateConfirmedScope(brand).errors
    assert.ok(blocked.length > 0, "a factless rescue family must not pass the gate")
    assert.ok(
        blocked.some((message) => /Say in one line what this helps with/.test(message)),
        `error must name the field to fix, got: ${JSON.stringify(blocked)}`,
    )

    // After the founder fills them in, it MUST pass. This is the escape hatch.
    const filled = result.families.map((family) => ({
        ...family,
        capability_contract: {
            ...family.capability_contract,
            deliveryMode: "browser software",
            operations: family.capability_contract.operations.map((operation) => ({
                ...operation,
                action: "Generate mobile app screens from a text prompt",
                evidenceRefs: [`${family.id}:founder-${operation.key}`],
            })),
            facts: [{
                id: `${family.id}:founder-op1`,
                url: "founder-confirmed:onboarding",
                quote: "Action: Generate mobile app screens from a text prompt.",
            }],
        },
    }))
    assert.deepEqual(
        validateConfirmedScope({ ...brand, scope_families: filled }).errors,
        [],
        "a rescue family must be completable by the founder",
    )
    for (const family of filled) {
        assert.deepEqual(mechanicsGaps(family.capability_contract), [])
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

    const overflow = validateGroundedScope(
        Array.from({ length: 13 }, (_, index) => ({
            name: `Area ${index + 1} Capability`,
            description: "A customer-facing product area on the site.",
            seed_keywords: [`area ${index + 1} search`],
            evidence: [],
            source: "extracted",
        })),
        pages,
        "https://drawgle.com",
        [],
    )
    assert.equal(overflow.families.length, 12, "overflow must slice, not wipe")
    assert.ok(overflow.issues.some((issue) => /keeping the first 12/i.test(issue.message)))

    const seedless = validateGroundedScope(
        [
            {
                name: "AI Photo Restoration",
                description: "Restore old family photos with AI.",
                seed_keywords: [],
                evidence: [],
                source: "extracted",
            },
        ],
        pages,
        "https://drawgle.com",
        [],
    )
    assert.equal(seedless.families.length, 1)
    assert.ok(seedless.families[0].seed_keywords.includes("ai photo restoration"))

    const { familyFromConfirmedBrand } = await import("../lib/brand-scope.ts")
    const fromBrand = familyFromConfirmedBrand({
        product_name: "Drawgle",
        product_identity: { literally: "AI that turns a prompt into a mobile app screen." },
        category: "AI Mobile App UI Design",
    })
    assert.ok(fromBrand)
    assert.equal(fromBrand.source, "founder")
    assert.ok(fromBrand.seed_keywords.length > 0)

    // Quote verification must survive paraphrase but still reject invention.
    const page = "turn any text prompt into a production ready mobile ui screen"
    assert.equal(verifyQuote("turn any text prompt into a production ready mobile ui screen", page), true)
    assert.equal(verifyQuote("turn any text prompt into a production-ready mobile UI screen today", page), true)
    assert.equal(verifyQuote("we manufacture industrial beehives for commercial apiaries", page), false)
})

test("scope role refinement folds delivery mechanics out of harvest seeds", async () => {
    const { applyScopeRoleRefinement } = await import("../lib/scope-role-refine.ts")
    const { CAPABILITY_CONTRACT_VERSION } = await import(
        "../lib/writer/article-contract.ts"
    )

    const contract = (action) => ({
        version: CAPABILITY_CONTRACT_VERSION,
        deliveryMode: "browser software",
        operations: [{
            key: "op1",
            customerJob: action,
            inputs: ["prompt"],
            action,
            outputs: ["screen"],
            limits: [],
            evidenceRefs: ["f1"],
        }],
        facts: [{
            id: "f1",
            url: "https://drawgle.com/",
            quote: "Generate editable mobile screens from a prompt.",
        }],
    })

    const family = (patch) => ({
        id: patch.id,
        name: patch.name,
        description: patch.description,
        seed_keywords: patch.seed_keywords,
        evidence: [{ url: "https://drawgle.com/", quote: "Generate editable mobile screens from a prompt." }],
        capability_contract: contract(patch.description),
        parent_hint: patch.parent_hint ?? null,
        source: "extracted",
        verified: true,
        priority: patch.priority ?? 0,
        enabled: true,
    })

    // Drawgle-shaped: handoff/export is how the product delivers, not a market.
    const drawgle = applyScopeRoleRefinement(
        [
            family({
                id: "11111111-1111-4111-8111-111111111111",
                name: "AI Mobile UI Design",
                description: "Generate high-fidelity mobile app screens from prompts.",
                seed_keywords: [
                    "ai mobile ui generator",
                    "prompt to mobile app design",
                    "tailwind html export",
                ],
                priority: 0,
            }),
            family({
                id: "22222222-2222-4222-8222-222222222222",
                name: "AI Design to Code Handoff",
                description: "Export designs as agent-ready Tailwind packages.",
                seed_keywords: [
                    "design to code ai",
                    "tailwind html export",
                    "cursor ai design context",
                    "ai mobile app ui designer",
                ],
                parent_hint: "AI Mobile UI Design",
                priority: 1,
            }),
        ],
        {
            families: [
                {
                    name: "AI Mobile UI Design",
                    role: "acquisition_job",
                    fold_into: null,
                    seeds: [
                        { seed: "ai mobile ui generator", role: "acquisition_job" },
                        { seed: "prompt to mobile app design", role: "acquisition_job" },
                        { seed: "tailwind html export", role: "delivery_artifact" },
                    ],
                },
                {
                    name: "AI Design to Code Handoff",
                    role: "delivery_artifact",
                    fold_into: "AI Mobile UI Design",
                    seeds: [
                        { seed: "design to code ai", role: "delivery_artifact" },
                        { seed: "tailwind html export", role: "delivery_artifact" },
                        { seed: "cursor ai design context", role: "workflow_step" },
                        { seed: "ai mobile app ui designer", role: "delivery_artifact" },
                    ],
                },
            ],
        },
        ["ai mobile app ui designer"],
    )

    assert.equal(drawgle.families.length, 1)
    assert.equal(drawgle.families[0].name, "AI Mobile UI Design")
    assert.deepEqual(
        drawgle.families[0].seed_keywords.sort(),
        ["ai mobile app ui designer", "ai mobile ui generator", "prompt to mobile app design"].sort(),
    )
    assert.ok(
        drawgle.issues.some((issue) => /Folded "AI Design to Code Handoff"/i.test(issue.message)),
    )
    assert.ok(
        drawgle.families[0].capability_contract.operations.length >= 1,
        "parent must keep capability mechanics from the fold",
    )

    // Genuine sibling jobs stay peers.
    const siblings = applyScopeRoleRefinement(
        [
            family({
                id: "33333333-3333-4333-8333-333333333333",
                name: "Photo restoration",
                description: "Repair damaged family photos.",
                seed_keywords: ["restore old photos"],
                priority: 0,
            }),
            family({
                id: "44444444-4444-4444-8444-444444444444",
                name: "Photo animation",
                description: "Animate still family portraits.",
                seed_keywords: ["animate old photos"],
                priority: 1,
            }),
        ],
        {
            families: [
                {
                    name: "Photo restoration",
                    role: "acquisition_job",
                    fold_into: null,
                    seeds: [{ seed: "restore old photos", role: "acquisition_job" }],
                },
                {
                    name: "Photo animation",
                    role: "acquisition_job",
                    fold_into: null,
                    seeds: [{ seed: "animate old photos", role: "acquisition_job" }],
                },
            ],
        },
        [],
    )
    assert.equal(siblings.families.length, 2)

    // Mechanism seed on a valid job is stripped; family remains.
    const scrubbed = applyScopeRoleRefinement(
        [
            family({
                id: "55555555-5555-4555-8555-555555555555",
                name: "AI Mobile UI Design",
                description: "Generate mobile screens from prompts.",
                seed_keywords: ["ai mobile ui generator", "zip handoff pack"],
            }),
        ],
        {
            families: [{
                name: "AI Mobile UI Design",
                role: "acquisition_job",
                fold_into: null,
                seeds: [
                    { seed: "ai mobile ui generator", role: "acquisition_job" },
                    { seed: "zip handoff pack", role: "delivery_artifact" },
                ],
            }],
        },
        [],
    )
    assert.equal(scrubbed.families.length, 1)
    assert.deepEqual(scrubbed.families[0].seed_keywords, ["ai mobile ui generator"])

    // Founder seed marked mechanism by a bad decision is still kept.
    const founder = applyScopeRoleRefinement(
        [
            family({
                id: "66666666-6666-4666-8666-666666666666",
                name: "AI Mobile UI Design",
                description: "Generate mobile screens from prompts.",
                seed_keywords: ["ai mobile ui generator", "text to mobile ui design"],
            }),
        ],
        {
            families: [{
                name: "AI Mobile UI Design",
                role: "acquisition_job",
                fold_into: null,
                seeds: [
                    { seed: "ai mobile ui generator", role: "acquisition_job" },
                    { seed: "text to mobile ui design", role: "delivery_artifact" },
                ],
            }],
        },
        ["text to mobile ui design"],
    )
    assert.ok(
        founder.families[0].seed_keywords.includes("text to mobile ui design"),
        "founder target seeds must survive role refinement",
    )
})

test("scope extraction is its own call, not a field on the persona prompt", async () => {
    const [route, scopeRoute, extraction] = await Promise.all([
        text("app/api/analyze-brand/route.ts"),
        text("app/api/analyze-brand/scope/route.ts"),
        text("lib/scope-extraction.ts"),
    ])

    // Scope was field 10 of an 11-field persona prompt that also produced
    // "Style DNA". The most consequential decision in the product must not
    // compete for attention with prose about tone of voice.
    assert.doesNotMatch(route, /Commercial Scope Families/)
    assert.match(extraction, /gemini-3-flash-preview/)

    // It is now its own ENDPOINT, which is stronger than its own function call.
    // Onboarding runs sequentially — the founder confirms brand details, then
    // scope is fetched — so each screen waits only on its own data. The
    // "start scope before awaiting persona" assertion that used to live here
    // described the parallel race this replaces, and is deliberately gone.
    assert.match(scopeRoute, /extractScopeFamilies\(/)
    assert.doesNotMatch(route, /extractScopeFamilies\(/)
    assert.doesNotMatch(route, /const scopePromise/)

    // After grounding, role refinement uses the confirmed brand profile so
    // delivery/handoff families cannot become harvest seeds. Prompt rules alone
    // already failed once on this exact failure mode.
    assert.match(scopeRoute, /refineScopeRoles\(/)
    assert.match(scopeRoute, /brandProfile/)
    assert.match(await text("app/(onboarding)/onboarding/page.tsx"), /brandProfile:/)
    assert.match(await text("components/brand-onboarding.tsx"), /brandProfile:/)
    assert.match(await text("lib/scope-role-refine.ts"), /applyScopeRoleRefinement/)
    // The gate is role classification + fold — not a token denylist of
    // "handoff"/"export"/"tailwind" that would break the next SaaS noun.
    assert.doesNotMatch(
        await text("lib/scope-role-refine.ts"),
        /BLOCKLIST|DENYLIST|bannedSeeds|forbiddenSeeds/,
    )

    // The second call must not re-crawl. The first hands over its corpus.
    assert.match(route, /pages: trimCorpusPages\(crawledPages\)/)
    assert.match(scopeRoute, /body\?\.pages/)

    // Brand crawl burned ~80s / ~10 Tavily credits at limit 20 + advanced.
    // Bound to 8 pages, prefer basic, escalate only when the corpus is thin,
    // and feed the persona a ranked corpus so pricing pages survive the 50k cut.
    assert.match(route, /BRAND_CRAWL_LIMIT\s*=\s*8/)
    assert.match(route, /extractDepth:\s*"basic"/)
    assert.match(route, /THIN_CORPUS_CHARS/)
    assert.match(route, /buildRankedBrandCorpus/)
    assert.match(extraction, /export function buildRankedBrandCorpus/)
    assert.match(extraction, /filterSeedsAgainstCorpus/)
    assert.match(extraction, /EXTRACT_TIMEOUT_MS/)
    assert.match(extraction, /fallbackCapabilityContract/)
    assert.match(extraction, /jsonrepair/)
    assert.doesNotMatch(extraction, /thinkingConfig/)
    assert.doesNotMatch(
        extraction,
        /A single-product business returns exactly one family/,
    )
    assert.doesNotMatch(
        extraction,
        /required:\s*\[[^\]]*capability_contract/,
    )
    assert.match(extraction, /Discover omitted site capabilities/)
    assert.match(
        extraction,
        /even when\s+the founder did not name it/,
    )

    // Pricing must extract real plan lines, not a vague billing model label.
    assert.doesNotMatch(
        route,
        /High-level model \(Subscription, One-time, Free tier\)/,
    )
    assert.match(route, /Do NOT summarize as only "Subscription"/)
    assert.match(route, /Plan name — \$price \/ period/)
})

test("brand analyze streams real phases and unlocks scope before persona finishes", async () => {
    const [onboarding, brandOnboarding, route, stream] = await Promise.all([
        onboardingSurface(),
        text("components/brand-onboarding.tsx"),
        text("app/api/analyze-brand/route.ts"),
        text("lib/analyze-brand/stream.ts"),
    ])
    const onboardingRoute = await text(ONBOARDING_ROUTE)

    assert.match(route, /application\/x-ndjson/)
    assert.match(route, /phase:\s*"brand_ready"/)
    assert.match(route, /phase:\s*"complete"/)
    // scope_ready now belongs to the second call, not this one.
    const scopeRoute = await text("app/api/analyze-brand/scope/route.ts")
    assert.match(scopeRoute, /application\/x-ndjson/)
    assert.match(scopeRoute, /phase:\s*"scope_ready"/)
    assert.doesNotMatch(route, /phase:\s*"scope_ready"/)
    assert.match(stream, /consumeAnalyzeBrandStream/)
    assert.match(stream, /Reading your site/)
    assert.match(stream, /Finding product areas/)
    assert.match(stream, /Building brand profile/)

    for (const [file, source] of [
        ["onboarding/page.tsx", onboarding],
        ["brand-onboarding.tsx", brandOnboarding],
    ]) {
        assert.match(
            source,
            /consumeAnalyzeBrandStream/,
            `${file}: must consume NDJSON analyze stream`,
        )
        assert.match(
            source,
            /brandProfileReady/,
            `${file}: Continue gated until validated complete payload`,
        )
        assert.match(
            source,
            /Usually 1–3 minutes/,
            `${file}: honest ETA (not under half a minute)`,
        )
        assert.match(
            source,
            /Last analysis was interrupted/,
            `${file}: refresh mid-analyze must restore inputs and prompt re-run`,
        )
        assert.doesNotMatch(
            source,
            /LiveAnalysisConsole/,
            `${file}: must not reuse AI terminal console chrome`,
        )
        assert.doesNotMatch(
            source,
            /under half a minute/,
            `${file}: retired optimistic ETA`,
        )
    }
    // "Brand voice still loading…" used to be pinned here. It was an apology for
    // persona and scope racing into one screen. Onboarding is now sequential —
    // the persona is confirmed two screens before scope is even requested — so
    // the copy is gone and the invariant it stood in for is replaced by the
    // stronger one below: each screen has its own step, and its own event.
    // The state machine belongs to the route, so these read the route directly.
    assert.match(onboardingRoute, /type Step =[\s\S]{0,120}"profile"[\s\S]{0,60}"scope"/)
    assert.match(onboardingRoute, /step === "profile"/)
    assert.match(onboardingRoute, /step === "scope"/)
    assert.match(onboardingRoute, /handleFindScope/)
    assert.match(onboardingRoute, /analyze-brand\/scope/)
    // One waiting treatment, driven by real phases — never a spinner.
    assert.match(onboarding, /phases=\{BRAND_ANALYZE_PHASES\}/)
    assert.match(onboarding, /phases=\{SCOPE_ANALYZE_PHASES\}/)
    assert.doesNotMatch(onboarding, /Loader2 className=/)

    assert.match(onboardingRoute, /ANALYZING_STARTED_AT/)
    assert.match(onboarding, /keep yours and find others/)
    assert.match(brandOnboarding, /ANALYZING_STARTED_KEY/)
    // Demand check stays out of the analyze critical path.
    assert.match(onboardingRoute, /analyze-brand\/demand-check/)
    assert.doesNotMatch(
        await text("app/api/analyze-brand/route.ts"),
        /findSeedsWithoutDemand/,
    )
})

test("onboarding profile can edit full brand DNA before the audit", async () => {
    const [profile, editor, brandOnboarding, surface] = await Promise.all([
        text("components/onboarding/steps/profile-step.tsx"),
        text("components/brand-details-editor.tsx"),
        text("components/brand-onboarding.tsx"),
        onboardingSurface(),
    ])

    // The compact card stays; the rest is one click away on the same step —
    // not deferred to Settings after the audit has already frozen a snapshot.
    assert.match(profile, /Edit full brand details/)
    assert.match(profile, /BrandDetailsEditor/)
    assert.match(profile, /skipAuditCoreFields/)
    assert.match(profile, /the audit uses what you confirm here/)
    assert.doesNotMatch(profile, /review it later in Settings/)
    assert.doesNotMatch(surface, /you can review it later in Settings/)

    // Shared editor owns the writer-facing fields both surfaces must expose.
    for (const field of ["mission", "style_dna", "core_features", "audience.primary", "how_it_works"]) {
        assert.match(editor, new RegExp(field.replace(".", "\\.")), `editor must expose ${field}`)
    }
    assert.match(brandOnboarding, /BrandDetailsEditor/)
})

test("user-supplied competitors top up via discovery instead of freezing the list", async () => {
    const { mergeUserFirstCompetitors } = await import(
        "../lib/audit/merge-competitors.ts"
    )
    const [runAudit, policy, assembly] = await Promise.all([
        text("trigger/run-audit.ts"),
        text("lib/harvest/policy.ts"),
        text("lib/harvest/assembly.ts"),
    ])

    const merged = mergeUserFirstCompetitors(
        [{ name: "Rival", url: "https://rival.example/" }],
        [
            { name: "Rival Dup", url: "https://www.rival.example/pricing" },
            { name: "Other", url: "https://other.example/" },
            { name: "Third", url: "https://third.example/" },
            { name: "Fourth", url: "https://fourth.example/" },
            { name: "Fifth", url: "https://fifth.example/" },
        ],
        4,
    )
    assert.equal(merged.length, 4)
    assert.equal(merged[0].url, "https://rival.example/")
    assert.deepEqual(
        merged.map((row) => row.name),
        ["Rival", "Other", "Third", "Fourth"],
    )

    const emptyUser = mergeUserFirstCompetitors(
        [],
        [
            { name: "A", url: "https://a.example/" },
            { name: "B", url: "https://b.example/" },
        ],
        4,
    )
    assert.equal(emptyUser.length, 2)

    assert.match(policy, /maxCompetitorCandidates:\s*12/)
    assert.match(runAudit, /mergeUserFirstCompetitors/)
    assert.match(runAudit, /remainingCandidateSlots/)
    assert.match(runAudit, /maxCompetitorCandidates/)
    assert.match(runAudit, /competitorsUsed/)
    assert.match(runAudit, /savedCompetitors/)
    assert.doesNotMatch(
        runAudit,
        /maximum is \$\{HARVEST_POLICY\.maxCompetitors\}/,
        "saved candidate pools above 4 must not hard-fail the audit restart",
    )
    // The old binary skip — if any user competitors exist, never discover —
    // must stay gone.
    assert.doesNotMatch(
        runAudit,
        /if \(Array\.isArray\(brandRecord\?\.discovered_competitors\) && brandRecord\.discovered_competitors\.length\)/,
    )

    // One unreadable competitor must not abort the audit; reserves fill the set.
    assert.match(assembly, /Skipping competitor/)
    assert.match(assembly, /competitorsSkipped/)
    assert.doesNotMatch(assembly, /competitor_coverage_failure/)
    assert.match(
        assembly,
        /maxCompetitorCandidates/,
        "assembly accepts a candidate pool larger than the working set of 4",
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

test("purging a brand cannot silently orphan a live subscription", async () => {
    const purge = await text("supabase/migrations/20260802_purge_brand.sql")

    // Deleting a program does not stop Dodo billing. Purging a paid brand while
    // its subscription stays live would keep charging a customer whose data no
    // longer exists, so this must be refused unless explicitly acknowledged.
    assert.match(purge, /p_acknowledge_active_subscription/)
    assert.match(purge, /has a live Dodo subscription/)
    assert.match(purge, /orphaned_dodo_subscription/)
    // The payment record itself is evidence — never deleted.
    assert.doesNotMatch(
        purge,
        /DELETE FROM public\.dodo_subscriptions/,
        "dodo_subscriptions is the payment record and must survive a purge",
    )

    // The immutability hatch matches ONE audit id against a transaction-local
    // setting, so a single set_config would exempt only the first audit and the
    // trigger would reject the rest. A brand can hold several audits.
    assert.match(purge, /FOREACH v_audit_id IN ARRAY v_audit_ids/)
    const setConfigCalls = purge.match(/set_config\('flipaeo\.discarding_audit_id'/g) || []
    assert.ok(
        setConfigCalls.length >= 4,
        `expected the hatch to be re-set per audit for each evidence table, saw ${setConfigCalls.length}`,
    )

    // Ordering matters: every FK into programs/audits is RESTRICT.
    const order = [
        "subscription_credit_consumptions",
        "subscription_period_grants",
        "program_cost_events",
        "planned_article_links",
        "program_clusters",
        "DELETE FROM public.programs",
        "program_purchase_intents",
        "DELETE FROM public.topical_audits",
        "DELETE FROM public.brand_details",
    ]
    let cursor = -1
    for (const step of order) {
        const at = purge.indexOf(step)
        assert.ok(at > cursor, `purge order violated: "${step}" must come after the previous step`)
        cursor = at
    }

    assert.match(purge, /GRANT EXECUTE ON FUNCTION public\.purge_brand\(UUID, BOOLEAN\) TO service_role/)
    assert.match(purge, /REVOKE ALL ON FUNCTION public\.purge_brand\(UUID, BOOLEAN\) FROM PUBLIC, anon, authenticated/)
})

test("a deleted brand cannot strand onboarding", async () => {
    const page = await text("app/(onboarding)/onboarding/page.tsx")

    // Onboarding persists step and brandId in localStorage and the URL, so a
    // brand deleted server-side left the browser pointing at something gone.
    // getAuditScope returns null for BOTH "no completed audit" and "brand does
    // not exist", so audit-results threw "scope could not be loaded" and kept
    // the stale state — every refresh reproduced it with no way out.
    assert.match(page, /const resetToBrandStep = useCallback/)
    assert.match(page, /clearOnboardingStorage\(\)/)
    assert.match(page, /setStep\("brand"\)/)
    assert.match(page, /router\.replace\("\/onboarding"\)/)

    // Validated once at hydration so every step is covered, not just the one
    // that happened to be reported.
    assert.match(page, /verifyBrandStillExists/)
    assert.match(page, /getUserBrands\(\)/)
    assert.match(page, /import \{ getUserBrands, saveBrandAction \}/)

    // A transient lookup failure must not itself strand the user.
    assert.match(
        page,
        /catch \{[\s\S]{0,200}per-step checks still catch/,
        "brand verification must fail open on a network error",
    )

    // The reset must clear every piece of brand-derived state, or a stale
    // fragment re-renders the dead brand's data on the fresh step.
    for (const setter of [
        "setBrandId(null)",
        "setBrandData(null)",
        "setAuditScope(null)",
        "setPlannedArticles([])",
        "setProgramProgress(null)",
    ]) {
        assert.ok(page.includes(setter), `resetToBrandStep must call ${setter}`)
    }
})

test("founder-only surfaces are gated in two independent layers", async () => {
    const [proxy, testPage, prospectPage, testApi] = await Promise.all([
        text("proxy.ts"),
        text("app/(protected)/founder/test-article/page.tsx"),
        text("app/(protected)/founder/prospect-audits/page.tsx"),
        text("app/api/founder/test-article/route.ts"),
    ])

    // Layer 1 — the edge. An anonymous request must be turned away before it
    // reaches a server component that queries the database on its way to
    // rejecting the caller.
    assert.match(
        proxy,
        /protectedRoutes = \[[^\]]*'\/founder'/,
        "'/founder' must be a protected route so anonymous requests redirect to login",
    )

    // Layer 2 — the page itself. Being logged in is not sufficient; the user id
    // must be in FOUNDER_USER_IDS, and a non-founder gets 404 rather than 403
    // so the surface is not discoverable.
    for (const [name, page] of [
        ["test-article", testPage],
        ["prospect-audits", prospectPage],
    ]) {
        assert.match(
            page,
            /isFounderUser\(user\.id\)/,
            `${name} page must check FOUNDER_USER_IDS`,
        )
        assert.match(page, /notFound\(\)/, `${name} page must 404 for non-founders`)
    }

    // The API behind the page repeats the check — a page gate is not an API gate.
    assert.match(testApi, /isFounderUser\(user\.id\)/)
    assert.match(testApi, /status: 404/)
})

test("single-article test generation stays outside the program pipeline", async () => {
    const route = await text("app/api/founder/test-article/route.ts")
    const routeCode = route
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "")

    assert.match(route, /isFounderUser\(user\.id\)/)
    assert.match(route, /status: 404/)
    assert.match(route, /brand\.user_id !== user\.id/)
    assert.match(route, /ensureProfileRow/)
    assert.match(route, /loadPlannedWriterInputs/)
    assert.match(route, /hydrateFromPlannedId/)
    assert.match(route, /subNodeIntents/)
    assert.match(route, /clusterCompetitorUrls/)

    // Must not pass plannedArticleId into the writer task — that would let a
    // QA run mark a real cluster generating/blocked on failure.
    assert.doesNotMatch(
        routeCode,
        /generateBlogPost\.trigger\([\s\S]*plannedArticleId/,
        "plannedArticleId must hydrate inputs only, never reach the writer task",
    )
    assert.doesNotMatch(
        routeCode,
        /consume_program_credit|program_clusters|purchase_intent/,
        "a QA article must not touch billing or program state",
    )

    assert.match(route, /generateBlogPost\.trigger\(/)
    assert.match(route, /clusterPosition/)
    assert.match(route, /\.delete\(\)\.eq\("id", article\.id\)/)
})

test("a purchased audit is never shown as ineligible", async () => {
    const [scopeAction, scopeResults, publicPage] = await Promise.all([
        text("actions/harvest.ts"),
        text("components/audit/scope-results.tsx"),
        text("app/audit/[token]/page.tsx"),
    ])

    // selectQualifiedProgramScope filters out SOLD clusters — it answers "can
    // they buy another program", not "is this audit any good". After a purchase
    // every cluster is sold, so it returns zero. Rendering that raw told a
    // paying customer "Not eligible for a program yet. 0 unsold qualified
    // clusters" and "The selected six contain 0 articles" — directly above the
    // 58 articles they had just paid for.
    for (const [file, source] of [
        ["actions/harvest.ts", scopeAction],
        ["app/audit/[token]/page.tsx", publicPage],
    ]) {
        assert.match(source, /hasActiveProgram/, `${file}: must know a program exists`)
        assert.match(
            source,
            /belowViableThreshold: !checkoutEligible && !hasActiveProgram/,
            `${file}: "below viable threshold" must never mean "already sold"`,
        )
        // The displayed scope must come from the purchased program, not from a
        // fresh selection that has nothing left to select.
        assert.match(source, /displayClusterIds/, `${file}: must show the purchased clusters`)
        assert.match(source, /displayArticleCount/, `${file}: must show the purchased article count`)
    }

    // The ineligibility banner must be suppressed on all three signals.
    assert.match(
        scopeResults,
        /!scope\.checkoutEligible && !scope\.hasActiveProgram && !progress &&/,
        "the not-eligible banner must never render to someone who already bought",
    )

    // Ineligible audits must not keep the happy-path program copy.
    assert.match(
        scopeResults,
        /Measured clusters \(not yet a program\)/,
        "ineligible audits must title measured clusters honestly",
    )
    // Counts are always derived from what the audit measured. A hard-coded
    // "six" told a business with 4 real clusters that its site was ineligible.
    assert.match(scopeResults, /\$\{recommended\.length\}-cluster program/)
    assert.doesNotMatch(
        scopeResults,
        /six-cluster program|The selected six|requires six/,
        "no fixed cluster count may remain in audit copy",
    )
    // The ineligible branch must explain depth, not a magic number.
    assert.match(scopeResults, /every\s*\n?\s*cluster needs 8–15 articles/)
})

test("qualified clusters are 8-15 unique articles; thin clusters are never program rows", async () => {
    const [
        productTruth,
        policy,
        clusterer,
        assembly,
        pricing,
        linkGraph,
    ] = await Promise.all([
        text("config/product-truth.ts"),
        text("lib/harvest/policy.ts"),
        text("lib/harvest/clusterer.ts"),
        text("lib/harvest/assembly.ts"),
        text("components/landing/PricingSection.tsx"),
        text("lib/harvest/link-graph.ts"),
    ])

    assert.match(productTruth, /minClusterArticles:\s*8/)
    assert.match(productTruth, /maxClusterArticles:\s*15/)
    assert.match(policy, /minQualifiedClusterArticles:\s*8/)
    assert.match(policy, /version:\s*"evidence-bound-writer-v5\.0\.0"/)
    assert.match(pricing, /Between 8 and 15 per cluster/)

    // The undersized escape that forced one 1–7 article cluster is gone.
    assert.doesNotMatch(
        clusterer,
        /No group reached the minimum size, so everything merges into one/,
    )
    assert.match(
        clusterer,
        /TARGET_CLUSTER_MIN = HARVEST_POLICY\.minQualifiedClusterArticles/,
    )

    // A thin domain still never becomes a program row — but its units are now
    // RETURNED for absorption instead of being filtered into a counter and
    // destroyed. That silent drop cost one audit 33% of its measured demand.
    assert.match(clusterer, /orphanedUnits/)
    assert.match(clusterer, /returned for absorption/)
    assert.doesNotMatch(
        clusterer,
        /residual undersized articles=/,
        "undersized units must be absorbed, not counted and discarded",
    )

    // Persist path must still reject any cluster below the floor.
    assert.match(assembly, /"cluster_too_small"/)
    assert.match(assembly, /will be absorbed into the nearest qualifying cluster/)
    assert.match(assembly, /0 gaps —/)
    assert.match(assembly, /findDuplicateArticlePairs/)
    assert.match(linkGraph, /qualified clusters require 8-15/)
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

test("competitor evidence stays attributable instead of being laundered", async () => {
    const writer = await text("trigger/generate-blog.ts")

    // The research search uses the article's own keyword, so top results ARE
    // the ranking competitors. They reached `external_link`, where §4 forbids
    // citing them — the model resolved that contradiction by dropping the link.
    assert.match(writer, /isKnownCompetitorUrl/)
    assert.match(writer, /If sourceKind is known_competitor, name\/attribute sourceTitle/)
    assert.match(writer, /never generalize it into an industry fact/)
    assert.doesNotMatch(writer, /Do NOT cite them by name/)
})

test("program sections receive only their referenced evidence packet", async () => {
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
    // New program articles receive only explicit fact IDs for the section.
    assert.match(outlineSchema, /capability_fact_ids/)
    assert.match(outlineSchema, /research_evidence_ids/)
    assert.match(outlineSchema, /intent_ids/)
    assert.match(writer, /SECTION EVIDENCE PACKET/)
    assert.match(writer, /allowedCapabilityIds\.has\(fact\.id\)/)
    assert.match(writer, /allowedEvidenceIds\.has\(fact\.id\)/)
    assert.match(writer, /Product-specific claims may use only capabilityFacts/)
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

    // 3. Program articles no longer pay for or depend on a separate angle call.
    assert.match(writer, /const angleInsights: AngleInsights \| null = null/)
    assert.doesNotMatch(writer, /await deriveAngleInsights\(/)
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

    // Each class must exist as a machine-readable decision, so a drop can be
    // told apart from a merely-adjacent one in diagnostics.
    assert.match(classifier, /"third_party_branded"/)
    assert.match(classifier, /"publisher_specific"/)
    // Autocomplete is a popularity engine, so mass-market "how do I do this in
    // <someone else's platform>" questions leak in even when the job is exactly
    // what the customer sells.
    assert.match(classifier, /"platform_native"/)

    // The union, the validator set and the response schema must agree. A value
    // the schema permits but VALID_DECISIONS omits fails the entire batch and,
    // after the retry budget, aborts an audit whose spend is already committed.
    const validatorSet = classifier.slice(
        classifier.indexOf("const VALID_DECISIONS"),
        classifier.indexOf("])", classifier.indexOf("const VALID_DECISIONS")),
    )
    const schemaEnum = classifier.slice(
        classifier.indexOf("enum: ["),
        classifier.indexOf("],", classifier.indexOf("enum: [")),
    )
    for (const decision of [
        "direct",
        "adjacent",
        "unrelated",
        "third_party_branded",
        "publisher_specific",
        "platform_native",
    ]) {
        assert.ok(validatorSet.includes(`"${decision}"`), `VALID_DECISIONS missing ${decision}`)
        assert.ok(schemaEnum.includes(`"${decision}"`), `responseSchema enum missing ${decision}`)
    }
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

    // The audited site is not a gap source. `excludeBrands` already carried the
    // subject, but it only ever tested the QUESTION TEXT for a brand token — so
    // a generic FAQ line off the customer's own page passed and was sold back
    // to them as a gap. A real BringBack plan contained four of their own
    // product-page FAQs as planned articles. The host must be checked too.
    const { isSameHost } = await import("../lib/harvest/types.ts")
    assert.equal(isSameHost("https://bringback.pro/ai-family-portrait", "https://bringback.pro"), true)
    assert.equal(isSameHost("https://www.bringback.pro/compare", "https://bringback.pro"), true)
    assert.equal(isSameHost("https://blog.bringback.pro/post", "https://bringback.pro"), true)
    assert.equal(isSameHost("https://competitor.example/faq", "https://bringback.pro"), false)
    // An unparseable or absent subject must never match, or one bad URL would
    // silently empty the entire harvest instead of failing loudly.
    assert.equal(isSameHost("https://bringback.pro", undefined), false)
    assert.equal(isSameHost("not a url", "https://bringback.pro"), false)

    const serpQuestions = await text("lib/harvest/serp-questions.ts")
    assert.match(serpQuestions, /if \(isSameHost\(result\.url, subjectUrl\)\) continue/)
    assert.match(assembly, /harvestSerpQuestions\([\s\S]{0,600}input\.subjectUrl/)

    // Production audits failed closed when Gemini mangled UUID family_ids or
    // returned a non-direct row with an invented id. Short aliases (f1, f2)
    // are what the model sees; UUIDs are resolved after. Non-direct unknown
    // family refs must clear, not abort the batch.
    assert.match(classifier, /buildFamilyAliasMaps|aliasToId/)
    assert.match(classifier, /resolveFamilyRef/)
    assert.match(classifier, /BATCH_SIZE = 25/)
    assert.match(classifier, /family_id=\$\{alias\}/)
    assert.match(
        classifier,
        /direct, family_id=f1/,
        "worked examples must show family_id aliases, not bare 'direct'",
    )
    assert.match(
        classifier,
        /Non-direct: an unknown\/mangled family_id must not/,
    )

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
        // fetch call must appear strictly after setBrandData is invoked for
        // the analyze result, not be awaited before it.
        //
        // Matches any call shape. It used to pin the literals `setBrandData({`
        // and `setBrandData(data)`, which made the `complete` handler
        // un-refactorable: switching to the updater form `setBrandData((current)
        // => …)` — required to stop that handler discarding the founder's edits
        // — failed a test whose own comment is about ORDERING, not call shape.
        const demandFetchIdx = client.indexOf("/api/analyze-brand/demand-check")
        const beforeDemand = client.slice(0, demandFetchIdx)
        const setBrandDataIdx = beforeDemand.lastIndexOf("setBrandData(")
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

test("any cluster count prices coherently without a new billing product", async () => {
    const { programPricing, availableTiers, PRODUCT_TRUTH } = await import(
        "../config/product-truth.ts"
    )

    // A fixed six meant a narrower business simply could not buy. Scope is now
    // whatever the audit measured, and the three existing velocity products
    // already price per cluster correctly — only the period count varies.
    // 8 is included deliberately: it is where Dominate ($224.63) crept above
    // Accelerate ($224.50) under the earlier baseline-only rule.
    for (const clusters of [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12]) {
        // Only tiers the scope can actually fill. A 2-cluster scope cannot be
        // sold at "3 clusters per period" — the customer would pay a full
        // period for two clusters, making the fastest tier the worst value.
        const offerable = availableTiers(clusters)
        assert.ok(offerable.length >= 1, `no tier offerable at ${clusters} clusters`)
        // Close is always offerable and always the baseline price per cluster.
        assert.ok(offerable.includes("close"), "Close must always be offerable")

        const quotes = offerable.map((tier) => programPricing(clusters, tier))
        for (const quote of quotes) {
            assert.equal(quote.clusters, clusters)
            assert.ok(
                Number.isInteger(quote.billingPeriods) && quote.billingPeriods >= 1,
                "billing periods must be a whole number so cancellation lands on a boundary",
            )
            // A period may be partial in clusters, never in price.
            assert.equal(
                quote.total,
                quote.billingPeriods * quote.pricePerPeriod,
                "total must be whole periods at the tier price",
            )
            assert.ok(
                quote.billingPeriods * quote.clustersPerMonth >= clusters,
                "the schedule must cover every purchased cluster",
            )
        }
        // Faster delivery stays cheaper per cluster — an ordinary volume
        // discount, and what makes any count defensible without new products.
        for (let i = 1; i < quotes.length; i++) {
            assert.ok(
                quotes[i].perCluster <= quotes[i - 1].perCluster,
                `per-cluster price must not rise with velocity at ${clusters} clusters: ` +
                    quotes.map((q) => q.perCluster.toFixed(2)).join(" / "),
            )
        }
    }

    // Zero clusters must not divide by zero or invent a charge.
    const none = programPricing(0, "close")
    assert.equal(none.billingPeriods, 0)
    assert.equal(none.total, 0)
    assert.equal(none.perCluster, 0)
    assert.equal(none.available, false)
    assert.deepEqual(availableTiers(0), [])

    // The retired invariant must not creep back as a hard gate.
    const productTruth = await text("config/product-truth.ts")
    assert.doesNotMatch(productTruth, /MUST DIVIDE .*EXACTLY/)
    assert.match(productTruth, /SCOPE IS DYNAMIC/)
    assert.ok(PRODUCT_TRUTH.tiers.close.clustersPerMonth === 1)
})

test("tier metadata still describes whole periods for the default scope", async () => {
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
        onboardingSurface(),
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
    // Storage keys belong to the route, not to a screen.
    assert.match(await text(ONBOARDING_ROUTE), /onboarding_competitors/)
    assert.match(review, /disableAdd=\{atCap\}/)
    assert.match(review, /\{totalDirections\}\/\{MAX_SEARCH_DIRECTIONS\}/)
    assert.match(review, /Evidence \(\{family\.evidence\.length\}\)/)
    assert.match(review, /Most important category first/)
    assert.match(review, />Category</)
    assert.match(review, />Keywords</)
    assert.match(review, /What this helps with/)
    assert.match(review, /Add a keyword, Enter/)
    assert.doesNotMatch(review, /Google searches|search chips|Customer job/)
    // The cap is applied where scope is now produced — the scope endpoint.
    assert.match(
        await text("app/api/analyze-brand/scope/route.ts"),
        /trimFamiliesToSearchCap/,
    )
    assert.match(
        await text("lib/scope-search-cap.ts"),
        /export function trimFamiliesToSearchCap/,
    )
    assert.match(
        await text("lib/scope-search-cap.ts"),
        /MAX_SEARCH_DIRECTIONS = 12/,
    )

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
        // Renders the only outcome evidence on the site, so it is the file most
        // able to drift back into a guarantee. It must be governed like the rest.
        "components/landing/AICitations.tsx",
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

    // The case study may report what happened on our own property; it may never
    // convert that record into a promise to a customer. Three passes over this
    // page drifted, so the disclaimer is pinned rather than trusted.
    const citations = await text("components/landing/AICitations.tsx")
    assert.match(citations, /not because we can promise you the same/i)
    assert.match(citations, /cannot honestly guarantee rankings|Nobody can honestly guarantee rankings/i)
    assert.doesNotMatch(citations, /\byou will (?:rank|get cited|be cited)\b/i)
    // Only AFFIRMATIVE guarantees are forbidden. The disclaimer itself has to be
    // able to say nobody can guarantee rankings, so a blanket ban on the word
    // would forbid the very sentence that keeps this section honest.
    assert.doesNotMatch(citations, /\bwe guarantee\b/i)
    assert.doesNotMatch(citations, /\bguaranteed (?:rankings|traffic|citations)\b/i)
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

test("brandless authenticated users cannot open the dashboard shell", async () => {
    const [gate, proxy, layout, onboardingActions] = await Promise.all([
        text("lib/onboarding-gate.ts"),
        text("proxy.ts"),
        text("app/(protected)/layout.tsx"),
        text("actions/onboarding.ts"),
    ])

    assert.match(gate, /export async function userHasActiveBrand/)
    assert.match(gate, /pathRequiresBrand/)
    for (const prefix of [
        "/content-plan",
        "/audit",
        "/articles",
        "/settings",
        "/account",
        "/subscribe",
    ]) {
        assert.ok(
            gate.includes(`"${prefix}"`),
            `brand gate must include ${prefix}`,
        )
    }

    assert.match(proxy, /pathRequiresBrand\(pathname\)/)
    assert.match(proxy, /userHasActiveBrand\(supabase, user\.id\)/)
    assert.match(proxy, /hasBrand \? '\/content-plan' : '\/onboarding'/)
    assert.match(onboardingActions, /requireBrandForDashboard/)
    assert.match(layout, /requireBrandForDashboard/)
    assert.match(layout, /pathname\.startsWith\("\/founder"\)/)
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

    // Title reflects the measured count, not a fixed six.
    assert.match(scopeResults, /Your \$\{recommended\.length\}-cluster program/)
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

test("intent-sized program lengths use the frozen short, medium and long ranges", async () => {
    assert.equal(
        selectIntentSizedLength({
            isPillar: false,
            articleType: "informational",
            absorbedIntentCount: 0,
        }),
        "short",
    )
    assert.equal(
        selectIntentSizedLength({
            isPillar: false,
            articleType: "howto",
            absorbedIntentCount: 0,
        }),
        "medium",
    )
    assert.equal(
        selectIntentSizedLength({
            isPillar: false,
            articleType: "commercial",
            absorbedIntentCount: 0,
        }),
        "medium",
    )
    assert.equal(
        selectIntentSizedLength({
            isPillar: false,
            articleType: "informational",
            absorbedIntentCount: 2,
        }),
        "long",
    )
    assert.equal(
        selectIntentSizedLength({
            isPillar: true,
            articleType: "informational",
            absorbedIntentCount: 0,
        }),
        "long",
    )

    const lengths = await text("lib/prompts/article-length.ts")
    for (const [minimum, maximum] of [["1,200", "1,800"], ["1,600", "2,200"], ["2,400", "3,200"]]) {
        assert.match(lengths, new RegExp(`${minimum}[^0-9]+${maximum}`))
    }
})

test("capability facts stay operation-bound across unrelated industries", () => {
    const fixtures = [
        ["ai-consumer", "compose", "Upload photos", "Create a digital composite"],
        ["developer-tools", "trace", "Send a trace ID", "Return a trace timeline"],
        ["fintech", "reconcile", "Upload a ledger", "Return matched transactions"],
        ["ecommerce-infra", "sync", "Connect a catalogue", "Sync inventory records"],
        ["agency", "audit", "Provide a site URL", "Deliver an evidence audit"],
    ]

    for (const [industry, operationKey, input, action] of fixtures) {
        const contract = {
            version: "capability-v1",
            deliveryMode: industry,
            operations: [{
                key: operationKey,
                customerJob: action,
                inputs: [input],
                action,
                outputs: [action],
                limits: [],
                evidenceRefs: [`${industry}-fact`],
            }],
            facts: [{
                id: `${industry}-fact`,
                url: `https://example.com/${industry}`,
                quote: `${input}. ${action}.`,
            }],
        }
        assert.deepEqual(
            capabilityFactIdsForOperation(contract, operationKey),
            [`${industry}-fact`],
        )
        assert.deepEqual(capabilityFactIdsForOperation(contract, "other"), [])
    }
})

test("the writer contract blocks the BringBack semantic-drift failure upstream", async () => {
    const [classifier, clusterer, assembly, writer, schema, migration, payload] =
        await Promise.all([
            text("lib/harvest/scope-classifier.ts"),
            text("lib/harvest/clusterer.ts"),
            text("lib/harvest/assembly.ts"),
            text("trigger/generate-blog.ts"),
            text("lib/schemas/outline.ts"),
            text("supabase/migrations/20260807_writer_intent_contracts.sql"),
            text("lib/writer/planned-article-payload.ts"),
        ])

    assert.match(classifier, /mechanically_entailed/)
    assert.match(classifier, /delivery=/)
    assert.match(classifier, /source_context=/)
    assert.match(clusterer, /candidate\.intentBinding\.operationKey !== gap\.intentBinding\.operationKey/)
    assert.match(clusterer, /candidate\.intentBinding\.solutionMode !== gap\.intentBinding\.solutionMode/)
    assert.match(assembly, /capabilityFactIdsForOperation/)
    assert.match(assembly, /sourceContext: query\.source_context/)
    assert.match(assembly, /articleContract/)
    assert.match(writer, /Preserve entity type and delivery mode/)
    assert.match(writer, /Do not turn software into a physical service/)
    assert.match(writer, /Research evidence proves category facts only/)
    assert.match(writer, /Do not invent implementation details, UI paths, performance/)
    assert.doesNotMatch(writer, /Founder = "I\/My team"/)
    assert.doesNotMatch(writer, /I found this tool snappy/)
    assert.match(schema, /capability_fact_ids/)
    assert.match(schema, /research_evidence_ids/)
    assert.match(schema, /intent_ids/)
    assert.match(migration, /source_context/)
    assert.match(migration, /intent_binding/)
    assert.match(migration, /article_contract/)
    assert.match(payload, /resolveCapabilityFacts/)
})

test("confirmed capability contracts cannot split between brand JSON and scope rows", async () => {
    const [migration, repairMigration, auditRoute] = await Promise.all([
        text("supabase/migrations/20260807_writer_intent_contracts.sql"),
        text("supabase/migrations/20260808_repair_scope_capability_sync.sql"),
        text("app/api/topical-audit/route.ts"),
    ])

    for (const sql of [migration, repairMigration]) {
        assert.match(sql, /hydrate_brand_scope_capability_contract/)
        assert.match(sql, /trg_hydrate_brand_scope_capability_contract/)
        assert.match(sql, /sync_brand_scope_capability_contracts/)
        assert.match(sql, /AFTER INSERT OR UPDATE OF brand_data/)
    }
    assert.match(repairMigration, /Repair every existing split-brain row/)
    assert.doesNotMatch(migration, /SELECT pg_get_functiondef/)
    assert.doesNotMatch(migration, /EXECUTE v_new/)
    assert.doesNotMatch(repairMigration, /SELECT pg_get_functiondef/)
    assert.doesNotMatch(repairMigration, /EXECUTE v_new/)

    assert.match(auditRoute, /reconcileScopeCapabilityContracts/)
    assert.match(auditRoute, /snapshotFamilies\.find\(\(family\) => family\.id === row\.id\)/)
    assert.match(auditRoute, /confirmed product mechanics could not be synchronized/i)
    assert.match(auditRoute, /missing their verified mechanics/i)
})

test("contract research is bounded by frozen intents and exact source quotes", async () => {
    const writer = await text("trigger/generate-blog.ts")
    assert.match(writer, /requiredQueries[\s\S]*\.slice\(0, 2\)/)
    assert.match(writer, /isEvidenceQuoteSupported\(source\.content, quote\)/)
    assert.match(writer, /isKnownCompetitorUrl/)
    assert.match(writer, /known_competitor evidence must remain explicitly attributed/)
    assert.doesNotMatch(writer, /targeted_queries\.slice\(0, 2\)/)
    assert.match(writer, /const angleInsights: AngleInsights \| null = null/)
})

test("program writing uses bounded packets and skips legacy enrichment", async () => {
    const [writer, purchaseIntent, founderTest] = await Promise.all([
        text("trigger/generate-blog.ts"),
        text("lib/harvest/purchase-intent.ts"),
        text("app/api/founder/test-article/route.ts"),
    ])
    assert.match(writer, /const effectiveArticleLength = articleContract/)
    assert.match(writer, /if \(!articleContract\) \{\s*await enrichOutlineWithLinks/)
    assert.match(writer, /if \(!plannedArticleId\) \{\s*await saveTopicMemory/)
    assert.match(writer, /if \(userId && !plannedArticleId\)/)
    assert.match(writer, /short" \? 0 : effectiveContract\.articleLength === "medium" \? 1 : 2/)
    assert.match(writer, /section\.word_budget/)
    // The bridge must be a flow cue, never a continuation instruction: phrased
    // as "continue naturally", a truncated section was completed by the next
    // one and the article read as one severed paragraph split by headings.
    assert.doesNotMatch(writer, /Continue naturally from this final prose context only/)
    assert.match(writer, /do NOT continue or complete its sentence/)
    // instruction_note is the only per-section brief the contract writer gets.
    assert.match(writer, /brief: isIntro \? outline\.intro\?\.instruction_note : currentSection\.instruction_note/)
    assert.match(purchaseIntent, /harvest_policy_version/)
    assert.match(purchaseIntent, /audit_policy_stale/)
    assert.doesNotMatch(founderTest, /plannedArticleId:\s*hydrated/)
    assert.match(founderTest, /founderLengthOverride/)
    assert.match(founderTest, /articleLength:\s*founderLengthOverride/)
    // A QA run hydrated from a stale audit measures the old policy's evidence,
    // not the current writer — it masked the real writer bugs once already.
    assert.match(founderTest, /hydrated\.auditPolicyVersion !== HARVEST_POLICY\.version/)
    assert.match(founderTest, /allowStalePolicy/)
})

test("brand crawl is checkpointed so refresh does not re-extract", async () => {
    const [
        analyze,
        scope,
        corpus,
        migration,
        onboardingRoute,
        brandOnboarding,
    ] = await Promise.all([
        text("app/api/analyze-brand/route.ts"),
        text("app/api/analyze-brand/scope/route.ts"),
        text("lib/brand-analyze-corpus.ts"),
        text("supabase/migrations/20260813_brand_analyze_corpus.sql"),
        text(ONBOARDING_ROUTE),
        text("components/brand-onboarding.tsx"),
    ])

    assert.match(analyze, /maxDuration = 300/)
    assert.match(scope, /maxDuration = 300/)
    assert.doesNotMatch(analyze, /tasks\.trigger/)
    assert.doesNotMatch(scope, /tasks\.trigger/)

    const extractIdx = analyze.indexOf("tvly.extract")
    const readIdx = analyze.indexOf("readCorpus")
    assert.ok(readIdx >= 0 && extractIdx >= 0 && readIdx < extractIdx)

    assert.match(analyze, /emitCrawlDone/)
    assert.match(analyze, /trimCorpusPages/)
    assert.doesNotMatch(
        analyze,
        /\.map\(\(page\) => \(\{\s*url: page\.url\s*\}\)\)/,
    )
    assert.match(analyze, /beginCorpusRun/)
    assert.match(analyze, /kind === "blocked"/)
    assert.match(analyze, /saveCorpusPages/)
    assert.match(analyze, /countTavilyStartsToday/)
    assert.match(analyze, /MAX_TAVILY_STARTS_PER_DAY/)
    assert.match(corpus, /MAX_TAVILY_STARTS_PER_DAY = 3/)
    assert.match(corpus, /tavily_started_at/)
    assert.match(corpus, /beginCorpusRun/)
    assert.match(corpus, /blocked/)

    assert.doesNotMatch(scope, /tvly\.search/)
    assert.doesNotMatch(scope, /searchDepth:\s*"advanced"/)
    assert.match(scope, /readCorpus/)
    assert.match(scope, /batchExtractHtmlSnapshots/)
    assert.match(scope, /batchExtractTitles/)
    assert.match(scope, /refineScopeRoles\(/)

    assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.brand_analyze_corpus/)
    assert.match(migration, /ENABLE ROW LEVEL SECURITY/)
    assert.match(migration, /auth\.uid\(\) = user_id/)

    assert.match(onboardingRoute, /CRAWL_PAGES/)
    assert.match(onboardingRoute, /persistCrawlPages/)
    assert.match(onboardingRoute, /restoreCrawlPages/)
    assert.match(onboardingRoute, /SCOPE_STARTED_AT/)
    assert.match(onboardingRoute, /Look again/)
    assert.doesNotMatch(
        onboardingRoute,
        /if \(analyzingStartedAt[\s\S]{0,400}handleAnalyzeBrand\(/,
    )
    assert.doesNotMatch(
        onboardingRoute,
        /if \(scopeStartedAt[\s\S]{0,400}handleFindScope\(/,
    )

    assert.match(brandOnboarding, /CRAWL_PAGES_KEY/)
    assert.match(brandOnboarding, /persistCrawlPages/)
    assert.match(brandOnboarding, /restoreCrawlPages/)
    assert.match(brandOnboarding, /SCOPE_STARTED_KEY/)
    assert.doesNotMatch(brandOnboarding, /handleAnalyze\(\)/)
})

test("AI-answer gaps are evidential, not scored into existence", async () => {
    // The pivot's risk is that "visibility" becomes a weighted composite nobody
    // can check — which is the same failure as the absolute-threshold coverage
    // that once reported 99% authority for a site covering almost nothing.
    // Every verdict must be a counted fact about stored answers.
    const [parser, mapper, probe, migration, evidencePage] = await Promise.all([
        text("lib/visibility/answer-parser.ts"),
        text("lib/visibility/gap-mapper.ts"),
        text("lib/visibility/run-probe.ts"),
        text("supabase/migrations/20260815_ai_visibility_probe.sql"),
        text("app/evidence/ai-answer/[runId]/[promptId]/page.tsx"),
    ])

    // Verdicts are derived from counts, never from a tunable cut-off.
    assert.match(mapper, /export function classifyPrompt/)
    assert.match(mapper, /mentionCount > 0/)
    assert.match(mapper, /mentionPosition === 1/)
    // No score threshold may decide whether something is a gap.
    assert.doesNotMatch(mapper, /visibilityScore\s*[<>]=?\s*\d/)

    // Presence is a plain proportion, not upstream's weighted composite.
    // Upstream folds sentiment into a 0-100 score at 15 points; that is an
    // extra model call per answer feeding a number nobody can check. Assert the
    // absence of the *field*, not of the word — the comment explaining why it
    // is gone is the part most worth keeping.
    assert.match(parser, /export function presenceRate/)
    assert.doesNotMatch(parser, /^\s*sentiment[?]?:/m)
    assert.doesNotMatch(parser, /sentiment ===/)

    // Provenance: the verbatim answer is the evidence record and is stored
    // whole. A truncated answer is an unverifiable gap.
    assert.match(probe, /answer_text: answer\.text/)
    assert.doesNotMatch(probe, /answer_text:[^\n]*slice\(/)
    assert.match(migration, /answer_text TEXT NOT NULL/)
    assert.match(migration, /Never truncate answer_text/)
    assert.match(evidencePage, /row\.answer_text/)

    // A broken engine must never read as an absence.
    assert.match(probe, /all_engines_failed/)
    assert.match(probe, /totalFailed === totalAttempted/)

    // The gap source is declared in the shared union and weighted explicitly.
    const [types, gapEngine] = await Promise.all([
        text("lib/harvest/types.ts"),
        text("lib/harvest/gap-engine.ts"),
    ])
    assert.match(types, /"ai_answer"/)
    assert.match(gapEngine, /ai_answer:\s*\d+/)
    assert.match(migration, /'autocomplete', 'paa', 'competitor_sitemap', 'ai_answer'/)
})

test("visibility gaps reuse the harvest clusterer rather than forking it", async () => {
    // The entire argument for this design is that a gap is a gap: the clusterer
    // does not care whether it came from a SERP or from ChatGPT declining to
    // name you. A second clustering implementation would be two definitions of
    // "cluster" drifting apart, which is how the plan and the report stop
    // agreeing about what was sold.
    const probe = await text("lib/visibility/run-probe.ts")

    assert.match(probe, /from "@\/lib\/harvest\/clusterer"/)
    assert.match(probe, /collapseToArticles/)
    assert.match(probe, /groupIntoClusters/)
    assert.match(probe, /absorbOrphanedUnits/)
    assert.match(probe, /titleArticles/)
    assert.match(probe, /nameClusters/)

    // No local re-implementation of grouping.
    assert.doesNotMatch(probe, /function (collapse|group)[A-Za-z]*\(/)
})

test("visibility measures the consumer surface, never silently the API", async () => {
    // The measurement this product sells is what a person sees in ChatGPT and
    // Google AI Mode. The provider APIs are a different surface: Petra Labs
    // measured a 32-point visibility swing across OpenAI's three surfaces on
    // the same prompts on the same day, and one brand that appeared in 15-18%
    // of chat trials appeared in ZERO API trials. Reporting that brand at 0%
    // would be indistinguishable from a brand with no AI presence at all.
    //
    // So: Cloro is the default, the API path is opt-in, and every stored answer
    // carries the surface it came from.
    const [engines, probe, route, surfaces, dashboard] = await Promise.all([
        text("lib/visibility/engines.ts"),
        text("lib/visibility/run-probe.ts"),
        text("app/api/visibility/probe/route.ts"),
        text("supabase/migrations/20260815_ai_visibility_surfaces.sql"),
        text("components/visibility/visibility-dashboard.tsx"),
    ])

    // The default pair is the two consumer surfaces.
    assert.match(engines, /DEFAULT_ENGINES[^\n]*=\s*\["chatgpt-web", "google-aimode"\]/)
    assert.match(engines, /api\.cloro\.dev/)

    // Every engine declares its surface, and the API engines are marked as such.
    assert.match(engines, /surface: "consumer_app"/)
    assert.match(engines, /"openai-api"[\s\S]{0,200}surface: "api"/)

    // No Cloro key must never fall back to the API surface on its own.
    assert.match(engines, /if \(!options\.allowApiSurface\) return \[\]/)
    assert.match(route, /allowApiSurface/)

    // The surface reaches the database on every answer row.
    assert.match(probe, /surface: ENGINE_SPECS\[job\.engine\]\.surface/)
    assert.match(surfaces, /ai_probe_results_surface_allowed/)
    assert.match(surfaces, /CHECK \(surface IN \('consumer_app', 'api'\)\)/)

    // And the dashboard reports per surface rather than averaging across kinds.
    assert.match(dashboard, /never averaged together/)
})

test("a Cloro probe runs as a background task, not inside a request", async () => {
    // Cloro is submit-and-poll: one task can take minutes, and upstream allows
    // 30. A probe driven from a serverless route would time out mid-flight and
    // strand a `running` row with no writer, which is the same shape as the
    // audit's abandoned-run bug.
    const [trigger, route, engines] = await Promise.all([
        text("trigger/run-probe.ts"),
        text("app/api/visibility/probe/route.ts"),
        text("lib/visibility/engines.ts"),
    ])

    assert.match(trigger, /id: "run-visibility-probe"/)
    assert.match(trigger, /maxDuration: \d{4}/)
    // A retry would re-submit every task and bill the credits twice.
    assert.match(trigger, /retry: \{ maxAttempts: 1 \}/)

    // The route enqueues and returns; it must not run the probe itself.
    assert.match(route, /tasks\.trigger<typeof runProbeTask>/)
    assert.doesNotMatch(route, /runVisibilityProbe\(/)
    // One live probe per audit — two would double-bill the same measurement.
    assert.match(route, /alreadyRunning/)

    // Two-phase: submit everything, then poll everything.
    assert.match(engines, /export async function submitCloroTask/)
    assert.match(engines, /export async function pollCloroTask/)

    // Credits are counted on success only, because Cloro does not bill failures.
    const probe = await text("lib/visibility/run-probe.ts")
    assert.match(probe, /entry\.creditsUsed \+= ENGINE_SPECS/)
})

test("the dashboard shows the evidence, not just the verdict", async () => {
    // A founder told "you are absent from 26 questions" reasonably suspects a
    // made-up number. The answer that produced each verdict has to be reachable
    // without leaving the page, unedited.
    const [dashboard, evidence] = await Promise.all([
        text("components/visibility/visibility-dashboard.tsx"),
        text("components/visibility/answer-evidence.tsx"),
    ])

    assert.match(dashboard, /AnswerEvidence/)
    assert.match(evidence, /answer\.answer_text/)
    // Captured third-party text is rendered as text, never as HTML. Assert on
    // the JSX usage, not the word — the comment explaining why an engine's
    // output must never be injected is the part worth keeping.
    assert.doesNotMatch(evidence, /dangerouslySetInnerHTML=\{/)
    assert.match(evidence, /<mark/)
    // Status is never carried by colour alone.
    assert.match(dashboard, /Icon: AlertCircle/)
    assert.match(dashboard, /<meta\.Icon/)
})

test("the citation classifier ages by structure, not by a growing domain list", async () => {
    // Upstream's classifier is a curated domain list, and it shows exactly how
    // that decays: its "editorial" list carries motortrend.com, caranddriver.com
    // and jalopnik.com, and its "forum" list carries bimmerpost.com and
    // teslamotorsclub.com — one automotive customer's report, patched host by
    // host. This repo already learned that lesson twice with content-quality
    // regex lists: each round catches the previous examples and misses the next.
    //
    // So the ordering is load-bearing: facts, then structure, then a short list,
    // then an honest "unclassified".
    const classifier = await text("lib/visibility/citation-classifier.ts")

    // Facts from the audit come first and are not list-driven.
    assert.match(classifier, /if \(isSameOrSubdomain\(host, context\.subjectDomains\)\) return "owned"/)
    assert.match(
        classifier,
        /if \(isSameOrSubdomain\(host, context\.competitorDomains\)\) return "competitor"/,
    )

    // Structural rules exist and do not depend on any list.
    assert.match(classifier, /INSTITUTIONAL_TLD\s*=\s*\//)
    assert.match(classifier, /LISTICLE_PATH\s*=\s*\//)
    assert.match(classifier, /COMPARISON_PATH\s*=\s*\//)

    // The honest default is a real category, and its share is reported.
    assert.match(classifier, /return "unclassified"/)
    assert.match(classifier, /unclassifiedShare/)

    // Curated lists stay small. A list that grows past this is the signal that
    // the rule is wrong, not that the list is short.
    for (const listName of [
        "COMMUNITY_HOSTS",
        "SOCIAL_VIDEO_HOSTS",
        "REVIEW_MARKETPLACE_HOSTS",
        "PUBLISHER_HOSTS",
    ]) {
        const block = classifier.match(new RegExp(`const ${listName} = \\[([\\s\\S]*?)\\]`))
        assert.ok(block, `${listName} is missing`)
        const entries = block[1].split(",").filter((line) => line.trim().length > 0)
        assert.ok(
            entries.length <= 15,
            `${listName} has ${entries.length} entries — curated lists must stay small; add a structural signal instead`,
        )
    }

    // Every category carries an action. A count with no next step is trivia.
    assert.match(classifier, /SOURCE_TYPE_ACTIONS/)
    assert.match(classifier, /export function actionabilityOf/)
})

test("cited sources report co-occurrence, never a claim about the page", async () => {
    // We have not fetched the cited pages, so "this listicle omits you" is a
    // claim the data cannot support. What IS supportable is that the answers
    // citing it did not name you. The wording has to keep those apart.
    const [mapper, dashboard] = await Promise.all([
        text("lib/visibility/gap-mapper.ts"),
        text("components/visibility/visibility-dashboard.tsx"),
    ])

    assert.match(mapper, /answersNaming/)
    assert.match(mapper, /co-occurrence/)
    // The UI states the limit next to the claim. Whitespace-tolerant: this is
    // prose inside JSX and the formatter is free to wrap it anywhere.
    assert.match(dashboard, /describes the answers, not the\s+page/)
    assert.match(dashboard, /haven&apos;t fetched these pages/)
})

test("the method panel reads its values from the code that computes them", async () => {
    // Ansvisor's best idea: the formula dialog imports the scoring weights, so
    // the explanation cannot drift from the implementation. A hand-written
    // description of the arithmetic is a doc that goes stale silently.
    const panel = await text("components/visibility/method-panel.tsx")

    assert.match(
        panel,
        /import \{ PROMPT_INTENTS, PROMPTS_PER_FAMILY \} from "@\/lib\/visibility\/prompt-config"/,
    )
    assert.match(panel, /from "@\/lib\/visibility\/citation-classifier"/)
    assert.match(panel, /PROMPT_INTENTS\.map/)

    // It must state limits, not only justify numbers.
    assert.match(panel, /What this measurement cannot tell you/)
    assert.match(panel, /we do not show a trend line/)
    assert.match(panel, /uncategorised/)

    // And it must not invent a composite score to explain.
    assert.match(panel, /There is no visibility score/)
})

test("query fan-out counts what the engines did, and never implies volume", async () => {
    // This is the only demand-side signal in the product observed on the AI
    // surface itself, and it exists because the alternative was buying one.
    // Ansvisor's `est_ai_volume` is Google Ads volume for five LLM-guessed head
    // terms multiplied by a hardcoded 0.15 — three guesses stacked on a real
    // figure about a different search engine. A literal count of what the
    // engines actually ran is smaller and true, and the wording has to keep it
    // that way.
    const { summariseFanOut, blindSpots } = await import("../lib/visibility/fan-out.ts")

    const summary = summariseFanOut([
        {
            promptId: "p1",
            answers: [
                {
                    engine: "google-aimode",
                    namedBrand: false,
                    // A case variant and a repeat inside one answer, plus junk.
                    searchQueries: [
                        "best design to code tools 2026",
                        "Best Design To Code Tools 2026",
                        "sketch to ui",
                        "https://example.com/page",
                        "x",
                    ],
                },
                { engine: "chatgpt-web", namedBrand: false, searchQueries: [] },
            ],
        },
        {
            promptId: "p2",
            answers: [
                {
                    engine: "google-aimode",
                    namedBrand: true,
                    searchQueries: ["best design to code tools 2026"],
                },
                { engine: "chatgpt-web", namedBrand: true, searchQueries: [] },
            ],
        },
        {
            promptId: "p3",
            answers: [
                { engine: "google-aimode", namedBrand: false, searchQueries: ["sketch to ui"] },
            ],
        },
    ])

    const byNorm = Object.fromEntries(summary.queries.map((q) => [q.queryNorm, q]))

    // Case variants fold together, and a repeat inside ONE answer counts once —
    // otherwise a chatty engine inflates its own signal.
    assert.equal(byNorm["best design to code tools 2026"].occurrences, 2)
    assert.equal(byNorm["best design to code tools 2026"].prompts, 2)

    // URLs and single characters are not searches.
    assert.ok(!byNorm["https://example.com/page"])
    assert.ok(!byNorm["x"])

    // `answersNaming` is the actionable column: run twice, named in one.
    assert.equal(byNorm["best design to code tools 2026"].answersNaming, 1)
    assert.equal(byNorm["sketch to ui"].answersNaming, 0)

    // A framing the engines keep reaching for and never find the brand in.
    assert.deepEqual(
        blindSpots(summary).map((q) => q.queryNorm),
        ["sketch to ui"],
    )

    // An engine that exposes nothing must be visible, not implied. Cloro's own
    // note: Perplexity and Copilot populate the fan-out, ChatGPT returns the
    // key empty — and ChatGPT is half the default pair, so a short list must
    // never read as "the engines barely searched".
    assert.equal(summary.hasSilentEngine, true)
    const chatgpt = summary.coverage.find((row) => row.engine === "chatgpt-web")
    assert.equal(chatgpt.answers, 2)
    assert.equal(chatgpt.answersWithFanOut, 0)

    // No display names in a pure counter — labelling is the UI's job, and the
    // decoupling is what keeps this module loadable here.
    assert.ok(!("label" in chatgpt))
})

test("fan-out is never presented as search volume", async () => {
    const [fanOut, dashboard, panel] = await Promise.all([
        text("lib/visibility/fan-out.ts"),
        text("components/visibility/visibility-dashboard.tsx"),
        text("components/visibility/method-panel.tsx"),
    ])

    // The module states the rule, and both surfaces that render it repeat it
    // where the reader is looking at the number.
    assert.match(fanOut, /never be rendered as volume/)
    assert.match(dashboard, /not how many people searched|not a search-volume figure/)
    assert.match(panel, /not search volume/)

    // And no vendor crept back in.
    const files = await Promise.all([
        text("lib/visibility/fan-out.ts"),
        text("lib/visibility/gap-mapper.ts"),
        text("lib/visibility/run-probe.ts"),
    ])
    for (const file of files) {
        assert.doesNotMatch(file, /dataforseo/i)
        assert.doesNotMatch(file, /AI_VOLUME_MULTIPLIER/)
    }
})

test("run size defaults small and the ceiling is a separate rail", async () => {
    // Every prompt costs real Cloro credits on every engine. An omitted
    // `maxPrompts` must never spend a full-size run's worth by accident — but
    // the cheap default and the safety ceiling are different decisions and must
    // not be the same constant, or raising one silently raises the other.
    const { DEFAULT_PROMPTS_PER_RUN, MAX_PROMPTS_PER_RUN } = await import(
        "../lib/visibility/prompt-config.ts"
    )

    assert.ok(
        DEFAULT_PROMPTS_PER_RUN < MAX_PROMPTS_PER_RUN,
        "the default must be cheaper than the ceiling, not equal to it",
    )
    assert.ok(
        DEFAULT_PROMPTS_PER_RUN <= 20,
        "the default is a spend decision — keep it small until runs are calibrated",
    )

    const route = await text("app/api/visibility/probe/route.ts")
    // An omitted field falls back to the default; an explicit one is clamped to
    // the ceiling rather than to the default.
    assert.match(route, /body\.maxPrompts \?\? DEFAULT_PROMPTS_PER_RUN/)
    assert.match(route, /MAX_PROMPTS_PER_RUN,\s*\)/)

    // And the panel reports what the run actually asked, not the per-area
    // candidate count — those are different numbers now that a cap applies.
    const panel = await text("components/visibility/method-panel.tsx")
    assert.match(panel, /promptCount/)
    assert.match(panel, /candidate questions/)

    // The panel is a client component; it must read these from the import-free
    // config, not from the builder that pulls in the Gemini client.
    assert.match(panel, /from "@\/lib\/visibility\/prompt-config"/)
})

test("onboarding lets the user confirm, edit, and prune buyer prompts before probing", async () => {
    const [page, promptsStep, generateRoute, probeRoute, probeRunner] = await Promise.all([
        onboardingSurface(),
        text("components/onboarding/steps/prompts-step.tsx"),
        text("app/api/visibility/prompts/generate/route.ts"),
        text("app/api/visibility/probe/route.ts"),
        text("lib/visibility/run-probe.ts"),
    ])

    // 1. Prompts step is a distinct screen rendered in the onboarding surface.
    assert.match(page, /Confirm the questions buyers ask AI/)
    assert.match(page, /Why are brands not named in these questions\?/)
    assert.match(promptsStep, /onRegenerateFamily/)
    assert.match(promptsStep, /checkBrandMention/)

    // 2. The generation endpoint bridges confirmed scope to the prompt builder.
    assert.match(generateRoute, /buildBuyerPrompts/)
    assert.match(generateRoute, /normalizeScopeFamilies/)
    assert.match(generateRoute, /POST/)

    // 3. The probe route and worker accept user-confirmed prompts.
    assert.match(probeRoute, /prompts\?: import\("@\/lib\/visibility\/prompt-builder"\)\.BuyerPrompt\[\]/)
    assert.match(probeRoute, /prompts:\s*body\.prompts/)
    assert.match(probeRunner, /options\.prompts && options\.prompts\.length > 0/)
})
