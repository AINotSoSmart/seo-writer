"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

async function post(url: string, body: unknown, method = "POST") {
    const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`)
    return data
}

const buttonClass =
    "inline-flex items-center rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-800 hover:bg-stone-50 disabled:opacity-50"
const primaryClass =
    "inline-flex items-center rounded-md bg-stone-950 px-3 py-1.5 text-xs font-semibold text-white hover:bg-stone-800 disabled:opacity-50"

export function RunNowButton({ brandId, running }: { brandId: string; running: boolean }) {
    const router = useRouter()
    const [busy, setBusy] = useState(false)
    const [message, setMessage] = useState<string | null>(null)
    return (
        <div className="flex flex-col items-end gap-1">
            <button
                className={primaryClass}
                disabled={busy || running}
                onClick={async () => {
                    if (!confirm("Ask every tracked question again now? This spends answer-engine credits and replaces this week's plan.")) return
                    setBusy(true)
                    setMessage(null)
                    try {
                        const result = await post("/api/engine/run", { brandId })
                        setMessage(result.alreadyRunning ? "This week is already running." : "Started. Answers take a few minutes.")
                        router.refresh()
                    } catch (error) {
                        setMessage(error instanceof Error ? error.message : String(error))
                    } finally {
                        setBusy(false)
                    }
                }}
            >
                {running ? "Running…" : busy ? "Starting…" : "Run now"}
            </button>
            {message && <span className="max-w-xs text-right text-xs text-stone-600">{message}</span>}
        </div>
    )
}

export function ActionButtons({
    actionId,
    kind,
    state,
    canPush,
}: {
    actionId: string
    kind: string
    state: string
    canPush: boolean
}) {
    const router = useRouter()
    const [busy, setBusy] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const run = async (op: string, confirmText?: string) => {
        if (confirmText && !confirm(confirmText)) return
        setBusy(op)
        setError(null)
        try {
            await post(`/api/engine/actions/${actionId}`, { op })
            router.refresh()
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : String(failure))
        } finally {
            setBusy(null)
        }
    }

    const open = ["ready", "failed", "blocked_duplicate", "planned", "pushed"].includes(state)
    return (
        <div className="flex flex-wrap items-center gap-2">
            {kind === "create" && state === "ready" && (
                <button
                    className={primaryClass}
                    disabled={!canPush || busy !== null}
                    title={canPush ? undefined : "Link a WordPress site to this tool first"}
                    onClick={() => run("push", "Send this article to WordPress as a draft?")}
                >
                    {busy === "push" ? "Sending…" : "Send to WordPress as draft"}
                </button>
            )}
            {state === "failed" && ["create", "refresh"].includes(kind) && (
                <button className={buttonClass} disabled={busy !== null} onClick={() => run("retry")}>
                    {busy === "retry" ? "Retrying…" : "Retry"}
                </button>
            )}
            {state === "blocked_duplicate" && (
                <button
                    className={buttonClass}
                    disabled={busy !== null}
                    onClick={() => run("retry", "Keep this article even though the duplicate guard matched an existing page?")}
                >
                    Keep anyway
                </button>
            )}
            {open && kind !== "monitor" && (
                <button className={buttonClass} disabled={busy !== null} onClick={() => run("done")}>
                    {kind === "create" && state === "pushed" ? "Published" : "Mark done"}
                </button>
            )}
            {open && (
                <button className={buttonClass} disabled={busy !== null} onClick={() => run("dismiss")}>
                    Dismiss
                </button>
            )}
            {error && <span className="text-xs text-red-700">{error}</span>}
        </div>
    )
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
    const [copied, setCopied] = useState(false)
    return (
        <button
            className={buttonClass}
            onClick={async () => {
                await navigator.clipboard.writeText(text)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
            }}
        >
            {copied ? "Copied" : label}
        </button>
    )
}

export function SettingsForm({
    brandId,
    enabled,
    ownedHosts,
    aliases,
    wordpressConnectionId,
    connections,
}: {
    brandId: string
    enabled: boolean
    ownedHosts: string[]
    aliases: string[]
    wordpressConnectionId: string | null
    connections: Array<{ id: string; siteUrl: string }>
}) {
    const router = useRouter()
    const [hosts, setHosts] = useState(ownedHosts.join("\n"))
    const [names, setNames] = useState(aliases.join("\n"))
    const [connectionId, setConnectionId] = useState(wordpressConnectionId ?? "")
    const [on, setOn] = useState(enabled)
    const [status, setStatus] = useState<string | null>(null)

    const lines = (value: string) => value.split(/[\n,]/).map((line) => line.trim()).filter(Boolean)

    return (
        <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={async (event) => {
                event.preventDefault()
                setStatus("Saving…")
                try {
                    await post(
                        "/api/engine/settings",
                        {
                            brandId,
                            enabled: on,
                            ownedHosts: lines(hosts),
                            aliases: lines(names),
                            wordpressConnectionId: connectionId || null,
                        },
                        "PATCH",
                    )
                    setStatus("Saved")
                    router.refresh()
                } catch (error) {
                    setStatus(error instanceof Error ? error.message : String(error))
                }
            }}
        >
            <label className="flex flex-col gap-1 text-xs font-medium text-stone-700">
                Domains you own, one per line (site, blog, app)
                <textarea
                    className="min-h-24 rounded-md border border-stone-300 p-2 font-mono text-xs"
                    value={hosts}
                    onChange={(event) => setHosts(event.target.value)}
                />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-stone-700">
                Other names the tool goes by, one per line
                <textarea
                    className="min-h-24 rounded-md border border-stone-300 p-2 text-xs"
                    value={names}
                    onChange={(event) => setNames(event.target.value)}
                />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-stone-700">
                WordPress site for this tool&apos;s blog
                <select
                    className="rounded-md border border-stone-300 p-2 text-xs"
                    value={connectionId}
                    onChange={(event) => setConnectionId(event.target.value)}
                >
                    <option value="">None (sitemaps only)</option>
                    {connections.map((connection) => (
                        <option key={connection.id} value={connection.id}>
                            {connection.siteUrl}
                        </option>
                    ))}
                </select>
            </label>
            <label className="flex items-center gap-2 self-end text-xs font-medium text-stone-700">
                <input type="checkbox" checked={on} onChange={(event) => setOn(event.target.checked)} />
                Run every Monday at 08:30 GMT
            </label>
            <div className="flex items-center gap-3 md:col-span-2">
                <button type="submit" className={primaryClass}>
                    Save settings
                </button>
                {status && <span className="text-xs text-stone-600">{status}</span>}
            </div>
        </form>
    )
}
