import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('content_pillars')
    .select('*')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ pillars: data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, emoji, color, description, target_pct } = body

  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const { count } = await supabase
    .from('content_pillars')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if ((count ?? 0) >= 5) {
    return NextResponse.json({ error: 'Maximum 5 pillars allowed' }, { status: 422 })
  }

  const { data, error } = await supabase
    .from('content_pillars')
    .insert({ user_id: user.id, name: name.trim(), emoji: emoji ?? '📌', color: color ?? '#128C7E', description, target_pct: target_pct ?? 20 })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ pillar: data }, { status: 201 })
}
