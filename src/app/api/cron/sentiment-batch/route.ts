import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const authHeader = req.headers.get("authorization")
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`

  if (!user && !isCron) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const targetUserId = user?.id ?? req.headers.get("x-user-id")
  if (!targetUserId) {
    return NextResponse.json({ error: "No user identified." }, { status: 400 })
  }

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: "GROQ_API_KEY not configured." }, { status: 503 })
  }

  // Fetch published posts not yet analyzed
  const { data: analyzedPostIds } = await supabase
    .from("sentiment_logs")
    .select("post_id")
    .eq("user_id", targetUserId)

  const analyzedIds = analyzedPostIds?.map(p => p.post_id).filter(Boolean) ?? []

  let query = supabase
    .from("posts")
    .select("id, content")
    .eq("user_id", targetUserId)
    .eq("status", "published")
    .not("content", "is", null)
    .limit(50)

  if (analyzedIds.length > 0) {
    query = query.not("id", "in", `(${analyzedIds.join(",")})`)
  }

  const { data: posts, error: fetchError } = await query

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!posts || posts.length === 0) {
    return NextResponse.json({ processed: 0, message: "No posts to analyze." })
  }

  // Fetch tracked keywords
  const { data: kwData } = await supabase
    .from("tracked_keywords")
    .select("keyword")
    .eq("user_id", targetUserId)
  const keywords = kwData?.map(k => k.keyword) ?? []

  let processed = 0
  let failed = 0

  for (const post of posts) {
    const kwPrompt = keywords.length > 0
      ? ` Also check for these tracked keywords: ${keywords.join(", ")}. Return matched ones in keywords_found.`
      : " Return an empty keywords_found array."

    const prompt = `Analyze the sentiment of this social media post. Return ONLY a valid JSON object with exactly these fields:
- sentiment: one of "positive", "neutral", or "negative"
- score: a number from -1.0 to +1.0
- confidence: a number from 0.0 to 1.0
- keywords_found: array of matched tracked keywords from the post content${kwPrompt}

Post: """${post.content}"""`

    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          temperature: 0,
          max_tokens: 256,
          messages: [
            { role: "system", content: "You are a sentiment analysis API. Respond ONLY with valid JSON." },
            { role: "user", content: prompt },
          ],
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) { failed++; continue }

      let parsed: { sentiment: string; score: number; confidence: number; keywords_found?: string[] }
      try {
        const raw = data.choices?.[0]?.message?.content ?? "{}"
        const match = raw.match(/\{[\s\S]*\}/)
        parsed = JSON.parse(match ? match[0] : "{}")
      } catch {
        failed++
        continue
      }

      if (!parsed.sentiment || !["positive", "neutral", "negative"].includes(parsed.sentiment)) {
        failed++
        continue
      }

      await supabase.from("sentiment_logs").insert({
        user_id: targetUserId,
        post_id: post.id,
        content: post.content.slice(0, 1000),
        sentiment: parsed.sentiment,
        score: typeof parsed.score === "number" ? parsed.score : 0,
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
        keywords_found: Array.isArray(parsed.keywords_found) ? parsed.keywords_found : [],
      })
      processed++
    } catch {
      failed++
    }
  }

  return NextResponse.json({ processed, failed, total: posts.length })
}
