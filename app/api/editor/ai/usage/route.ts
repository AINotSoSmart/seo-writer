import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ is_subscribed: false })
        }

        // Use the same RPC to get token status
        const { data, error } = await supabase.rpc('consume_ai_tokens', {
            p_user_id: user.id
        })

        if (error) {
            console.error("Token usage check error:", error)
            return NextResponse.json({ is_subscribed: false })
        }

        return NextResponse.json({
            is_subscribed: data.is_subscribed ?? false,
            tokens_remaining: data.tokens_remaining ?? 0,
            tokens_limit: data.tokens_limit ?? 200000,
            tokens_used: (data.tokens_limit ?? 200000) - (data.tokens_remaining ?? 0),
            cycle_resets_at: data.cycle_resets_at
        })
    } catch (error) {
        console.error("Usage API error:", error)
        return NextResponse.json({ is_subscribed: false })
    }
}
