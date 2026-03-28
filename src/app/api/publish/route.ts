import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { content, platforms, media_urls = [], hashtags = [], emotion, scheduled_for } = body;

    if (!content || !platforms || platforms.length === 0) {
      return NextResponse.json({ error: "Missing content or target platforms" }, { status: 400 });
    }

    const isScheduled = scheduled_for && new Date(scheduled_for) > new Date();

    // 1. Log the Post into the Database for Analytics & Queueing
    const { data: postRecord, error: insertError } = await supabase
      .from("posts")
      .insert({
        user_id: user.id,
        content: content,
        platforms: platforms,
        media_urls: media_urls,
        hashtags: hashtags,
        emotion: emotion || null,
        status: isScheduled ? 'scheduled' : 'publishing',
        scheduled_for: scheduled_for || null
      })
      .select()
      .single();

    if (insertError) {
      console.error("Database Insert Error:", insertError);
      return NextResponse.json({ error: "Failed to save post to database." }, { status: 500 });
    }

    // 2. If Scheduled, return early! A cron job will handle the actual delivery.
    if (isScheduled) {
      return NextResponse.json({
        success: true,
        message: "Successfully scheduled in the queue.",
        post: postRecord
      });
    }

    // 3. Immedate Publishing Execution
    const { data: profiles, error: dbError } = await supabase
      .from("social_profiles")
      .select("*")
      .eq("user_id", user.id)
      .in("platform", platforms);

    if (dbError || !profiles || profiles.length === 0) {
      await supabase.from("posts").update({ status: 'failed', error_logs: { reason: "No connected OAuth profiles found."} }).eq('id', postRecord.id);
      return NextResponse.json({ error: "No connected profiles found for the selected platforms." }, { status: 400 });
    }

    const results = [];
    let hasCompleteFailure = true;

    for (const profile of profiles) {
      try {
        if (profile.platform === "linkedin") {
           // Basic LinkedIn Text / Image Payload Builder
           // Note: True image publishing on LinkedIn requires a multi-step asset registration upload.
           // For this MVP, we will append the URL to the text, as UGC shareMediaCategory requires URN assets.
           let finalContent = content;
           if (hashtags.length > 0) finalContent += `\n\n${hashtags.map((h:string) => `#${h}`).join(" ")}`;
           if (media_urls.length > 0) finalContent += `\n\nImage: ${media_urls[0]}`;

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
            results.push({ platform: "linkedin", status: "error", message: data.message || "Failed to post to LinkedIn" });
          }
        } else {
            results.push({ platform: profile.platform, status: "error", message: "API integration pending for this platform." });
        }
      } catch(e: any) {
        results.push({ platform: profile.platform, status: "error", message: e.message });
      }
    }

    // 4. Update the Database Record with the outcome
    await supabase
      .from("posts")
      .update({
        status: hasCompleteFailure ? 'failed' : 'published',
        published_at: hasCompleteFailure ? null : new Date().toISOString(),
        error_logs: results
      })
      .eq('id', postRecord.id);

    return NextResponse.json({ success: true, results, post: postRecord });

  } catch (error: any) {
    console.error("Publishing pipeline error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
