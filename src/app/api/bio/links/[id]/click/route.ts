import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params

  // Use raw SQL increment to avoid race conditions
  const { error } = await supabase.rpc('increment_bio_link_click', { link_id: id })

  // Fallback if RPC not set up: direct update
  if (error) {
    const { data: link } = await supabase.from('bio_links').select('click_count').eq('id', id).single()
    if (link) {
      await supabase.from('bio_links').update({ click_count: (link.click_count ?? 0) + 1 }).eq('id', id)
    }
  }

  return NextResponse.json({ ok: true })
}
