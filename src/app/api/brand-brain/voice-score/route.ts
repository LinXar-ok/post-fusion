import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildBriefContext } from '@/lib/brand-brain'
import Groq from 'groq-sdk'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 503 })
  }

  const { content } = await req.json()
  if (!content || content.length < 20) {
    return NextResponse.json({ score: null, traits: [], flags: [] })
  }

  // Fetch last 15 published posts for context
  const { data: posts } = await supabase
    .from('posts')
    .select('content')
    .eq('user_id', user.id)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(15)

  const postContents = (posts ?? []).map(p => p.content)

  if (postContents.length < 3) {
    // Not enough history to score — return null so UI shows nothing
    return NextResponse.json({ score: null, traits: [], flags: [] })
  }

  const context = buildBriefContext(postContents)
  const prompt = `You are a brand voice analyst. Here are someone's recent social media posts (newest first):\n\n${context}\n\n---\n\nNow rate this new draft on brand voice consistency with those posts. Return ONLY valid JSON with no markdown:\n{"score": <integer 0-100>, "traits": [<2-3 positive traits from their established voice>], "flags": [<0-2 ways this draft diverges, or empty array if consistent>]}\n\nDraft to score:\n"${content}"`

  const client = new Groq({ apiKey: process.env.GROQ_API_KEY })

  try {
    const completion = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = completion.choices[0]?.message?.content?.trim() ?? '{}'
    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const result = JSON.parse(cleaned)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ score: null, traits: [], flags: [] })
  }
}
