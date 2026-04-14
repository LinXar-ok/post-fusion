import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Groq from 'groq-sdk'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: post } = await supabase
    .from('posts')
    .select('id, content, platforms, created_at, post_analytics(likes, comments, shares, engagement_rate)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  const analytics = post.post_analytics as unknown as { likes: number; comments: number; shares: number; engagement_rate: number } | null

  if (!analytics || !process.env.GROQ_API_KEY) {
    return NextResponse.json({ post, analysis: null })
  }

  // Fetch user's top 10 posts for baseline comparison
  const { data: topPosts } = await supabase
    .from('posts')
    .select('content, post_analytics(engagement_rate)')
    .eq('user_id', user.id)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(10)

  const avgEngagement = topPosts
    ? topPosts.reduce((s, p) => s + ((p.post_analytics as unknown as { engagement_rate: number } | null)?.engagement_rate ?? 0), 0) / topPosts.length
    : 0

  const prompt = `This social media post achieved a ${analytics.engagement_rate}% engagement rate (${analytics.likes} likes, ${analytics.comments} comments, ${analytics.shares} shares). The user's average is ${avgEngagement.toFixed(1)}%.\n\nPost content:\n"${post.content}"\n\nAnalyze why this post performed the way it did. Return ONLY valid JSON with no markdown:\n{"reasons": ["<specific reason with evidence from the post text>"], "hook_type": "<vulnerability|question|story|tip|humor|controversy>", "what_to_repeat": "<one sentence: what structural or tonal element to use again>", "what_to_avoid": "<one sentence, or null if it performed well>"}\n\nProvide exactly 3 reasons.`

  const client = new Groq({ apiKey: process.env.GROQ_API_KEY })

  try {
    const completion = await client.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = completion.choices[0]?.message?.content?.trim() ?? '{}'
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const analysis = JSON.parse(cleaned)

    return NextResponse.json({ post, analytics, analysis })
  } catch {
    return NextResponse.json({ post, analytics, analysis: null })
  }
}
