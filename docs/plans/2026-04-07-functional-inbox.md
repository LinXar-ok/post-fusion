# Functional Inbox (Real Webhook Data) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace hardcoded mock data in the inbox page with real messages received via platform webhooks (LinkedIn, X, Facebook), enabling a functional unified inbox with read/unread status, reply capability, and unread count tracking.

**Architecture:** Create a new `inbox_messages` Supabase table with RLS. Build a single POST route handler at `/api/webhooks/inbox` that normalizes incoming payloads from LinkedIn, X, and Facebook into the common schema. Refactor the inbox UI (`inbox/page.tsx`) from client-only mock data to a server-fetched + client-interactive component using Supabase queries. Keep the webhook-notice banner as a helpful indicator for users who need to configure their developer apps.

**Tech Stack:** TypeScript (strict), Next.js 16 Route Handlers, Supabase (native SDK, no Prisma), PostgreSQL, Tailwind CSS v4, shadcn/ui, Framer Motion.

**References:**
- Current inbox page: `src/app/(app)/inbox/page.tsx`
- Publishers helper: `src/lib/publishers.ts` (follow the platform-switch pattern)
- Existing migration: `supabase/migrations/20260328000000_init.sql` (follow RLS conventions)
- Existing route handler: `src/app/api/cron/process-queue/route.ts` (follow `createClient()` usage pattern)
- Supabase client: `src/lib/supabase/server.ts` (server component) and `src/lib/supabase/client.ts` (client browser)

---

### Task 1: Create `inbox_messages` Database Migration

**Files:**
- Create: `supabase/migrations/20260407000000_create_inbox_messages.sql`

**Step 1: Write the migration SQL**

```sql
-- Create inbox_messages table for unified inbox webhook data

CREATE TABLE public.inbox_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,                    -- 'linkedin', 'x', 'facebook'
    platform_message_id TEXT NOT NULL,          -- unique external ID from the platform
    sender_id TEXT,                             -- external sender ID
    sender_name TEXT NOT NULL,
    sender_handle TEXT,                         -- e.g. @username
    sender_avatar_url TEXT,
    content TEXT NOT NULL,
    platform_type TEXT NOT NULL,                -- 'comment', 'mention', 'dm', 'reply'
    platform_post_url TEXT,                     -- link to the original post/comment
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    in_reply_to UUID REFERENCES public.inbox_messages(id),
    raw_payload JSONB,                          -- store full webhook payload for debugging
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(platform, platform_message_id)
);

-- Enable RLS
ALTER TABLE public.inbox_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own inbox messages"
    ON public.inbox_messages FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Insert inbox messages (for API/service)"
    ON public.inbox_messages FOR INSERT
    WITH CHECK (true);  -- Webhook endpoint inserts on behalf of user

CREATE POLICY "Users can update their own inbox messages"
    ON public.inbox_messages FOR UPDATE
    USING (auth.uid() = user_id);

-- Indexes for common queries
CREATE INDEX idx_inbox_messages_user_id ON public.inbox_messages(user_id);
CREATE INDEX idx_inbox_messages_user_read ON public.inbox_messages(user_id, is_read);
CREATE INDEX idx_inbox_messages_created ON public.inbox_messages(user_id, created_at DESC);
CREATE INDEX idx_inbox_messages_platform ON public.inbox_messages(user_id, platform);
```

**Step 2: Apply the migration**

```bash
supabase db push
```

Expected: `Migrations applied successfully.`

**Step 3: Commit**

```bash
git add supabase/migrations/20260407000000_create_inbox_messages.sql
git commit -m "feat: add inbox_messages table with RLS policies and indexes"
```

---

### Task 2: Create Webhook Endpoint `/api/webhooks/inbox`

**Files:**
- Create: `src/app/api/webhooks/inbox/route.ts`
- Read: `src/lib/supabase/server.ts` (for `createClient` pattern)

**Step 1: Create the webhook route handler**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

type NormalizedMessage = {
  platform: string
  platform_message_id: string
  sender_name: string
  sender_handle?: string
  sender_avatar_url?: string
  sender_id?: string
  content: string
  platform_type: "comment" | "mention" | "dm" | "reply"
  platform_post_url?: string
  raw_payload: Record<string, unknown>
}

