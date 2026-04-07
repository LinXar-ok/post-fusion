import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const { rows } = body as { rows: { content: string; hashtags: string[]; platforms: string[]; scheduled_datetime: string }[] }

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "No valid rows to insert" }, { status: 400 })
    }

    const toInsert = rows.map(r => ({
      user_id: user.id,
      content: r.content,
      platforms: r.platforms,
      hashtags: r.hashtags,
      scheduled_for: new Date(r.scheduled_datetime).toISOString(),
      status: "scheduled" as const,
    }))

    const { data, error } = await supabase.from("posts").insert(toInsert).select()
    if (error) {
      console.error("Bulk insert error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, inserted: data.length, ids: data.map(d => d.id) })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error"
    console.error("Bulk insert error:", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
