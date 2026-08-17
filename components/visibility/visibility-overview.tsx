import type { VisibilitySummaryV2 } from "@/lib/visibility/visibility-summary"

interface VisibilityOverviewProps {
    subjectName: string
    summary: VisibilitySummaryV2
}

function rate(part: number, whole: number): string {
    if (whole === 0) return "0%"
    return `${Math.round((part / whole) * 1000) / 10}%`
}

function Metric({ value, label }: { value: string; label: string }) {
    return (
        <div className="rounded-lg border border-[var(--viz-hairline)] bg-[var(--viz-surface)] p-4">
            <div className="text-2xl font-semibold tabular-nums text-[var(--viz-ink)]">
                {value}
            </div>
            <div className="mt-1 text-xs leading-snug text-[var(--viz-ink-secondary)]">
                {label}
            </div>
        </div>
    )
}

export function VisibilityOverview({ subjectName, summary }: VisibilityOverviewProps) {
    const brand = summary.brandVisibility
    const competitors = summary.competitorVisibility
    const unpromptedTotal = competitors.namedRows.reduce(
        (total, row) => total + row.namedQuestions,
        0,
    )
    /** Questions where any answer named the brand, first or not. */
    const namedQuestions = brand.ledQuestions + brand.namedNeverFirstQuestions

    return (
        <>
            <section className="mt-10">
                <div className="rounded-xl border border-[var(--viz-hairline)] bg-[var(--viz-surface)] p-6">
                    <div className="flex flex-wrap items-end gap-6">
                        <div>
                            <div className="text-5xl font-semibold leading-none tabular-nums text-[var(--viz-ink)]">
                                {rate(brand.namedAnswers, brand.answersTotal)}
                            </div>
                            <p className="mt-2 text-sm text-[var(--viz-ink-secondary)]">
                                of answers named {subjectName}
                            </p>
                        </div>
                        <div className="text-sm leading-relaxed text-[var(--viz-ink-secondary)] sm:ml-auto sm:text-right">
                            <div>
                                Named in <strong className="text-[var(--viz-ink)]">{brand.namedAnswers}/{brand.answersTotal}</strong> answers
                            </div>
                            <div>
                                Cited in <strong className="text-[var(--viz-ink)]">{brand.citedAnswers}/{brand.answersTotal}</strong> answers
                            </div>
                        </div>
                    </div>

                    {/*
                      * Two plain sentences, not two equations.
                      *
                      * This was `40 questions = 2 + 2 + 36` stacked on top of
                      * `40 answers = 3 + 1 + 1 + 35`, annotated with
                      * "denominator" and "mutually exclusive". The founder could
                      * not read their own report: naming and citing are
                      * independent axes, and presenting them as two partitions
                      * of the same 40 makes a reader try to reconcile numbers
                      * that were never meant to reconcile.
                      *
                      * So: say what happened, then say plainly that the two
                      * things are counted separately. Every figure is still
                      * exact and still checkable against the rows below.
                      */}
                    <div className="mt-5 space-y-3 border-t border-[var(--viz-hairline)] pt-4 text-sm leading-relaxed text-[var(--viz-ink-secondary)]">
                        <p>
                            An assistant named {subjectName} in{" "}
                            <strong className="text-[var(--viz-ink)]">
                                {namedQuestions} of the {brand.questionsTotal} questions
                            </strong>
                            {namedQuestions > 0 && (
                                brand.namedNeverFirstQuestions === 0
                                    ? <> — and named you <strong className="text-[var(--viz-ink)]">first</strong> every time</>
                                    : <> — naming you first in <strong className="text-[var(--viz-ink)]">{brand.ledQuestions}</strong>, and after a rival in {brand.namedNeverFirstQuestions}</>
                            )}
                            . The other {brand.notNamedQuestions} never named you.
                        </p>
                        <p>
                            Being <em>named</em> and being <em>linked</em> are counted
                            separately — an answer can do one without the other.{" "}
                            {brand.namedAndCitedAnswers > 0 && (
                                <>
                                    <strong className="text-[var(--viz-ink)]">{brand.namedAndCitedAnswers}</strong>{" "}
                                    {brand.namedAndCitedAnswers === 1 ? "answer" : "answers"} did both
                                    {brand.namedOnlyAnswers + brand.citedOnlyAnswers > 0 ? ", " : ". "}
                                </>
                            )}
                            {brand.namedOnlyAnswers > 0 && (
                                <>
                                    <strong className="text-[var(--viz-ink)]">{brand.namedOnlyAnswers}</strong> named you
                                    without linking{brand.citedOnlyAnswers > 0 ? ", and " : ". "}
                                </>
                            )}
                            {brand.citedOnlyAnswers > 0 && (
                                <>
                                    <strong className="text-[var(--viz-ink)]">{brand.citedOnlyAnswers}</strong> linked to
                                    your site without naming you.{" "}
                                </>
                            )}
                            The remaining {brand.neitherAnswers} did neither.
                        </p>
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <Metric
                        value={`${brand.namedAnswers}/${brand.answersTotal}`}
                        label={`answers naming ${subjectName}`}
                    />
                    <Metric
                        value={`${brand.citedAnswers}/${brand.answersTotal}`}
                        label="answers citing your site"
                    />
                    <Metric
                        value={`${brand.ledQuestions}/${brand.questionsTotal}`}
                        label="questions where you were named first"
                    />
                    <Metric
                        value={`${brand.namedNeverFirstQuestions}/${brand.questionsTotal}`}
                        label="questions where you were named, never first"
                    />
                </div>
            </section>

            <section className="mt-12">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h2 className="text-xl font-semibold">Who was named instead</h2>
                        <p className="mt-1.5 text-sm text-[var(--viz-ink-secondary)]">
                            Only the {competitors.trackedCount} competitors confirmed for this run. Names introduced by our own question are excluded.
                        </p>
                    </div>
                    <span className="rounded-full border border-[var(--viz-hairline)] px-3 py-1 text-xs tabular-nums text-[var(--viz-ink-muted)]">
                        {competitors.promptInducedNamedAnswersExcluded} prompt-induced mention {competitors.promptInducedNamedAnswersExcluded === 1 ? "row" : "rows"} excluded
                    </span>
                </div>

                <div className="mt-5 overflow-x-auto rounded-lg border border-[var(--viz-hairline)] bg-[var(--viz-surface)]">
                    <table className="w-full min-w-[620px] text-sm">
                        <thead className="border-b border-[var(--viz-hairline)] text-left text-xs text-[var(--viz-ink-muted)]">
                            <tr>
                                <th className="px-4 py-3 font-medium">Tracked competitor</th>
                                <th className="px-4 py-3 text-right font-medium">Named answers</th>
                                <th className="px-4 py-3 text-right font-medium">Named questions</th>
                                <th className="px-4 py-3 text-right font-medium">You absent</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--viz-hairline)]">
                            {competitors.namedRows.map((row) => (
                                <tr key={row.id}>
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-[var(--viz-ink)]">{row.name}</div>
                                        {row.domain && <div className="text-xs text-[var(--viz-ink-muted)]">{row.domain}</div>}
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums">{row.namedAnswers}</td>
                                    <td className="px-4 py-3 text-right tabular-nums">{row.namedQuestions}</td>
                                    <td className="px-4 py-3 text-right tabular-nums">{row.brandAbsentQuestions}</td>
                                </tr>
                            ))}
                            {competitors.namedRows.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-4 py-5 text-center text-[var(--viz-ink-muted)]">
                                        No competitors were tracked, so competitor naming could not be measured.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {competitors.trackedCount > 0 && unpromptedTotal === 0 && (
                    <p className="mt-3 rounded-lg border border-[var(--viz-hairline)] bg-[var(--viz-plane)] p-3 text-sm text-[var(--viz-ink-secondary)]">
                        Zero tracked competitors were named naturally. This is a measured zero, not a missing section.
                    </p>
                )}
            </section>

            <section className="mt-12">
                <h2 className="text-xl font-semibold">Who was cited instead</h2>
                <p className="mt-1.5 text-sm text-[var(--viz-ink-secondary)]">
                    Citation evidence is kept even when the question named the competitor, because the engine still chose that competitor’s domain as a source.
                </p>

                <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <Metric value={String(competitors.citationOccurrences)} label="tracked-competitor citation occurrences" />
                    <Metric value={String(competitors.citingAnswers)} label="answers citing a tracked competitor" />
                    <Metric value={String(competitors.competitorCitedBrandNotCitedQuestions)} label="questions citing a competitor but not your site" />
                    <Metric value={String(competitors.competitorCitedBrandNotNamedQuestions)} label="questions citing a competitor without naming you" />
                </div>

                <div className="mt-5 overflow-x-auto rounded-lg border border-[var(--viz-hairline)] bg-[var(--viz-surface)]">
                    <table className="w-full min-w-[900px] text-sm">
                        <thead className="border-b border-[var(--viz-hairline)] text-left text-xs text-[var(--viz-ink-muted)]">
                            <tr>
                                <th className="px-4 py-3 font-medium">Tracked competitor</th>
                                <th className="px-4 py-3 text-right font-medium">Citations</th>
                                <th className="px-4 py-3 text-right font-medium">Citing answers</th>
                                <th className="px-4 py-3 text-right font-medium">Citing questions</th>
                                <th className="px-4 py-3 text-right font-medium">You named alongside</th>
                                <th className="px-4 py-3 text-right font-medium">Your site cited alongside</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--viz-hairline)]">
                            {competitors.citedRows.map((row) => (
                                <tr key={row.id}>
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-[var(--viz-ink)]">{row.name}</div>
                                        {row.domain && <div className="text-xs text-[var(--viz-ink-muted)]">{row.domain}</div>}
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums">{row.citationOccurrences}</td>
                                    <td className="px-4 py-3 text-right tabular-nums">{row.citingAnswers}</td>
                                    <td className="px-4 py-3 text-right tabular-nums">{row.citingQuestions}</td>
                                    <td className="px-4 py-3 text-right tabular-nums">{row.brandNamedAlongsideAnswers}</td>
                                    <td className="px-4 py-3 text-right tabular-nums">{row.brandCitedAlongsideAnswers}</td>
                                </tr>
                            ))}
                            {competitors.citedRows.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-4 py-5 text-center text-[var(--viz-ink-muted)]">
                                        No competitors were tracked, so competitor citations could not be measured.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </>
    )
}
