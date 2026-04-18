'use client'

import Link from 'next/link'
import { CheckCircle, XCircle, Brain, Zap } from 'lucide-react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import type { Notification } from '@/lib/notifications'

const typeIcon: Record<string, React.ReactNode> = {
  post_published: <CheckCircle className="w-4 h-4 text-[#128C7E]" />,
  post_failed:    <XCircle    className="w-4 h-4 text-destructive" />,
  brief_ready:    <Brain      className="w-4 h-4 text-[#7BA4D0]" />,
  ab_decided:     <Zap        className="w-4 h-4 text-[#675B47]" />,
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 60)  return `${mins}m ago`
  if (hours < 24)  return `${hours}h ago`
  return `${days}d ago`
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  notifications: Notification[]
  onMarkAllRead: () => Promise<void>
  onMarkRead: (id: string) => Promise<void>
}

export function NotificationDrawer({ open, onOpenChange, notifications, onMarkAllRead, onMarkRead }: Props) {
  const unreadCount = notifications.filter((n) => !n.read_at).length

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[380px] sm:w-[420px] p-0 bg-[var(--nm-bg)] flex flex-col">
        <SheetHeader className="px-5 py-4 border-b border-border flex-row items-center justify-between space-y-0">
          <div>
            <SheetTitle className="font-display text-base">Notifications</SheetTitle>
            {unreadCount > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">{unreadCount} unread</p>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllRead}
              className="text-xs text-[#2E5E99] hover:text-[#7BA4D0] transition-colors px-2 py-1 rounded-lg bg-[var(--nm-bg)] cursor-pointer"
              style={{ boxShadow: 'var(--nm-flat)' }}
            >
              Mark all read
            </button>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <div className="w-12 h-12 rounded-2xl bg-[var(--nm-bg)] flex items-center justify-center mb-3" style={{ boxShadow: 'var(--nm-inset-sm)' }}>
                <CheckCircle className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">All caught up</p>
              <p className="text-xs text-muted-foreground">No notifications yet.</p>
            </div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={async () => {
                  if (!n.read_at) await onMarkRead(n.id)
                  if (n.link) window.location.href = n.link
                }}
                className={`w-full text-left flex gap-3 items-start px-5 py-4 border-b border-border transition-colors hover:bg-muted/30 cursor-pointer ${!n.read_at ? 'bg-primary/5' : 'opacity-60'}`}
              >
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-[var(--nm-bg)]" style={{ boxShadow: 'var(--nm-raised-xs)' }}>
                  {typeIcon[n.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground leading-tight">{n.title}</p>
                  {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1 font-semibold uppercase tracking-wide">{timeAgo(n.created_at)}</p>
                </div>
                {!n.read_at && <span className="w-2 h-2 rounded-full bg-[#128C7E] shrink-0 mt-1.5" />}
              </button>
            ))
          )}
        </div>

        <div className="px-5 py-3 border-t border-border">
          <Link
            href="/notifications"
            onClick={() => onOpenChange(false)}
            className="text-xs text-[#2E5E99] hover:text-[#7BA4D0] transition-colors"
          >
            View notification centre →
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  )
}
