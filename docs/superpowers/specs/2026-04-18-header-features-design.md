# Header Features: Command Palette, Notifications, Profile Page

**Date:** 2026-04-18  
**Status:** Approved  
**Approach:** B — Hybrid (modal + drawer + full page)

---

## Overview

Three features connected to the top header bar:

1. **Command Palette** — ⌘K modal for quick navigation, post search, and actions  
2. **Notification Drawer** — slide-in drawer from right with unread badge on bell icon  
3. **Profile Page** — full page at `/profile` with edit, password, and danger zone tabs  

The avatar button becomes a dropdown menu: **View Profile** / **Sign Out**.

---

## 1. Command Palette

### Trigger
- Keyboard shortcut `⌘K` (Mac) / `Ctrl+K` (Windows/Linux) — global listener on `document`
- Clicking the search bar in the header also opens it
- The search `<input>` in the header becomes a visual button (no real input behaviour) that fires the palette

### Modal behaviour
- Centred overlay with a dark scrim behind it
- Dismisses on `Escape` or click outside
- Keyboard: `↑↓` to navigate results, `Enter` to activate, `Esc` to close
- No page navigation on open — stays on current page

### Search scope & result groups (in display order)
| Group | Source | Match |
|---|---|---|
| Pages | Static list of 10 nav destinations | Fuzzy match on name |
| Recent Posts | Last 20 posts from Supabase (`posts` table) | Substring match on `content` |
| Settings | Static list of settings sections | Fuzzy match |
| Actions | Static list: "New post", "Go to profile", "Toggle dark mode" | Fuzzy match |

- Results update on every keystroke (client-side filtering — no API calls for pages/actions; one initial Supabase fetch for posts on mount)
- Empty state: "No results for '…'" with a suggestion to try different keywords
- Max visible results: 8 (scrollable if more)

### Implementation
- New client component: `src/components/command-palette/CommandPalette.tsx`
- State managed in a Zustand store or React context: `isOpen`, `query`, `results`
- Registered globally in `src/app/(app)/layout.tsx` via a `useEffect` keydown listener
- Header search bar becomes a `<button>` that calls `openPalette()`

---

## 2. Notification System

### Data model — new `notifications` table

```sql
create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  type        text not null,  -- 'post_published' | 'post_failed' | 'brief_ready' | 'ab_decided'
  title       text not null,
  body        text,
  link        text,           -- optional deep link (e.g. /publishing?post=<id>)
  read_at     timestamptz,    -- null = unread
  created_at  timestamptz default now()
);
-- RLS: users can only see/update their own rows
```

### Notification triggers (server-side)
| Event | Where inserted |
|---|---|
| Post published successfully | `/api/publish` route after successful publish |
| Post failed | `/api/publish` route on caught error |
| Brand Brain brief ready | `/api/cron/generate-brief` route |
| A/B test auto-decided | `/api/cron/decide-ab-tests` route |

### Bell icon
- Unread count = `SELECT count(*) FROM notifications WHERE user_id = $1 AND read_at IS NULL`
- Fetched by the `Header` server component on each render; revalidated client-side every 60 s via a lightweight polling hook
- Badge hidden when count = 0; shows up to `9+`

### Drawer behaviour
- `<NotificationDrawer>` is a client component rendered inside `(app)/layout.tsx`
- Opens via shared state (Zustand store: `isNotifOpen`)
- Bell button in header calls `toggleNotifDrawer()`
- Drawer slides in from right using Framer Motion (`x: '100%'` → `x: 0`)
- Scrim behind drawer; clicking scrim or pressing `Esc` closes it
- "Mark all read" button — sets `read_at = now()` on all unread rows for the user
- Individual items are clickable — marks that item read and navigates to `link` if present
- Footer link "View notification centre →" navigates to `/notifications` full page

### Notification centre page — `/notifications`
- Full page listing all notifications, grouped by date
- Same mark-as-read behaviour
- Infinite scroll or paginated (50 per page)

---

