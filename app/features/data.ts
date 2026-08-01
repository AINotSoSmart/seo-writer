export type FeatureTruth = {
    slug: string
    name: string
    summary: string
    promise: string
    inputs: string[]
    outputs: string[]
    safeguards: string[]
}

export const features: Record<string, FeatureTruth> = {
    "evidence-backed-topical-audit": {
        slug: "evidence-backed-topical-audit",
        name: "Evidence-backed topical audit",
        summary:
            "Build an immutable search-gap snapshot in which every observed query retains its source URL.",
        promise:
            "A completed run never mutates. A later audit creates a new run and cannot rewrite a purchased program.",
        inputs: ["Your public website", "Seed topics", "Up to four competitors"],
        outputs: ["Observed query evidence", "Current coverage matches", "Immutable run hash"],
        safeguards: [
            "No Google Search Console access",
            "Bounded source requests",
            "Hard failure for missing provenance",
        ],
    },
    "competitor-gap-evidence": {
        slug: "competitor-gap-evidence",
        name: "Competitor gap evidence",
        summary:
            "See the pages that currently answer a query while your website is missing or only partially covers it.",
        promise:
            "The report shows observations and similarity matches, not traffic forecasts or ranking guarantees.",
        inputs: ["Observed search evidence", "Public competitor pages", "Your public site pages"],
        outputs: ["Gap and partial-gap rows", "Matched competitor URLs", "Your closest existing URL"],
        safeguards: ["Maximum four competitors", "Coverage page caps", "Source-linked claims"],
    },
    "topic-cluster-delivery": {
        slug: "topic-cluster-delivery",
        name: "Complete topic-cluster delivery",
        summary:
            "A program contains every qualified priority cluster the audit measured, each with one pillar and 7–14 supporting articles.",
        promise:
            "A cluster is delivered as one batch only after every member has generated successfully.",
        inputs: ["Six unsold qualified clusters", "At least 25 total articles", "A paid velocity tier"],
        outputs: ["Complete cluster batches", "Research-backed articles", "Delivery burn-down"],
        safeguards: ["No partial cluster release", "Failed-member-only retry", "Finite program scope"],
    },
    "frozen-internal-link-graph": {
        slug: "frozen-internal-link-graph",
        name: "Frozen internal-link graph",
        summary:
            "Confirm one permanent URL pattern before checkout so every planned target is known before writing begins.",
        promise:
            "Pillars link to leaves, leaves link to pillars and relevant siblings, and unresolved edges block delivery.",
        inputs: ["HTTPS URL pattern", "Deterministic article slugs", "Audit site snapshot"],
        outputs: ["Absolute target URLs", "Frozen anchor text", "Validated directed link graph"],
        safeguards: ["Same audited host only", "No self-links or duplicate edges", "HTML checked before release"],
    },
    "wordpress-manual-delivery": {
        slug: "wordpress-manual-delivery",
        name: "WordPress-ready and manual delivery",
        summary:
            "Receive the complete cluster in the dashboard, create a WordPress draft, or publish manually at the frozen URL.",
        promise:
            "Delivery and publication are independent states. WordPress permalink mismatches remain drafts.",
        inputs: ["Delivered article", "Optional WordPress application password", "Frozen target URL"],
        outputs: ["Dashboard delivery", "WordPress draft", "Confirmed public URL"],
        safeguards: ["WordPress and manual only", "Permalink validation", "No silent publish-state guessing"],
    },
    "program-burn-down": {
        slug: "program-burn-down",
        name: "Program burn-down",
        summary:
            "Track generated, delivered, and published counts separately across the whole measured scope.",
        promise:
            "Once every cluster is delivered, FlipAEO requests cancellation at the end of the paid billing period.",
        inputs: ["Frozen program schedule", "Cluster state", "Billing-period events"],
        outputs: ["Separate progress counts", "Pause-aware dates", "Cancellation status"],
        safeguards: ["Idempotent billing grants", "No rescheduling on generic updates", "No work after scope delivery"],
    },
}
