"use client"

import { useEffect, useState } from "react"
import { Check, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import {
    addWordPressConnection,
    deleteWordPressConnection,
    getWordPressConnections,
    setDefaultConnection,
} from "@/actions/wordpress"

type Connection = {
    id: string
    site_url: string
    site_name: string | null
    username: string
    is_default: boolean
}

export default function IntegrationsPage() {
    const [connections, setConnections] = useState<Connection[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [pending, setPending] = useState(false)

    async function load() {
        const result = await getWordPressConnections()
        if (!result.error) setConnections(result.connections)
        setLoading(false)
    }

    useEffect(() => {
        void load()
    }, [])

    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setPending(true)
        const form = new FormData(event.currentTarget)
        const result = await addWordPressConnection({
            siteUrl: String(form.get("siteUrl") || ""),
            username: String(form.get("username") || ""),
            appPassword: String(form.get("appPassword") || ""),
        })
        setPending(false)
        if (result.error) return toast.error(result.error)
        event.currentTarget.reset()
        setShowForm(false)
        toast.success("WordPress connected")
        await load()
    }

    return (
        <main className="mx-auto w-full max-w-4xl py-6">
            <header className="mb-7">
                <h1 className="font-serif text-3xl text-stone-900">Delivery integrations</h1>
                <p className="mt-2 text-sm text-stone-600">
                    WordPress draft creation is optional. Manual download and confirmed
                    public URLs remain available without a CMS connection.
                </p>
            </header>

            <section className="rounded-xl border border-stone-200 bg-white p-6">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="font-serif text-2xl">WordPress</h2>
                        <p className="mt-1 text-sm text-stone-600">
                            Connect with a WordPress application password. Program articles
                            are created as drafts first so the frozen permalink can be checked.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowForm((value) => !value)}
                        className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-stone-950 px-3 py-2 text-sm font-medium text-white"
                    >
                        <Plus className="h-4 w-4" /> Add site
                    </button>
                </div>

                {showForm && (
                    <form onSubmit={(event) => void submit(event)} className="mt-6 grid gap-3 rounded-lg bg-stone-50 p-4">
                        <input name="siteUrl" type="url" required placeholder="https://example.com" className="rounded-lg border px-3 py-2.5 text-sm" />
                        <input name="username" required placeholder="WordPress username" className="rounded-lg border px-3 py-2.5 text-sm" />
                        <input name="appPassword" type="password" required placeholder="Application password" className="rounded-lg border px-3 py-2.5 text-sm" />
                        <button disabled={pending} className="rounded-lg bg-stone-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                            {pending ? "Connecting…" : "Connect WordPress"}
                        </button>
                    </form>
                )}

                <div className="mt-6 space-y-3">
                    {connections.map((connection) => (
                        <div key={connection.id} className="flex items-center justify-between rounded-lg border border-stone-200 p-4">
                            <div>
                                <div className="font-medium text-stone-900">
                                    {connection.site_name || connection.site_url}
                                </div>
                                <div className="text-xs text-stone-500">{connection.site_url}</div>
                            </div>
                            <div className="flex items-center gap-2">
                                {connection.is_default ? (
                                    <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                                        <Check className="h-3.5 w-3.5" /> Default
                                    </span>
                                ) : (
                                    <button
                                        onClick={async () => {
                                            await setDefaultConnection(connection.id)
                                            await load()
                                        }}
                                        className="text-xs underline"
                                    >
                                        Make default
                                    </button>
                                )}
                                <button
                                    aria-label="Delete connection"
                                    onClick={async () => {
                                        await deleteWordPressConnection(connection.id)
                                        await load()
                                    }}
                                    className="rounded border p-2"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                    ))}
                    {!loading && connections.length === 0 && (
                        <p className="text-sm text-stone-500">No WordPress site connected.</p>
                    )}
                </div>
            </section>
        </main>
    )
}
