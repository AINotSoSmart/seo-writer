"use client"

/**
 * "How these numbers work" — every definition on the report, with its exact
 * arithmetic, one click from the number it explains.
 *
 * Adapted from Ansvisor's `_formula-dialog.tsx`, and their best idea: the
 * weights in their dialog are *imported from the scoring module*, so the
 * explanation cannot drift from the implementation. That constraint is kept
 * here — `PROMPT_INTENTS` is read from the module that computes with it, so a
 * change to the code changes this panel automatically or fails the build.
 *
 * Where this diverges: they use it to make a weighted 0-100 composite
 * auditable. We have no composite to audit — every number on this report is a
 * count or a plain proportion — so the panel spends its space on the two things
 * that actually limit the measurement: what a verdict means precisely, and
 * what the source evidence can and cannot establish.
 *
 * A panel that only justified the numbers would be marketing. This one is
 * expected to state the limits, because the reader who checks is the reader who
 * buys.
 */

import { useState } from "react"
import { Sigma, X } from "lucide-react"

// From the import-free config module, not the builder: this is a client
// component and the builder pulls in the server-side Gemini client.
import { MAX_GENERATED_PROMPTS, PROMPT_INTENTS } from "@/lib/visibility/prompt-config"

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="space-y-2">
            <h3 className="text-sm font-semibold text-[var(--viz-ink)]">{title}</h3>
            <div className="space-y-2 text-sm leading-relaxed text-[var(--viz-ink-secondary)]">
                {children}
            </div>
        </section>
    )
}

function Formula({ children }: { children: React.ReactNode }) {
    return (
        <div className="rounded-md border border-[var(--viz-hairline)] bg-[var(--viz-plane)] px-3 py-2 font-mono text-xs text-[var(--viz-ink)]">
            {children}
        </div>
    )
}

