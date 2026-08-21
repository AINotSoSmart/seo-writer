/**
 * Dev-only calibration harness for the buyer-question selection threshold.
 *
 * CLAUDE.md: *"Never hand-tune a matching threshold. Use the calibration
 * harness with hand-labelled positives and negatives. If the populations
 * overlap, the method is wrong — report that instead of picking a midpoint."*
 *
 * This scores two labelled populations with the real classifier and the real
 * scoring rule, then reports whether they separate at all. It deliberately does
 * NOT write a threshold anywhere: it prints a suggestion only when a gap
 * exists, and prints the overlapping items when one does not, so the failure is
 * diagnosable rather than papered over.
 *
 * Defaults to the live 2026-08-17 bringback.pro set — 36 real rejected
 * questions as negatives, 16 founder-written selection questions as positives.
 *
 *   curl -X POST http://127.0.0.1:3000/api/visibility/calibrate-prompts
 *
 * Post a body with `positives`, `negatives` and the product context to
 * calibrate against a different brand.
 */

import { NextRequest, NextResponse } from "next/server"

import {
    BRINGBACK_CALIBRATION,
    separationReport,
    type CalibrationSet,
} from "@/lib/visibility/selection-calibration-set"
import { judgeSelectionPrompts } from "@/lib/visibility/selection-classifier"
import {
    selectionRejections,
    selectionScore,
} from "@/lib/visibility/selection-judgement"

export const maxDuration = 300

export async function POST(request: NextRequest) {
    // Never reachable in production. `proxy.ts` also keeps /api behind auth, so
    // this is the second of two gates.
    if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    let body: Partial<CalibrationSet> = {}
    try {
        body = (await request.json()) as Partial<CalibrationSet>
    } catch {
        // An empty body means "calibrate the default set".
    }

    const set: CalibrationSet = {
        subjectType: body.subjectType || BRINGBACK_CALIBRATION.subjectType,
        category: body.category || BRINGBACK_CALIBRATION.category,
        coreFeatures: body.coreFeatures?.length
            ? body.coreFeatures
            : BRINGBACK_CALIBRATION.coreFeatures,
        positives: body.positives?.length
            ? body.positives
            : BRINGBACK_CALIBRATION.positives,
        negatives: body.negatives?.length
            ? body.negatives
            : BRINGBACK_CALIBRATION.negatives,
    }

    const context = {
        subjectType: set.subjectType,
        category: set.category,
        coreFeatures: set.coreFeatures,
    }

    // Judged in two calls, not one, so a label can never leak between
    // populations through ordering — the model must not be able to infer which
    // half a question came from.
    const [positiveRun, negativeRun] = await Promise.all([
        judgeSelectionPrompts(set.positives, context),
        judgeSelectionPrompts(set.negatives, context),
    ])

    const score = (run: typeof positiveRun) =>
        run.judged.map((row) => ({
            text: row.text,
            score: Math.round(selectionScore(row.judgement) * 1000) / 1000,
            selectionClass: row.judgement.selectionClass,
            rejections: selectionRejections(row.judgement),
        }))

    const positives = score(positiveRun)
    const negatives = score(negativeRun)
    const report = separationReport(positives, negatives)

    return NextResponse.json({
        verdict: report.separates
            ? "separates — a threshold exists"
            : "OVERLAP — the populations cannot be split by any threshold",
        report,
        classifierErrors: [positiveRun.error, negativeRun.error].filter(Boolean),
        positives: positives.sort((a, b) => a.score - b.score),
        negatives: negatives.sort((a, b) => b.score - a.score),
    })
}
