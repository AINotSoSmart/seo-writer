"use client"

import { useEffect, useState } from "react"
import { Check, Globe2, PlugZap, Plus, ShieldCheck, Trash2 } from "lucide-react"
import { toast } from "sonner"

import {
    addWordPressConnection,
    deleteWordPressConnection,
    getWordPressConnections,
    setDefaultConnection,
} from "@/actions/wordpress"
import {
    ProductHeader,
    ProductMetric,
    ProductPage,
    ProductPanel,
    primaryActionClass,
    secondaryActionClass,
} from "@/components/product/product-page"

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
        <ProductPage width="reading">
            <ProductHeader
                eyebrow="Delivery connections"
                icon={PlugZap}
                title="Integrations"
                description="Connect the systems that receive finished work. WordPress is optional—manual download and confirmed public URLs remain available without it."
            />

            <section className="grid gap-3 py-6 sm:grid-cols-2">
                <ProductMetric
                    icon={Globe2}
                    iconTint="#dbeafe"
                    iconColor="#1d4ed8"
                    label="Connected sites"
                    value={loading ? "—" : String(connections.length)}
                    note="WordPress destinations available"
                />
                <ProductMetric
                    icon={ShieldCheck}
                    iconTint="#dcfce7"
                    iconColor="#15803d"
                    label="Default destination"
                    value={connections.some((connection) => connection.is_default) ? "Set" : "None"}
                    note="Used for new draft deliveries"
                />
            </section>

            <ProductPanel>
                <div className="flex flex-col gap-4 border-b border-[var(--viz-hairline)] p-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-blue-50 text-blue-700">
                            <Globe2 className="size-4" aria-hidden />
                        </span>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-base font-semibold text-[var(--viz-ink)]">WordPress delivery</h2>
                                <span className="rounded-full bg-[var(--viz-track)] px-2 py-0.5 text-[10px] font-medium text-[var(--viz-ink-muted)]">
                                    optional
                                </span>
                            </div>
                            <p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--viz-ink-secondary)]">
                            Connect with a WordPress application password. Program articles
                            are created as drafts first so the frozen permalink can be checked.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowForm((value) => !value)}
                        className={primaryActionClass}
                    >
                        <Plus className="h-4 w-4" /> Add site
                    </button>
                </div>

                {showForm && (
                    <form onSubmit={(event) => void submit(event)} className="grid gap-4 border-b border-[var(--viz-hairline)] bg-[var(--viz-plane)] p-5">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <label className="grid gap-1.5 text-xs font-medium text-[var(--viz-ink-secondary)] sm:col-span-2">
                                Site URL
                                <input name="siteUrl" type="url" required placeholder="https://example.com" className="h-10 rounded-[9px] border border-[var(--viz-hairline)] bg-white px-3 text-sm outline-none focus:border-[var(--viz-baseline)]" />
                            </label>
                            <label className="grid gap-1.5 text-xs font-medium text-[var(--viz-ink-secondary)]">
                                WordPress username
                                <input name="username" required placeholder="Editor account" className="h-10 rounded-[9px] border border-[var(--viz-hairline)] bg-white px-3 text-sm outline-none focus:border-[var(--viz-baseline)]" />
                            </label>
                            <label className="grid gap-1.5 text-xs font-medium text-[var(--viz-ink-secondary)]">
                                Application password
                                <input name="appPassword" type="password" required placeholder="xxxx xxxx xxxx xxxx" className="h-10 rounded-[9px] border border-[var(--viz-hairline)] bg-white px-3 text-sm outline-none focus:border-[var(--viz-baseline)]" />
                            </label>
                        </div>
                        <button disabled={pending} className={`${primaryActionClass} sm:w-fit`}>
                            {pending ? "Connecting…" : "Connect WordPress"}
                        </button>
                    </form>
                )}

                <div className="divide-y divide-[var(--viz-hairline)]">
                    {connections.map((connection) => (
                        <div key={connection.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-[var(--viz-ink)]">
                                    {connection.site_name || connection.site_url}
                                </div>
                                <div className="mt-0.5 truncate text-xs text-[var(--viz-ink-muted)]">{connection.site_url}</div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                {connection.is_default ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                                        <Check className="h-3.5 w-3.5" /> Default
                                    </span>
                                ) : (
                                    <button
                                        onClick={async () => {
                                            await setDefaultConnection(connection.id)
                                            await load()
                                        }}
                                        className={secondaryActionClass}
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
                                    className="inline-flex size-9 items-center justify-center rounded-[9px] border border-[var(--viz-hairline)] text-[var(--viz-ink-muted)] hover:bg-red-50 hover:text-red-700"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                    ))}
                    {!loading && connections.length === 0 && (
                        <div className="px-5 py-10 text-center">
                            <p className="text-sm font-medium text-[var(--viz-ink)]">No WordPress site connected</p>
                            <p className="mt-1 text-xs text-[var(--viz-ink-muted)]">Manual delivery remains available from every article.</p>
                        </div>
                    )}
                </div>
            </ProductPanel>
        </ProductPage>
    )
}
