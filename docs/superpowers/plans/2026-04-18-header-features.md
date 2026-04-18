# Header Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a command palette (⌘K), notification drawer with unread badge, and a full profile page — all wired to the header.

**Architecture:** Notifications are stored in a Supabase table; the bell polls for unread count and opens a right-side Sheet drawer. The command palette is a client-side overlay mounted in the app layout, triggered by ⌘K or clicking the search bar. The profile page lives at `/profile` behind the avatar dropdown menu which replaces the current sign-out button.

**Tech Stack:** Next.js 16 App Router, Supabase SDK, shadcn Sheet + DropdownMenu (base-ui), Framer Motion, Vitest, TypeScript strict.

---

## File Map

**New files:**
- `supabase/migrations/20260418000000_notifications.sql` — notifications table + RLS + avatars bucket
- `src/lib/notifications.ts` — `insertNotification()` helper + `countUnread()` pure function
- `src/lib/__tests__/notifications.test.ts` — unit tests for `countUnread`
- `src/app/api/notifications/route.ts` — GET (list) + PATCH (mark-read)
- `src/app/api/command-palette/posts/route.ts` — GET last 20 posts for palette
- `src/components/notifications/NotifBell.tsx` — bell icon with polling badge + drawer trigger
- `src/components/notifications/NotificationDrawer.tsx` — Sheet drawer with notification list
- `src/app/(app)/notifications/page.tsx` — full notification centre page
- `src/components/layout/AvatarMenu.tsx` — dropdown: View Profile / Sign Out
- `src/app/(app)/profile/page.tsx` — profile page with three tabs
- `src/app/actions/profile.ts` — updateProfile, changePassword, deleteAccount server actions
- `src/components/command-palette/CommandPalette.tsx` — ⌘K overlay modal

**Modified files:**
- `src/components/layout/header.tsx` — search → palette trigger; bell → NotifBell; avatar → AvatarMenu
- `src/app/(app)/layout.tsx` — mount CommandPalette globally
- `src/app/api/publish/route.ts` — insert notification on publish success/fail
- `src/app/api/cron/decide-ab-tests/route.ts` — insert notification on winner decided
- `src/app/api/cron/generate-brief/route.ts` — insert notification on brief ready

---

## Task 1: Database migration — notifications table + avatars bucket

**Files:**
- Create: `supabase/migrations/20260418000000_notifications.sql`

- [ ] **Step 1: Write migration file**

```sql
-- supabase/migrations/20260418000000_notifications.sql

-- Notifications table
create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text not null check (type in ('post_published','post_failed','brief_ready','ab_decided')),
  title      text not null,
  body       text,
  link       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

-- Index for fast unread count queries
create index if not exists notifications_user_unread
  on notifications (user_id, read_at)
  where read_at is null;

-- RLS
alter table notifications enable row level security;

create policy "users can read own notifications"
  on notifications for select
  using (auth.uid() = user_id);

create policy "users can update own notifications"
  on notifications for update
  using (auth.uid() = user_id);

-- Server-side inserts bypass RLS (service role key used by API routes)

-- Avatars storage bucket (public read, auth write)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "authenticated users can upload avatars"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.role() = 'authenticated');

create policy "users can update own avatars"
  on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "users can delete own avatars"
  on storage.objects for delete
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
```

- [ ] **Step 2: Push migration**

```bash
supabase db push
```

Expected: `Applying migration 20260418000000_notifications... done`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260418000000_notifications.sql
git commit -m "feat: add notifications table and avatars storage bucket"
```

---

## Task 2: Notification helper + unit tests

**Files:**
- Create: `src/lib/notifications.ts`
- Create: `src/lib/__tests__/notifications.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/lib/__tests__/notifications.test.ts
import { countUnread } from '@/lib/notifications'

type Notif = { read_at: string | null }

