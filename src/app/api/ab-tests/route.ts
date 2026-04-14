import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('ab_tests')
    .select(`*, post_a:post_a_id(id, content, post_analytics(engagement_rate)), post_b:post_b_id(id, content, post_analytics(engagement_rate)), winner:winner_post_id(id, content)`)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tests: data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { post_a_id, post_b_id, decide_after } = await req.json()
  if (!post_a_id || !post_b_id) {
    return NextResponse.json({ error: 'post_a_id and post_b_id required' }, { status: 400 })
  }

  // Default: decide 48 hours after now
  const decideAt = decide_after ?? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('ab_tests')
    .insert({ user_id: user.id, post_a_id, post_b_id, decide_after: decideAt })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ test: data }, { status: 201 })
}