function normalizeLinkedIn(payload: Record<string, unknown>): NormalizedMessage | null {
  // LinkedIn comment/mention webhook format
  // Payload typically has: actor, object, content.text, activity, timestamp
  const content =
    typeof payload.content === "string"
      ? payload.content
      : (payload.content as { text?: string })?.text ?? ""
  if (!content) return null

  return {
    platform: "linkedin",
    platform_message_id: String(payload.id ?? `lnk-${Date.now()}-${Math.random()}`),
    sender_name: String(payload.actor?.name ?? payload.actor?.localizedName ?? "LinkedIn User"),
    sender_handle: payload.actor?.vanityName ? `@${payload.actor.vanityName}` : undefined,
    sender_avatar_url: payload.actor?.picture ?? undefined,
    sender_id: payload.actor?.id ? String(payload.actor.id) : undefined,
    content,
    platform_type: ("comment" in payload ? "comment" : "mention") as NormalizedMessage["platform_type"],
    platform_post_url: payload.object as string | undefined,
    raw_payload: payload,
  }
}

function normalizeX(payload: Record<string, unknown>): NormalizedMessage | null {
  // X webhook webhook (Account Activity API) — tweet or DM event
  const data = (payload.tweet_create_events?.[0] ??
                payload.direct_message_events?.[0] ??
                payload.favorite_events?.[0]) as Record<string, unknown> | undefined
  if (!data) return null

  const isDM = !!payload.direct_message_events?.[0]
  const sender = (data.sender as Record<string, unknown>) ??
                 (data.user as Record<string, unknown>) ??
                 {}

  return {
    platform: "x",
    platform_message_id: String(data.id ?? `x-${Date.now()}-${Math.random()}`),
    sender_name: String(sender.name ?? "X User"),
    sender_handle: sender.screen_name ? `@${sender.screen_name}` : undefined,
    sender_avatar_url: sender.profile_image_url_https as string | undefined,
    sender_id: sender.id_str ? String(sender.id_str) : String(sender.id ?? ""),
    content: String(data.text ?? data.message_data?.text ?? ""),
    platform_type: isDM ? "dm" : "comment",
    platform_post_url: String(data.url ?? ""),
    raw_payload: payload,
  }
}

function normalizeFacebook(payload: Record<string, unknown>): NormalizedMessage | null {
  // Facebook webhook (Graph API subscribed objects) — page conversations/comments
  const entry = (payload.entry as Record<string, unknown>[])?.[0]
  if (!entry) return null

  const change = (entry.changes as { value: Record<string, unknown> }[])?.[0]?.value
  if (!change) return null

  // Comments on a post
  if (change.field === "feed") {
    const item = change.item as Record<string, unknown> | undefined
    if (!item) return null
    const from = item.from as Record<string, unknown> | undefined

    return {
      platform: "facebook",
      platform_message_id: String(item.id ?? `fb-${Date.now()}-${Math.random()}`),
      sender_name: String(from?.name ?? "Facebook User"),
      sender_id: from?.id ? String(from.id) : undefined,
      content: String(item.message ?? item.story ?? item.description ?? ""),
      platform_type: "comment",
      platform_post_url: item.permalink_url as string | undefined,
      raw_payload: payload,
    }
  }

  // Messenger / page messages
  if (change.field === "messages" || change.field === "conversations") {
    const message = change.message as Record<string, unknown> | undefined
    if (!message) return null
    const from = message.from as Record<string, unknown> | undefined

    return {
      platform: "facebook",
      platform_message_id: String(message.mid ?? `fb-dm-${Date.now()}-${Math.random()}`),
      sender_name: String(from?.name ?? "Facebook User"),
      sender_id: from?.id ? String(from.id) : undefined,
      content: String(message.text ?? ""),
      platform_type: "dm",
      raw_payload: payload,
    }
  }

  return null
}

const platformNormalizers: Record<string, (payload: Record<string, unknown>) => NormalizedMessage | null> = {
  linkedin: normalizeLinkedIn,
  x: normalizeX,
  facebook: normalizeFacebook,
}

