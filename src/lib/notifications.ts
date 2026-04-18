import { SupabaseClient } from '@supabase/supabase-js'

export type NotificationType = 'post_published' | 'post_failed' | 'brief_ready' | 'ab_decided'

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string | null
  link: string | null
  read_at: string | null
  created_at: string
}

/** Insert a notification row. Call this from API routes using the server Supabase client. */
export async function insertNotification(
  supabase: SupabaseClient,
  userId: string,
  type: NotificationType,
  title: string,
  body?: string,
  link?: string,
) {
  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    type,
    title,
    body: body ?? null,
    link: link ?? null,
  })
  if (error) console.error('[notifications] insert error:', error.message)
}

/** Pure helper — count unread notifications from an array. */
export function countUnread(notifications: { read_at: string | null }[]): number {
  return notifications.filter((n) => n.read_at === null).length
}
