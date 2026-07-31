"use client"

import { useMemo, useState } from "react"
import { ExternalLink, Loader2, Sparkles } from "lucide-react"

/**
 * The five opening shapes, mirroring ANSWER_FRAMINGS × SECOND_MOVES in
 * lib/writer/composition.ts. Shown so a quality check can target a specific
 * pattern rather than guessing which one an article received.
 */
const INTRO_PATTERNS = [
    { position: 0, label: "definition + attribute-list" },
    { position: 1, label: "verdict + mechanism" },
    { position: 2, label: "direct-number + worked-example" },
    { position: 3, label: "corrective + common-failure" },
    { position: 4, label: "conditional + attribute-list" },
]

type Brand = { id: string; websiteUrl: string; productName: string }

type PlannedArticle = {
    id: string
    brandId: string
    title: string
    mainKeyword: string
    supportingKeywords: string[]
    articleType: string
    isPillar: boolean
    generationStatus: string
    clusterName: string | null
    clusterPosition: number
}

type Result = { articleId: string; runId: string; slug: string }

export function TestArticleRunner({
    brands,
    plannedArticles,
}: {
    brands: Brand[]
    plannedArticles: PlannedArticle[]
}) {
    const [brandId, setBrandId] = useState(brands[0]?.id || "")
    const [title, setTitle] = useState("")
    const [keyword, setKeyword] = useState("")
    const [articleType, setArticleType] = useState("informational")
    const [supporting, setSupporting] = useState("")
    const [sourceQueries, setSourceQueries] = useState("")
    const [clusterName, setClusterName] = useState("")
    const [clusterPosition, setClusterPosition] = useState(0)
    const [isPillar, setIsPillar] = useState(false)
    const [running, setRunning] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [result, setResult] = useState<Result | null>(null)

    const brandArticles = useMemo(
        () => plannedArticles.filter((row) => row.brandId === brandId),
        [plannedArticles, brandId],
    )

    /** Loads a planned article's real inputs, still fully editable afterwards. */
    const loadPlanned = (row: PlannedArticle) => {
        setTitle(row.title)
        setKeyword(row.mainKeyword)
        setArticleType(row.articleType)
        setSupporting(row.supportingKeywords.join(", "))
        setClusterName(row.clusterName || "")
        setClusterPosition(row.clusterPosition)
        setIsPillar(row.isPillar)
        setResult(null)
        setError(null)
    }

    const generate = async () => {
        if (!brandId || !title.trim() || !keyword.trim()) {
            setError("Brand, title and keyword are required.")
            return
        }
        setRunning(true)
        setError(null)
        setResult(null)
        try {
            const res = await fetch("/api/founder/test-article", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    brandId,
                    title: title.trim(),
                    keyword: keyword.trim(),
                    articleType,
                    supportingKeywords: supporting
                        .split(",")
                        .map((value) => value.trim())
                        .filter(Boolean),
                    sourceQueries: sourceQueries
                        .split("\n")
                        .map((value) => value.trim())
                        .filter(Boolean),
                    cluster: clusterName.trim(),
                    clusterPosition,
                    isPillar,
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "Generation could not be queued.")
            setResult(data)
        } catch (e: any) {
            setError(e.message || "Something went wrong.")
        } finally {
            setRunning(false)
        }
    }

    if (brands.length === 0) {
        return (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                <strong className="font-medium">No brand on this account yet.</strong> This
                page reads real brand data — style DNA, product facts, search preferences —
                so complete the brand step of onboarding first. An audit is <em>not</em>
                required.
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <section className="rounded-xl border border-stone-200 bg-white p-5">
                <label className="mb-1 block text-xs font-medium text-stone-600">Brand</label>
                <select
                    value={brandId}
                    onChange={(e) => setBrandId(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                >
                    {brands.map((brand) => (
                        <option key={brand.id} value={brand.id}>
                            {brand.productName} — {brand.websiteUrl}
                        </option>
                    ))}
                </select>
            </section>

            {brandArticles.length > 0 && (
                <section className="rounded-xl border border-stone-200 bg-white p-5">
                    <h2 className="text-sm font-semibold text-stone-900">
                        Planned articles ({brandArticles.length})
                    </h2>
                    <p className="mb-3 mt-1 text-xs text-stone-500">
                        Load one to generate it exactly as the program would — same title,
                        keyword, cluster and intro pattern. Everything stays editable.
                    </p>
                    <div className="max-h-80 space-y-1.5 overflow-y-auto">
                        {brandArticles.map((row) => (
                            <button
                                key={row.id}
                                type="button"
                                onClick={() => loadPlanned(row)}
                                className="flex w-full items-start justify-between gap-3 rounded-lg border border-stone-200 px-3 py-2 text-left hover:border-stone-400 hover:bg-stone-50"
                            >
                                <span className="min-w-0">
                                    <span className="block truncate text-sm text-stone-900">
                                        {row.isPillar && (
                                            <span className="mr-1.5 rounded bg-stone-900 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">
                                                Pillar
                                            </span>
                                        )}
                                        {row.title}
                                    </span>
                                    <span className="mt-0.5 block truncate text-xs text-stone-500">
                                        {row.clusterName || "No cluster"} · {row.mainKeyword}
                                    </span>
                                </span>
                                <span className="shrink-0 text-[10px] uppercase tracking-wider text-stone-400">
                                    Load
                                </span>
                            </button>
                        ))}
                    </div>
                </section>
            )}

            <section className="space-y-4 rounded-xl border border-stone-200 bg-white p-5">
                <div>
                    <label className="mb-1 block text-xs font-medium text-stone-600">
                        Article title
                    </label>
                    <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="How to Restore a Faded Family Photo Without Losing Detail"
                        className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                    />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                        <label className="mb-1 block text-xs font-medium text-stone-600">
                            Primary keyword
                        </label>
                        <input
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            placeholder="restore faded photo"
                            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-stone-600">
                            Article type
                        </label>
                        <select
                            value={articleType}
                            onChange={(e) => setArticleType(e.target.value)}
                            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                        >
                            <option value="informational">Informational</option>
                            <option value="commercial">Commercial / comparison</option>
                            <option value="howto">How-to / tutorial</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="mb-1 block text-xs font-medium text-stone-600">
                        Intro pattern to test
                    </label>
                    <select
                        value={clusterPosition}
                        onChange={(e) => setClusterPosition(Number(e.target.value))}
                        className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                    >
                        {INTRO_PATTERNS.map((pattern) => (
                            <option key={pattern.position} value={pattern.position}>
                                {pattern.position} — {pattern.label}
                            </option>
                        ))}
                    </select>
                    <p className="mt-1 text-[10px] text-stone-400">
                        Openings rotate by position within a cluster, so no two articles in
                        one cluster share a shape. Run the same title at each position to
                        compare all five.
                    </p>
                </div>

                <details className="rounded-lg border border-stone-200 p-3">
                    <summary className="cursor-pointer text-xs font-medium text-stone-600">
                        Optional: audit evidence and cluster context
                    </summary>
                    <div className="mt-3 space-y-3">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-stone-600">
                                Supporting keywords (comma separated)
                            </label>
                            <input
                                value={supporting}
                                onChange={(e) => setSupporting(e.target.value)}
                                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-stone-600">
                                Observed searches — one per line
                            </label>
                            <textarea
                                value={sourceQueries}
                                onChange={(e) => setSourceQueries(e.target.value)}
                                rows={3}
                                placeholder={"can you restore a photo from a negative?\nwho can restore an old picture"}
                                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                            />
                            <p className="mt-1 text-[10px] text-stone-400">
                                Fills the MEASURED SEARCH DEMAND block the real pipeline sends.
                            </p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                                <label className="mb-1 block text-xs font-medium text-stone-600">
                                    Cluster name
                                </label>
                                <input
                                    value={clusterName}
                                    onChange={(e) => setClusterName(e.target.value)}
                                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                                />
                            </div>
                            <label className="flex items-end gap-2 pb-2 text-sm text-stone-700">
                                <input
                                    type="checkbox"
                                    checked={isPillar}
                                    onChange={(e) => setIsPillar(e.target.checked)}
                                />
                                Treat as cluster pillar
                            </label>
                        </div>
                    </div>
                </details>

                {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                        {error}
                    </div>
                )}

                <button
                    type="button"
                    onClick={generate}
                    disabled={running || !title.trim() || !keyword.trim()}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-stone-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                    {running ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" /> Queueing…
                        </>
                    ) : (
                        <>
                            <Sparkles className="h-4 w-4" /> Generate this article
                        </>
                    )}
                </button>
                <p className="text-center text-[10px] text-stone-400">
                    Real provider cost (~$0.13–0.33). Nothing touches billing, clusters or
                    programs.
                </p>
            </section>

            {result && (
                <section className="rounded-xl border border-stone-300 bg-white p-5">
                    <h2 className="text-sm font-semibold text-stone-900">Generation queued</h2>
                    <p className="mt-1 text-xs text-stone-500">
                        Takes a few minutes. The article appears once writing finishes.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3">
                        <a
                            href={`/articles/${result.articleId}`}
                            className="inline-flex items-center gap-2 rounded-lg bg-stone-950 px-3 py-2 text-xs font-semibold text-white"
                        >
                            Open article <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        <code className="rounded bg-stone-100 px-2 py-2 text-[11px] text-stone-600">
                            run {result.runId}
                        </code>
                    </div>
                </section>
            )}
        </div>
    )
}
