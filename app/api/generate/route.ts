import { NextResponse } from "next/server"

export function POST() {
    return NextResponse.json(
        {
            error:
                "Ad-hoc generation is retired. Articles are generated from a purchased program cluster.",
        },
        { status: 410 },
    )
}
