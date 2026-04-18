'use client'

import { useEffect, useState, useCallback } from 'react'
import { Bell } from 'lucide-react'
import { countUnread } from '@/lib/notifications'
import type { Notification } from '@/lib/notifications'
import { NotificationDrawer } from './NotificationDrawer'

export function NotifBell() {
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])

  const fetchNotifications = useCallback(async () => {
    const res = await fetch('/api/notifications')
    if (!res.ok) return
    const data = await res.json()
    setNotifications(data.notifications ?? [])
    setUnread(countUnread(data.notifications ?? []))
  }, [])

  // Fetch on mount and every 60 s
  useEffect(() => {
    fetchNotifications()
    const timer = setInterval(fetchNotifications, 60_000)
    return () => clearInterval(timer)
  }, [fetchNotifications])

  // Re-fetch when drawer closes (so badge refreshes after mark-read)
  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) fetchNotifications()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-[#2E5E99] transition-colors duration-200 bg-[var(--nm-bg)] cursor-pointer"
        style={{ boxShadow: 'var(--nm-raised-sm)' }}
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-[#128C7E] border-2 border-[var(--nm-bg)] flex items-center justify-center text-[8px] font-bold text-white px-0.5">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      <NotificationDrawer
        open={open}
        onOpenChange={handleOpenChange}
        notifications={notifications}
        onMarkAllRead={async () => {
          await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
          fetchNotifications()
        }}
        onMarkRead={async (id: string) => {
          await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [id] }) })
          fetchNotifications()
        }}
      />
    </>
  )
}
