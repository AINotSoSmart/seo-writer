import { NextResponse } from "next/server"

function retired() {
    return NextResponse.json(
        {
            error:
                "The legacy content-plan API is retired. Program scope is read from immutable audits and normalized program clusters.",
        },
        { status: 410 },
    )
}

export const GET = retired
export const POST = retired
export const PATCH = retired
export const DELETE = retired
