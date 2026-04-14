# PRD Core Remaining Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the four remaining PRD features not yet built: Smart Queues (best-time auto-scheduling), Platform-Specific Post Previews (character limits + formatting warnings), PDF Report Export (using the already-installed `@react-pdf/renderer`), and a Link-in-Bio page builder with click analytics.

**Architecture:** Smart queues store user-defined weekly time slots in Supabase; "Add to Queue" picks the next unfilled slot. Platform previews are a pure client-side component that reads character limits from a constants map. PDF export is a client-side `@react-pdf/renderer` document triggered on button click. Link-in-Bio has a public route (`/bio/[slug]`) and an editor route (`/link-in-bio`) backed by two Supabase tables.

**What's already done and excluded from this plan:** Media library UI, bulk CSV scheduling, OAuth token refresh, social listening + sentiment analysis, exportable CSV reports, calendar with post display.

**Tech Stack:** Next.js 16, Supabase SDK, `@react-pdf/renderer` (already installed), `@dnd-kit/core` (to install for drag-and-drop), Tailwind CSS v4, Framer Motion, Vitest (already set up).

---

## File Map

**New files:**
- `supabase/migrations/20260414030000_prd_core.sql` — queue_slots, bio_pages, bio_links tables
- `src/lib/queue.ts` — pure functions: `nextAvailableSlot`
- `src/lib/__tests__/queue.test.ts`
- `src/lib/platform-limits.ts` — character limit constants + helpers
- `src/lib/__tests__/platform-limits.test.ts`
- `src/app/api/queue-slots/route.ts` — GET/POST/DELETE user's queue slots
- `src/app/api/queue/next-slot/route.ts` — GET next available slot for scheduling
- `src/app/api/bio/route.ts` — GET/POST bio page
- `src/app/api/bio/links/route.ts` — POST/DELETE/PATCH bio links
- `src/app/api/bio/links/[id]/click/route.ts` — POST increment click count
- `src/components/publishing/platform-preview.tsx` — per-platform post preview panel
- `src/components/publishing/queue-slot-picker.tsx` — UI to manage queue slots
- `src/components/reports/pdf-report.tsx` — @react-pdf/renderer document
- `src/app/(app)/link-in-bio/page.tsx` — Link-in-Bio editor
- `src/app/bio/[slug]/page.tsx` — public Link-in-Bio viewer (no auth)

**Modified files:**
- `src/app/(app)/publishing/page.tsx` — add platform preview panel + "Add to Queue" button
- `src/app/(app)/analytics/page.tsx` — add PDF export button
- `src/app/(app)/settings/page.tsx` — add queue slot management section
- `src/components/layout/sidebar.tsx` — add Link-in-Bio nav item

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260414030000_prd_core.sql`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/20260414030000_prd_core.sql

-- Smart queue: user-defined weekly posting time slots
CREATE TABLE public.queue_slots (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday
  hour        INTEGER NOT NULL CHECK (hour BETWEEN 0 AND 23),
  minute      INTEGER NOT NULL DEFAULT 0 CHECK (minute IN (0, 15, 30, 45)),
  platform    TEXT,   -- null = any platform
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, day_of_week, hour, minute)
);

-- Link-in-Bio: one page per user
CREATE TABLE public.bio_pages (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID    NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  slug        TEXT    NOT NULL UNIQUE,
  title       TEXT    NOT NULL DEFAULT 'My Links',
  bio         TEXT,
  avatar_url  TEXT,
  theme       TEXT    NOT NULL DEFAULT 'dark',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Link-in-Bio: links on a page
CREATE TABLE public.bio_links (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id     UUID    NOT NULL REFERENCES public.bio_pages(id) ON DELETE CASCADE,
  label       TEXT    NOT NULL,
  url         TEXT    NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  click_count INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.queue_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bio_pages   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bio_links   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own queue slots"
  ON public.queue_slots FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own bio page"
  ON public.bio_pages FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Bio pages are publicly readable (for the /bio/[slug] public route)
CREATE POLICY "Bio pages are publicly readable"
  ON public.bio_pages FOR SELECT USING (true);

CREATE POLICY "Users manage own bio links"
  ON public.bio_links FOR ALL
  USING (EXISTS (SELECT 1 FROM public.bio_pages bp WHERE bp.id = page_id AND bp.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.bio_pages bp WHERE bp.id = page_id AND bp.user_id = auth.uid()));

-- Bio links are publicly readable
CREATE POLICY "Bio links are publicly readable"
  ON public.bio_links FOR SELECT USING (true);

-- Bio link clicks can be incremented by anyone (anonymous click tracking)
CREATE POLICY "Anyone can increment bio link clicks"
  ON public.bio_links FOR UPDATE USING (true) WITH CHECK (true);
```

- [ ] **Step 2: Push migration**

```bash
supabase db push
```