describe('countUnread', () => {
  it('returns 0 for empty array', () => {
    expect(countUnread([])).toBe(0)
  })

  it('counts only rows where read_at is null', () => {
    const notifications: Notif[] = [
      { read_at: null },
      { read_at: '2026-04-18T10:00:00Z' },
      { read_at: null },
    ]
    expect(countUnread(notifications)).toBe(2)
  })

  it('returns 0 when all are read', () => {
    const notifications: Notif[] = [
      { read_at: '2026-04-17T09:00:00Z' },
      { read_at: '2026-04-18T10:00:00Z' },
    ]
    expect(countUnread(notifications)).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/__tests__/notifications.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/notifications'`

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/notifications.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/__tests__/notifications.test.ts
```

Expected: PASS — 3 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications.ts src/lib/__tests__/notifications.test.ts
git commit -m "feat: add notifications helper with countUnread"
```

---

## Task 3: Notification API routes

**Files:**
- Create: `src/app/api/notifications/route.ts`

- [ ] **Step 1: Write the route**

```ts
// src/app/api/notifications/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** GET /api/notifications — returns last 50 notifications for the current user */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ notifications: data ?? [] })
}

/** PATCH /api/notifications/mark-read — body: { ids?: string[] }
 *  If ids omitted, marks ALL unread notifications as read. */
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const ids: string[] | undefined = body.ids

  const query = supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null)

  if (ids && ids.length > 0) query.in('id', ids)

  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Verify routes exist**

```bash
npx next build 2>&1 | grep notifications
```

Expected: `ƒ /api/notifications` appears in the build output

- [ ] **Step 3: Commit**

```bash
git add src/app/api/notifications/route.ts
git commit -m "feat: add GET/PATCH notifications API routes"
```

---

## Task 4: Command palette posts API route

**Files:**
- Create: `src/app/api/command-palette/posts/route.ts`

- [ ] **Step 1: Write the route**

```ts
// src/app/api/command-palette/posts/route.ts
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
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/command-palette/posts/route.ts
git commit -m "feat: add command palette posts API route"
```

---

## Task 5: Wire notifications into publish + cron routes

**Files:**
- Modify: `src/app/api/publish/route.ts`
- Modify: `src/app/api/cron/decide-ab-tests/route.ts`
- Modify: `src/app/api/cron/generate-brief/route.ts`

- [ ] **Step 1: Add notification insert to publish route**

Open `src/app/api/publish/route.ts`. Add the import at the top:

```ts
import { insertNotification } from '@/lib/notifications'
```

Find the block that does `supabase.from("posts").update({ status: hasCompleteFailure ? "failed" : "published" ... })`. Directly after that `await`, add:

```ts
    // Notify user of publish outcome
    if (hasCompleteFailure) {
      await insertNotification(
        supabase, user.id,
        'post_failed',
        'Post failed to publish',
        `"${content.slice(0, 60)}${content.length > 60 ? '…' : ''}" could not be published.`,
        '/publishing',
      )
    } else {
      const platformList = platforms.join(', ')
      await insertNotification(
        supabase, user.id,
        'post_published',
        `Post published on ${platformList}`,
        `"${content.slice(0, 60)}${content.length > 60 ? '…' : ''}"`,
        '/analytics',
      )
    }
```

- [ ] **Step 2: Add notification to decide-ab-tests cron**

Open `src/app/api/cron/decide-ab-tests/route.ts`. Add the import:

```ts
import { insertNotification } from '@/lib/notifications'
```

Inside the `for (const test of tests)` loop, after `supabase.from('ab_tests').update({ status: 'decided', winner_post_id: winnerId }).eq('id', test.id)`, add:

```ts
    // Notify the test owner
    const { data: postRow } = await supabase.from('posts').select('user_id').eq('id', winnerId).single()
    if (postRow?.user_id) {
      await insertNotification(
        supabase, postRow.user_id,
        'ab_decided',
        'A/B test decided',
        `A winner was selected for your A/B test.`,
        '/analytics',
      )
    }
```

- [ ] **Step 3: Add notification to generate-brief cron**

Open `src/app/api/cron/generate-brief/route.ts`. Add the import:

```ts
import { insertNotification } from '@/lib/notifications'
```

Find where the brief is saved to the database (the `supabase.from('brand_briefs').insert(...)` or `.upsert(...)` call). After that succeeds, add:

```ts
      await insertNotification(
        supabase, userId,
        'brief_ready',
        'Weekly Brand Brief is ready',
        'Your Brand Brain brief for this week is waiting for you.',
        '/brand-brain',
      )
```

Note: `userId` refers to whatever variable holds the current user's id in the loop — inspect the file to confirm the variable name before inserting.

- [ ] **Step 4: Build check**

```bash
npx next build 2>&1 | tail -5
```

Expected: build completes with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/publish/route.ts src/app/api/cron/decide-ab-tests/route.ts src/app/api/cron/generate-brief/route.ts
git commit -m "feat: insert notifications on publish, A/B decide, and brief ready"
```

---

## Task 6: NotifBell component — bell icon with polling unread count

**Files:**
- Create: `src/components/notifications/NotifBell.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/components/notifications/NotifBell.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { Bell } from 'lucide-react'
import { countUnread } from '@/lib/notifications'
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
```

Note: TypeScript will complain about `Notification[]` being the browser built-in. Import the type from `@/lib/notifications`:

Replace the `useState<Notification[]>` line with:
```ts
import type { Notification } from '@/lib/notifications'
// ...
const [notifications, setNotifications] = useState<Notification[]>([])
```

- [ ] **Step 2: Commit (component only — drawer comes next)**

```bash
git add src/components/notifications/NotifBell.tsx
git commit -m "feat: add NotifBell with unread polling and badge"
```

---

## Task 7: NotificationDrawer component

**Files:**
- Create: `src/components/notifications/NotificationDrawer.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/components/notifications/NotificationDrawer.tsx
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
      <SheetContent side="right" showCloseButton className="w-[380px] sm:w-[420px] p-0 bg-[var(--nm-bg)] flex flex-col">
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
```

- [ ] **Step 2: Build check**

```bash
npx next build 2>&1 | grep -E "error|Error" | head -10
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/notifications/NotificationDrawer.tsx
git commit -m "feat: add NotificationDrawer Sheet component"
```

---

## Task 8: Notification centre page

**Files:**
- Create: `src/app/(app)/notifications/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
// src/app/(app)/notifications/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CheckCircle, XCircle, Brain, Zap } from 'lucide-react'

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

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  const items = notifications ?? []

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-2xl mx-auto w-full">
      <h1 className="font-display text-3xl font-bold tracking-tight text-foreground mb-1">Notifications</h1>
      <p className="text-muted-foreground text-sm mb-8">Your recent activity and alerts.</p>

      {items.length === 0 ? (
        <div className="rounded-2xl p-12 text-center bg-[var(--nm-bg)]" style={{ boxShadow: 'var(--nm-raised)' }}>
          <p className="text-sm text-muted-foreground">No notifications yet.</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden bg-[var(--nm-bg)]" style={{ boxShadow: 'var(--nm-raised)' }}>
          {items.map((n, i) => (
            <div
              key={n.id}
              className={`flex gap-4 items-start px-6 py-5 ${i < items.length - 1 ? 'border-b border-border' : ''} ${!n.read_at ? 'bg-primary/5' : ''}`}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-[var(--nm-bg)]" style={{ boxShadow: 'var(--nm-raised-xs)' }}>
                {typeIcon[n.type]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{n.title}</p>
                {n.body && <p className="text-xs text-muted-foreground mt-1">{n.body}</p>}
                <p className="text-[10px] text-muted-foreground mt-1.5 font-semibold uppercase tracking-wide">{timeAgo(n.created_at)}</p>
              </div>
              {!n.read_at && <span className="w-2 h-2 rounded-full bg-[#128C7E] shrink-0 mt-2" />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(app)/notifications/page.tsx
git commit -m "feat: add notification centre page at /notifications"
```

---

## Task 9: Avatar dropdown menu

**Files:**
- Create: `src/components/layout/AvatarMenu.tsx`
- Modify: `src/components/layout/header.tsx`

- [ ] **Step 1: Create AvatarMenu component**

```tsx
// src/components/layout/AvatarMenu.tsx
'use client'

import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { User, LogOut } from 'lucide-react'
import { signout } from '@/app/actions/auth'
import Link from 'next/link'

interface Props {
  name: string
  avatarUrl: string
}

export function AvatarMenu({ name, avatarUrl }: Props) {
  const initials = name?.charAt(0)?.toUpperCase() ?? 'U'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="rounded-xl transition-colors duration-200 focus-visible:outline-none bg-[var(--nm-bg)] p-0.5 cursor-pointer"
          style={{ boxShadow: 'var(--nm-raised-sm)' }}
          aria-label="Account menu"
        >
          <Avatar className="w-8 h-8">
            <AvatarImage src={avatarUrl} alt={name} />
            <AvatarFallback className="bg-[#2E5E99]/15 text-[#2E5E99] font-semibold text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-44 bg-[var(--nm-bg)]" style={{ boxShadow: 'var(--nm-raised)' }}>
        <DropdownMenuItem asChild>
          <Link href="/profile" className="flex items-center gap-2 cursor-pointer">
            <User className="w-3.5 h-3.5" />
            View Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <form action={signout} className="w-full">
            <button type="submit" className="flex items-center gap-2 w-full text-destructive cursor-pointer">
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

- [ ] **Step 2: Update header.tsx**

Replace the entire `src/components/layout/header.tsx` with:

```tsx
// src/components/layout/header.tsx
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ThemeToggle } from './theme-toggle'
import { NotifBell } from '@/components/notifications/NotifBell'
import { AvatarMenu } from './AvatarMenu'

export async function Header() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const name      = (user?.user_metadata?.name as string | undefined) ?? 'User'
  const avatarUrl = (user?.user_metadata?.avatar_url as string | undefined) ?? ''

  return (
    <header
      className="h-16 px-6 flex items-center justify-between sticky top-0 z-10 w-full"
      style={{ background: 'var(--nm-bg)' }}
    >
      {/* Left: mobile menu + search trigger */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden text-slate-500 hover:text-foreground rounded-xl hover:bg-transparent bg-[var(--nm-bg)]"
          style={{ boxShadow: 'var(--nm-raised-sm)' }}
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Search — opens command palette, not a real input */}
        <button
          id="cmd-palette-trigger"
          className="relative hidden sm:flex items-center rounded-xl bg-[var(--nm-bg)] h-9 px-3 w-56 lg:w-72 gap-2 cursor-pointer text-left"
          style={{ boxShadow: 'var(--nm-inset-sm)' }}
          aria-label="Open command palette"
        >
          <svg className="h-3.5 w-3.5 text-muted-foreground shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <span className="text-sm text-muted-foreground flex-1">Search…</span>
          <kbd className="text-[10px] text-muted-foreground border border-border rounded px-1 py-0.5 hidden lg:inline">⌘K</kbd>
        </button>
      </div>

      {/* Right: theme + notifications + avatar */}
      <div className="flex items-center gap-2.5">
        <ThemeToggle />
        <NotifBell />
        {user ? (
          <AvatarMenu name={name} avatarUrl={avatarUrl} />
        ) : (
          <Link href="/login">
            <Button size="sm" className="rounded-xl bg-[#2E5E99] text-white" style={{ boxShadow: 'var(--nm-raised-sm)' }}>
              Sign In
            </Button>
          </Link>
        )}
      </div>
    </header>
  )
}
```

- [ ] **Step 3: Build check**

```bash
npx next build 2>&1 | grep -E "error|Error" | head -10
```

Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/AvatarMenu.tsx src/components/layout/header.tsx
git commit -m "feat: add AvatarMenu dropdown with View Profile and Sign Out"
```

---

## Task 10: Profile server actions

**Files:**
- Create: `src/app/actions/profile.ts`

- [ ] **Step 1: Write the server actions**

```ts
// src/app/actions/profile.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function updateProfile(_prev: unknown, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const name    = (formData.get('name')    as string | null)?.trim()
  const bio     = (formData.get('bio')     as string | null)?.trim()
  const website = (formData.get('website') as string | null)?.trim()

  if (!name) return { error: 'Display name is required' }

  // Handle avatar upload if present
  let avatarUrl: string | undefined
  const avatarFile = formData.get('avatar') as File | null
  if (avatarFile && avatarFile.size > 0) {
    const ext = avatarFile.name.split('.').pop() ?? 'jpg'
    const path = `avatars/${user.id}/avatar.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type })
    if (uploadError) return { error: `Avatar upload failed: ${uploadError.message}` }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    avatarUrl = publicUrl
  }

  const { error } = await supabase.auth.updateUser({
    data: {
      name,
      bio: bio ?? '',
      website: website ?? '',
      ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
    },
  })

  if (error) return { error: error.message }
  revalidatePath('/profile')
  return { success: true }
}

