import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildBriefContext } from '@/lib/brand-brain'
import Groq from 'groq-sdk'

function getWeekStart(date: Date): string {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  // Roll back to Monday
  const day = d.getUTCDay()
  const diff = (day === 0 ? -6 : 1 - day)
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().split('T')[0]
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ?meta=true — return only unread count, no generation
  const meta = new URL(req.url).searchParams.get('meta')
  if (meta === 'true') {
    const { count } = await supabase
      .from('weekly_briefs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'unread')
    return NextResponse.json({ unread: count ?? 0 })
  }

  const weekStart = getWeekStart(new Date())

  // Return cached brief if it exists for this week
  const { data: existing } = await supabase
    .from('weekly_briefs')
    .select('*')
    .eq('user_id', user.id)
    .eq('week_start', weekStart)
    .single()

  if (existing) {
    // Mark as read
    if (existing.status === 'unread') {
      await supabase
        .from('weekly_briefs')
        .update({ status: 'read' })
        .eq('id', existing.id)
    }
    return NextResponse.json({ brief: existing })
  }

  // No cached brief — generate one now
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ brief: null })
  }

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: posts } = await supabase
    .from('posts')
    .select('content, status, platforms, created_at')
    .eq('user_id', user.id)
    .in('status', ['published', 'scheduled'])
    .gte('created_at', since)
    .order('created_at', { ascending: false })

  if (!posts || posts.length < 3) {
    return NextResponse.json({ brief: null })
  }

  const context = buildBriefContext(posts.map(p => p.content))
  const prompt = `You are a personal brand strategist. Here are someone's last 30 days of social media posts:\n\n${context}\n\nGenerate a weekly content brief. Return ONLY valid JSON with no markdown:\n{"summary": "<2-3 sentence plain-English summary of what's working and what's missing>", "insights": [{"type": "positive|gap", "text": "<specific insight>"}], "post_ideas": [{"pillar": "<Personal Story|Behind the Scenes|Tips & Insights|Curated>", "hook": "<compelling opening line for a post>"}], "actions": ["<specific actionable instruction>"]}\n\nInclude exactly 2 insights, 3 post_ideas, and 3 actions. Make everything specific to these posts — no generic advice.`

  const client = new Groq({ apiKey: process.env.GROQ_API_KEY })

  try {
    const completion = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = completion.choices[0]?.message?.content?.trim() ?? '{}'
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const result = JSON.parse(cleaned)

    const { data: brief } = await supabase
      .from('weekly_briefs')
      .insert({
        user_id: user.id,
        week_start: weekStart,
        summary: result.summary ?? '',
        insights: result.insights ?? [],
        post_ideas: result.post_ideas ?? [],
        actions: result.actions ?? [],
        status: 'read', // generated on-demand = already being viewed
      })
      .select()
      .single()

    return NextResponse.json({ brief })
  } catch {
    return NextResponse.json({ brief: null })
  }
}
