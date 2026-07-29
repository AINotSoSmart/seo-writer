import { createHash } from "crypto"
import { NextRequest, NextResponse } from "next/server"

import { createClient } from "@/utils/supabase/server"

export async function POST(request: NextRequest) {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const token = typeof body.token === "string" ? body.token : ""
    if (token.length < 32) {
        return NextResponse.json({ error: "Invalid claim link." }, { status: 400 })
    }
    const hash = createHash("sha256").update(token).digest("hex")
    const { data, error } = await (supabase as any).rpc("claim_prospect_audit", {
        p_claim_token_hash: hash,
    })
    if (error) {
        const message = String(error.message || "")
        const status = message.includes("another email") ? 403 : 409
        return NextResponse.json({ error: message || "Unable to claim audit." }, { status })
    }
    const claimed = Array.isArray(data) ? data[0] : data
    return NextResponse.json({
        success: true,
        auditId: claimed?.audit_id,
        brandId: claimed?.brand_id,
        next: "/subscribe",
    })
}