export function MethodPanel({
    subjectName,
    promptCount,
}: {
    subjectName: string
    /**
     * Questions this run actually asked. Stated rather than implied: the
     * per-area candidate count and the run's budget are different numbers, and
     * a panel that quoted only the first would be describing a run that didn't
     * happen.
     */
    promptCount: number
}) {
    const [open, setOpen] = useState(false)

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--viz-hairline)] px-3 py-1.5 text-sm text-[var(--viz-ink-secondary)] transition hover:bg-[var(--viz-surface)]"
            >
                <Sigma className="size-4" aria-hidden />
                How these numbers work
            </button>

            {open && (
                <div
                    className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8"
                    role="dialog"
                    aria-modal="true"
                    aria-label="How these numbers work"
                    onClick={() => setOpen(false)}
                >
                    <div
                        className="viz-root w-full max-w-2xl rounded-xl border border-[var(--viz-hairline)] bg-[var(--viz-surface)] p-6 shadow-xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-4">
                            <h2 className="text-lg font-semibold text-[var(--viz-ink)]">
                                How these numbers work
                            </h2>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="rounded p-1 text-[var(--viz-ink-muted)] transition hover:bg-[var(--viz-plane)]"
                                aria-label="Close"
                            >
                                <X className="size-4" aria-hidden />
                            </button>
                        </div>

                        <div className="mt-5 space-y-6">
                            <Section title="There is no visibility score">
                                <p>
                                    Every number on this report is a count of answers we stored, or
                                    a plain proportion of them. Nothing is weighted, and nothing is
                                    blended into a single index.
                                </p>
                                <p>
                                    That is deliberate. A weighted score looks authoritative and
                                    cannot be checked — you would have no way to tell a real
                                    improvement from a change in the weighting. Every claim here
                                    can be verified by opening the answers underneath it.
                                </p>
                            </Section>

                            <Section title="Presence rate">
                                <Formula>
                                    presence rate = answers naming {subjectName} ÷ answers read ×
                                    100
                                </Formula>
                                <p>
                                    An answer &ldquo;names&rdquo; you if your brand or one of your
                                    domains appears in its text. Links are stripped before counting,
                                    so being cited in a footnote without being recommended in the
                                    prose does not count as a mention.
                                </p>
                            </Section>

                            <Section title="The three verdicts">
                                <p>
                                    Each question gets exactly one verdict, from counting the
                                    answers to it:
                                </p>
                                <ul className="list-disc space-y-1 pl-5">
                                    <li>
                                        <strong className="font-medium text-[var(--viz-ink)]">
                                            Not named
                                        </strong>{" "}
                                        — you appear in none of the answers.
                                    </li>
                                    <li>
                                        <strong className="font-medium text-[var(--viz-ink)]">
                                            Named, never first
                                        </strong>{" "}
                                        — you appear, but a competitor is named before you in every
                                        answer that mentions you.
                                    </li>
                                    <li>
                                        <strong className="font-medium text-[var(--viz-ink)]">
                                            Named first
                                        </strong>{" "}
                                        — you are the first tracked brand named in at least one
                                        answer.
                                    </li>
                                </ul>
                                <p>
                                    Position is the order of first mention among you and your
                                    tracked competitors — not a ranking the engine publishes. Only
                                    the first two verdicts become content work.
                                </p>
                            </Section>

                            <Section title="Where the questions come from">
                                <p>
                                    We write up to {MAX_GENERATED_PROMPTS} distinct questions across
                                    the company as a whole, from confirmed business areas, verified
                                    capabilities and the customer&apos;s own words. Narrow areas are not
                                    padded to match broad ones. Each question is labelled with the
                                    situation it came from:
                                </p>
                                <ul className="list-disc space-y-1 pl-5">
                                    {PROMPT_INTENTS.map((intent) => (
                                        <li key={intent.key}>
                                            <strong className="font-medium text-[var(--viz-ink)]">
                                                {intent.key}
                                            </strong>{" "}
                                            — {intent.label}
                                        </li>
                                    ))}
                                </ul>
                                <p>
                                    This run asked{" "}
                                    <strong className="font-medium text-[var(--viz-ink)]">
                                        {promptCount}
                                    </strong>{" "}
                                    of those questions. Each one must naturally lead a useful answer
                                    to name products or services; tutorials that can be answered from
                                    general knowledge are excluded from recommendation visibility.
                                </p>
                                <p>
                                    No question names any brand, including yours. A question that
                                    names you would test whether the engine has an opinion about
                                    you, not whether a buyer who has never heard of you is told
                                    about you.
                                </p>
                            </Section>

                            <Section title="How source relationships are stated">
                                <p>
                                    Citations are evidence attached to stored answers. The report
                                    preserves every valid source URL and makes only three factual
                                    ownership statements:
                                </p>
                                <ul className="list-disc space-y-1 pl-5">
                                    <li>Your domain comes from the confirmed customer domain.</li>
                                    <li>Tracked competitor comes from the confirmed rival set.</li>
                                    <li>Every other cited domain is called external.</li>
                                </ul>
                                <p>
                                    External does not mean low quality, unactionable or unresolved.
                                    The report does not guess a publisher type, ask you to classify
                                    unfamiliar sites, or use citation categories to approve or block
                                    production.
                                </p>
                                <p>
                                    The Lists view is narrower: it includes a page only when its
                                    stored citation title explicitly says best-of, comparison or
                                    review. All other pages remain available in Sources.
                                </p>
                            </Section>

                            <Section title="What the engines searched for is not search volume">
                                <p>
                                    An engine doesn&apos;t search your question verbatim — it
                                    breaks it into its own searches, and we record those. The
                                    count next to each one is{" "}
                                    <strong className="font-medium text-[var(--viz-ink)]">
                                        how many of our questions triggered it
                                    </strong>
                                    , not how many people searched it.
                                </p>
                                <Formula>
                                    questions triggering it ÷ questions we asked — never a
                                    population estimate
                                </Formula>
                                <p>
                                    This is the distinction that decided against buying a
                                    search-volume vendor. The usual approach turns your question
                                    into a few broad Google terms, looks up Google Ads volume, and
                                    multiplies by a fixed constant to call it &ldquo;AI
                                    volume&rdquo;. That number is three guesses stacked on a real
                                    figure about a different search engine. A literal count of
                                    what the engines did is smaller, and true.
                                </p>
                                <p>
                                    Coverage is uneven: some engines publish their searches and
                                    some don&apos;t. Where one didn&apos;t, the report says so
                                    rather than letting a short list imply the engine searched
                                    less.
                                </p>
                            </Section>

                            <Section title="&ldquo;Cited alongside you&rdquo; is not &ldquo;mentions you&rdquo;">
                                <p>
                                    For each source we count how many of the answers citing it also
                                    named you. That is co-occurrence, and nothing more — we have not
                                    fetched those pages, so we cannot tell you whether a given page
                                    mentions you. It tells you which sources the engines lean on
                                    when they build an answer that leaves you out.
                                </p>
                            </Section>

                            <Section title="What this measurement cannot tell you">
                                <ul className="list-disc space-y-1 pl-5">
                                    <li>
                                        AI answers vary by person, place and time. Two identical runs
                                        will not match exactly.
                                    </li>
                                    <li>
                                        Because of that, we do not show a trend line. A change
                                        between two runs cannot yet be told apart from normal
                                        variation, and attributing one to your content would be a
                                        claim this data cannot support.
                                    </li>
                                    <li>
                                        Answers are captured from the real consumer apps, but they
                                        are our recording of a private, non-reproducible generation.
                                        You can check what we stored; you cannot independently
                                        re-run it the way you could re-run a Google search.
                                    </li>
                                    <li>
                                        Failed requests are excluded from every number and reported
                                        separately. A request that failed is never counted as you
                                        being absent.
                                    </li>
                                </ul>
                            </Section>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
