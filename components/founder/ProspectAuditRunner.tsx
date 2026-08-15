"use client"

import { useEffect, useState } from "react"
import { Copy, ExternalLink, Loader2, Plus } from "lucide-react"

type AuditRow = {
    id: string
    subject_url: string
    run_status: string
    generation_phase: string | null
    generation_error: string | null
    failure_code: string | null
    source_call_ledger: Array<{
        source: string
        attempted: number
        succeeded: number
        failed: number
        cached: number
    }>
    public_token: string
    pool_size: number
    article_count: number
    cluster_count: number
    created_at: string
    audit_claims?: Array<{
        claim_email_normalized: string
        expires_at: string
        claimed_at: string | null
    }>
}

export function ProspectAuditRunner() {
    const [audits, setAudits] = useState<AuditRow[]>([])
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [createdLinks, setCreatedLinks] = useState<{
        publicReportUrl: string
        claimUrl: string
    } | null>(null)

    async function load() {
        const response = await fetch("/api/founder/prospect-audits", {
            cache: "no-store",
        })
        const result = await response.json()
        if (response.ok) setAudits(result.audits || [])
    }

    useEffect(() => {
        void load()
        const interval = window.setInterval(() => {
            if (audits.some((audit) => audit.run_status === "running")) void load()
        }, 5000)
        return () => window.clearInterval(interval)
    }, [audits])

    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setSubmitting(true)
        setError(null)
        setCreatedLinks(null)
        const form = new FormData(event.currentTarget)
        const lines = (name: string) =>
            String(form.get(name) || "")
                .split(/\r?\n/)
                .map((value) => value.trim())
                .filter(Boolean)
        try {
            const businessAreas = lines("businessAreas").map((line, priority) => {
                const [name = "", seedText = "", deliveryMode = "", mechanics = ""] =
                    line.split("|").map((part) => part.trim())
                const [input = "", action = "", output = ""] = mechanics
                    .split("->")
                    .map((part) => part.trim())
                return {
                    name: name.trim(),
                    description: `Content directly serving ${name.trim()}.`,
                    seedKeywords: seedText
                        .split(",")
                        .map((seed) => seed.trim())
                        .filter(Boolean),
                    capabilityContract: {
                        version: "capability-v1",
                        deliveryMode,
                        operations: [{
                            key: "op1",
                            customerJob: `Content directly serving ${name.trim()}.`,
                            inputs: input ? [input] : [],
                            action,
                            outputs: output ? [output] : [],
                            limits: [],
                            evidenceRefs: [`prospect-${priority}-fact`],
                        }],
                        facts: [{
                            id: `prospect-${priority}-fact`,
                            url: "founder-confirmed:prospect-runner",
                            quote: `Input: ${input}. Action: ${action}. Output: ${output}.`,
                        }],
                    },
                }
            })
            const response = await fetch("/api/founder/prospect-audits", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    website: form.get("website"),
                    email: form.get("email"),
                    businessAreas,
                    competitors: lines("competitors"),
                }),
            })
            const result = await response.json()
            if (!response.ok) throw new Error(result.error || "Unable to queue audit.")
            setCreatedLinks(result)
            event.currentTarget.reset()
            await load()
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to queue audit.")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="space-y-8">
            <form
                onSubmit={(event) => void submit(event)}
                className="rounded-xl border border-stone-200 bg-white p-6"
            >
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field name="website" label="Prospect website" placeholder="https://example.com" required />
                    <Field name="email" label="Claim email" placeholder="owner@example.com" type="email" required />
                    <TextArea
                        name="businessAreas"
                        label="Areas: name | searches | delivery | input -> action -> output"
                        placeholder={"Photo restoration | restore old photos, fix damaged photos | browser software | old photo upload -> repairs visible damage -> restored digital photo"}
                    />
                    <TextArea
                        name="competitors"
                        label="Competitors (optional, maximum four)"
                        placeholder={"https://competitor-one.com\nhttps://competitor-two.com"}
                    />
                </div>
                <button
                    disabled={submitting}
                    className="mt-5 inline-flex items-center gap-2 rounded-lg bg-stone-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Queue prospect audit
                </button>
                {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            </form>

            {createdLinks && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
                    <p className="text-sm font-medium text-emerald-950">
                        Save the claim link now. Only its hash is stored.
                    </p>
                    <CopyRow label="Public report" value={createdLinks.publicReportUrl} />
                    <CopyRow label="Email-bound claim" value={createdLinks.claimUrl} />
                </div>
            )}

            <section>
                <h2 className="mb-3 font-serif text-xl">Prospect audit queue</h2>
                <div className="space-y-3">
                    {audits.map((audit) => {
                        const calls = (audit.source_call_ledger || []).reduce(
                            (sum, item) => sum + Number(item.attempted || 0),
                            0,
                        )
                        return (
                            <article key={audit.id} className="rounded-xl border border-stone-200 bg-white p-5">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <div className="font-medium text-stone-900">{audit.subject_url}</div>
                                        <div className="mt-1 text-xs text-stone-500">
                                            {audit.audit_claims?.[0]?.claim_email_normalized}
                                        </div>
                                    </div>
                                    <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs capitalize text-stone-700">
                                        {audit.run_status === "running"
                                            ? audit.generation_phase || "queued"
                                            : audit.run_status}
                                    </span>
                                </div>
                                {audit.run_status === "completed" && (
                                    <div className="mt-4 flex flex-wrap gap-5 text-sm text-stone-600">
                                        <span>{audit.pool_size} queries</span>
                                        <span>{audit.cluster_count} clusters</span>
                                        <span>{audit.article_count} articles</span>
                                        <span>{calls} bounded source requests</span>
                                        <a
                                            href={`/audit/${audit.public_token}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1 text-stone-900 underline"
                                        >
                                            Report <ExternalLink className="h-3.5 w-3.5" />
                                        </a>
                                    </div>
                                )}
                                {audit.run_status === "failed" && (
                                    <p className="mt-3 text-sm text-red-700">
                                        {audit.failure_code}: {audit.generation_error}
                                    </p>
                                )}
                            </article>
                        )
                    })}
                </div>
            </section>
        </div>
    )
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
    const { label, ...input } = props
    return (
        <label className="text-sm font-medium text-stone-700">
            {label}
            <input {...input} className="mt-1.5 w-full rounded-lg border border-stone-300 px-3 py-2.5" />
        </label>
    )
}

function TextArea({ name, label, placeholder }: { name: string; label: string; placeholder: string }) {
    return (
        <label className="text-sm font-medium text-stone-700">
            {label}
            <textarea
                name={name}
                placeholder={placeholder}
                rows={4}
                className="mt-1.5 w-full rounded-lg border border-stone-300 px-3 py-2.5"
            />
        </label>
    )
}

function CopyRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="mt-3 flex items-center gap-2">
            <span className="w-32 text-xs font-medium text-emerald-900">{label}</span>
            <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1.5 text-xs">{value}</code>
            <button type="button" onClick={() => void navigator.clipboard.writeText(value)} aria-label={`Copy ${label}`}>
                <Copy className="h-4 w-4" />
            </button>
        </div>
    )
}
