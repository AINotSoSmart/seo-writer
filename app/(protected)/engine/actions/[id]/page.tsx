/* eslint-disable @typescript-eslint/no-explicit-any -- engine tables are absent from generated database types until the migration is applied and types regenerated. */
/**
 * One action with everything it rests on: the questions, the verified passages,
 * the cited pages, the duplicate checks and, for a refresh, every change with
 * its source.
 */

import Link from "next/link"
import { notFound, redirect } from "next/navigation"

import { ActionButtons, CopyButton } from "@/components/engine/engine-controls"
import type { ActionEvidence } from "@/lib/engine/produce"
import type { RefreshOutput } from "@/lib/engine/refresh-writer"
import { createAdminClient } from "@/utils/supabase/admin"
import { createClient } from "@/utils/supabase/server"

export default async function EngineActionPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) redirect("/login")
    const admin = createAdminClient() as any

    const { data: action } = await admin
        .from("engine_actions")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle()
    if (!action) notFound()

    const { data: settings } = await admin
        .from("engine_brand_settings")
        .select("wordpress_connection_id")
        .eq("brand_id", action.brand_id)
        .maybeSingle()
    const evidence = (action.evidence ?? {}) as ActionEvidence
    const output = action.output ?? {}
    const duplicate = action.duplicate_check ?? null

    return (
        <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
            <Link href={`/engine?brand=${action.brand_id}`} className="text-xs text-stone-600 underline">
                ← Back to the engine
            </Link>
            <header>
                <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{action.kind.replace("_", " ")}</p>
                <h1 className="mt-1 font-serif text-3xl text-stone-900">{action.title}</h1>
                {action.target_url && (
                    <a href={action.target_url} target="_blank" rel="noreferrer" className="text-sm underline">
                        {action.target_url}
                    </a>
                )}
                <p className="mt-2 text-sm text-stone-700">{action.reason}</p>
                {action.failure_reason && <p className="mt-2 text-sm text-red-700">{action.failure_reason}</p>}
                <div className="mt-3">
                    <ActionButtons
                        actionId={action.id}
                        kind={action.kind}
                        state={action.state}
                        canPush={Boolean(settings?.wordpress_connection_id)}
                    />
                </div>
            </header>

            <Section title="Buyer questions where no engine named you">
                <ul className="list-disc pl-5 text-sm">
                    {(action.prompts ?? []).map((prompt: string) => (
                        <li key={prompt}>{prompt}</li>
                    ))}
                </ul>
                {evidence.confirmedGaps > 0 && (
                    <p className="mt-1 text-xs text-stone-500">{evidence.confirmedGaps} of these were also gaps the week before.</p>
                )}
            </Section>

            {evidence.coveringPage && (
                <Section title="Your page that already answers this">
                    <a href={evidence.coveringPage.url} target="_blank" rel="noreferrer" className="text-sm underline">
                        {evidence.coveringPage.title || evidence.coveringPage.url}
                    </a>
                    {evidence.coveringPage.quotes.map((quote) => (
                        <blockquote key={quote} className="mt-2 border-l-2 border-stone-300 pl-3 text-xs text-stone-600">
                            “{quote}”
                        </blockquote>
                    ))}
                </Section>
            )}

            {(evidence.missingItems?.length ?? 0) > 0 && (
                <Section title="What the cited pages have that you don't">
                    <ul className="flex flex-col gap-3">
                        {evidence.missingItems.map((item) => (
                            <li key={item.id} className="text-sm">
                                <p className="font-medium text-stone-900">{item.item}</p>
                                {item.why && <p className="text-xs text-stone-600">{item.why}</p>}
                                <blockquote className="mt-1 border-l-2 border-stone-300 pl-3 text-xs text-stone-600">
                                    “{item.sourceQuote}”{" "}
                                    <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="underline">
                                        source
                                    </a>
                                </blockquote>
                            </li>
                        ))}
                    </ul>
                    {evidence.droppedItems > 0 && (
                        <p className="mt-2 text-xs text-stone-500">
                            {evidence.droppedItems} other point(s) were discarded because their quote was not found on the cited page.
                        </p>
                    )}
                </Section>
            )}

            {action.kind === "refresh" && output.updatedContent && <RefreshView output={output as RefreshOutput} />}

            {action.kind === "page_suggestion" && Array.isArray(output.suggestions) && (
                <Section title="What to add to this page">
                    <p className="text-xs text-stone-600">
                        This page lives in your site&apos;s code, not WordPress, so nothing was rewritten. Each point below comes from a
                        page the engines cited.
                    </p>
                    <CopyButton
                        label="Copy as a checklist"
                        text={output.suggestions
                            .map((suggestion: any) => `- [ ] ${suggestion.add}\n  Source: ${suggestion.sourceUrl}\n  "${suggestion.sourceQuote}"`)
                            .join("\n")}
                    />
                </Section>
            )}

            {action.kind === "create" && action.article_id && (
                <Section title="The article">
                    <Link href={`/articles/${action.article_id}`} className="text-sm underline">
                        Open the article
                    </Link>
                    {action.wordpress_url && (
                        <a href={action.wordpress_url} target="_blank" rel="noreferrer" className="ml-4 text-sm underline">
                            WordPress draft
                        </a>
                    )}
                </Section>
            )}

            {(evidence.citedPages?.length ?? 0) > 0 && (
                <Section title="Pages the engines cited">
                    <ul className="text-xs">
                        {evidence.citedPages.map((page) => (
                            <li key={page.url} className="flex justify-between gap-2">
                                <a href={page.url} target="_blank" rel="noreferrer" className="truncate underline">
                                    {page.url}
                                </a>
                                <span className="shrink-0 text-stone-500">
                                    cited {page.count}× {page.read ? "" : "· could not be read"}
                                </span>
                            </li>
                        ))}
                    </ul>
                </Section>
            )}

            {duplicate && (
                <Section title="Duplicate guard">
                    {(["plan", "draft"] as const).map((stage) => {
                        const check = stage === "plan" ? (duplicate.stage === "plan" ? duplicate : null) : duplicate.draft
                        if (!check) return null
                        return (
                            <div key={stage} className="text-xs text-stone-700">
                                <p className="font-medium">{stage === "plan" ? "When planned" : "On the finished draft"}</p>
                                <p>
                                    {check.duplicateOfId ? `Matched ${check.duplicateOfUrl ?? check.duplicateOfId}: ` : "No duplicate. "}
                                    {check.reason}
                                </p>
                                {check.overlapQuote && <blockquote className="border-l-2 border-stone-300 pl-3">“{check.overlapQuote}”</blockquote>}
                                {Array.isArray(check.compared) && check.compared.length > 0 && (
                                    <p className="text-stone-500">Compared with: {check.compared.join(", ")}</p>
                                )}
                            </div>
                        )
                    })}
                </Section>
            )}

            {(evidence.nearestPages?.length ?? 0) > 0 && (
                <Section title="Your closest pages that were checked">
                    <ul className="text-xs">
                        {evidence.nearestPages.map((page) => (
                            <li key={page.url} className="flex justify-between gap-2">
                                <span className="truncate">
                                    {page.title || page.url} <span className="text-stone-500">({page.source})</span>
                                </span>
                                <span className="text-stone-500">{page.similarity.toFixed(2)}</span>
                            </li>
                        ))}
                    </ul>
                </Section>
            )}
        </main>
    )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="rounded-lg border border-stone-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold text-stone-900">{title}</h2>
            {children}
        </section>
    )
}

