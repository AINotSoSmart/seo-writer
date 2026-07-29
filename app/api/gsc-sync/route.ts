import { NextResponse } from "next/server"

export async function POST() {
    return NextResponse.json({ error: "Google Search Console is not part of the active product." }, { status: 410 })
}
