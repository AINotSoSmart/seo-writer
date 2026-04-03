import { getDashboardDirectives } from "@/actions/seo-board"
import { createClient } from "@/utils/supabase/server"
import { ActionTrackingDashboard } from "@/components/action-tracking-dashboard"
import { GlobalCard } from "@/components/ui/global-card"
import { Loader2 } from "lucide-react"

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
}
