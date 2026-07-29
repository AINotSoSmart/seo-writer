import { NextResponse } from "next/server"

export function POST() {
    return NextResponse.json(
        { error: "Webflow publishing is no longer supported." },
        { status: 410 },
    )
}
