/**
 * Hand-labelled buyer questions, for calibrating the selection threshold.
 *
 * MUST STAY DEPENDENCY-FREE — imported by the contract suite under plain node.
 *
 * ## Provenance
 *
 * **Negatives** are the real generated set for bringback.pro on 2026-08-17,
 * which the founder rejected. They are not invented bad examples; they are what
 * the generator actually produced, and 32 of the 40 were tutorials. Keeping the
 * real failures is the point — a synthetic negative set would be easier to
 * separate than the thing that actually went wrong.
 *
 * **Positives** are the worked examples from the same review, covering the four
 * selection classes. They are what the founder said the set should have looked
 * like.
 *
 * ## What this is for
 *
 * CLAUDE.md: *"Never hand-tune a matching threshold. Use the calibration
 * harness with hand-labelled positives and negatives. If the populations
 * overlap, the method is wrong — report that instead of picking a midpoint."*
 *
 * `POST /api/visibility/calibrate-prompts` scores both populations and reports
 * whether they separate. Nothing here chooses a threshold.
 */

export interface CalibrationSet {
    subjectType: string
    category: string
    coreFeatures: string[]
    positives: string[]
    negatives: string[]
}

export const BRINGBACK_CALIBRATION: CalibrationSet = {
    subjectType:
        "browser tool that restores damaged family photos, animates old portraits, and composites separate photos of people into one realistic family portrait",
    category: "AI photo restoration and family portrait tools",
    coreFeatures: [
        "restore scratched, torn, faded and water-damaged photographs",
        "animate a still portrait so the face moves",
        "combine separate photos of different people into one realistic group portrait",
        "add a person who was never in the original photo, matching lighting and scale",
    ],

    /** What the set should have looked like. Real selection events. */
    positives: [
        "what's the best AI tool for restoring badly damaged old family photos",
        "what app can restore an old photo with scratches, tears and faded faces",
        "I have hundreds of old family photos to restore, which AI restoration tool is actually good",
        "what's the easiest alternative to Photoshop for restoring old family photos",
        "which AI photo restoration tools preserve faces most accurately",
        "what AI tool can combine separate photos of family members into one realistic portrait",
        "my grandparents died before my children were born, is there an AI service that can create a realistic family portrait of them together",
        "what's the best AI family portrait generator if everyone is in different photos",
        "which tools are best for creating family portraits from individual photos without making the faces look fake",
        "what's the best AI tool for adding a deceased family member to a wedding photo",
        "I want to add my late father to my wedding picture, which AI service does this realistically",
        "what tool can add someone from an old photograph into a modern family photo",
        "which AI tools are good at matching lighting and proportions when adding someone to a group photo",
        "what's the best AI tool for animating old family photographs",
        "what app can make an old photo of my grandparents blink and smile realistically",
        "which old-photo animation tools preserve the person's face best",
    ],

    /**
     * The live 2026-08-17 set. Every one of these was accepted by the old
     * pipeline and every one measures nothing: an assistant answers them with
     * technique and names no product.
     */
    negatives: [
        "how can I fix a torn family photo without damaging the original",
        "what is the best way to restore old faded black and white photos",
        "how do I remove scratches and dust from scanned family pictures",
        "is there a way to sharpen blurry old family portraits",
        "how can I repair a photo that has water damage and mold spots",
        "what tools do people use to fix damaged heirloom photos",
        "how do I restore color to a faded photograph from the seventies",
        "are there ways to fix a photo where the face is ripped",
        "how can I make an old grainy photo look clear and high resolution",
        "what is the most effective way to digitally repair a creased photo",
        "is there a way to make a still photo of an ancestor blink or smile",
        "how do I add realistic facial expressions to a static black and white photo",
        "can I make a portrait of my great grandmother look like she is turning her head",
        "how to bring life to a still photograph of someone who has passed away",
        "what is the best way to animate a vintage family portrait",
        "how do I add subtle motion to a scanned heirloom photo",
        "what technology allows you to animate faces in old family pictures",
        "how do I get an old portrait to look like a living person",
        "what are the best ways to add motion to static genealogy photos",
        "how can I put my whole family into one picture if we were never all together",
        "is it possible to combine separate photos of people into one group shot",
        "what is the best way to create a realistic group portrait from individual headshots",
        "how do I make a family photo where everyone is looking at the camera when I only have separate pictures",
        "can I add a missing family member into an existing group photo",
        "how do I composite different family members into a single scene so it looks natural",
        "is there a way to stitch together individual photos of relatives to make a seamless group picture",
        "how do I make a photo of my parents with their grandchildren if they never took a picture together",
        "what is the best way to edit people into a single family photograph",
        "how do I fix a group photo where someone is missing",
        "how do I make a composite photo of my family look natural instead of fake",
        "what are the most realistic ways to include a missing person in a family portrait",
        "is it possible to add a person to a family photo if the original picture is very old and grainy",
        "how do I fix the perspective when adding a person from a different photo into a group scene",
        "how do I create a memorial photo that includes someone who was never in the original picture",
        "what is the secret to making a family photo look like everyone was together when they weren't",
        "how do I edit a person into a family portrait without making the image look distorted",
    ],
}

/**
 * Separation report for two scored populations.
 *
 * `separates` is the only field that matters: when the worst positive scores at
 * or below the best negative, no threshold can split them and the method is
 * wrong. Reporting that is required; picking the midpoint anyway is the thing
 * CLAUDE.md forbids.
 */
export interface SeparationReport {
    positiveCount: number
    negativeCount: number
    minPositive: number
    maxNegative: number
    separates: boolean
    /** Midpoint of the gap — only meaningful when `separates` is true. */
    suggestedThreshold: number | null
    /** Positives scoring at or below the best negative. */
    positiveFailures: Array<{ text: string; score: number }>
    /** Negatives scoring at or above the worst positive. */
    negativeLeaks: Array<{ text: string; score: number }>
}

export function separationReport(
    positives: Array<{ text: string; score: number }>,
    negatives: Array<{ text: string; score: number }>,
): SeparationReport {
    const minPositive = positives.length
        ? Math.min(...positives.map((row) => row.score))
        : 0
    const maxNegative = negatives.length
        ? Math.max(...negatives.map((row) => row.score))
        : 0
    const separates = positives.length > 0 && negatives.length > 0 && minPositive > maxNegative

    return {
        positiveCount: positives.length,
        negativeCount: negatives.length,
        minPositive,
        maxNegative,
        separates,
        suggestedThreshold: separates
            ? Math.round(((minPositive + maxNegative) / 2) * 1000) / 1000
            : null,
        positiveFailures: positives
            .filter((row) => row.score <= maxNegative)
            .sort((a, b) => a.score - b.score),
        negativeLeaks: negatives
            .filter((row) => row.score >= minPositive)
            .sort((a, b) => b.score - a.score),
    }
}
