import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = 'force-dynamic'; // Ensures this route isn't statically cached

export async function GET(req: NextRequest) {
  // In production, ensure this route is secured via Vercel Cron secrets:
  // if (req.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
  //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // }

  try {
    const supabase = await createClient();

    // Fetch all pending posts that are scheduled for delivery up to the current timestamp
    const { data: duePosts, error: fetchError } = await supabase
      .from("posts")
      .select("*")
      .eq("status", "scheduled")
      .lte("scheduled_for", new Date().toISOString());

    if (fetchError || !duePosts || duePosts.length === 0) {
      return NextResponse.json({ message: "No pending posts in the queue requiring orchestration." });
    }

    const processedIds: string[] = [];

    // Process each queued post asynchronously
    for (const post of duePosts) {
      // Mark as publishing to prevent duplicate processing if pinged concurrently
      await supabase.from("posts").update({ status: 'publishing' }).eq("id", post.id);

      const { data: profiles } = await supabase
        .from("social_profiles")
        .select("*")
        .eq("user_id", post.user_id)
        .in("platform", post.platforms);

      if (!profiles || profiles.length === 0) {
        await supabase.from("posts").update({ status: 'failed', error_logs: { reason: "Missing OAuth profiles at execution time." } }).eq("id", post.id);
        continue;
      }

      let hasCompleteFailure = true;
      const results = [];

      for (const profile of profiles) {
        try {
          if (profile.platform === "linkedin") {
             // Compile payload enhancements mapped from user input
             let finalContent = post.content;
             if (post.hashtags && post.hashtags.length > 0) finalContent += `\n\n${post.hashtags.map((h:string) => `#${h}`).join(" ")}`;
             if (post.media_urls && post.media_urls.length > 0) finalContent += `\n\nImage: ${post.media_urls[0]}`;

             const linkedinBody = {
              author: `urn:li:person:${profile.profile_id}`,
              lifecycleState: "PUBLISHED",
              specificContent: {
                "com.linkedin.ugc.ShareContent": {
                  shareCommentary: {
                    text: finalContent
                  },
                  shareMediaCategory: "NONE"
                }
              },
              visibility: {
                "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
              }
            };

            const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${profile.access_token}`,
                "Content-Type": "application/json",
                "X-Restli-Protocol-Version": "2.0.0"
              },
              body: JSON.stringify(linkedinBody)
            });

            const data = await res.json().catch(() => ({}));

            if (res.ok) {
              hasCompleteFailure = false;
              results.push({ platform: "linkedin", status: "success", id: data.id });
            } else {
              results.push({ platform: "linkedin", status: "error", message: data.message });
            }
          }
        } catch(e: any) {
          results.push({ platform: profile.platform, status: "error", message: e.message || "Execution exception." });
        }
      }

      // Update Database Record with the post-mortem
      await supabase
        .from("posts")
        .update({
          status: hasCompleteFailure ? 'failed' : 'published',
          published_at: hasCompleteFailure ? null : new Date().toISOString(),
          error_logs: results
        })
        .eq('id', post.id);

      processedIds.push(post.id);
    }

    return NextResponse.json({ success: true, processedCount: processedIds.length, publishedIds: processedIds });

  } catch (error: any) {
    console.error("Cron Database Execution Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