async function resolveUserIdFromPlatform(
  platform: string,
  senderId: string | undefined
): Promise<string | null> {
  if (!senderId) return null

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Look up the user who owns this social profile
  const { data: profile } = await supabaseAdmin
    .from("social_profiles")
    .select("user_id")
    .eq("platform", platform)
    .eq("profile_id", senderId)
    .single()

  return profile?.user_id ?? null
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url)
  const platform = url.searchParams.get("platform")

  if (!platform || !platformNormalizers[platform]) {
    return NextResponse.json(
      { error: "Invalid or missing platform parameter. Use: linkedin, x, facebook" },
      { status: 400 }
    )
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const normalized = platformNormalizers[platform](body)
  if (!normalized) {
    return NextResponse.json({ error: "Could not normalize webhook payload" }, { status: 200 })
  }

  // Determine the target user ID
  // For a single-user app, we can also fall back to the first user or
  // use a configurable WEBHOOK_TARGET_USER_ID env var.
  let targetUserId: string | null = process.env.WEBHOOK_TARGET_USER_ID ?? null

  // Try to resolve via social profile lookup using the sender_id
  if (!targetUserId) {
    targetUserId = await resolveUserIdFromPlatform(platform, normalized.sender_id)
  }

  if (!targetUserId) {
    return NextResponse.json(
      { error: "Could not determine target user for this webhook" },
      { status: 400 }
    )
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data, error } = await supabaseAdmin
    .from("inbox_messages")
    .insert({
      user_id: targetUserId,
      platform: normalized.platform,
      platform_message_id: normalized.platform_message_id,
      sender_id: normalized.sender_id,
      sender_name: normalized.sender_name,
      sender_handle: normalized.sender_handle,
      sender_avatar_url: normalized.sender_avatar_url,
      content: normalized.content,
      platform_type: normalized.platform_type,
      platform_post_url: normalized.platform_post_url,
      raw_payload: normalized.raw_payload,
    })
    .select()

  if (error) {
    // UNIQUE conflict on (platform, platform_message_id) means duplicate — idempotent
    if (error.code === "23505") {
      return NextResponse.json({ message: "Duplicate webhook ignored" }, { status: 200 })
    }
    console.error("Error inserting inbox message:", error)
    return NextResponse.json(
      { error: "Failed to store inbox message" },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, data }, { status: 200 })
}
```

**Step 2: Update middleware to skip auth for webhook route (already done for `/api/cron`)**

Open `src/lib/supabase/middleware.ts`. The current middleware only checks `/api/cron`. We need to also skip `/api/webhooks`. The auth middleware in `src/middleware.ts` may also need updating -- check it.

Modify `src/lib/supabase/middleware.ts:6`:

```typescript
  if (request.nextUrl.pathname.startsWith('/api/cron') ||
      request.nextUrl.pathname.startsWith('/api/webhooks')) {
```

Also check `src/middleware.ts` if it has a similar block.

**Step 3: Add environment variable documentation note**

The webhook endpoint uses `SUPABASE_SERVICE_ROLE_KEY` for server-side inserts and optionally `WEBHOOK_TARGET_USER_ID` to direct webhook messages to a specific user in a multi-user future state. Add these to `.env.local` if not present:

```
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
WEBHOOK_TARGET_USER_ID=  # optional: lock webhooks to a specific user
```

**Step 4: Commit**

```bash
git add src/app/api/webhooks/inbox/route.ts src/lib/supabase/middleware.ts
git commit -m "feat: add webhook endpoint for LinkedIn, X, and Facebook inbox messages"
```

---

### Task 3: Build Server Action / Data Fetcher for Inbox Messages

**Files:**
- Create: `src/app/(app)/inbox/actions.ts`

**Step 1: Create server actions for inbox data**

```typescript
"use server"

import { createClient } from "@/lib/supabase/server"

export type InboxMessageSummary = {
  id: string
  platform: string
  sender_name: string
  sender_handle: string | null
  sender_avatar_url: string | null
  content: string
  platform_type: string
  platform_post_url: string | null
  is_read: boolean
  created_at: string
}

export type InboxThread = InboxMessageSummary & {
  replies?: InboxMessageSummary[]
}

export async function getInboxMessages(
  filter?: "all" | "unread" | "linkedin" | "x" | "facebook"
): Promise<InboxMessageSummary[]> {
  const supabase = await createClient()

  let query = supabase
    .from("inbox_messages")
    .select("*")
    .order("created_at", { ascending: false })

  if (filter === "unread") {
    query = query.eq("is_read", false)
  } else if (filter === "linkedin" || filter === "x" || filter === "facebook") {
    query = query.eq("platform", filter)
  }

  const { data, error } = await query.returns<InboxMessageSummary[]>()
  if (error) {
    console.error("Failed to fetch inbox messages:", error)
    return []
  }
  return data ?? []
}

export async function getUnreadCount(): Promise<number> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from("inbox_messages")
    .select("*", { count: "exact", head: true })
    .eq("is_read", false)
  if (error) return 0
  return count ?? 0
}

