import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { GlobalCard } from "@/components/ui/global-card"
import Link from "next/link"
import { Sparkles, Shield, Lock, Activity } from "lucide-react"
import { Suspense } from "react"
import { ActionBoardLoader, ActionBoardClient, GscSiteSelector } from "./action-components"
import { decryptToken } from "@/lib/encryption"

export const metadata = {
    title: "Action Board | ROI Tracker",
    description: "Generate and track the ROI of elite SEO action steps."
}

export default async function ActionBoardPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect("/sign-in")
    }

    // Check for active subscription
    const { data: subscription } = await supabase
        .from("dodo_subscriptions")
        .select("status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle()

    const hasActiveSubscription = !!subscription

    // Show locked state if no active subscription
    if (!hasActiveSubscription) {
        return (
            <div className="w-full min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
                <GlobalCard className="max-w-lg w-full" contentClassName="p-8">
                    <div className="space-y-6 text-center">
                        <div className="flex justify-center">
                            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-amber-50 to-stone-100 flex items-center justify-center border border-amber-200/50 shadow-sm">
                                <Lock className="w-7 h-7 text-gray-600" />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
                                ROI Action Board
                            </h1>
                            <p className="text-stone-500 leading-relaxed">
                                Generate highly-optimzied, data-driven action steps directly tied to revenue, mapped securely via your Google Search Console.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-left">
                            <div className="flex items-center gap-2 p-3 rounded-lg bg-stone-50 border border-stone-100">
                                <Sparkles className="w-4 h-4 text-stone-500" />
                                <span className="text-xs font-medium text-stone-700">AI Fix Orchestration</span>
                            </div>
                            <div className="flex items-center gap-2 p-3 rounded-lg bg-stone-50 border border-stone-100">
                                <Activity className="w-4 h-4 text-stone-500" />
                                <span className="text-xs font-medium text-stone-700">Predictive ROI Tracking</span>
                            </div>
                            <div className="flex items-center gap-2 p-3 rounded-lg bg-stone-50 border border-stone-100">
                                <Shield className="w-4 h-4 text-stone-500" />
                                <span className="text-xs font-medium text-stone-700">Cannibalization Safety</span>
                            </div>
                            <div className="flex items-center gap-2 p-3 rounded-lg bg-stone-50 border border-stone-100">
                                <Sparkles className="w-4 h-4 text-stone-500" />
                                <span className="text-xs font-medium text-stone-700">Auto Title & Meta Writing</span>
                            </div>
                        </div>

                        <Link href="/billing" className="block">
                            <button
                                className="w-full h-12 rounded-lg inline-flex items-center justify-center gap-2 bg-stone-900 hover:bg-stone-800 text-white font-semibold text-sm border border-stone-700 transition-all duration-150 ease-out cursor-pointer select-none active:translate-y-[2px] active:shadow-[0_2px_0_0_#1c1917]"
                            >
                                Upgrade to Access
                            </button>
                        </Link>
                    </div>
                </GlobalCard>
            </div>
        )
    }

    // Ensure the user has completed onboarding / has a brand
    const { data: brand } = await supabase
        .from("brand_details")
        .select("id")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

    if (!brand) {
        return (
            <div className="w-full min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
                <GlobalCard className="max-w-lg w-full" contentClassName="p-8 text-center">
                    <h1 className="text-2xl font-bold mb-4 text-stone-900">No Brand Found</h1>
                    <p className="text-stone-500 mb-6">
                        Before we can generate SEO Action Steps tailored to your brand, please complete onboarding.
                    </p>
                    <Link href="/onboarding" className="inline-flex h-10 items-center justify-center rounded-lg bg-stone-900 px-8 text-sm font-medium text-white hover:bg-stone-800 transition-colors">
                        Go to Onboarding
                    </Link>
                </GlobalCard>
            </div>
        )
    }

    // Check for GSC connection
    const { data: gscConnection } = await supabase
        .from("gsc_connections")
        .select("site_url, access_token")
        .eq("user_id", user.id)
        .maybeSingle()

    if (!gscConnection || !gscConnection.access_token) {
        return (
            <div className="w-full min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
                <GlobalCard className="max-w-lg w-full" contentClassName="p-8">
                    <div className="space-y-6 text-center">
                        <div className="flex justify-center">
                            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-50 to-stone-100 flex items-center justify-center border border-indigo-200/50 shadow-sm">
                                <Activity className="w-7 h-7 text-indigo-600" />
                            </div>
                        </div>
                        <div className="space-y-3">
                            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
                                Connect Search Console
                            </h1>
                            <p className="text-stone-500 leading-relaxed">
                                To generate data-driven action steps and track your ROI, you need to connect your Google Search Console account.
                            </p>
                        </div>
                        <Link href="/api/auth/gsc?next=/action-board" className="block">
                            <button
                                className="w-full h-12 rounded-lg inline-flex items-center justify-center gap-2 bg-stone-900 hover:bg-stone-800 text-white font-semibold text-sm border border-stone-700 transition-all duration-150 ease-out cursor-pointer select-none active:translate-y-[2px] active:shadow-[0_2px_0_0_#1c1917]"
                            >
                                <Sparkles className="w-4 h-4" />
                                Connect to GSC
                            </button>
                        </Link>
                    </div>
                </GlobalCard>
            </div>
        )
    }

    return (
        <div className="w-full h-full min-h-[calc(100vh-4rem)] flex flex-col space-y-6 mx-auto">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold text-stone-900">ROI Action Board</h1>
                <p className="text-stone-500">Your specific SEO fixes directly tied to ROI.</p>
            </div>

            {!gscConnection.site_url ? (
                <GscSiteSelector accessToken={decryptToken(gscConnection.access_token)} />
            ) : (
                <Suspense fallback={<ActionBoardLoader />}>
                    <ActionBoardClient siteUrl={gscConnection.site_url} userId={user.id} />
                </Suspense>
            )}
        </div>
    )
}