## 3. Profile Page

### Route
`/profile` — protected, inside `(app)/` route group

### Avatar dropdown (replaces current sign-out button)
The avatar button in the header becomes a `DropdownMenu` (shadcn):
- **View Profile** → `href="/profile"`
- **Sign Out** → calls existing `signout` server action

### Page layout
Three tabs rendered as a tabbed interface (shadcn `Tabs`):

#### Tab 1 — Edit Profile
Fields:
- **Display name** — `user_metadata.name`, editable
- **Email** — read-only (shown for reference; changing email not supported)
- **Bio** — `user_metadata.bio`, editable textarea
- **Website** — `user_metadata.website`, editable URL input
- **Avatar** — click camera button to upload; stored in Supabase Storage `avatars/{user_id}` bucket; public URL saved to `user_metadata.avatar_url`

Save action: `supabase.auth.updateUser({ data: { name, bio, website, avatar_url } })`

#### Tab 2 — Change Password
Fields: Current password, New password, Confirm new password  
Action: `supabase.auth.updateUser({ password: newPassword })`  
Requires the user to be signed in with email/password (OAuth users see a note that password change is not available for OAuth accounts).

#### Tab 3 — Danger Zone
- Single destructive action: **Delete my account**
- Clicking opens a confirmation modal: user must type their email to confirm
- On confirm: server action deletes all user data (posts, profiles, notifications, storage files) then calls `supabase.auth.admin.deleteUser()`
- Signs the user out and redirects to `/login`

### Supabase Storage
- Bucket: `avatars` (public read, authenticated write)
- Path: `avatars/{user_id}/{filename}`
- Old avatar deleted from storage when a new one is uploaded

---

## Architecture Summary

```
Header (server component)
├── Search bar → button → fires openPalette() [client]
├── Bell icon → NotifBell [client, polls unread count, opens drawer]
└── Avatar → DropdownMenu [client] → /profile or signout

CommandPalette [client, global, in (app)/layout.tsx]
├── Zustand store: { isOpen, query }
├── Static items: pages + actions
└── Posts: fetched once on mount from /api/command-palette/posts

NotificationDrawer [client, in (app)/layout.tsx]
├── Zustand store: { isOpen }
├── Fetches /api/notifications on open
└── Mark-read: PATCH /api/notifications/mark-read

/profile [server + client tabs]
├── Edit Profile tab (client form, server action)
├── Change Password tab (client form, server action)
└── Danger Zone tab (client, confirmation modal, server action)

/notifications [server page, paginated list]
```

---

## New Files

| File | Purpose |
|---|---|
| `src/components/command-palette/CommandPalette.tsx` | Palette modal, keyboard nav, result groups |
| `src/components/notifications/NotificationDrawer.tsx` | Slide-in drawer component |
| `src/components/notifications/NotifBell.tsx` | Bell icon with polling badge |
| `src/app/(app)/notifications/page.tsx` | Full notification centre page |
| `src/app/(app)/profile/page.tsx` | Profile page with tabs |
| `src/app/actions/profile.ts` | Server actions: updateProfile, changePassword, deleteAccount |
| `src/app/api/notifications/route.ts` | GET notifications, PATCH mark-read |
| `src/app/api/command-palette/posts/route.ts` | GET last 20 posts for palette |
| `src/store/ui.ts` | Zustand store: palette + notif drawer open state |
| `supabase/migrations/YYYYMMDD_notifications.sql` | notifications table + RLS |

## Modified Files

| File | Change |
|---|---|
| `src/components/layout/header.tsx` | Search → palette trigger button; Bell → NotifBell; Avatar → dropdown |
| `src/app/(app)/layout.tsx` | Mount CommandPalette + NotificationDrawer globally |
| `src/app/api/publish/route.ts` | Insert notification row on publish/fail |
| `src/app/api/brand-brain/generate/route.ts` | Insert notification on brief ready |
| `src/app/api/cron/decide-ab-tests/route.ts` | Insert notification on winner decided |
