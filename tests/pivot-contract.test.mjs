import assert from "node:assert/strict"
import { readFile, access } from "node:fs/promises"
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

test("program scope selects only the six highest-priority unsold qualified clusters", () => {
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
    assert.match(production, /assembleHarvest\(\s*\{/)
    assert.match(production, /persistHarvestOutput\(options\.auditId, output\)/)
    assert.match(production, /initialSourceCallLedger/)
    assert.match(assembly, /filterToSearchedQueries/)
    assert.match(assembly, /capProportionally\(.*HARVEST_POLICY\.maxQueries/s)
    assert.match(assembly, /resultHash/)
    assert.match(assembly, /onProgress/)
    assert.match(assembly, /phase:\s*"scanning_user_site"/)
    assert.match(assembly, /phase:\s*"scanning_competitors"/)
    assert.match(policy, /maxCompetitors:\s*4/)
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
        "components/landing/Navbar.tsx",
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
    assert.match(layout, /href="\/content-plan"/)
    assert.match(layout, /Leave setup/)
    assert.match(layout, /form action=\{signOut\}/)
    assert.match(page, /min-h-\[calc\(100vh-5rem\)\]/)
    assert.match(consent, /isFocusedOnboarding/)
    assert.match(consent, /\["do", "chat:hide"\]/)
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