function RefreshView({ output }: { output: RefreshOutput }) {
    return (
        <Section title="The refresh">
            <p className="text-xs text-stone-600">
                Read from WordPress at {output.fetchedAt.slice(0, 16).replace("T", " ")} UTC (post last changed{" "}
                {output.modifiedGmt?.slice(0, 10) ?? "unknown"}). Only the blocks below change; images, embeds and every other
                block are kept exactly as they were. Nothing was written to WordPress.
            </p>
            <div className="mt-3 flex gap-2">
                <CopyButton text={output.updatedContent} label="Copy the full updated post" />
                <a href={output.link} target="_blank" rel="noreferrer" className="text-xs underline">
                    Open the live post
                </a>
            </div>
            <p className="mt-1 text-xs text-stone-500">
                Paste it into WordPress with the block editor&apos;s Code editor (Ctrl+Shift+Alt+M), then switch back to see the blocks.
            </p>
            <ol className="mt-4 flex flex-col gap-4">
                {output.changes.map((change, index) => (
                    <li key={index} className="rounded-md border border-stone-200 p-3">
                        <p className="text-xs font-medium text-stone-800">
                            {change.operation === "replace" ? `Rewrite block ${change.position}` : `New section after block ${change.position}`}
                        </p>
                        {change.reason && <p className="text-xs text-stone-600">{change.reason}</p>}
                        {change.replaced && (
                            <details className="mt-2 text-xs">
                                <summary className="cursor-pointer text-stone-500">What it replaces</summary>
                                <pre className="whitespace-pre-wrap rounded bg-red-50 p-2 text-[11px]">{change.replaced}</pre>
                            </details>
                        )}
                        <div
                            className="prose prose-sm mt-2 max-w-none rounded bg-emerald-50 p-2"
                            dangerouslySetInnerHTML={{ __html: change.html }}
                        />
                        <ul className="mt-2 text-[11px] text-stone-500">
                            {change.sources.map((source) => (
                                <li key={source.url + source.quote}>
                                    {source.item}: “{source.quote}”{" "}
                                    <a href={source.url} target="_blank" rel="noreferrer" className="underline">
                                        source
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </li>
                ))}
            </ol>
        </Section>
    )
}