export async function markAsRead(messageId: string): Promise<boolean> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("inbox_messages")
    .update({ is_read: true })
    .eq("id", messageId)
  return !error
}

export async function markAllAsRead(): Promise<boolean> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("inbox_messages")
    .update({ is_read: true })
    .eq("is_read", false)
  return !error
}

export async function sendMessageReply(
  messageId: string,
  content: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  // Fetch original message to know platform + tokens
  const { data: original } = await supabase
    .from("inbox_messages")
    .select("*")
    .eq("id", messageId)
    .single()

  if (!original) return { success: false, error: "Message not found" }

  // Look up the social_profile for the platform to get access token
  const { data: profile } = await supabase
    .from("social_profiles")
    .select("*")
    .eq("platform", original.platform)
    .limit(1)
    .single()

  if (!profile) return { success: false, error: "No connected profile for this platform" }
  if (profile.expires_at && new Date(profile.expires_at) < new Date()) {
    return { success: false, error: "OAuth token expired — reconnect the platform" }
  }

  // Send reply via platform API
  const result = await sendPlatformReply(profile, original, content)
  if (!result.success) return result

  // Store our reply locally too
  const { error: insertError } = await supabase.from("inbox_messages").insert({
    user_id: original.user_id,
    platform: original.platform,
    platform_message_id: `outgoing-${Date.now()}`,
    sender_name: "You",
    content,
    platform_type: "reply",
    in_reply_to: messageId,
    is_read: true,
    raw_payload: null,
  })

  if (insertError) {
    console.error("Failed to store reply:", insertError)
  }

  return { success: true }
}

