import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { pickAbWinner } from '@/lib/performance-coach'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: test } = await supabase
    .from('ab_tests')
    .select(`*, post_a:post_a_id(id, post_analytics(engagement_rate)), post_b:post_b_id(id, post_analytics(engagement_rate))`)
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!test) return NextResponse.json({ error: 'Test not found' }, { status: 404 })
  if (test.status === 'decided') return NextResponse.json({ test })

  const postA = test.post_a as unknown as { id: string; post_analytics: { engagement_rate: number } | null } | null
  const postB = test.post_b as unknown as { id: string; post_analytics: { engagement_rate: number } | null } | null

  if (!postA || !postB) return NextResponse.json({ error: 'Posts not found' }, { status: 422 })

  const winnerId = pickAbWinner(
    { id: postA.id, engagement_rate: postA.post_analytics?.engagement_rate ?? 0 },
    { id: postB.id, engagement_rate: postB.post_analytics?.engagement_rate ?? 0 }
  )

  const { data: updated } = await supabase
    .from('ab_tests')
    .update({ winner_post_id: winnerId, status: 'decided', decided_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  return NextResponse.json({ test: updated })
}
