import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getUserPageId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<string | null> {
  const { data } = await supabase.from('bio_pages').select('id').eq('user_id', userId).single()
  return data?.id ?? null
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pageId = await getUserPageId(supabase, user.id)
  if (!pageId) return NextResponse.json({ error: 'Create a bio page first' }, { status: 422 })

  const { label, url, sort_order } = await req.json()
  if (!label?.trim() || !url?.trim()) return NextResponse.json({ error: 'label and url required' }, { status: 400 })

  const { data, error } = await supabase
    .from('bio_links')
    .insert({ page_id: pageId, label: label.trim(), url: url.trim(), sort_order: sort_order ?? 0 })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ link: data }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pageId = await getUserPageId(supabase, user.id)
  if (!pageId) return NextResponse.json({ error: 'No bio page found' }, { status: 422 })

  const { id, label, url, sort_order } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const update: Record<string, unknown> = {}
  if (label !== undefined) update.label = label
  if (url !== undefined) update.url = url
  if (sort_order !== undefined) update.sort_order = sort_order

  const { data, error } = await supabase
    .from('bio_links')
    .update(update)
    .eq('id', id)
    .eq('page_id', pageId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ link: data })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pageId = await getUserPageId(supabase, user.id)
  if (!pageId) return NextResponse.json({ error: 'No bio page found' }, { status: 422 })

  const { id } = await req.json()
  const { error } = await supabase.from('bio_links').delete().eq('id', id).eq('page_id', pageId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
