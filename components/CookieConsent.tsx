"use client"

import { useEffect, useState } from "react"
import Clarity from "@microsoft/clarity"

type Consent = {
    analytics: boolean
    support: boolean
    updatedAt: string
}

const STORAGE_KEY = "flipaeo_cookie_consent_v1"

function loadScript(id: string, src: string) {
    if (document.getElementById(id)) return
    const script = document.createElement("script")
    script.id = id
    script.src = src
    script.async = true
    document.head.appendChild(script)
}

export function CookieConsent({
    clarityProjectId,
    analyticsId,
    crispWebsiteId,
}: {
    clarityProjectId?: string
    analyticsId?: string
    crispWebsiteId?: string
}) {
    const [consent, setConsent] = useState<Consent | null>(null)
    const [open, setOpen] = useState(false)
    const [analytics, setAnalytics] = useState(false)
    const [support, setSupport] = useState(false)

    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY)
            if (raw) {
                const saved = JSON.parse(raw) as Consent
                setConsent(saved)
                setAnalytics(Boolean(saved.analytics))
                setSupport(Boolean(saved.support))
            } else {
                setOpen(true)
            }
        } catch {
            setOpen(true)
        }
    }, [])

    useEffect(() => {
        if (!consent) return
        if (consent.analytics) {
            if (analyticsId) {
                loadScript("flipaeo-gtag", `https://www.googletagmanager.com/gtag/js?id=${analyticsId}`)
                const windowWithData = window as typeof window & {
                    dataLayer?: unknown[]
                    gtag?: (...args: unknown[]) => void
                }
                windowWithData.dataLayer = windowWithData.dataLayer || []
                windowWithData.gtag = (...args: unknown[]) => {
                    windowWithData.dataLayer!.push(args)
                }
                windowWithData.gtag("js", new Date())
                windowWithData.gtag("config", analyticsId, { anonymize_ip: true })
            }
            if (clarityProjectId) {
                Clarity.init(clarityProjectId)
            }
        }
        if (consent.support && crispWebsiteId) {
            const crispWindow = window as typeof window & {
                $crisp?: unknown[]
                CRISP_WEBSITE_ID?: string
            }
            crispWindow.$crisp = crispWindow.$crisp || []
            crispWindow.CRISP_WEBSITE_ID = crispWebsiteId
            loadScript("flipaeo-crisp", "https://client.crisp.chat/l.js")
        }
    }, [analyticsId, clarityProjectId, consent, crispWebsiteId])

    function save(next: Pick<Consent, "analytics" | "support">) {
        const value: Consent = { ...next, updatedAt: new Date().toISOString() }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
        document.cookie = `${STORAGE_KEY}=${encodeURIComponent(JSON.stringify(value))}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`
        setConsent(value)
        setAnalytics(value.analytics)
        setSupport(value.support)
        setOpen(false)
        if (!value.analytics || !value.support) {
            window.location.reload()
        }
    }

    return (
        <>
            {!open && (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="fixed bottom-3 left-3 z-[100] rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-[11px] text-stone-600 shadow-sm"
                >
                    Cookie settings
                </button>
            )}
            {open && (
                <div className="fixed inset-x-3 bottom-3 z-[110] mx-auto max-w-2xl rounded-xl border border-stone-300 bg-white p-5 shadow-2xl">
                    <h2 className="font-serif text-xl text-stone-900">Your privacy choices</h2>
                    <p className="mt-2 text-sm leading-6 text-stone-600">
                        Essential cookies keep authentication and security working. Analytics
                        and support chat load only with your consent.
                    </p>
                    <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
                        <label className="rounded-lg border bg-stone-50 p-3 text-stone-600">
                            <input type="checkbox" checked disabled className="mr-2" />
                            Essential
                        </label>
                        <label className="rounded-lg border p-3">
                            <input
                                type="checkbox"
                                checked={analytics}
                                onChange={(event) => setAnalytics(event.target.checked)}
                                className="mr-2"
                            />
                            Analytics
                        </label>
                        <label className="rounded-lg border p-3">
                            <input
                                type="checkbox"
                                checked={support}
                                onChange={(event) => setSupport(event.target.checked)}
                                className="mr-2"
                            />
                            Support chat
                        </label>
                    </div>
                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => save({ analytics: false, support: false })}
                            className="rounded-lg border px-3 py-2 text-sm font-medium"
                        >
                            Essential only
                        </button>
                        <button
                            type="button"
                            onClick={() => save({ analytics, support })}
                            className="rounded-lg border px-3 py-2 text-sm font-medium"
                        >
                            Save choices
                        </button>
                        <button
                            type="button"
                            onClick={() => save({ analytics: true, support: true })}
                            className="rounded-lg bg-stone-950 px-3 py-2 text-sm font-semibold text-white"
                        >
                            Accept all
                        </button>
                    </div>
                </div>
            )}
        </>
    )
}
