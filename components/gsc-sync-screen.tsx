"use client"

import { useEffect, useState } from "react"
import { motion } from "motion/react"
import { Loader2, Database, ShieldCheck, Search } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"

export function GscSyncScreen({ siteUrl, userId }: { siteUrl: string, userId: string }) {
    const router = useRouter()
    const [elapsed, setElapsed] = useState(0)

    useEffect(() => {
        const timer = setInterval(() => {
            setElapsed(e => e + 1)
        }, 1000)
        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        const supabase = createClient()
        const pollTimer = setInterval(async () => {
            const { data } = await supabase
                .from("gsc_connections")
                .select("sync_status")
                .eq("user_id", userId)
                .single()

            if (data && data.sync_status === "completed") {
                clearInterval(pollTimer)
                router.refresh() // Tell server to re-render ActionBoardClient
            }
        }, 3000)

        return () => clearInterval(pollTimer)
    }, [userId, router])

    return (
        <div className="w-full flex-1 flex flex-col items-center justify-center p-12 min-h-[60vh]">
            <div className="relative inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-white border border-stone-200 shadow-sm mb-8">
                <Database className="w-12 h-12 text-stone-900" strokeWidth={1.5} />
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white"></span>
                </span>
            </div>

            <h3 className="font-serif text-3xl text-stone-900 mb-3">Syncing Search Data</h3>
            <p className="text-stone-500 text-lg max-w-md text-center mx-auto leading-relaxed mb-10">
                We are securely downloading 60 days of historical search performance for <span className="font-medium text-stone-800">{siteUrl}</span>...
            </p>

            <div className="w-full max-w-md bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-stone-400" />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-medium text-stone-900 mb-1">Authenticating securely</p>
                        <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden">
                            <div className="h-full bg-stone-900 w-full" />
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-stone-900 flex items-center justify-center shrink-0">
                        <Loader2 className="w-4 h-4 text-white animate-spin" />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-medium text-stone-900 mb-1">Parsing millions of rows</p>
                        <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden relative">
                            <motion.div
                                className="h-full bg-stone-900 absolute left-0 top-0 w-1/3"
                                animate={{ x: ["0%", "200%", "0%"] }}
                                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4 opacity-40 grayscale">
                    <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center shrink-0">
                        <Search className="w-4 h-4 text-stone-400" />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-medium text-stone-900 mb-1">Generating SEO Action Plan</p>
                        <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden" />
                    </div>
                </div>
            </div>

            <div className="mt-8 text-sm font-medium text-stone-400 font-mono">
                {elapsed}s elapsed
            </div>
        </div>
    )
}

function CheckCircle2(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
    )
}
