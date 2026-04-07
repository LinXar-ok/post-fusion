import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { content } = await req.json() as { content?: string }
    if (!content?.trim()) return NextResponse.json({ error: "Content is required" }, { status: 400 })

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
          {
            role: "user",
            content: `Analyze the sentiment of this social media post. Return ONLY a valid JSON object with exactly these fields:
- sentiment: one of "positive", "neutral", or "negative"
- score: a number from -1.0 (very negative) to +1.0 (very positive)
- confidence: a number from 0.0 to 1.0 indicating confidence

Post: ${content}`,
          },
        ],
      }),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) return NextResponse.json({ error: data.error?.message || "Groq API error" }, { status: res.status })

    let parsed: { sentiment: string; score: number; confidence: number }
    try {
      const raw = data.choices?.[0]?.message?.content ?? "{}"
      const match = raw.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(match ? match[0] : "{}")
    } catch {
      parsed = { sentiment: "neutral", score: 0, confidence: 0.5 }
    }

    return NextResponse.json({
      sentiment: parsed.sentiment,
      score: parsed.score,
      confidence: parsed.confidence,
      keywords_found: [],
      content,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error"
    console.error("Sentiment analysis error:", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
