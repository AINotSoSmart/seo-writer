import { NextResponse } from "next/server"

export async function POST() {
    return NextResponse.json({ error: "SEO Health is retired." }, { status: 410 })
}
