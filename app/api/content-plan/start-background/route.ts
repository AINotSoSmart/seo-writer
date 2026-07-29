import { NextResponse } from "next/server"

export async function POST() {
    return NextResponse.json(
        {
            error:
                "This legacy plan generator is retired. The completed immutable audit is the program plan.",
        },
        { status: 410 },
    )
}
