/** Development-only regression harness for the whole-set prompt critic. */

import { NextRequest, NextResponse } from "next/server"

import {
    BRINGBACK_CALIBRATION,
    type CalibrationSet,
} from "@/lib/visibility/selection-calibration-set"
import { reviewPromptSet } from "@/lib/visibility/selection-classifier"

export const maxDuration = 300

export async function POST(request: NextRequest) {
    if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    let body: Partial<CalibrationSet> = {}
    try {
        body = (await request.json()) as Partial<CalibrationSet>
    } catch {
        // Empty body uses the checked-in BringBack regression set.
    }

    const positives = body.positives?.length
        ? body.positives
        : BRINGBACK_CALIBRATION.positives
    const negatives = body.negatives?.length
        ? body.negatives
        : BRINGBACK_CALIBRATION.negatives

    const [positiveRun, negativeRun] = await Promise.all([
        reviewPromptSet(positives),
        reviewPromptSet(negatives),
    ])
    const positivesRejected = positiveRun.reviews.filter((review) => !review.accepted)
    const negativesAccepted = negativeRun.reviews.filter((review) => review.accepted)

    return NextResponse.json({
        verdict:
            positivesRejected.length === 0 && negativesAccepted.length === 0
                ? "clean separation"
                : "review required",
        report: {
            positives: positives.length,
            positivesAccepted: positives.length - positivesRejected.length,
            negatives: negatives.length,
            negativesRejected: negatives.length - negativesAccepted.length,
        },
        positivesRejected,
        negativesAccepted,
        criticErrors: [positiveRun.error, negativeRun.error].filter(Boolean),
    })
}
