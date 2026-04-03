import { getDashboardDirectives, setGscSite } from "@/actions/seo-board"
import { createClient } from "@/utils/supabase/server"
import { ActionTrackingDashboard } from "@/components/action-tracking-dashboard"
import { GlobalCard } from "@/components/ui/global-card"
import { Loader2, ArrowRight } from "lucide-react"

export function ActionBoardLoader() {
    return (
        <GlobalCard className="w-full flex-1" contentClassName="flex items-center justify-center p-12">
            <div className="flex flex-col items-center gap-4 text-stone-400">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p>Analyzing millions of GSC rows and preparing strategy...</p>
            </div>
        </GlobalCard>
    )
}

export async function ActionBoardClient({ siteUrl, userId }: { siteUrl: string, userId: string }) {
    try {
        // 1. Get strategic directives 
        const directives = await getDashboardDirectives(siteUrl, 30)

        // 2. Fetch deployed plays from Postgres to track ROI
        const supabase = await createClient()
        const { data: plays } = await supabase
            .from('seo_plays')
            .select('*')
            .eq('user_id', userId)
            .eq('site_url', siteUrl)
            .order('created_at', { ascending: false })

        return (
            <ActionTrackingDashboard
                siteUrl={siteUrl}
                directives={directives}
                plays={plays || []}
            />
        )
    } catch (error: any) {
        if (error.message?.includes("401") || error.message?.includes("Unauthorized")) {
            return (
                <GlobalCard className="w-full flex-1" contentClassName="flex flex-col items-center justify-center p-12 text-center text-rose-800">
                    <h3 className="font-bold text-lg mb-2">Search Console Access Expired</h3>
                    <p className="mb-6 max-w-md text-stone-600">Your Google Search Console connection has expired or is invalid. Please reconnect to continue generating ROI action steps.</p>
                    <a href="/api/auth/gsc" className="px-5 py-2.5 bg-stone-900 text-white rounded-lg font-medium inline-block hover:bg-stone-800 transition-colors">Reconnect GSC</a>
                </GlobalCard>
            )
        }
        return (
            <GlobalCard className="w-full flex-1" contentClassName="flex flex-col items-center justify-center p-12 text-center text-rose-800">
                <h3 className="font-bold text-lg mb-2">Failed to load Action Board</h3>
                <p className="text-stone-600">{error.message}</p>
            </GlobalCard>
        )
    }
}

export async function GscSiteSelector({ accessToken }: { accessToken: string }) {
    let sites: { siteUrl: string }[] = []

    try {
        const response = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
            headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (response.ok) {
            const data = await response.json()
            sites = data.siteEntry || []
        }
    } catch (e) {
        console.error("Failed to fetch GSC sites", e)
    }

    return (
        <div className="w-full flex-1 flex flex-col items-center justify-center py-12">
            <GlobalCard className="max-w-2xl w-full" contentClassName="p-8">
                <div className="mb-8 text-center space-y-2">
                    <h2 className="text-2xl font-bold text-stone-900">Select Your Project</h2>
                    <p className="text-stone-500">
                        We found multiple properties in your Google Search Console.
                        Please select the URL that matches your Flipaeo brand.
                    </p>
                </div>

                {sites.length === 0 ? (
                    <div className="text-center p-6 border border-stone-200 rounded-xl bg-stone-50 text-stone-600">
                        We couldn't find any verified properties in your Google Search Console account.
                        Make sure you have added your website to GSC.
                    </div>
                ) : (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {sites.map((site) => (
                            <div key={site.siteUrl} className="flex items-center justify-between p-4 border border-stone-200 rounded-xl hover:border-stone-300 hover:bg-stone-50/30 transition-colors group">
                                <span className="font-medium text-stone-800 truncate pr-4">{site.siteUrl}</span>
                                <form action={setGscSite.bind(null, site.siteUrl)}>
                                    <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-stone-100 hover:bg-black text-stone-700 hover:text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer">
                                        Select <ArrowRight className="w-3.5 h-3.5" />
                                    </button>
                                </form>
                            </div>
                        ))}
                    </div>
                )}
            </GlobalCard>
        </div>
    )
}
