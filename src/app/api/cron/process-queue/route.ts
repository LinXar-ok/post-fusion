import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { publishToLinkedIn, publishToX, publishToFacebook } from "@/lib/publishers"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  // Protect cron in production — set CRON_SECRET in Vercel env vars
  if (process.env.NODE_ENV === "production") {
    const authHeader = req.headers.get("Authorization")
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  try {
    const supabase = await createClient()

    const { data: duePosts, error: fetchError } = await supabase
      .from("posts")
      .select("*")
      .eq("status", "scheduled")
      .lte("scheduled_for", new Date().toISOString())

    if (fetchError || !duePosts || duePosts.length === 0) {
      return NextResponse.json({ message: "No pending posts in the queue." })
    }

    const processedIds: string[] = []

    for (const dbPost of duePosts) {
      // Mark as publishing to prevent duplicate processing on concurrent calls
      await supabase.from("posts").update({ status: "publishing" }).eq("id", dbPost.id)

      const { data: profiles } = await supabase
        .from("social_profiles")
        .select("*")
        .eq("user_id", dbPost.user_id)
        .in("platform", dbPost.platforms ?? [])

      if (!profiles || profiles.length === 0) {
        await supabase.from("posts").update({ status: "failed", error_logs: { reason: "Missing OAuth profiles at execution time." } }).eq("id", dbPost.id)
        continue
      }

      const post = { content: dbPost.content, hashtags: dbPost.hashtags, media_urls: dbPost.media_urls }
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

      await supabase
        .from("posts")
        .update({
          status: hasCompleteFailure ? "failed" : "published",
          published_at: hasCompleteFailure ? null : new Date().toISOString(),
          error_logs: results,
        })
        .eq("id", dbPost.id)

      processedIds.push(dbPost.id)
    }

    return NextResponse.json({ success: true, processedCount: processedIds.length, publishedIds: processedIds })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error"
    console.error("Cron execution error:", error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
