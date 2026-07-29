import { NextResponse } from "next/server"

export async function GET() {
    return NextResponse.json({ error: "SEO Health is retired." }, { status: 410 })
}
