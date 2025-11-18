import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const page = Number.parseInt(url.searchParams.get("page") || "1")
    const limit = Number.parseInt(url.searchParams.get("limit") || "20")
    const userId = url.searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    const from = (page - 1) * limit
    const to = from + limit - 1

    const supabase = await createClient()

    // Fetch user's images with pagination
    const { data, error, count } = await supabase
      .from("images")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(from, to)

    if (error) {
      throw error
    }

    return NextResponse.json({
      images: data,
      totalCount: count,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    })
  } catch (error: any) {
    console.error("Error fetching user images:", error)
    return NextResponse.json({ error: error.message || "Failed to fetch user images" }, { status: 500 })
  }
}
