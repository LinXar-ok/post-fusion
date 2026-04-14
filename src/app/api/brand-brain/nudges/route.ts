import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeNudges, type NudgePost } from '@/lib/brand-brain'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch last 60 days of posts
  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
  const { data: posts, error } = await supabase
    .from('posts')
    .select('content, media_urls, status, scheduled_for, created_at')
    .eq('user_id', user.id)
    .gte('created_at', since)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch dismissed nudge types for this user
  const { data: dismissed } = await supabase
    .from('dismissed_nudges')
    .select('nudge_type')
    .eq('user_id', user.id)

  const dismissedTypes = new Set((dismissed ?? []).map(d => d.nudge_type))

  const allNudges = computeNudges((posts ?? []) as NudgePost[])
  const active = allNudges.filter(n => !dismissedTypes.has(n.type))

  return NextResponse.json({ nudges: active })
}
