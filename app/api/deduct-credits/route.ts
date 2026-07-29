import { NextResponse } from "next/server"

export function POST() {
    return NextResponse.json(
        { error: "Customer credit deductions are retired." },
        { status: 410 },
    )
}
