import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import Groq from "groq-sdk"

const PROMPTS: Record<string, (content: string, platform: string) => string> = {
  improve: (content, platform) =>
    `You are a social media expert. Improve the following ${platform} post caption to be more engaging, clear, and optimized for the platform. Return ONLY the improved caption with no explanation or preamble:\n\n"${content}"`,
  hashtags: (content, platform) =>
    `Generate 8-10 relevant, high-reach hashtags for this ${platform} post. Return ONLY the hashtags as a comma-separated list without # symbols:\n\n"${content}"`,
  suggest: (content, platform) =>
    `Generate 3 alternative engaging opening lines for a ${platform} post about this topic. Number each option. Keep them concise and attention-grabbing:\n\n"${content}"`,
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "GROQ_API_KEY is not configured. Add it to your environment variables." },
      { status: 503 }
    )
  }

  const { type, content, platform } = await req.json()

  if (!type || !content || !PROMPTS[type]) {
    return NextResponse.json({ error: "Invalid request. Provide type (improve|hashtags|suggest) and content." }, { status: 400 })
  }

  const client = new Groq({ apiKey: process.env.GROQ_API_KEY })

  const completion = await client.chat.completions.create({
    model: "openai/gpt-oss-120b",
    max_tokens: 512,
    messages: [{ role: "user", content: PROMPTS[type](content, platform || "social media") }],
  })

  const result = completion.choices[0]?.message?.content?.trim() ?? ""
  return NextResponse.json({ result })
}
