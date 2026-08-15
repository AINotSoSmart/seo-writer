import { NextResponse } from "next/server"

export function POST() {
    return NextResponse.json(
        {
            error:
                "Standalone pillar generation is retired. Pillars are delivered with their complete cluster.",
        },
        { status: 410 },
    )
}
