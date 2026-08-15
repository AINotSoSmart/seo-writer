import { NextResponse } from "next/server"

export function POST() {
    return NextResponse.json(
        {
            error:
                "Mutable sitemap link syncing is retired. Program links are frozen from the purchased audit.",
        },
        { status: 410 },
    )
}
