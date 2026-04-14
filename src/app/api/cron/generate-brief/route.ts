import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildBriefContext } from '@/lib/brand-brain'
import Groq from 'groq-sdk'

function getWeekStart(date: Date): string {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  const day = d.getUTCDay()
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day))
  return d.toISOString().split('T')[0]
}

export async function POST(req: NextRequest) {
  // Verify cron secret in production
  const secret = req.headers.get('x-cron-secret')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 503 })
  }

  const supabase = await createClient()
  const weekStart = getWeekStart(new Date())

  // Get all users who have posts in the last 30 days
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: activeUsers } = await supabase
    .from('posts')
    .select('user_id')
    .gte('created_at', since)
    .in('status', ['published', 'scheduled'])

  const userIds = [...new Set((activeUsers ?? []).map(r => r.user_id))]

  // Skip users who already have a brief for this week
  const { data: existing } = await supabase
    .from('weekly_briefs')
    .select('user_id')
    .eq('week_start', weekStart)
    .in('user_id', userIds)

  const alreadyGenerated = new Set((existing ?? []).map(r => r.user_id))
  const toGenerate = userIds.filter(id => !alreadyGenerated.has(id))

  const client = new Groq({ apiKey: process.env.GROQ_API_KEY })
  let generated = 0

  for (const userId of toGenerate) {
    const { data: posts } = await supabase
      .from('posts')
      .select('content')
      .eq('user_id', userId)
      .in('status', ['published', 'scheduled'])
      .gte('created_at', since)
      .order('created_at', { ascending: false })

    if (!posts || posts.length < 3) continue

    const context = buildBriefContext(posts.map(p => p.content))
    const prompt = `You are a personal brand strategist. Here are someone's last 30 days of social media posts:\n\n${context}\n\nGenerate a weekly content brief. Return ONLY valid JSON with no markdown:\n{"summary": "<2-3 sentence plain-English summary of what's working and what's missing>", "insights": [{"type": "positive|gap", "text": "<specific insight>"}], "post_ideas": [{"pillar": "<Personal Story|Behind the Scenes|Tips & Insights|Curated>", "hook": "<compelling opening line for a post>"}], "actions": ["<specific actionable instruction>"]}\n\nInclude exactly 2 insights, 3 post_ideas, and 3 actions. Be specific to these posts.`

    try {
      const completion = await client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      })

      const raw = completion.choices[0]?.message?.content?.trim() ?? '{}'
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
      const result = JSON.parse(cleaned)

      await supabase.from('weekly_briefs').insert({
        user_id: userId,
        week_start: weekStart,
        summary: result.summary ?? '',
        insights: result.insights ?? [],
        post_ideas: result.post_ideas ?? [],
        actions: result.actions ?? [],
        status: 'unread',
      })

      generated++
    } catch {
      // Skip failed users, don't abort the whole batch
      continue
    }
  }

  return NextResponse.json({ generated, skipped: toGenerate.length - generated })
}
