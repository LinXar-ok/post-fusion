import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { nudge_type } = await req.json()
  if (!nudge_type) return NextResponse.json({ error: 'nudge_type required' }, { status: 400 })

  const { error } = await supabase
    .from('dismissed_nudges')
    .upsert({ user_id: user.id, nudge_type, dismissed_at: new Date().toISOString() })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