Expected: applies cleanly.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260414030000_prd_core.sql
git commit -m "feat: add queue_slots, bio_pages, bio_links tables"
```

---

## Task 2: Smart Queue Lib + Tests

**Files:**
- Create: `src/lib/queue.ts`
- Create: `src/lib/__tests__/queue.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/__tests__/queue.test.ts`:

```ts
import { nextAvailableSlot } from '@/lib/queue'

type Slot = { day_of_week: number; hour: number; minute: number }

describe('nextAvailableSlot', () => {
  // Freeze to: Wednesday 2026-04-15 10:00:00 UTC (day_of_week=3)
  const NOW = new Date('2026-04-15T10:00:00Z').getTime()

  it('returns the next slot after current time on the same day', () => {
    const slots: Slot[] = [
      { day_of_week: 3, hour: 9,  minute: 0 },  // today, already passed
      { day_of_week: 3, hour: 14, minute: 0 },  // today, future
    ]
    const result = nextAvailableSlot(slots, NOW)
    expect(result).not.toBeNull()
    expect(result!.getUTCHours()).toBe(14)
    expect(result!.getUTCDay()).toBe(3)
  })

  it('wraps to the following week when no slots remain this week', () => {
    const slots: Slot[] = [
      { day_of_week: 2, hour: 9, minute: 0 }, // Tuesday — already passed this week
    ]
    const result = nextAvailableSlot(slots, NOW)
    expect(result).not.toBeNull()
    // Next Tuesday
    expect(result!.getUTCDay()).toBe(2)
    expect(result!.getTime()).toBeGreaterThan(NOW)
  })

  it('returns null when no slots are defined', () => {
    expect(nextAvailableSlot([], NOW)).toBeNull()
  })

  it('picks the earliest future slot across different days', () => {
    const slots: Slot[] = [
      { day_of_week: 5, hour: 9, minute: 0 },  // Friday
      { day_of_week: 4, hour: 8, minute: 0 },  // Thursday — closer
    ]
    const result = nextAvailableSlot(slots, NOW)
    expect(result!.getUTCDay()).toBe(4) // Thursday wins
  })
})
```

- [ ] **Step 2: Run — expect failures**

```bash
npm test
```

Expected: FAIL — `nextAvailableSlot` not found.

- [ ] **Step 3: Implement**

Create `src/lib/queue.ts`:

```ts
type Slot = { day_of_week: number; hour: number; minute: number }

/**
 * Given a list of weekly recurring time slots, returns the next Date
 * after `nowMs` when a slot fires. Returns null if no slots are defined.
 *
 * All times are treated as UTC.
 */
export function nextAvailableSlot(slots: Slot[], nowMs: number = Date.now()): Date | null {
  if (slots.length === 0) return null

  const now = new Date(nowMs)
  const currentDay = now.getUTCDay()
  const currentMins = now.getUTCHours() * 60 + now.getUTCMinutes()

  let earliest: Date | null = null

  for (const slot of slots) {
    const slotMins = slot.hour * 60 + slot.minute
    let daysAhead = slot.day_of_week - currentDay

    // Same day but slot already passed → next week
    if (daysAhead === 0 && slotMins <= currentMins) daysAhead = 7
    // Slot is on an earlier day this week → next week
    if (daysAhead < 0) daysAhead += 7

    const candidate = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + daysAhead,
      slot.hour,
      slot.minute,
      0,
      0
    ))

    if (!earliest || candidate < earliest) earliest = candidate
  }

  return earliest
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/queue.ts src/lib/__tests__/queue.test.ts
git commit -m "feat: add nextAvailableSlot with full test coverage"
```

---

## Task 3: Platform Limits Lib + Tests

**Files:**
- Create: `src/lib/platform-limits.ts`
- Create: `src/lib/__tests__/platform-limits.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/__tests__/platform-limits.test.ts`:

```ts
import { getCharLimit, getOverageInfo } from '@/lib/platform-limits'

describe('getCharLimit', () => {
  it('returns 280 for x', () => expect(getCharLimit('x')).toBe(280))
  it('returns 3000 for linkedin', () => expect(getCharLimit('linkedin')).toBe(3000))
  it('returns 2200 for instagram', () => expect(getCharLimit('instagram')).toBe(2200))
  it('returns 63206 for facebook', () => expect(getCharLimit('facebook')).toBe(63206))
  it('returns null for unknown platform', () => expect(getCharLimit('tiktok')).toBeNull())
})

describe('getOverageInfo', () => {
  it('returns status ok when under limit', () => {
    const { status, remaining } = getOverageInfo('x', 'hello world')
    expect(status).toBe('ok')
    expect(remaining).toBe(280 - 11)
  })

  it('returns status warning when within 20 chars of limit', () => {
    const content = 'a'.repeat(265)
    const { status } = getOverageInfo('x', content)
    expect(status).toBe('warning')
  })

  it('returns status over when exceeding limit', () => {
    const content = 'a'.repeat(290)
    const { status, overage } = getOverageInfo('x', content)
    expect(status).toBe('over')
    expect(overage).toBe(10)
  })

  it('returns status ok for unknown platform regardless of length', () => {
    const { status } = getOverageInfo('tiktok', 'a'.repeat(10000))
    expect(status).toBe('ok')
  })
})
```

- [ ] **Step 2: Run — expect failures**

```bash
npm test
```

Expected: FAIL — functions not found.

- [ ] **Step 3: Implement**

Create `src/lib/platform-limits.ts`:

```ts
const LIMITS: Record<string, number> = {
  x:         280,
  linkedin:  3000,
  instagram: 2200,
  facebook:  63206,
}

