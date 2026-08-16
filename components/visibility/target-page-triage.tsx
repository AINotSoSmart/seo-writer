"use client"

import { useState } from "react"
import { Check, ExternalLink, Loader2 } from "lucide-react"

import {
    normalizeHttpsTargetUrl,
    type CoverageDecision,
    type TargetPageDecision,
} from "@/lib/visibility/target-page"

interface TargetPageTriageProps {
    decision: TargetPageDecision
    onSaved: (decision: TargetPageDecision) => void
}

const OPTIONS: Array<{
    value: CoverageDecision
    label: string
    detail: string
}> = [
    {
        value: "has_page",
        label: "Yes, an existing page",
        detail: "Use that page as the refresh target.",
    },
    {
        value: "no_page",
        label: "No suitable page",
        detail: "This can become a create candidate.",
    },
    {
        value: "unknown",
        label: "I’m not sure yet",
        detail: "Keep it visible, but select no content work.",
    },
]

function outcomeCopy(decision: TargetPageDecision): string {
    if (decision.opportunityState === "monitoring") {
        return "Saved. The delivered work remains in its observation window."
    }
    if (
        decision.coverageState === "no_page" &&
        decision.deliveredCreateExists
    ) {
        return "A create draft was already delivered. Publish or identify that page before another action is selected."
    }
    if (decision.resolutionType === "refresh") {
        return "Refresh candidate — the existing page is now the only target."
    }
    if (decision.resolutionType === "create") {
        return "Create candidate — no suitable existing page was claimed."
    }
    return "Needs input — this finding uses no production capacity."
}

export function TargetPageTriage({ decision, onSaved }: TargetPageTriageProps) {
    const [choice, setChoice] = useState<CoverageDecision>(decision.coverageState)
    const [targetUrl, setTargetUrl] = useState(decision.targetUrl ?? "")
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [saved, setSaved] = useState(false)
    const dirty =
        choice !== decision.coverageState ||
        (choice === "has_page" && targetUrl.trim() !== (decision.targetUrl ?? ""))

    const save = async () => {
        setError(null)
        setSaved(false)

        const normalized = normalizeHttpsTargetUrl(targetUrl)
        if (choice === "has_page" && !normalized) {
            setError("Enter the full HTTPS URL of the existing page.")
            return
        }

        setSaving(true)
        try {
            const response = await fetch("/api/visibility/opportunities/target-page", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    trackedPromptId: decision.trackedPromptId,
                    coverageState: choice,
                    targetUrl: choice === "has_page" ? normalized : null,
                }),
            })
            const payload = (await response.json()) as {
                error?: string
                decision?: Partial<TargetPageDecision>
            }
            if (!response.ok || !payload.decision) {
                throw new Error(payload.error || "Could not save this decision.")
            }

            const next: TargetPageDecision = {
                ...decision,
                ...payload.decision,
                priority: decision.priority,
                reason: decision.reason,
            }
            setTargetUrl(next.targetUrl ?? "")
            setSaved(true)
            onSaved(next)
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Could not save this decision.")
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="mb-4 rounded-lg border border-[var(--viz-hairline)] bg-[var(--viz-surface)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                    <h4 className="text-sm font-semibold text-[var(--viz-ink)]">
                        Do you already have a page meant to answer this question?
                    </h4>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--viz-ink-secondary)]">
                        We did not infer this from a sample of your site. Your answer decides
                        create versus refresh; skipping selects nothing.
                    </p>
                </div>
                {decision.priority !== null && (
                    <span className="rounded-full bg-[var(--viz-track)] px-2.5 py-1 text-xs text-[var(--viz-ink-muted)]">
                        Prioritised from measured evidence
                    </span>
                )}
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {OPTIONS.map((option) => {
                    const selected = choice === option.value
                    return (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                                setChoice(option.value)
                                setSaved(false)
                                setError(null)
                            }}
                            className={`rounded-md border p-3 text-left transition ${
                                selected
                                    ? "border-[var(--viz-series-1)] bg-[var(--viz-series-1)]/8"
                                    : "border-[var(--viz-hairline)] hover:bg-[var(--viz-plane)]"
                            }`}
                        >
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--viz-ink)]">
                                {selected && <Check className="size-3.5" aria-hidden />}
                                {option.label}
                            </span>
                            <span className="mt-1 block text-xs leading-snug text-[var(--viz-ink-muted)]">
                                {option.detail}
                            </span>
                        </button>
                    )
                })}
            </div>

            {choice === "has_page" && (
                <label className="mt-3 block text-xs font-medium text-[var(--viz-ink-secondary)]">
                    Existing page URL
                    <input
                        type="url"
                        inputMode="url"
                        value={targetUrl}
                        onChange={(event) => {
                            setTargetUrl(event.target.value)
                            setSaved(false)
                            setError(null)
                        }}
                        placeholder="https://your-site.com/page"
                        className="mt-1.5 w-full rounded-md border border-[var(--viz-hairline)] bg-[var(--viz-surface)] px-3 py-2 text-sm text-[var(--viz-ink)] outline-none focus:border-[var(--viz-series-1)]"
                    />
                </label>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                    type="button"
                    onClick={() => void save()}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-md bg-[var(--viz-ink)] px-3 py-2 text-xs font-semibold text-[var(--viz-surface)] disabled:opacity-60"
                >
                    {saving && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
                    Save decision
                </button>
                {decision.targetUrl && decision.coverageState === "has_page" && (
                    <a
                        href={decision.targetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-[var(--viz-series-1)] hover:underline"
                    >
                        Open saved target
                        <ExternalLink className="size-3" aria-hidden />
                    </a>
                )}
            </div>

            {error && (
                <p role="alert" className="mt-2 text-xs text-[var(--viz-critical)]">
                    {error}
                </p>
            )}
            {!dirty && (saved || decision.coverageState !== "unknown") && !error && (
                <p className="mt-2 text-xs font-medium text-[var(--viz-ink-secondary)]">
                    {outcomeCopy(decision)}
                </p>
            )}
        </div>
    )
}
