import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST: link a post to an arc
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { arc_id, post_id, sequence_order } = await req.json()
  if (!arc_id || !post_id) return NextResponse.json({ error: 'arc_id and post_id required' }, { status: 400 })

  // Verify arc belongs to user
  const { data: arc } = await supabase
    .from('story_arcs')
    .select('id')
    .eq('id', arc_id)
    .eq('user_id', user.id)
    .single()

  if (!arc) return NextResponse.json({ error: 'Arc not found' }, { status: 404 })

  const { error } = await supabase
    .from('story_arc_posts')
    .upsert({ arc_id, post_id, sequence_order: sequence_order ?? 0 })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true }, { status: 201 })
}

// DELETE: unlink a post from an arc
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { arc_id, post_id } = await req.json()

  const { error } = await supabase
    .from('story_arc_posts')
    .delete()
    .eq('arc_id', arc_id)
    .eq('post_id', post_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
