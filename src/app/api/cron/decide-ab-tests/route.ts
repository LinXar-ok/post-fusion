import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { pickAbWinner } from '@/lib/performance-coach'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()

  // Find all running tests past their decide_after time
  const { data: tests } = await supabase
    .from('ab_tests')
    .select(`id, post_a:post_a_id(id, post_analytics(engagement_rate)), post_b:post_b_id(id, post_analytics(engagement_rate))`)
    .eq('status', 'running')
    .lte('decide_after', new Date().toISOString())

  if (!tests || tests.length === 0) return NextResponse.json({ decided: 0 })

  let decided = 0
  for (const test of tests) {
    const postA = test.post_a as { id: string; post_analytics: { engagement_rate: number } | null } | null
    const postB = test.post_b as { id: string; post_analytics: { engagement_rate: number } | null } | null
    if (!postA || !postB) continue

    const winnerId = pickAbWinner(
      { id: postA.id, engagement_rate: postA.post_analytics?.engagement_rate ?? 0 },
      { id: postB.id, engagement_rate: postB.post_analytics?.engagement_rate ?? 0 }
    )

    await supabase
      .from('ab_tests')
      .update({ winner_post_id: winnerId, status: 'decided', decided_at: new Date().toISOString() })
      .eq('id', test.id)

    decided++
  }

  return NextResponse.json({ decided })
}