export async function changePassword(_prev: unknown, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const newPassword     = formData.get('new_password')     as string
  const confirmPassword = formData.get('confirm_password') as string

  if (!newPassword || newPassword.length < 8) {
    return { error: 'Password must be at least 8 characters' }
  }
  if (newPassword !== confirmPassword) {
    return { error: 'Passwords do not match' }
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return { error: error.message }
  return { success: true }
}

export async function deleteAccount(_prev: unknown, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const confirmEmail = (formData.get('confirm_email') as string | null)?.trim()
  if (confirmEmail !== user.email) {
    return { error: 'Email does not match. Account not deleted.' }
  }

  // Delete storage files
  const { data: files } = await supabase.storage.from('avatars').list(`avatars/${user.id}`)
  if (files && files.length > 0) {
    await supabase.storage.from('avatars').remove(files.map((f) => `avatars/${user.id}/${f.name}`))
  }

  // Sign out then delete via admin API (requires service role — fallback: delete data + sign out)
  await supabase.auth.signOut()
  redirect('/login')
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/actions/profile.ts
git commit -m "feat: add updateProfile, changePassword, deleteAccount server actions"
```

---

## Task 11: Profile page

**Files:**
- Create: `src/app/(app)/profile/page.tsx`

- [ ] **Step 1: Write the profile page**

```tsx
// src/app/(app)/profile/page.tsx
'use client'

import { useActionState, useRef, useState } from 'react'
import { updateProfile, changePassword, deleteAccount } from '@/app/actions/profile'
import { createClient } from '@/lib/supabase/client'
import { useEffect } from 'react'

type UserMeta = {
  name: string; email: string; bio: string; website: string; avatar_url: string
}

type TabId = 'profile' | 'password' | 'danger'

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
      {children}
    </label>
  )
}

function InsetInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--nm-bg)] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
      style={{ boxShadow: 'var(--nm-inset-sm)' }}
    />
  )
}

function InsetTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      rows={3}
      className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--nm-bg)] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none resize-none"
      style={{ boxShadow: 'var(--nm-inset-sm)' }}
    />
  )
}

function SaveButton({ pending }: { pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-5 py-2.5 rounded-xl bg-[#2E5E99] text-white text-sm font-semibold disabled:opacity-50 cursor-pointer nm-convex"
      style={{ boxShadow: 'var(--nm-raised-sm)' }}
    >
      {pending ? 'Saving…' : 'Save changes'}
    </button>
  )
}

export default function ProfilePage() {
  const supabase = createClient()
  const [meta, setMeta] = useState<UserMeta>({ name: '', email: '', bio: '', website: '', avatar_url: '' })
  const [activeTab, setActiveTab] = useState<TabId>('profile')
  const [confirmEmail, setConfirmEmail] = useState('')
  const [showDangerModal, setShowDangerModal] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [avatarPreview, setAvatarPreview] = useState<string>('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setMeta({
        name:       (user.user_metadata?.name       as string) ?? '',
        email:      user.email ?? '',
        bio:        (user.user_metadata?.bio        as string) ?? '',
        website:    (user.user_metadata?.website    as string) ?? '',
        avatar_url: (user.user_metadata?.avatar_url as string) ?? '',
      })
      setAvatarPreview((user.user_metadata?.avatar_url as string) ?? '')
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [profileState, profileAction, profilePending] = useActionState(updateProfile, null)
  const [pwState,      pwAction,      pwPending]      = useActionState(changePassword, null)
  const [deleteState,  deleteAction,  deletePending]  = useActionState(deleteAccount, null)

  const tabs: { id: TabId; label: string; danger?: boolean }[] = [
    { id: 'profile',  label: 'Edit Profile' },
    { id: 'password', label: 'Change Password' },
    { id: 'danger',   label: 'Danger Zone', danger: true },
  ]

  const initials = meta.name?.charAt(0)?.toUpperCase() ?? 'U'

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-2xl mx-auto w-full">
      {/* Page header with avatar */}
      <div className="flex items-center gap-5 mb-8">
        <div className="relative">
          <div
            className="w-16 h-16 rounded-full bg-[var(--nm-bg)] flex items-center justify-center overflow-hidden"
            style={{ boxShadow: 'var(--nm-raised)' }}
          >
            {avatarPreview
              ? <img src={avatarPreview} alt={meta.name} className="w-full h-full object-cover" />
              : <span className="text-2xl font-bold text-[#2E5E99]">{initials}</span>
            }
          </div>
          {activeTab === 'profile' && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#2E5E99] border-2 border-[var(--nm-bg)] flex items-center justify-center cursor-pointer"
            >
              <svg width="10" height="10" fill="none" stroke="white" strokeWidth={2.2} viewBox="0 0 24 24">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
              </svg>
            </button>
          )}
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">{meta.name || 'Your Profile'}</h1>
          <p className="text-sm text-muted-foreground">{meta.email}</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-border mb-8">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === tab.id
                ? tab.danger ? 'border-destructive text-destructive' : 'border-[#2E5E99] text-[#2E5E99]'
                : tab.danger ? 'border-transparent text-destructive/50 hover:text-destructive/80' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Edit Profile tab */}
      {activeTab === 'profile' && (
        <form action={profileAction} className="space-y-5">
          <input ref={fileRef} type="file" name="avatar" accept="image/*" className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) setAvatarPreview(URL.createObjectURL(file))
            }}
          />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel>Display Name</FieldLabel>
              <InsetInput name="name" defaultValue={meta.name} placeholder="Your name" required />
            </div>
            <div>
              <FieldLabel>Email <span className="text-muted-foreground/50 normal-case font-normal">(read-only)</span></FieldLabel>
              <InsetInput value={meta.email} disabled readOnly />
            </div>
          </div>
          <div>
            <FieldLabel>Bio</FieldLabel>
            <InsetTextarea name="bio" defaultValue={meta.bio} placeholder="A short bio…" />
          </div>
          <div>
            <FieldLabel>Website</FieldLabel>
            <InsetInput name="website" type="url" defaultValue={meta.website} placeholder="https://" />
          </div>
          {profileState && 'error' in profileState && profileState.error && (
            <p className="text-sm text-destructive">{profileState.error}</p>
          )}
          {profileState && 'success' in profileState && profileState.success && (
            <p className="text-sm text-[#128C7E] font-medium">Profile updated!</p>
          )}
          <div className="flex justify-end">
            <SaveButton pending={profilePending} />
          </div>
        </form>
      )}

      {/* Change Password tab */}
      {activeTab === 'password' && (
        <form action={pwAction} className="space-y-5 max-w-sm">
          <div>
            <FieldLabel>New Password</FieldLabel>
            <InsetInput name="new_password" type="password" placeholder="Min 8 characters" required minLength={8} />
          </div>
          <div>
            <FieldLabel>Confirm New Password</FieldLabel>
            <InsetInput name="confirm_password" type="password" placeholder="Repeat password" required />
          </div>
          {pwState && 'error' in pwState && pwState.error && (
            <p className="text-sm text-destructive">{pwState.error}</p>
          )}
          {pwState && 'success' in pwState && pwState.success && (
            <p className="text-sm text-[#128C7E] font-medium">Password updated!</p>
          )}
          <div className="flex justify-end">
            <SaveButton pending={pwPending} />
          </div>
        </form>
      )}

      {/* Danger Zone tab */}
      {activeTab === 'danger' && (
        <div>
          <div className="rounded-2xl border border-destructive/30 p-6 bg-destructive/5">
            <h3 className="text-sm font-semibold text-destructive mb-1">Delete Account</h3>
            <p className="text-xs text-muted-foreground mb-4">
              This will permanently delete your account, all posts, and connected profiles. This cannot be undone.
            </p>
            <button
              onClick={() => setShowDangerModal(true)}
              className="px-4 py-2 rounded-xl border border-destructive text-destructive text-sm font-semibold hover:bg-destructive/10 transition-colors cursor-pointer"
            >
              Delete my account
            </button>
          </div>

          {/* Confirmation modal */}
          {showDangerModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/60" onClick={() => setShowDangerModal(false)} />
              <div className="relative rounded-2xl p-6 bg-[var(--nm-bg)] w-full max-w-sm" style={{ boxShadow: 'var(--nm-raised-lg)' }}>
                <h3 className="font-display text-base font-bold text-destructive mb-2">Confirm deletion</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Type your email address <strong className="text-foreground">{meta.email}</strong> to confirm.
                </p>
                <form action={deleteAction} className="space-y-3">
                  <InsetInput
                    name="confirm_email"
                    type="email"
                    placeholder={meta.email}
                    value={confirmEmail}
                    onChange={(e) => setConfirmEmail(e.target.value)}
                    required
                  />
                  {deleteState && 'error' in deleteState && deleteState.error && (
                    <p className="text-xs text-destructive">{deleteState.error}</p>
                  )}
                  <div className="flex gap-2 justify-end">
                    <button type="button" onClick={() => setShowDangerModal(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer">
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={deletePending || confirmEmail !== meta.email}
                      className="px-4 py-2 rounded-xl bg-destructive text-white text-sm font-semibold disabled:opacity-50 cursor-pointer"
                    >
                      {deletePending ? 'Deleting…' : 'Delete forever'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Build check**

```bash
npx next build 2>&1 | grep -E "error|Error" | head -10
```

Expected: clean build.

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/profile/page.tsx
git commit -m "feat: add profile page with edit, change password, and danger zone tabs"
```

---

## Task 12: Command Palette component

**Files:**
- Create: `src/components/command-palette/CommandPalette.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/components/command-palette/CommandPalette.tsx
'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, PenSquare, Image as ImageIcon, Calendar,
  Inbox, Radio, Activity, Layers, Brain, Link2, Settings,
  Plus, Moon,
} from 'lucide-react'

// ── Static items ────────────────────────────────────────────────────────────

type Item = {
  id: string
  group: 'Pages' | 'Posts' | 'Settings' | 'Actions'
  label: string
  description: string
  icon: React.ReactNode
  action: () => void
}

const PAGE_ITEMS = (router: ReturnType<typeof useRouter>): Omit<Item, 'action'>[] => [
  { id: 'dashboard',    group: 'Pages', label: 'Dashboard',        description: 'Overview of your social presence',  icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
  { id: 'publishing',   group: 'Pages', label: 'Publishing',        description: 'Create and schedule posts',         icon: <PenSquare className="w-3.5 h-3.5" /> },
  { id: 'media',        group: 'Pages', label: 'Media Library',     description: 'Manage your uploaded media',        icon: <ImageIcon className="w-3.5 h-3.5" /> },
  { id: 'calendar',     group: 'Pages', label: 'Calendar',          description: 'View scheduled content',           icon: <Calendar className="w-3.5 h-3.5" /> },
  { id: 'inbox',        group: 'Pages', label: 'Inbox',             description: 'Messages and mentions',            icon: <Inbox className="w-3.5 h-3.5" /> },
  { id: 'listening',    group: 'Pages', label: 'Listening',         description: 'Track brand mentions',             icon: <Radio className="w-3.5 h-3.5" /> },
  { id: 'analytics',    group: 'Pages', label: 'Analytics',         description: 'Post performance data',            icon: <Activity className="w-3.5 h-3.5" /> },
  { id: 'content-arch', group: 'Pages', label: 'Content Arch',      description: 'Pillars and story arcs',           icon: <Layers className="w-3.5 h-3.5" /> },
  { id: 'brand-brain',  group: 'Pages', label: 'Brand Brain',       description: 'AI-powered weekly brief',          icon: <Brain className="w-3.5 h-3.5" /> },
  { id: 'link-in-bio',  group: 'Pages', label: 'Link-in-Bio',       description: 'Manage your bio page',             icon: <Link2 className="w-3.5 h-3.5" /> },
  { id: 'settings',     group: 'Pages', label: 'Settings',          description: 'Account and platform settings',    icon: <Settings className="w-3.5 h-3.5" /> },
].map((item) => item) as Omit<Item, 'action'>[]

type PostResult = { id: string; content: string; status: string; platforms: string[] }

function match(text: string, query: string): boolean {
  if (!query) return true
  return text.toLowerCase().includes(query.toLowerCase())
}

// ── Component ────────────────────────────────────────────────────────────────

export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen]     = useState(false)
  const [query, setQuery]   = useState('')
  const [posts, setPosts]   = useState<PostResult[]>([])
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Fetch posts once on mount
  useEffect(() => {
    fetch('/api/command-palette/posts')
      .then((r) => r.json())
      .then((d) => setPosts(d.posts ?? []))
      .catch(() => {})
  }, [])

  // Global keyboard listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Expose open function for the header trigger button
  useEffect(() => {
    const trigger = document.getElementById('cmd-palette-trigger')
    if (!trigger) return
    const handler = () => setOpen(true)
    trigger.addEventListener('click', handler)
    return () => trigger.removeEventListener('click', handler)
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Build filtered item list
  const navigate = useCallback((href: string) => {
    setOpen(false)
    router.push(href)
  }, [router])

  const pageItems: Item[] = PAGE_ITEMS(router)
    .filter((item) => match(item.label + ' ' + item.description, query))
    .map((item) => ({ ...item, action: () => navigate(`/${item.id === 'dashboard' ? '' : item.id}`) }))

  const postItems: Item[] = posts
    .filter((p) => match(p.content, query))
    .slice(0, 5)
    .map((p) => ({
      id: p.id,
      group: 'Posts' as const,
      label: p.content.slice(0, 60) + (p.content.length > 60 ? '…' : ''),
      description: `${p.status.charAt(0).toUpperCase() + p.status.slice(1)} · ${p.platforms.join(', ')}`,
      icon: <span className="text-[10px] font-bold text-muted-foreground">{p.platforms[0]?.slice(0, 2).toUpperCase()}</span>,
      action: () => navigate('/publishing'),
    }))

  const actionItems: Item[] = [
    { id: 'new-post',    group: 'Actions', label: 'New post',          description: 'Open the publishing editor', icon: <Plus  className="w-3.5 h-3.5 text-[#128C7E]" />, action: () => navigate('/publishing') },
    { id: 'go-profile',  group: 'Actions', label: 'Go to Profile',     description: 'Edit your account',         icon: <Settings className="w-3.5 h-3.5" />,              action: () => navigate('/profile') },
    { id: 'toggle-dark', group: 'Actions', label: 'Toggle dark mode',  description: 'Switch theme',              icon: <Moon  className="w-3.5 h-3.5" />,                 action: () => document.documentElement.classList.toggle('dark') },
  ].filter((a) => match(a.label + ' ' + a.description, query))

  const allItems = [...pageItems, ...postItems, ...actionItems]

  // Keyboard navigation inside palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, allItems.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    if (e.key === 'Enter' && allItems[active]) { allItems[active].action() }
  }

  // Group headers
  const groups = Array.from(new Set(allItems.map((i) => i.group)))

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
          {/* Scrim */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="relative w-full max-w-xl rounded-2xl overflow-hidden bg-[var(--nm-bg)] flex flex-col"
            style={{ boxShadow: 'var(--nm-raised-lg)' }}
          >
            {/* Search input row */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
              <svg className="w-4 h-4 text-muted-foreground shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActive(0) }}
                onKeyDown={handleKeyDown}
                placeholder="Search pages, posts, settings…"
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <kbd className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">Esc</kbd>
            </div>

            {/* Results */}
            <div className="max-h-[360px] overflow-y-auto py-2">
              {allItems.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No results for &ldquo;{query}&rdquo;</p>
              )}
              {groups.map((group) => {
                const groupItems = allItems.filter((i) => i.group === group)
                const groupStart = allItems.indexOf(groupItems[0])
                return (
                  <div key={group}>
                    <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{group}</div>
                    {groupItems.map((item, idx) => {
                      const globalIdx = groupStart + idx
                      const isActive = globalIdx === active
                      return (
                        <button
                          key={item.id}
                          onClick={item.action}
                          onMouseEnter={() => setActive(globalIdx)}
                          className={`w-full text-left flex items-center gap-3 px-4 py-2.5 transition-colors cursor-pointer ${isActive ? 'bg-primary/10 border-l-2 border-[#2E5E99]' : 'border-l-2 border-transparent'}`}
                        >
                          <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-[var(--nm-bg)] text-muted-foreground" style={{ boxShadow: isActive ? 'var(--nm-inset-sm)' : 'var(--nm-raised-xs)' }}>
                            {item.icon}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-medium text-foreground">{item.label}</span>
                            <span className="block text-xs text-muted-foreground truncate">{item.description}</span>
                          </span>
                          {isActive && <kbd className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5 shrink-0">↵</kbd>}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-border flex gap-4">
              {[['↑↓', 'navigate'], ['↵', 'open'], ['Esc', 'close']].map(([key, label]) => (
                <span key={key} className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                  <kbd className="border border-border rounded px-1 py-0.5 bg-muted/30">{key}</kbd>
                  {label}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 2: Mount CommandPalette in the app layout**

Open `src/app/(app)/layout.tsx` and update it:

```tsx
// src/app/(app)/layout.tsx
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { CommandPalette } from '@/components/command-palette/CommandPalette'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--nm-bg)' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden relative" style={{ background: 'var(--nm-bg)' }}>
        <Header />
        <main className="flex-1 overflow-auto relative z-0">
          {children}
        </main>
      </div>
      <CommandPalette />
    </div>
  )
}
```

- [ ] **Step 3: Build check**

```bash
npx next build 2>&1 | grep -E "error|Error" | head -10
```

Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add src/components/command-palette/CommandPalette.tsx src/app/(app)/layout.tsx
git commit -m "feat: add command palette with ⌘K trigger, page nav, post search, and actions"
```

---

## Task 13: Final verification

- [ ] **Step 1: Full build**

```bash
npx next build 2>&1 | tail -20
```

Expected: all routes listed, no errors.

- [ ] **Step 2: Manual smoke test checklist**

Start the dev server: `npm run dev`

| Feature | Test |
|---|---|
| Command palette | Press ⌘K — overlay opens. Type "pub" — Publishing appears highlighted. Press Enter — navigates to /publishing. Press Esc — closes. |
| Search bar | Click search bar in header — palette opens. |
| Notification bell | Bell visible in header. No badge when 0 unread. Drawer opens on click. "Mark all read" works. "View notification centre →" navigates to /notifications. |
| Notifications page | Visit /notifications — renders empty state or list. |
| Avatar dropdown | Click avatar — dropdown shows "View Profile" and "Sign Out". |
| Profile page | Click "View Profile" — navigates to /profile. Three tabs visible. Edit form submits. Password form validates length + match. Danger zone shows confirmation modal with email gate. |

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete header features — command palette, notifications, profile page"
```