async function sendPlatformReply(
  profile: { platform: string; access_token: string; profile_id?: string },
  message: {
    platform: string
    sender_id?: string | null
    platform_message_id: string
    platform_type: string
    platform_post_url?: string | null
  },
  content: string
): Promise<{ success: boolean; error?: string }> {
  if (message.platform === "linkedin") {
    // LinkedIn: respond to comment via UGC API or send DM
    const commentUrn = `urn:li:comment:${message.platform_message_id}`
    const res = await fetch("https://api.linkedin.com/v2/socialActions/" +
      encodeURIComponent(commentUrn) + "/comments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${profile.access_token}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        actor: `urn:li:person:${profile.profile_id}`,
        object: commentUrn,
        message: { text: content },
      }),
    })
    if (!res.ok) return { success: false, error: "LinkedIn reply failed" }
    return { success: true }
  }

  if (message.platform === "x") {
    // X: reply to a tweet
    const res = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${profile.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: content,
        reply: {
          in_reply_to_tweet_id: message.platform_message_id,
        },
      }),
    })
    if (!res.ok) return { success: false, error: "X reply failed" }
    return { success: true }
  }

  if (message.platform === "facebook") {
    // Facebook: reply to comment or send page message
    if (message.platform_type === "comment") {
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${message.platform_message_id}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            message: content,
            access_token: profile.access_token,
          }),
        }
      )
      if (!res.ok) return { success: false, error: "Facebook comment reply failed" }
      return { success: true }
    } else {
      // DM / page message
      const res = await fetch(
        `https://graph.facebook.com/v19.0/me/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            recipient: JSON.stringify({ id: message.sender_id }),
            message: JSON.stringify({ text: content }),
            access_token: profile.access_token,
          }),
        }
      )
      if (!res.ok) return { success: false, error: "Facebook message reply failed" }
      return { success: true }
    }
  }

  return { success: false, error: "Unsupported platform" }
}
```

**Step 2: Commit**

```bash
git add src/app/\(app\)/inbox/actions.ts
git commit -m "feat: add server actions for inbox messages (fetch, mark read, reply)"
```

---

### Task 4: Refactor Inbox UI to Use Real Data

**Files:**
- Modify: `src/app/(app)/inbox/page.tsx` (full rewrite)
- Read: `src/app/(app)/inbox/actions.ts` (just created)
- Read: `src/components/ui/card.tsx` (for card component API)

**Step 1: Rewrite the inbox page with real-data fetching**

The page needs these changes:
1. Convert to server component wrapper + client interactive component
2. Fetch data server-side, pass to client component
3. Replace hardcoded mock `messages` array with `getInboxMessages()` data
4. Add filter state (All/Unread/LinkedIn/X/Facebook) with counts
5. Show unread badge
6. Keep the webhook setup banner
7. Wire up reply form to `sendMessageReply` server action
8. Wire up "mark as read" on click

```typescript
// Server component wrapper
import { getInboxMessages, getUnreadCount } from "./actions"

export default async function InboxPage() {
  const messages = await getInboxMessages("all")
  const unreadCount = await getUnreadCount()

  return <InboxClient messages={messages} unreadCount={unreadCount} />
}
```

The client component (can be inline in the same file via `"use client"` sub-component, or separated):

```typescript
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Filter, Send, Webhook, Mail, RefreshCw } from "lucide-react"
import {
  FaLinkedin,
  FaXTwitter,
  FaFacebook,
} from "react-icons/fa6"
import { markAsRead, sendMessageReply } from "./actions"

type InboxMessage = {
  id: string
  platform: string
  sender_name: string
  sender_handle: string | null
  sender_avatar_url: string | null
  content: string
  platform_type: string
  platform_post_url: string | null
  is_read: boolean
  created_at: string
}

const platformIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  linkedin: FaLinkedin,
  x: FaXTwitter,
  facebook: FaFacebook,
}

const platformColors: Record<string, string> = {
  linkedin: "text-[#0A66C2]",
  x: "text-slate-900",
  facebook: "text-[#1877F2]",
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function InboxClient({ messages, unreadCount }: {
  messages: InboxMessage[]
  unreadCount: number
}) {
  const router = useRouter()
  const [filter, setFilter] = useState<"all" | "unread" | "linkedin" | "x" | "facebook">("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState("")
  const [sending, setSending] = useState(false)

  // Filter + search
  const filtered = messages.filter((msg) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "unread" && !msg.is_read) ||
      msg.platform === filter
    const matchesSearch =
      !searchQuery ||
      msg.sender_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      msg.content.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const selected = messages.find((m) => m.id === selectedId)
  const PlatformIcon = selected ? (platformIcons[selected.platform] ?? Mail) : null

  async function handleSelect(msg: InboxMessage) {
    setSelectedId(msg.id)
    if (!msg.is_read) {
      await markAsRead(msg.id)
      router.refresh()
    }
  }

  async function handleReply() {
    if (!selectedId || !replyText.trim()) return
    setSending(true)
    const result = await sendMessageReply(selectedId, replyText.trim())
    setSending(false)
    if (result.success) {
      setReplyText("")
      router.refresh()
    } else {
      alert(result.error ?? "Failed to send reply")
    }
  }

  const filterOptions = [
    { key: "all" as const, label: `All (${messages.length})` },
    { key: "unread" as const, label: `Unread (${unreadCount})` },
    { key: "linkedin" as const, label: "LinkedIn" },
    { key: "x" as const, label: "X" },
    { key: "facebook" as const, label: "Facebook" },
  ]

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full h-[calc(100vh-4rem)] flex flex-col relative z-10">
      <div className="mb-6 shrink-0">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-2">Unified Inbox</h1>
        <p className="text-slate-500 text-lg">Respond to comments, mentions, and direct messages in one place.</p>
      </div>

      {/* Webhook setup banner */}
      <div className="mb-4 flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 shrink-0">
        <Webhook className="w-5 h-5 mt-0.5 shrink-0 text-amber-600" />
        <div>
          <span className="font-semibold">Webhook URLs to configure:</span>
          <ul className="mt-1 font-mono text-xs space-y-1">
            <li>LinkedIn: POST `{process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/webhooks/inbox?platform=linkedin`</li>
            <li>X: POST `{process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/webhooks/inbox?platform=x`</li>
            <li>Facebook: POST `{process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/webhooks/inbox?platform=facebook`</li>
          </ul>
          <span className="mt-1 block">Add these URLs as webhook subscriptions in each platform&#39;s developer console.
          Live data will appear here once configured.</span>
        </div>
      </div>

      <Card className="flex-1 bg-white border-slate-200 shadow-sm backdrop-blur-xl overflow-hidden flex min-h-0">
        {/* Left sidebar */}
        <div className="w-full md:w-80 border-r border-slate-100 bg-slate-50/50 flex flex-col h-full shrink-0">
          <div className="p-4 border-b border-slate-100 bg-white">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-slate-50 border-slate-200 shadow-xs h-9 text-sm rounded-lg focus-visible:ring-[#128C7E]"
              />
            </div>
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
              {filterOptions.map((opt) => {
                const isActive = filter === opt.key
                return (
                  <Button
                    key={opt.key}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    className={`h-7 text-xs rounded-full shrink-0 ${
                      isActive
                        ? "bg-[#128C7E] hover:bg-[#128C7E]/90 text-white"
                        : "bg-white hover:bg-slate-50 text-slate-600 font-semibold border-slate-200 shadow-xs"
                    }`}
                    onClick={() => setFilter(opt.key)}
                  >
                    {opt.label}
                  </Button>
                )
              })}
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Mail className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">No messages</p>
                <p className="text-xs mt-1">Connect webhooks to receive messages</p>
              </div>
            ) : (
              filtered.map((msg) => {
                const Icon = platformIcons[msg.platform] ?? Mail
                return (
                  <div
                    key={msg.id}
                    className={`p-4 border-b border-slate-100 cursor-pointer transition-colors ${
                      selectedId === msg.id ? "bg-white" : msg.is_read ? "hover:bg-slate-100/50 opacity-80" : "bg-white hover:bg-slate-50"
                    }`}
                    onClick={() => handleSelect(msg)}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center gap-2">
                        <div className="font-bold text-sm text-slate-900">{msg.sender_name}</div>
                        <Icon className={`w-3.5 h-3.5 ${platformColors[msg.platform] ?? "text-slate-400"}`} />
                      </div>
                      <span className="text-xs font-semibold text-slate-400">{timeAgo(msg.created_at)}</span>
                    </div>
                    <p className="text-xs font-medium text-slate-500 mt-0.5 truncate">{msg.sender_handle ?? msg.platform_type}</p>
                    <p className={`text-sm mt-2 line-clamp-2 leading-relaxed ${
                      msg.is_read ? "text-slate-500" : "text-slate-800 font-medium"
                    }`}>{msg.content}</p>
                    {!msg.is_read && <div className="w-2 h-2 rounded-full bg-[#128C7E] mt-3 shadow-xs" />}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right detail panel */}
        <div className="hidden md:flex flex-1 flex-col bg-white h-full relative">
          {selected && PlatformIcon ? (
            <>
              <div className="h-16 border-b border-slate-100 bg-white/80 backdrop-blur-xl flex items-center px-6 shrink-0">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 font-bold shadow-xs">
                    {selected.sender_avatar_url ? (
                      <img src={selected.sender_avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      selected.sender_name.split(" ").map(n => n[0]).join("").slice(0, 2)
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{selected.sender_name}</h3>
                    <p className="text-xs font-medium text-slate-500 flex items-center gap-1 mt-0.5">
                      <PlatformIcon className={`w-3 h-3 ${platformColors[selected.platform] ?? "text-slate-400"}`} />
                      {selected.sender_handle ?? selected.platform_type}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
                <div className="flex flex-col space-y-6">
                  <div className="flex justify-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-xs">
                      {timeAgo(selected.created_at)}
                    </span>
                  </div>
                  <div className="bg-white p-4 rounded-2xl rounded-tl-sm border border-slate-200 shadow-sm max-w-lg self-start">
                    <p className="text-slate-700 text-[15px] leading-relaxed">{selected.content}</p>
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-slate-100 bg-white shrink-0">
                <div className="relative flex items-center">
                  <Input
                    placeholder={`Type your reply to ${selected.sender_name}...`}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleReply()}
                    className="flex-1 pr-12 bg-slate-50 border-slate-200 text-slate-900 h-12 rounded-xl shadow-inner focus-visible:ring-[#128C7E]"
                  />
                  <Button
                    size="icon"
                    disabled={sending || !replyText.trim()}
                    onClick={handleReply}
                    className="absolute right-1.5 h-9 w-9 rounded-lg bg-[#128C7E] hover:bg-[#0B1020] shadow-sm text-white transition-transform hover:scale-105 disabled:opacity-50"
                  >
                    <Send className="w-4 h-4 ml-0.5" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-slate-400">
              <div className="text-center">
                <Mail className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Select a conversation</p>
                <p className="text-sm mt-1">Choose a message from the list to view details</p>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
```

**Step 2: Update the sidebar to show unread badge if we are not already**

Check `src/components/layout/sidebar.tsx` - the memory says sidebar exists. If there's a nav link for inbox, add the unread count badge. This can be done in a follow-up task since the main inbox page already shows it in its filter.

Read the sidebar and add badge if needed (see Task 6).

**Step 3: Commit**

```bash
git add "src/app/(app)/inbox/page.tsx"
git commit -m "feat: rebuild inbox UI with real Supabase data, filters, and reply"
```

---

### Task 5: Add Webhook URLs to Platform Integration

**Files:**
- Create: `src/app/(app)/settings/page.tsx` update (add webhook URL display if not already present)
- Read: `src/app/(app)/settings/page.tsx` (check existing settings UI)

This task documents the webhook URLs in the Settings page so users know what to paste into each platform's developer console.

**Step 1: After the platform connection section in Settings, add a "Webhook Setup" section**

Add a collapsible section or expand the platform connection cards to show the webhook URL for each connected platform.

```tsx
// In the settings page, after each platform connection card:
{platform === "linkedin" && isConnected && (
  <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
    <p className="text-xs font-mono text-slate-600">
      Webhook URL: {NEXT_PUBLIC_APP_URL}/api/webhooks/inbox?platform=linkedin
    </p>
  </div>
)}
```

(Do this for X and Facebook as well; use the file's existing structure to insert.)

**Step 2: Commit**

```bash
git add src/app/\(app\)/settings/page.tsx
git commit -m "feat: display webhook URLs in settings for connected platforms"
```

---

### Task 6: Test the Implementation

**Pre-test requirements:**
- Database migration applied (`supabase db push` completed)
- At least one platform OAuth connection established (LinkedIn recommended)
- Supabase service role key available in environment

**Test 1: Webhook endpoint returns 200 for valid payloads**

Run locally:

```bash
curl -X POST "http://localhost:3000/api/webhooks/inbox?platform=linkedin" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-123",
    "content": {"text": "This is a test comment from LinkedIn"},
    "actor": {"name": "Test User", "vanityName": "testuser", "id": "abc123"},
    "object": "https://linkedin.com/feed/update/test"
  }'
```

Expected: `{ "success": true, "data": [...] }` with status 200.

**Test 2: Invalid platform returns 400**

```bash
curl -X POST "http://localhost:3000/api/webhooks/inbox?platform=instagram" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

Expected: `{ "error": "..." }` with status 400.

**Test 3: Duplicate webhook is idempotent (200, no duplicate row)**

Run the same Test 1 curl again with the same `id: "test-123"`.

Expected: `{ "message": "Duplicate webhook ignored" }` with status 200 and only one row in DB.

**Test 4: Inbox page loads real data**

1. Run `npm run dev`
2. Navigate to `/inbox`
3. Verify: The inbox message list shows any messages from the webhook test above
4. Verify: Filter buttons work (All/Unread/LinkedIn/X/Facebook)
5. Verify: Unread badge shows on new messages
6. Verify: Clicking a message opens detail view and marks as read
7. Verify: Reply form sends a reply (may fail if token expired, but error message shows)

**Test 5: No messages shows empty state**

If no webhook messages received, verify the empty state displays:
- "No messages" text
- Mail icon
- "Connect webhooks to receive messages" helper text

**Step 6: Full test commit**

```bash
git status
git log --oneline -3
```

---

### Task 7: Set Up a Test Webhook Script (Optional, Dev Convenience)

**Files:**
- Create: `scripts/test-webhook.sh`

**Step 1: Create a dev convenience script**

```bash
#!/usr/bin/env bash
# Test webhook sender for local development
# Usage: ./scripts/test-webhook.sh linkedin
# Usage: ./scripts/test-webhook.sh x
# Usage: ./scripts/test-webhook.sh facebook

PLATFORM=${1:-linkedin}
BASE_URL="http://localhost:3000/api/webhooks/inbox"

if [ "$PLATFORM" = "linkedin" ]; then
  PAYLOAD='{
    "id": "lnk-test-'"$(date +%s)"'",
    "content": {"text": "This is a test LinkedIn comment sent at '"$(date)"'"},
    "actor": {"name": "Test User", "vanityName": "testuser", "id": "abc123"},
    "object": "https://linkedin.com/feed/update/test"
  }'
elif [ "$PLATFORM" = "x" ]; then
  PAYLOAD='{
    "tweet_create_events": [{
      "id": "x-test-'"$(date +%s)"'",
      "text": "Test tweet mentioning you at '"$(date)"'",
      "user": {"name": "X Tester", "screen_name": "xtester", "id_str": "999", "profile_image_url_https": "https://example.com/avatar.jpg"}
    }]
  }'
elif [ "$PLATFORM" = "facebook" ]; then
  PAYLOAD='{
    "entry": [{
      "changes": [{
        "field": "feed",
        "value": {
          "item": {
            "id": "fb-test-'"$(date +%s)"'",
            "message": "Test Facebook comment at '"$(date)"'",
            "from": {"name": "FB Tester", "id": "fb123"},
            "permalink_url": "https://facebook.com/test"
          }
        }
      }]
    }]
  }'
fi

echo "Sending $PLATFORM webhook..."
curl -s -X POST "$BASE_URL?platform=$PLATFORM" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" | jq .
echo
```

```bash
chmod +x scripts/test-webhook.sh
```

**Step 2: Commit**

```bash
git add scripts/test-webhook.sh
git commit -m "chore: add test webhook script for local development"
```

---

## Summary of All Files Changed

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/20260407000000_create_inbox_messages.sql` | Create | Database table with RLS and indexes |
| `src/app/api/webhooks/inbox/route.ts` | Create | POST handler normalizing LinkedIn/X/Facebook payloads |
| `src/lib/supabase/middleware.ts` | Modify | Skip auth for `/api/webhooks` path |
| `src/app/(app)/inbox/actions.ts` | Create | Server actions: fetch, mark read, send reply |
| `src/app/(app)/inbox/page.tsx` | Rewrite | Real data UI with filters, detail view, reply |
| `src/app/(app)/settings/page.tsx` | Modify | Show webhook URLs for connected platforms |
| `scripts/test-webhook.sh` | Create | Dev convenience test script |

## Environment Variables Needed

| Variable | Required | Notes |
|----------|----------|-------|
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | For webhook server-side inserts |
| `WEBHOOK_TARGET_USER_ID` | No | Lock webhooks to specific user (falls back to profile lookup) |

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Webhook payload format varies per platform API version | Store `raw_payload` as JSONB for debugging; normalizer returns null for unrecognized shapes (200, no crash) |
| OAuth tokens expire for reply functionality | Server action checks `expires_at` and returns clear error message |
| Duplicate webhooks from platform retries | UNIQUE constraint on `(platform, platform_message_id)` + idempotent 200 on conflict |
| Service role key in env vars | Use `.env.local`, never commit; `SUPABASE_SERVICE_ROLE_KEY` is only used server-side in route handler |
| X API free tier has limited webhook access | Normalizer handles multiple event types; graceful fallback if no events match |
| Facebook requires HTTPS callback URLs | Works in production; dev testing uses `scripts/test-webhook.sh` |

---

**Plan complete and saved to `docs/plans/2026-04-07-functional-inbox.md`. Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
