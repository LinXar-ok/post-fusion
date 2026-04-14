import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('bio_pages')
    .select('*, bio_links(id, label, url, sort_order, click_count)')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json({ page: data ?? null })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { slug, title, bio, avatar_url, theme } = body

  if (!slug?.trim()) return NextResponse.json({ error: 'slug required' }, { status: 400 })

  const { data, error } = await supabase
    .from('bio_pages')
    .upsert({
      user_id: user.id,
      slug: slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      title: title?.trim() ?? 'My Links',
      bio, avatar_url,
      theme: theme ?? 'dark',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ page: data })
}
