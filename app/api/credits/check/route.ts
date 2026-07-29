import { NextResponse } from "next/server"

export function GET() {
    return NextResponse.json(
        { error: "Customer credit balances are retired." },
        { status: 410 },
    )
}
