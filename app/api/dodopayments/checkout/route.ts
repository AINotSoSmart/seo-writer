import { NextResponse } from "next/server"

/**
 * The finite audit/cluster checkout was retired in subscription Phase 3.
 * Phase 8 will replace this boundary with the single founding-plan checkout
 * after payment -> cycle -> batch delivery passes end to end.
 */
export async function POST() {
    return NextResponse.json(
        {
            error:
                "Checkout remains closed while the recurring delivery path is being verified.",
            code: "recurring_checkout_not_ready",
        },
        { status: 503 },
    )
}
