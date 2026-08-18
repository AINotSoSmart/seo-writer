import type { VisibilitySummaryV2 } from "@/lib/visibility/visibility-summary"
import { InfoHint, SectionHeading } from "./info-hint"

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
    /**
     * How many times a tracked rival was recommended by name, in answers.
     *
     * Summed over `namedAnswers`, not `namedQuestions`: everything on this page
     * is counted per answer, because an answer is what names or cites anything.
     * It is a count of occurrences rather than distinct answers — two rivals in
     * one answer is two recommendations — so the copy says "times", not
     * "answers".
     */
    const unpromptedTotal = competitors.namedRows.reduce(
        (total, row) => total + row.namedAnswers,
        0,
    )
    /** Questions where any answer named the brand, first or not. */
    const namedQuestions = brand.ledQuestions + brand.namedNeverFirstQuestions

    /**
     * One row per tracked rival, joining the naming and citation views.
     *
     * They were two tables keyed by the same competitor id, which forced the
     * reader to cross-reference by name to answer "how did this rival do?".
     * `namedRows` and `citedRows` are both derived from `input.competitors`, so
     * they always contain the same ids — joining is safe, and the fallback
     * keeps a row visible if that ever stops being true.
     */
    const citedById = new Map(competitors.citedRows.map((row) => [row.id, row]))
    const rivalRows = competitors.namedRows
        .map((named) => {
            const cited = citedById.get(named.id)
            return {
                id: named.id,
                name: named.name,
                domain: named.domain,
                namedAnswers: named.namedAnswers,
                citingAnswers: cited?.citingAnswers ?? 0,
                citationOccurrences: cited?.citationOccurrences ?? 0,
                brandNamedAlongsideAnswers: cited?.brandNamedAlongsideAnswers ?? 0,
            }
        })
        .sort(
            (a, b) =>
                b.namedAnswers - a.namedAnswers ||
                b.citationOccurrences - a.citationOccurrences ||
                a.name.localeCompare(b.name),
        )

    const citedCompetitorCount = competitors.citedCompetitorCount
    const citedCompetitorNames = competitors.citedRows
        .filter((row) => row.citationOccurrences > 0)
        .map((row) => row.name)
        .join(", ")
    /** Answers discounted on either axis because our own question named the rival. */
    const excludedTotal =
        competitors.promptInducedNamedAnswersExcluded +
        competitors.promptInducedCitedAnswersExcluded

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
                            <div className="flex items-center gap-1.5 sm:justify-end">
                                <span>
                                    Named in <strong className="text-[var(--viz-ink)]">{brand.namedAnswers}/{brand.answersTotal}</strong> answers
                                </span>
                                <InfoHint
                                    align="end"
                                    label="What named and cited mean, and why they differ"
                                >
                                    <p>
                                        <strong className="text-[var(--viz-ink)]">Named</strong> —
                                        the answer says your brand name in its text.
                                    </p>
                                    <p className="mt-2">
                                        <strong className="text-[var(--viz-ink)]">Cited</strong> —
                                        the answer links to a page on your site as a source.
                                    </p>
                                    <p className="mt-2">
                                        These are independent: an answer can do either without the
                                        other, so the two figures are not two slices of one total
                                        and are not meant to add up.
                                    </p>
                                    <p className="mt-2">
                                        Both count answers rather than questions, because an
                                        answer is what does the naming and the linking.
                                    </p>
                                </InfoHint>
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
                        {/*
                          * The "named vs linked are different things" explanation
                          * moved to the hint on the Named/Cited figures above.
                          * It is standing information — true on every run, read
                          * once — and it was pushing the numbers below the fold.
                          * What stays here is this run's actual breakdown.
                          */}
                        <p>
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

            {/*
              * ONE section, not two.
              *
              * This was "Who was named instead" and "Who was cited instead":
              * nine columns across two tables, four of which duplicated each
              * other on any single-engine run (`namedQuestions` = `namedAnswers`,
              * `citingQuestions` = `citingAnswers`, because 40 questions produced
              * 40 answers). A reader hunting for the difference between two
              * identical columns concludes the report is unreliable, and the
              * founder did.
              *
              * The two tables also read as a contradiction — an all-zero naming
              * table beside a citation table full of numbers — because they
              * applied OPPOSITE exclusion rules. That is fixed upstream in
              * `visibility-summary.ts`; both halves now discount evidence our
              * own question caused, and the discarded total is stated once here
              * instead of as two conflicting footnotes.
              *
              * Everything is counted per ANSWER. A question does not cite or
              * name anything; the answer to it does. "Citing questions" was a
              * category error as well as a duplicate.
              */}
            <section className="mt-12">
                <SectionHeading
                    title="How your rivals showed up"
                    hintLabel="What recommended and used as a source mean"
                    hint={
                        <>
                            <p>
                                Two different things, and a rival can do either without the
                                other.
                            </p>
                            <p className="mt-2">
                                <strong className="text-[var(--viz-ink)]">Recommended</strong> —
                                an answer named them to your buyer.
                            </p>
                            <p className="mt-2">
                                <strong className="text-[var(--viz-ink)]">
                                    Used as a source
                                </strong>{" "}
                                — the engine read one of their pages to build the answer. Their
                                content is feeding the machine even when their name never
                                appears, which is usually the more actionable of the two.
                            </p>
                            <p className="mt-2">
                                Both are counted per answer. A question does not name or cite
                                anything; the answer to it does.
                            </p>
                        </>
                    }
                />

                <p className="mt-4 max-w-3xl rounded-lg border border-[var(--viz-hairline)] bg-[var(--viz-plane)] p-4 text-sm leading-relaxed text-[var(--viz-ink-secondary)]">
                    {unpromptedTotal === 0 ? (
                        <>
                            Across all {brand.answersTotal} answers,{" "}
                            <strong className="text-[var(--viz-ink)]">
                                none of your {competitors.trackedCount} tracked rivals was
                                recommended by name
                            </strong>
                            .{" "}
                        </>
                    ) : (
                        <>
                            Your tracked rivals were recommended by name{" "}
                            <strong className="text-[var(--viz-ink)]">{unpromptedTotal}</strong>{" "}
                            {unpromptedTotal === 1 ? "time" : "times"}.{" "}
                        </>
                    )}
                    {competitors.citingAnswers > 0 ? (
                        <>
                            {citedCompetitorNames} {citedCompetitorCount === 1 ? "was" : "were"}{" "}
                            used as a source in{" "}
                            <strong className="text-[var(--viz-ink)]">
                                {competitors.citingAnswers}
                            </strong>{" "}
                            of them.
                        </>
                    ) : (
                        <>No tracked rival was used as a source either.</>
                    )}
                    {excludedTotal > 0 && (
                        <>
                            {" "}
                            <span className="text-[var(--viz-ink-muted)]">
                                {excludedTotal} further {excludedTotal === 1 ? "answer" : "answers"}{" "}
                                mentioned or cited a rival only because our own question named it;
                                those are excluded from every number here.
                            </span>
                        </>
                    )}
                </p>

                <div className="mt-5 overflow-x-auto rounded-lg border border-[var(--viz-hairline)] bg-[var(--viz-surface)]">
                    <table className="w-full min-w-[560px] text-sm">
                        <thead className="border-b border-[var(--viz-hairline)] text-left text-xs text-[var(--viz-ink-muted)]">
                            <tr>
                                <th className="px-4 py-3 font-medium">Tracked rival</th>
                                <th className="px-4 py-3 text-right font-medium">
                                    Recommended
                                    <span className="block font-normal opacity-70">answers</span>
                                </th>
                                <th className="px-4 py-3 text-right font-medium">
                                    Used as a source
                                    <span className="block font-normal opacity-70">answers</span>
                                </th>
                                <th className="px-4 py-3 text-right font-medium">
                                    Pages cited
                                    <span className="block font-normal opacity-70">total</span>
                                </th>
                                <th className="px-4 py-3 text-right font-medium">
                                    You appeared too
                                    <span className="block font-normal opacity-70">answers</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--viz-hairline)]">
                            {rivalRows.map((row) => (
                                <tr key={row.id}>
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-[var(--viz-ink)]">{row.name}</div>
                                        {row.domain && row.domain !== row.name && (
                                            <div className="text-xs text-[var(--viz-ink-muted)]">{row.domain}</div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums">{row.namedAnswers}</td>
                                    <td className="px-4 py-3 text-right tabular-nums">{row.citingAnswers}</td>
                                    <td className="px-4 py-3 text-right tabular-nums">{row.citationOccurrences}</td>
                                    <td className="px-4 py-3 text-right tabular-nums">{row.brandNamedAlongsideAnswers}</td>
                                </tr>
                            ))}
                            {rivalRows.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-5 text-center text-[var(--viz-ink-muted)]">
                                        No competitors were tracked, so rival visibility could not be
                                        measured.
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