const WARNING_BUFFER = 20

export function getCharLimit(platform: string): number | null {
  return LIMITS[platform.toLowerCase()] ?? null
}

export type OverageInfo = {
  limit: number | null
  used: number
  remaining: number | null
  overage: number
  status: 'ok' | 'warning' | 'over'
}

export function getOverageInfo(platform: string, content: string): OverageInfo {
  const limit = getCharLimit(platform)
  const used = content.length

  if (limit === null) {
    return { limit: null, used, remaining: null, overage: 0, status: 'ok' }
  }

  const remaining = limit - used
  const overage = Math.max(0, -remaining)
  let status: OverageInfo['status'] = 'ok'
  if (remaining < 0) status = 'over'
  else if (remaining <= WARNING_BUFFER) status = 'warning'

  return { limit, used, remaining, overage, status }
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/platform-limits.ts src/lib/__tests__/platform-limits.test.ts
git commit -m "feat: add platform character limits lib with tests"
```

---

## Task 4: Queue Slots API

**Files:**
- Create: `src/app/api/queue-slots/route.ts`
- Create: `src/app/api/queue/next-slot/route.ts`

- [ ] **Step 1: Create queue-slots CRUD route**

Create `src/app/api/queue-slots/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('queue_slots')
    .select('*')
    .eq('user_id', user.id)
    .order('day_of_week', { ascending: true })
    .order('hour', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ slots: data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { day_of_week, hour, minute, platform } = await req.json()
  if (day_of_week === undefined || hour === undefined) {
    return NextResponse.json({ error: 'day_of_week and hour required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('queue_slots')
    .insert({ user_id: user.id, day_of_week, hour, minute: minute ?? 0, platform: platform ?? null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ slot: data }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase
    .from('queue_slots')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Create next-slot route**

Create `src/app/api/queue/next-slot/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { nextAvailableSlot } from '@/lib/queue'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: slots } = await supabase
    .from('queue_slots')
    .select('day_of_week, hour, minute')
    .eq('user_id', user.id)

  const next = nextAvailableSlot(slots ?? [])
  return NextResponse.json({ next: next?.toISOString() ?? null })
}
```

- [ ] **Step 3: Verify no type errors**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/queue-slots/route.ts src/app/api/queue/next-slot/route.ts
git commit -m "feat: add queue slots API and next-slot route"
```

---

## Task 5: Platform Preview Component

**Files:**
- Create: `src/components/publishing/platform-preview.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/publishing/platform-preview.tsx`:

```tsx
'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { getOverageInfo } from '@/lib/platform-limits'
import { FaLinkedin, FaXTwitter, FaInstagram, FaFacebook } from 'react-icons/fa6'
import { cn } from '@/lib/utils'

const PLATFORM_META: Record<string, { label: string; Icon: React.ElementType; color: string }> = {
  linkedin:  { label: 'LinkedIn',  Icon: FaLinkedin,  color: '#0A66C2' },
  x:         { label: 'X',         Icon: FaXTwitter,  color: '#000000' },
  instagram: { label: 'Instagram', Icon: FaInstagram, color: '#E1306C' },
  facebook:  { label: 'Facebook',  Icon: FaFacebook,  color: '#1877F2' },
}

type Props = {
  content: string
  platforms: string[]
}

export function PlatformPreview({ content, platforms }: Props) {
  if (!content.trim() || platforms.length === 0) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-3"
      >
        <p className="text-xs uppercase tracking-widest text-slate-500">Platform Preview</p>
        {platforms.map(platform => {
          const meta = PLATFORM_META[platform]
          if (!meta) return null
          const info = getOverageInfo(platform, content)
          const preview = info.status === 'over' && info.limit
            ? content.slice(0, info.limit)
            : content

          return (
            <div
              key={platform}
              className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
                <meta.Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
                <span className="text-xs text-slate-400">{meta.label}</span>
                <div className="ml-auto flex items-center gap-2">
                  {info.limit && (
                    <span className={cn(
                      'text-xs font-mono',
                      info.status === 'over'    ? 'text-red-400' :
                      info.status === 'warning' ? 'text-[#C97D3A]' : 'text-slate-500'
                    )}>
                      {info.status === 'over' ? `-${info.overage}` : info.remaining}
                    </span>
                  )}
                </div>
              </div>

              {/* Content preview */}
              <div className="px-3 py-3">
                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap break-words">
                  {preview}
                  {info.status === 'over' && (
                    <span className="text-red-400 bg-red-400/10 rounded px-0.5 ml-0.5">
                      …+{info.overage} chars
                    </span>
                  )}
                </p>
              </div>

              {/* Over-limit warning */}
              {info.status === 'over' && (
                <div className="px-3 py-2 bg-red-400/10 border-t border-red-400/20">
                  <p className="text-xs text-red-400">
                    {info.overage} characters over the {meta.label} limit of {info.limit?.toLocaleString()}. Post will be truncated.
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </motion.div>
    </AnimatePresence>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/publishing/platform-preview.tsx
git commit -m "feat: add PlatformPreview component with character limit warnings"
```

---

## Task 6: Publishing Editor — Platform Preview + Add to Queue

**Files:**
- Modify: `src/app/(app)/publishing/page.tsx`

- [ ] **Step 1: Import PlatformPreview**

Add to imports at the top of `src/app/(app)/publishing/page.tsx`:

```ts
import { PlatformPreview } from "@/components/publishing/platform-preview"
```

- [ ] **Step 2: Add PlatformPreview to JSX**

In the publishing form JSX, below the content textarea and voice score meter (but above the schedule/metadata sections), add:

```tsx
<PlatformPreview content={content} platforms={selectedPlatforms} />
```

- [ ] **Step 3: Add "Add to Queue" button**

Add a new state variable:

```ts
const [queueLoading, setQueueLoading] = useState(false)
```

Add a handler function inside `PublishingPage`:

```ts
const handleAddToQueue = async () => {
  setQueueLoading(true)
  try {
    const res = await fetch('/api/queue/next-slot')
    const { next } = await res.json()
    if (!next) {
      setFeedbackMsg('No queue slots set up. Add time slots in Settings → Smart Queue.')
      setStatus('error')
      return
    }
    setScheduledFor(next.slice(0, 16)) // 'YYYY-MM-DDTHH:mm'
    setShowSchedule(true)
    setFeedbackMsg(`Queued for ${new Date(next).toLocaleString()}`)
    setStatus('success')
  } catch {
    setFeedbackMsg('Could not fetch next queue slot.')
    setStatus('error')
  } finally {
    setQueueLoading(false)
    setTimeout(() => setStatus('idle'), 3000)
  }
}
```

In the JSX, add an "Add to Queue" button next to the existing schedule/publish buttons:

```tsx
<button
  type="button"
  onClick={handleAddToQueue}
  disabled={queueLoading || selectedPlatforms.length === 0 || !content.trim()}
  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/10 text-sm text-slate-300 hover:border-[#128C7E] hover:text-[#128C7E] disabled:opacity-50 transition-colors"
>
  {queueLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
  Add to Queue
</button>
```

(`Clock` is already imported from lucide-react.)

- [ ] **Step 4: Verify no type errors**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/app/(app)/publishing/page.tsx
git commit -m "feat: add platform preview and Add to Queue to publishing editor"
```

---

## Task 7: Settings — Smart Queue Slot Manager

**Files:**
- Modify: `src/app/(app)/settings/page.tsx`

- [ ] **Step 1: Read the current settings page structure**

Read `src/app/(app)/settings/page.tsx` to understand how sections are structured before editing.

- [ ] **Step 2: Add queue slot state + fetch**

Inside the settings page component, add:

```ts
const [slots, setSlots] = useState<{ id: string; day_of_week: number; hour: number; minute: number }[]>([])
const [newSlotDay, setNewSlotDay] = useState(1)
const [newSlotHour, setNewSlotHour] = useState(9)
const [newSlotMin, setNewSlotMin] = useState(0)

useEffect(() => {
  fetch('/api/queue-slots')
    .then(r => r.json())
    .then(d => setSlots(d.slots ?? []))
    .catch(() => {})
}, [])

const handleAddSlot = async () => {
  const res = await fetch('/api/queue-slots', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ day_of_week: newSlotDay, hour: newSlotHour, minute: newSlotMin }),
  })
  const data = await res.json()
  if (data.slot) setSlots(prev => [...prev, data.slot])
}

const handleDeleteSlot = async (id: string) => {
  await fetch('/api/queue-slots', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  })
  setSlots(prev => prev.filter(s => s.id !== id))
}
```

- [ ] **Step 3: Add Smart Queue section to settings JSX**

The settings page uses sections for each settings group. Add a new section using the same pattern as existing sections:

```tsx
{/* Smart Queue */}
<div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
  <div>
    <h3 className="text-sm font-semibold text-foreground">Smart Queue</h3>
    <p className="text-xs text-slate-500 mt-0.5">Define weekly time slots. "Add to Queue" picks the next free slot.</p>
  </div>

  {/* Existing slots */}
  {slots.length > 0 && (
    <div className="space-y-1.5">
      {slots.map(slot => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        const time = `${String(slot.hour).padStart(2, '0')}:${String(slot.minute).padStart(2, '0')}`
        return (
          <div key={slot.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
            <span className="text-sm text-slate-300">{days[slot.day_of_week]} at {time} UTC</span>
            <button onClick={() => handleDeleteSlot(slot.id)} className="text-slate-500 hover:text-red-400 transition-colors text-xs">Remove</button>
          </div>
        )
      })}
    </div>
  )}

  {/* Add new slot */}
  <div className="flex items-center gap-2 flex-wrap">
    <select value={newSlotDay} onChange={e => setNewSlotDay(Number(e.target.value))}
      className="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-[#128C7E]">
      {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((d, i) => (
        <option key={i} value={i}>{d}</option>
      ))}
    </select>
    <select value={newSlotHour} onChange={e => setNewSlotHour(Number(e.target.value))}
      className="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-[#128C7E]">
      {Array.from({ length: 24 }, (_, i) => (
        <option key={i} value={i}>{String(i).padStart(2, '0')}:00 UTC</option>
      ))}
    </select>
    <button onClick={handleAddSlot}
      className="px-3 py-1.5 rounded-lg bg-[#128C7E] text-white text-sm hover:bg-[#0e7a6e] transition-colors">
      Add Slot
    </button>
  </div>
</div>
```

- [ ] **Step 4: Verify no type errors**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/app/(app)/settings/page.tsx
git commit -m "feat: add Smart Queue slot manager to Settings"
```

---

## Task 8: PDF Report Export

**Files:**
- Create: `src/components/reports/pdf-report.tsx`
- Modify: `src/app/(app)/analytics/page.tsx`

- [ ] **Step 1: Create the PDF document component**

Create `src/components/reports/pdf-report.tsx`:

```tsx
// Note: @react-pdf/renderer components must NOT be rendered server-side.
// This file is client-only — only import it with dynamic(() => ..., { ssr: false }).
import {
  Document, Page, Text, View, StyleSheet, Font,
} from '@react-pdf/renderer'

Font.register({
  family: 'Helvetica',
  fonts: [{ src: 'Helvetica' }, { src: 'Helvetica-Bold', fontWeight: 'bold' }],
})

const styles = StyleSheet.create({
  page:    { fontFamily: 'Helvetica', fontSize: 11, padding: 48, color: '#0D2440', backgroundColor: '#FFFFFF' },
  header:  { marginBottom: 32 },
  title:   { fontSize: 22, fontWeight: 'bold', color: '#128C7E', marginBottom: 4 },
  subtitle:{ fontSize: 11, color: '#64748B' },
  section: { marginBottom: 24 },
  label:   { fontSize: 9, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  row:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  metric:  { fontSize: 13, fontWeight: 'bold', color: '#0D2440' },
  cell:    { flex: 1, fontSize: 10, color: '#475569' },
  badge:   { fontSize: 9, color: '#128C7E', backgroundColor: '#E7F9F7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  footer:  { position: 'absolute', bottom: 32, left: 48, right: 48, fontSize: 9, color: '#94A3B8', textAlign: 'center' },
})

type Post = {
  id: string; status: string; content: string
  platforms: string[]; created_at: string; published_at: string | null
}

type Props = {
  posts: Post[]
  dateStart: string | null
  dateEnd: string | null
  reportTitle: string
}

export function PdfReport({ posts, dateStart: _dateStart, dateEnd: _dateEnd, reportTitle }: Props) {
  const published = posts.filter(p => p.status === 'published')
  const scheduled = posts.filter(p => p.status === 'scheduled')
  const failed    = posts.filter(p => p.status === 'failed')

  const platformCounts: Record<string, number> = {}
  for (const post of published) {
    for (const platform of (post.platforms ?? [])) {
      platformCounts[platform] = (platformCounts[platform] ?? 0) + 1
    }
  }

  return (
    <Document title={`LinXar Report — ${reportTitle}`} author="LinXar Ops: Social">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>LinXar Ops: Social</Text>
          <Text style={styles.subtitle}>Analytics Report · {reportTitle}</Text>
        </View>

        {/* Summary metrics */}
        <View style={styles.section}>
          <Text style={styles.label}>Summary</Text>
          {[
            ['Total Posts', String(posts.length)],
            ['Published', String(published.length)],
            ['Scheduled', String(scheduled.length)],
            ['Failed', String(failed.length)],
          ].map(([label, value]) => (
            <View key={label} style={styles.row}>
              <Text style={styles.cell}>{label}</Text>
              <Text style={styles.metric}>{value}</Text>
            </View>
          ))}
        </View>

        {/* Platform breakdown */}
        {Object.keys(platformCounts).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.label}>Posts by Platform</Text>
            {Object.entries(platformCounts).map(([platform, count]) => (
              <View key={platform} style={styles.row}>
                <Text style={styles.cell}>{platform.charAt(0).toUpperCase() + platform.slice(1)}</Text>
                <Text style={styles.metric}>{count}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Recent published posts */}
        <View style={styles.section}>
          <Text style={styles.label}>Published Posts</Text>
          {published.slice(0, 15).map(post => (
            <View key={post.id} style={[styles.row, { paddingVertical: 8 }]}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ fontSize: 10, color: '#0D2440', marginBottom: 2 }} numberOfLines={2}>
                  {post.content.slice(0, 120)}{post.content.length > 120 ? '…' : ''}
                </Text>
                <Text style={{ fontSize: 9, color: '#94A3B8' }}>
                  {post.published_at ? new Date(post.published_at).toLocaleDateString() : '—'}
                </Text>
              </View>
              <Text style={styles.badge}>{(post.platforms ?? []).join(' · ')}</Text>
            </View>
          ))}
          {published.length > 15 && (
            <Text style={{ fontSize: 9, color: '#94A3B8', marginTop: 6 }}>
              + {published.length - 15} more posts — see CSV export for full data.
            </Text>
          )}
        </View>

        <Text style={styles.footer}>
          Generated by LinXar Ops: Social · {new Date().toLocaleDateString()}
        </Text>
      </Page>
    </Document>
  )
}
```

- [ ] **Step 2: Add PDF export to Analytics page**

In `src/app/(app)/analytics/page.tsx`, add a dynamic import (avoids SSR crash from @react-pdf/renderer):

```ts
import dynamic from 'next/dynamic'
const { pdf } = await import('@react-pdf/renderer') // lazy import in handler only
```

Actually, `@react-pdf/renderer`'s `pdf()` function must be called client-side. Add this handler to the analytics page component:

```ts
const handlePdfExport = async () => {
  const { pdf } = await import('@react-pdf/renderer')
  const { PdfReport } = await import('@/components/reports/pdf-report')
  const { buildReportTitle } = await import('@/lib/report-export')

  const title = buildReportTitle(dateStart, dateEnd)
  const blob = await pdf(<PdfReport posts={posts} dateStart={dateStart} dateEnd={dateEnd} reportTitle={title} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `linxar-report-${Date.now()}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
```

(`dateStart`, `dateEnd`, and `posts` are already in the analytics page state from the existing implementation.)

Find the existing Download/Export button in the analytics page JSX. Add a PDF button next to it:

```tsx
<button
  onClick={handlePdfExport}
  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 text-xs text-slate-300 hover:border-[#128C7E] hover:text-[#128C7E] transition-colors"
>
  <FileText className="w-3.5 h-3.5" />
  Export PDF
</button>
```

(`FileText` is already imported in the analytics page.)

- [ ] **Step 3: Verify no type errors**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/reports/pdf-report.tsx src/app/(app)/analytics/page.tsx
git commit -m "feat: add PDF report export using @react-pdf/renderer"
```

---

## Task 9: Link-in-Bio API Routes

**Files:**
- Create: `src/app/api/bio/route.ts`
- Create: `src/app/api/bio/links/route.ts`
- Create: `src/app/api/bio/links/[id]/click/route.ts`

- [ ] **Step 1: Create bio page GET/POST route**

Create `src/app/api/bio/route.ts`:

```ts
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
```

- [ ] **Step 2: Create bio links CRUD route**

Create `src/app/api/bio/links/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getUserPageId(supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>, userId: string): Promise<string | null> {
  const { data } = await supabase.from('bio_pages').select('id').eq('user_id', userId).single()
  return data?.id ?? null
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pageId = await getUserPageId(supabase, user.id)
  if (!pageId) return NextResponse.json({ error: 'Create a bio page first' }, { status: 422 })

  const { label, url, sort_order } = await req.json()
  if (!label?.trim() || !url?.trim()) return NextResponse.json({ error: 'label and url required' }, { status: 400 })

  const { data, error } = await supabase
    .from('bio_links')
    .insert({ page_id: pageId, label: label.trim(), url: url.trim(), sort_order: sort_order ?? 0 })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ link: data }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pageId = await getUserPageId(supabase, user.id)
  if (!pageId) return NextResponse.json({ error: 'No bio page found' }, { status: 422 })

  const { id, label, url, sort_order } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const update: Record<string, unknown> = {}
  if (label !== undefined) update.label = label
  if (url !== undefined) update.url = url
  if (sort_order !== undefined) update.sort_order = sort_order

  const { data, error } = await supabase
    .from('bio_links')
    .update(update)
    .eq('id', id)
    .eq('page_id', pageId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ link: data })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pageId = await getUserPageId(supabase, user.id)
  if (!pageId) return NextResponse.json({ error: 'No bio page found' }, { status: 422 })

  const { id } = await req.json()
  const { error } = await supabase.from('bio_links').delete().eq('id', id).eq('page_id', pageId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Create click-tracking route**

Create `src/app/api/bio/links/[id]/click/route.ts`:

```ts
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
```

- [ ] **Step 4: Create the Supabase RPC function for atomic click increment**

Add a new migration:

Create `supabase/migrations/20260414031000_bio_click_rpc.sql`:

```sql
CREATE OR REPLACE FUNCTION public.increment_bio_link_click(link_id UUID)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.bio_links SET click_count = click_count + 1 WHERE id = link_id;
$$;
```

Push:

```bash
supabase db push
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/bio/route.ts src/app/api/bio/links/route.ts src/app/api/bio/links/[id]/click/route.ts supabase/migrations/20260414031000_bio_click_rpc.sql
git commit -m "feat: add Link-in-Bio API routes and click-tracking RPC"
```

---

## Task 10: Link-in-Bio Editor Page

**Files:**
- Create: `src/app/(app)/link-in-bio/page.tsx`

- [ ] **Step 1: Create the editor page**

Create `src/app/(app)/link-in-bio/page.tsx`:

```tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2, ExternalLink, BarChart2 } from 'lucide-react'

type BioLink = { id: string; label: string; url: string; sort_order: number; click_count: number }
type BioPage = { id: string; slug: string; title: string; bio?: string | null }

export default function LinkInBioPage() {
  const [page, setPage] = useState<BioPage | null>(null)
  const [links, setLinks] = useState<BioLink[]>([])
  const [loading, setLoading] = useState(true)
  const [setupMode, setSetupMode] = useState(false)

  // Setup form state
  const [slug, setSlug] = useState('')
  const [title, setTitle] = useState('My Links')
  const [bio, setBio] = useState('')
  const [setupLoading, setSetupLoading] = useState(false)

  // Add link form state
  const [newLabel, setNewLabel] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [addingLink, setAddingLink] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/bio')
    const data = await res.json()
    if (data.page) {
      setPage(data.page)
      const sorted = [...(data.page.bio_links ?? [])].sort((a: BioLink, b: BioLink) => a.sort_order - b.sort_order)
      setLinks(sorted)
    } else {
      setSetupMode(true)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    setSetupLoading(true)
    await fetch('/api/bio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, title, bio }),
    })
    setSetupLoading(false)
    setSetupMode(false)
    await load()
  }

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLabel.trim() || !newUrl.trim()) return
    setAddingLink(true)
    const res = await fetch('/api/bio/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: newLabel, url: newUrl, sort_order: links.length }),
    })
    const data = await res.json()
    if (data.link) setLinks(prev => [...prev, data.link])
    setNewLabel(''); setNewUrl('')
    setAddingLink(false)
  }

  const handleDeleteLink = async (id: string) => {
    await fetch('/api/bio/links', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setLinks(prev => prev.filter(l => l.id !== id))
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-4 animate-pulse">
        <div className="h-8 bg-white/5 rounded w-1/3" />
        <div className="h-32 bg-white/5 rounded-2xl" />
      </div>
    )
  }

  // Setup flow — no page yet
  if (setupMode) {
    return (
      <div className="max-w-lg mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-foreground mb-2">Set Up Your Link-in-Bio</h1>
        <p className="text-sm text-slate-400 mb-6">Create a public page to share in your social bios.</p>
        <form onSubmit={handleSetup} className="space-y-4">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Page URL slug</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">/bio/</span>
              <input value={slug} onChange={e => setSlug(e.target.value)} required placeholder="yourname"
                className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-foreground placeholder:text-slate-600 focus:outline-none focus:border-[#128C7E]" />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Page title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} required
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#128C7E]" />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Bio (optional)</label>
            <textarea value={bio} onChange={e => setBio(e.target.value)} rows={2} maxLength={160}
              placeholder="Short description of who you are"
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-foreground placeholder:text-slate-600 resize-none focus:outline-none focus:border-[#128C7E]" />
          </div>
          <button type="submit" disabled={setupLoading || !slug.trim()}
            className="w-full py-2.5 rounded-xl bg-[#128C7E] text-white text-sm font-medium hover:bg-[#0e7a6e] disabled:opacity-50 transition-colors">
            {setupLoading ? 'Creating…' : 'Create My Page'}
          </button>
        </form>
      </div>
    )
  }

  const totalClicks = links.reduce((s, l) => s + l.click_count, 0)
  const publicUrl = `/bio/${page?.slug}`

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Link-in-Bio</h1>
          <a href={publicUrl} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 text-sm text-[#128C7E] hover:underline mt-1">
            {window.location.origin}{publicUrl} <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-slate-400">
          <BarChart2 className="w-4 h-4" />
          <span>{totalClicks} total clicks</span>
        </div>
      </motion.div>

      {/* Links list */}
      <section className="space-y-2">
        {links.map(link => (
          <motion.div key={link.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 group">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{link.label}</p>
              <p className="text-xs text-slate-500 truncate">{link.url}</p>
            </div>
            <span className="text-xs text-slate-500 shrink-0">{link.click_count} clicks</span>
            <button onClick={() => handleDeleteLink(link.id)}
              className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}

        {/* Add link form */}
        <form onSubmit={handleAddLink} className="flex items-center gap-2 pt-1">
          <input value={newLabel} onChange={e => setNewLabel(e.target.value)} required placeholder="Label"
            className="w-32 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-foreground placeholder:text-slate-600 focus:outline-none focus:border-[#128C7E]" />
          <input value={newUrl} onChange={e => setNewUrl(e.target.value)} required placeholder="https://…" type="url"
            className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-foreground placeholder:text-slate-600 focus:outline-none focus:border-[#128C7E]" />
          <button type="submit" disabled={addingLink}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#128C7E] text-white text-sm hover:bg-[#0e7a6e] disabled:opacity-50 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </form>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(app)/link-in-bio/page.tsx
git commit -m "feat: add Link-in-Bio editor page"
```

---

## Task 11: Link-in-Bio Public Page

**Files:**
- Create: `src/app/bio/[slug]/page.tsx`

- [ ] **Step 1: Create the public page**

This page lives outside the `(app)` route group — no auth required. Create `src/app/bio/[slug]/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { BioPageView } from '@/components/bio/bio-page-view'

type Props = { params: Promise<{ slug: string }> }

export default async function PublicBioPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: page } = await supabase
    .from('bio_pages')
    .select('*, bio_links(id, label, url, sort_order, click_count)')
    .eq('slug', slug)
    .single()

  if (!page) notFound()

  const links = [...(page.bio_links ?? [])].sort((a, b) => a.sort_order - b.sort_order)

  return <BioPageView page={page} links={links} />
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: page } = await supabase.from('bio_pages').select('title, bio').eq('slug', slug).single()
  return {
    title: page?.title ?? 'Link in Bio',
    description: page?.bio ?? '',
  }
}
```

- [ ] **Step 2: Create the BioPageView client component**

Create `src/components/bio/bio-page-view.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ExternalLink } from 'lucide-react'

type BioLink = { id: string; label: string; url: string; sort_order: number }
type BioPage = { title: string; bio?: string | null; avatar_url?: string | null; theme: string }

type Props = { page: BioPage; links: BioLink[] }

export function BioPageView({ page, links }: Props) {
  const [clicked, setClicked] = useState<string | null>(null)

  const handleClick = async (link: BioLink) => {
    setClicked(link.id)
    // Fire-and-forget click tracking
    fetch(`/api/bio/links/${link.id}/click`, { method: 'POST' }).catch(() => {})
    // Small delay so user sees the highlight, then navigate
    await new Promise(r => setTimeout(r, 200))
    window.open(link.url, '_blank', 'noopener,noreferrer')
    setClicked(null)
  }

  return (
    <div className="min-h-screen flex items-start justify-center py-16 px-4"
      style={{ background: page.theme === 'dark' ? '#0B1020' : '#F8FAFC' }}>
      <div className="w-full max-w-sm space-y-8">
        {/* Profile */}
        <div className="text-center space-y-2">
          {page.avatar_url && (
            <img src={page.avatar_url} alt={page.title}
              className="w-20 h-20 rounded-full mx-auto object-cover border-2 border-[#128C7E]" />
          )}
          <h1 className={`text-xl font-bold ${page.theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            {page.title}
          </h1>
          {page.bio && (
            <p className={`text-sm ${page.theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{page.bio}</p>
          )}
        </div>

        {/* Links */}
        <div className="space-y-3">
          {links.map((link, i) => (
            <motion.button
              key={link.id}
              onClick={() => handleClick(link)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className={`w-full flex items-center justify-between px-5 py-3.5 rounded-2xl text-sm font-medium transition-all ${
                clicked === link.id ? 'scale-95' : 'scale-100'
              } ${
                page.theme === 'dark'
                  ? 'bg-white/10 hover:bg-white/15 text-white border border-white/10'
                  : 'bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 shadow-sm'
              }`}
            >
              <span>{link.label}</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-50" />
            </motion.button>
          ))}
        </div>

        <p className={`text-center text-xs ${page.theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`}>
          Made with LinXar Ops
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/bio/[slug]/page.tsx src/components/bio/bio-page-view.tsx
git commit -m "feat: add public Link-in-Bio page with click tracking"
```

---

## Task 12: Sidebar — Add Link-in-Bio Nav Item

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

- [ ] **Step 1: Add import and nav item**

In `src/components/layout/sidebar.tsx`, add `Link2` to the lucide-react import:

```ts
import { ..., Link2 } from 'lucide-react'
```

Add to the `navItems` array, between Settings and the end:

```ts
{ name: 'Link-in-Bio', href: '/link-in-bio', icon: Link2 },
```

- [ ] **Step 2: Final build check**

```bash
npm run build
```

Expected: builds cleanly with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat: add Link-in-Bio to sidebar nav"
```

---

## Task 13: Final Verification

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: all tests pass (queue, platform-limits, brand-brain, content-arch, performance-coach).

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Production build**

```bash
npm run build
```

Expected: builds cleanly.

- [ ] **Step 4: Smoke test the public bio page**

Start dev server, create a bio page at `/link-in-bio`, then navigate to `/bio/[your-slug]` without being logged in. Verify links render and click tracking fires.

```bash
npm run dev
```

- [ ] **Step 5: Commit if any lint fixes needed**

```bash
npm run lint -- --fix
git add -A
git commit -m "chore: lint fixes for PRD core features"
```

Only run if lint found issues.
