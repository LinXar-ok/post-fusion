import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildBriefContext } from '@/lib/brand-brain'
import Groq from 'groq-sdk'

function getWeekStart(date: Date): string {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() + (d.getUTCDay() === 0 ? -6 : 1 - d.getUTCDay()))
  return d.toISOString().split('T')[0]
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const weekStart = getWeekStart(new Date())

  // Return cached digest if available
  const { data: existing } = await supabase
    .from('performance_digests')
    .select('*')
    .eq('user_id', user.id)
    .eq('week_start', weekStart)
    .single()

  if (existing) {
    if (existing.status === 'unread') {
      await supabase.from('performance_digests').update({ status: 'read' }).eq('id', existing.id)
    }
    return NextResponse.json({ digest: existing })
  }

  // Generate new digest
  if (!process.env.GROQ_API_KEY) return NextResponse.json({ digest: null })

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: posts } = await supabase
    .from('posts')
    .select('id, content, platforms, status, created_at, post_analytics(likes, comments, shares, engagement_rate)')
    .eq('user_id', user.id)
    .gte('created_at', since)
    .in('status', ['published'])

  if (!posts || posts.length === 0) return NextResponse.json({ digest: null })

  // Find top post by engagement_rate
  const withAnalytics = posts.filter(p => p.post_analytics)
  const topPost = withAnalytics.sort((a, b) => {
    const ar = (a.post_analytics as { engagement_rate: number } | null)?.engagement_rate ?? 0
    const br = (b.post_analytics as { engagement_rate: number } | null)?.engagement_rate ?? 0
    return br - ar
  })[0]

  const totalPosts = posts.length
  const avgEngagement = withAnalytics.length > 0
    ? (withAnalytics.reduce((sum, p) => sum + ((p.post_analytics as { engagement_rate: number } | null)?.engagement_rate ?? 0), 0) / withAnalytics.length).toFixed(1)
    : '—'

  const context = buildBriefContext(posts.map(p => p.content))
  const prompt = `You are a social media performance strategist. This user published ${totalPosts} posts this week with an average engagement rate of ${avgEngagement}%. Here are the posts:\n\n${context}\n\nGenerate a weekly performance digest. Return ONLY valid JSON with no markdown:\n{"summary": "<2-3 sentences: what worked this week and what didn't>", "actions": ["<specific, data-driven action>", "<specific action>", "<specific action>"]}\n\nMake all 3 actions concrete and specific to these posts — no generic advice.`

  const client = new Groq({ apiKey: process.env.GROQ_API_KEY })

  try {
    const completion = await client.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = completion.choices[0]?.message?.content?.trim() ?? '{}'
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const result = JSON.parse(cleaned)

    const metrics = { total_posts: totalPosts, avg_engagement: avgEngagement }

    const { data: digest } = await supabase
      .from('performance_digests')
      .insert({
        user_id: user.id,
        week_start: weekStart,
        summary: result.summary ?? '',
        actions: result.actions ?? [],
        top_post_id: topPost?.id ?? null,
        metrics,
        status: 'read',
      })
      .select()
      .single()

    return NextResponse.json({ digest })
  } catch {
    return NextResponse.json({ digest: null })
  }
}
