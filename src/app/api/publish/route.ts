import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { publishToLinkedIn, publishToX, publishToFacebook } from "@/lib/publishers"

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { content, platforms, media_urls = [], hashtags = [], emotion, scheduled_for } = body

    if (!content || !platforms || platforms.length === 0) {
      return NextResponse.json({ error: "Missing content or target platforms" }, { status: 400 })
    }

    const isScheduled = scheduled_for && new Date(scheduled_for) > new Date()

    // 1. Log the post into the database
    const { data: postRecord, error: insertError } = await supabase
      .from("posts")
      .insert({
        user_id: user.id,
        content,
        platforms,
        media_urls,
        hashtags,
        emotion: emotion || null,
        status: isScheduled ? "scheduled" : "publishing",
        scheduled_for: scheduled_for || null,
      })
      .select()
      .single()

    if (insertError) {
      console.error("Database Insert Error:", insertError)
      return NextResponse.json({ error: `Failed to save post: ${insertError.message}` }, { status: 500 })
    }

    // 2. If scheduled, return early — the cron job handles delivery
    if (isScheduled) {
      return NextResponse.json({ success: true, message: "Successfully scheduled in the queue.", post: postRecord })
    }

    // 3. Immediate publishing
    const { data: profiles, error: dbError } = await supabase
      .from("social_profiles")
      .select("*")
      .eq("user_id", user.id)
      .in("platform", platforms)

    if (dbError || !profiles || profiles.length === 0) {
      await supabase.from("posts").update({ status: "failed", error_logs: { reason: "No connected OAuth profiles found." } }).eq("id", postRecord.id)
      return NextResponse.json({ error: "No connected profiles found for the selected platforms." }, { status: 400 })
    }

    const post = { content, hashtags, media_urls }
    const results = []
    let hasCompleteFailure = true

    for (const profile of profiles) {
      let result
      if (profile.platform === "linkedin") result = await publishToLinkedIn(profile, post)
      else if (profile.platform === "x") result = await publishToX(profile, post)
      else if (profile.platform === "facebook") result = await publishToFacebook(profile, post)
      else result = { platform: profile.platform, status: "error" as const, message: "Platform integration not yet available." }

      if (result.status === "success") hasCompleteFailure = false
      results.push(result)
    }

    // 4. Update the database record with the outcome
    await supabase
      .from("posts")
      .update({
        status: hasCompleteFailure ? "failed" : "published",
        published_at: hasCompleteFailure ? null : new Date().toISOString(),
        error_logs: results,
      })
      .eq("id", postRecord.id)

    return NextResponse.json({ success: true, results, post: postRecord })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error"
    console.error("Publishing pipeline error:", error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
