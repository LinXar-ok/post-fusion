import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** GET /api/command-palette/posts — returns last 20 posts for the command palette */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ posts: [] })

  const { data } = await supabase
    .from('posts')
    .select('id, content, status, platforms, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ posts: data ?? [] })
}
