"use server"

import { createClient } from "@/lib/supabase/server"

export type InboxMessage = {
  id: string
  sender_name: string
  sender_handle?: string
  sender_avatar_url?: string
  platform: string
  platform_type: string
  content: string
  is_read: boolean
  created_at: string
}

export async function getInboxMessages(filter?: "all" | "unread" | "linkedin" | "x" | "facebook"): Promise<InboxMessage[]> {
  const supabase = await createClient()
  let query = supabase.from("inbox_messages").select("*")
    .order("created_at", { ascending: false })
    .limit(100)

  if (filter === "unread") query = query.eq("is_read", false)
  else if (filter === "linkedin") query = query.eq("platform", "linkedin")
  else if (filter === "x") query = query.eq("platform", "x")
  else if (filter === "facebook") query = query.eq("platform", "facebook")

  const { data, error } = await query
  if (error) return []
  return data
}

export async function markAsRead(id: string): Promise<boolean> {
  const supabase = await createClient()
  const { error } = await supabase.from("inbox_messages").update({ is_read: true }).eq("id", id)
  return !error
}

export async function markAllAsRead(): Promise<boolean> {
  const supabase = await createClient()
  const { error } = await supabase.from("inbox_messages").update({ is_read: true }).eq("is_read", false)
  return !error
}

export async function getUnreadCount(): Promise<number> {
  const supabase = await createClient()
  const { count } = await supabase.from("inbox_messages").select("*", { count: "exact", head: true }).eq("is_read", false)
  return count ?? 0
}
