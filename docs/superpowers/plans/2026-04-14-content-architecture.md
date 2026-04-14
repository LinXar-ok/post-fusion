# Content Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a structural layer above scheduling — content pillars (brand themes) and story arcs (multi-week narratives) — so every post has purpose and the user can see whether their content actually reflects what they stand for.

**Architecture:** Pillars and arcs live in Supabase. Posts get a nullable `pillar_id` FK. Balance heatmap is computed client-side from post counts grouped by pillar. Story arcs are a join table between arcs and posts with a sequence order. Pillar selector in the publishing editor writes back to the post row on save.

**Tech Stack:** Next.js 16, Supabase SDK (server + client), TypeScript strict, Tailwind CSS v4, Framer Motion, Lucide icons. Vitest already set up (from Brand Brain plan).

---

## File Map

**New files:**
- `supabase/migrations/20260414010000_content_architecture.sql`
- `src/app/api/content-pillars/route.ts` — GET list, POST create
- `src/app/api/content-pillars/[id]/route.ts` — DELETE
- `src/app/api/story-arcs/route.ts` — GET list, POST create
- `src/app/api/story-arcs/[id]/route.ts` — DELETE
- `src/app/api/story-arc-posts/route.ts` — POST link, DELETE unlink
- `src/components/content-arch/pillar-card.tsx`
- `src/components/content-arch/pillar-form-modal.tsx`
- `src/components/content-arch/balance-heatmap.tsx`
- `src/components/content-arch/story-arc-card.tsx`
- `src/components/content-arch/story-arc-form-modal.tsx`
- `src/app/(app)/content-architecture/page.tsx`
- `src/lib/__tests__/content-arch.test.ts`

**Modified files:**
- `src/app/(app)/publishing/page.tsx` — add pillar selector
- `src/components/layout/sidebar.tsx` — add Content Architecture nav item

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260414010000_content_architecture.sql`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/20260414010000_content_architecture.sql

CREATE TABLE public.content_pillars (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  emoji       TEXT    NOT NULL DEFAULT '📌',
  color       TEXT    NOT NULL DEFAULT '#128C7E',
  description TEXT,
  target_pct  INTEGER NOT NULL DEFAULT 20 CHECK (target_pct BETWEEN 1 AND 100),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.story_arcs (
  id          UUID   DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT   NOT NULL,
  description TEXT,
  start_date  DATE,
  end_date    DATE,
  status      TEXT   NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed')),
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.story_arc_posts (
  arc_id         UUID    NOT NULL REFERENCES public.story_arcs(id) ON DELETE CASCADE,
  post_id        UUID    NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  sequence_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (arc_id, post_id)
);

-- Add pillar_id to posts (nullable — existing posts have no pillar)
ALTER TABLE public.posts ADD COLUMN pillar_id UUID REFERENCES public.content_pillars(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE public.content_pillars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_arcs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_arc_posts  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own pillars"
  ON public.content_pillars FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own arcs"
  ON public.story_arcs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage arc posts for own arcs"
  ON public.story_arc_posts FOR ALL
  USING (EXISTS (SELECT 1 FROM public.story_arcs a WHERE a.id = arc_id AND a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.story_arcs a WHERE a.id = arc_id AND a.user_id = auth.uid()));
```

- [ ] **Step 2: Push migration**

```bash
supabase db push
```

Expected: applies cleanly with no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260414010000_content_architecture.sql
git commit -m "feat: add content_pillars, story_arcs, story_arc_posts tables"
```

---

## Task 2: Balance Heatmap Lib + Tests

**Files:**
- Create: `src/lib/__tests__/content-arch.test.ts`
- Create: `src/lib/content-arch.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/__tests__/content-arch.test.ts`:

```ts
import { computePillarBalance } from '@/lib/content-arch'

type Pillar = { id: string; name: string; target_pct: number; color: string; emoji: string }
type Post = { pillar_id: string | null }

describe('computePillarBalance', () => {
  const pillars: Pillar[] = [
    { id: 'p1', name: 'Building', target_pct: 30, color: '#128C7E', emoji: '🛠️' },
    { id: 'p2', name: 'Tips',     target_pct: 30, color: '#4A90D9', emoji: '💡' },
    { id: 'p3', name: 'Personal', target_pct: 40, color: '#C97D3A', emoji: '🧬' },
  ]

  it('computes correct actual percentages', () => {
    const posts: Post[] = [
      { pillar_id: 'p1' }, { pillar_id: 'p1' },
      { pillar_id: 'p2' },
      { pillar_id: 'p3' }, { pillar_id: 'p3' }, { pillar_id: 'p3' },
      { pillar_id: null },
    ]
    const result = computePillarBalance(pillars, posts)
    // 6 posts with a pillar: p1=2 (33%), p2=1 (17%), p3=3 (50%)
    expect(result.find(r => r.id === 'p1')!.actual_pct).toBeCloseTo(33, 0)
    expect(result.find(r => r.id === 'p2')!.actual_pct).toBeCloseTo(17, 0)
    expect(result.find(r => r.id === 'p3')!.actual_pct).toBeCloseTo(50, 0)
  })

  it('returns zero actual_pct for all pillars when no posts', () => {
    const result = computePillarBalance(pillars, [])
    result.forEach(r => expect(r.actual_pct).toBe(0))
  })

  it('marks pillar as low when actual is more than 10 points below target', () => {
    const posts: Post[] = [{ pillar_id: 'p1' }, { pillar_id: 'p1' }, { pillar_id: 'p1' }]
    const result = computePillarBalance(pillars, posts)
    // p2 has 0% actual, target 30% → gap of 30 → should be low
    expect(result.find(r => r.id === 'p2')!.status).toBe('low')
  })

  it('marks pillar as on_target when within 10 points of target', () => {
    const posts: Post[] = [
      { pillar_id: 'p1' }, { pillar_id: 'p1' }, { pillar_id: 'p1' },
      { pillar_id: 'p2' }, { pillar_id: 'p2' }, { pillar_id: 'p2' },
      { pillar_id: 'p3' }, { pillar_id: 'p3' }, { pillar_id: 'p3' }, { pillar_id: 'p3' },
    ]
    const result = computePillarBalance(pillars, posts)
    result.forEach(r => expect(r.status).toBe('on_target'))
  })
})
```

- [ ] **Step 2: Run — expect failures**

```bash
npm test
```

Expected: FAIL — `computePillarBalance` not found.

- [ ] **Step 3: Implement**

Create `src/lib/content-arch.ts`:

```ts
export type PillarInput = {
  id: string
  name: string
  target_pct: number
  color: string
  emoji: string
}

export type PostForBalance = {
  pillar_id: string | null
}

export type PillarBalanceRow = PillarInput & {
  actual_pct: number
  post_count: number
  status: 'on_target' | 'low' | 'high'
}

const GAP_THRESHOLD = 10

export function computePillarBalance(
  pillars: PillarInput[],
  posts: PostForBalance[]
): PillarBalanceRow[] {
  const tagged = posts.filter(p => p.pillar_id !== null)
  const total = tagged.length

  const counts: Record<string, number> = {}
  for (const p of tagged) {
    if (p.pillar_id) counts[p.pillar_id] = (counts[p.pillar_id] ?? 0) + 1
  }

  return pillars.map(pillar => {
    const post_count = counts[pillar.id] ?? 0
    const actual_pct = total === 0 ? 0 : Math.round((post_count / total) * 100)
    const gap = actual_pct - pillar.target_pct

    let status: PillarBalanceRow['status'] = 'on_target'
    if (gap < -GAP_THRESHOLD) status = 'low'
    else if (gap > GAP_THRESHOLD) status = 'high'

    return { ...pillar, actual_pct, post_count, status }
  })
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npm test
```

Expected: all tests pass (including Brand Brain tests from the previous plan).

- [ ] **Step 5: Commit**

```bash
git add src/lib/content-arch.ts src/lib/__tests__/content-arch.test.ts
git commit -m "feat: add computePillarBalance with full test coverage"
```

---

## Task 3: Pillar API Routes

**Files:**
- Create: `src/app/api/content-pillars/route.ts`
- Create: `src/app/api/content-pillars/[id]/route.ts`

- [ ] **Step 1: Create GET/POST route**

Create `src/app/api/content-pillars/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('content_pillars')
    .select('*')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ pillars: data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, emoji, color, description, target_pct } = body

  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const { data: existing } = await supabase
    .from('content_pillars')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if ((existing as unknown as { count: number })?.count >= 5) {
    return NextResponse.json({ error: 'Maximum 5 pillars allowed' }, { status: 422 })
  }

  const { data, error } = await supabase
    .from('content_pillars')
    .insert({ user_id: user.id, name: name.trim(), emoji: emoji ?? '📌', color: color ?? '#128C7E', description, target_pct: target_pct ?? 20 })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ pillar: data }, { status: 201 })
}
```

- [ ] **Step 2: Create DELETE route**

Create `src/app/api/content-pillars/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { error } = await supabase
    .from('content_pillars')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Verify no type errors**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/content-pillars/route.ts src/app/api/content-pillars/[id]/route.ts
git commit -m "feat: add content pillars API (GET, POST, DELETE)"
```

---

## Task 4: Story Arc API Routes

**Files:**
- Create: `src/app/api/story-arcs/route.ts`
- Create: `src/app/api/story-arcs/[id]/route.ts`
- Create: `src/app/api/story-arc-posts/route.ts`

- [ ] **Step 1: Create arc GET/POST route**

Create `src/app/api/story-arcs/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('story_arcs')
    .select(`*, story_arc_posts(post_id, sequence_order)`)
    .eq('user_id', user.id)
    .order('start_date', { ascending: true, nullsFirst: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ arcs: data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, description, start_date, end_date, status } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const { data, error } = await supabase
    .from('story_arcs')
    .insert({ user_id: user.id, name: name.trim(), description, start_date, end_date, status: status ?? 'draft' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ arc: data }, { status: 201 })
}
```

- [ ] **Step 2: Create arc DELETE route**

Create `src/app/api/story-arcs/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const allowed = ['name', 'description', 'start_date', 'end_date', 'status']
  const update: Record<string, unknown> = {}
  for (const key of allowed) if (key in body) update[key] = body[key]

  const { data, error } = await supabase
    .from('story_arcs')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ arc: data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { error } = await supabase
    .from('story_arcs')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Create arc-posts link/unlink route**

Create `src/app/api/story-arc-posts/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST: link a post to an arc
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { arc_id, post_id, sequence_order } = await req.json()
  if (!arc_id || !post_id) return NextResponse.json({ error: 'arc_id and post_id required' }, { status: 400 })

  // Verify arc belongs to user
  const { data: arc } = await supabase
    .from('story_arcs')
    .select('id')
    .eq('id', arc_id)
    .eq('user_id', user.id)
    .single()

  if (!arc) return NextResponse.json({ error: 'Arc not found' }, { status: 404 })

  const { error } = await supabase
    .from('story_arc_posts')
    .upsert({ arc_id, post_id, sequence_order: sequence_order ?? 0 })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true }, { status: 201 })
}

// DELETE: unlink a post from an arc
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { arc_id, post_id } = await req.json()

  const { error } = await supabase
    .from('story_arc_posts')
    .delete()
    .eq('arc_id', arc_id)
    .eq('post_id', post_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Verify no type errors**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/story-arcs/route.ts src/app/api/story-arcs/[id]/route.ts src/app/api/story-arc-posts/route.ts
git commit -m "feat: add story arcs API (CRUD + post linking)"
```

---

## Task 5: Components — Pillar Card and Form Modal

**Files:**
- Create: `src/components/content-arch/pillar-card.tsx`
- Create: `src/components/content-arch/pillar-form-modal.tsx`

- [ ] **Step 1: Create PillarCard**

Create `src/components/content-arch/pillar-card.tsx`:

```tsx
'use client'

import { Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'

type Pillar = {
  id: string
  name: string
  emoji: string
  color: string
  description?: string | null
  target_pct: number
}

type Props = {
  pillar: Pillar
  actualPct: number
  postCount: number
  status: 'on_target' | 'low' | 'high'
  onDelete: (id: string) => void
}

const STATUS_LABEL = { on_target: 'On target', low: '⚠ Low', high: '⚠ High' }
const STATUS_COLOR = { on_target: '#128C7E', low: '#C97D3A', high: '#E05252' }

export function PillarCard({ pillar, actualPct, postCount, status, onDelete }: Props) {
  const color = pillar.color
  const statusColor = STATUS_COLOR[status]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-xl border bg-white/[0.03] p-4 flex flex-col gap-3 relative group"
      style={{ borderColor: `${color}40` }}
    >
      <button
        onClick={() => onDelete(pillar.id)}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-red-400"
        aria-label="Delete pillar"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      <div className="flex items-center gap-2">
        <span className="text-xl">{pillar.emoji}</span>
        <div>
          <p className="text-sm font-semibold text-foreground">{pillar.name}</p>
          {pillar.description && <p className="text-xs text-slate-500">{pillar.description}</p>}
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">Actual</span>
          <span style={{ color: statusColor }}>{actualPct}% · {STATUS_LABEL[status]}</span>
        </div>
        <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: color }}
            initial={{ width: 0 }}
            animate={{ width: `${actualPct}%` }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-500">
          <span>{postCount} posts</span>
          <span>Target: {pillar.target_pct}%</span>
        </div>
      </div>
    </motion.div>
  )
}
```

- [ ] **Step 2: Create PillarFormModal**

Create `src/components/content-arch/pillar-form-modal.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

const EMOJI_OPTIONS = ['🛠️', '💡', '🧬', '🔖', '🎯', '🌱', '🎨', '📖', '🔥', '✨']
const COLOR_OPTIONS = ['#128C7E', '#4A90D9', '#C97D3A', '#9B59B6', '#E05252', '#2E5E99']

type Props = {
  open: boolean
  onClose: () => void
  onSubmit: (data: { name: string; emoji: string; color: string; description: string; target_pct: number }) => Promise<void>
}

export function PillarFormModal({ open, onClose, onSubmit }: Props) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('🛠️')
  const [color, setColor] = useState('#128C7E')
  const [description, setDescription] = useState('')
  const [targetPct, setTargetPct] = useState(20)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    await onSubmit({ name, emoji, color, description, target_pct: targetPct })
    setLoading(false)
    setName(''); setDescription(''); setEmoji('🛠️'); setColor('#128C7E'); setTargetPct(20)
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0B1020] p-6 shadow-2xl space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Add Content Pillar</h2>
              <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X className="w-4 h-4" /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Name</label>
                <input
                  value={name} onChange={e => setName(e.target.value)} required maxLength={40}
                  placeholder="e.g. Building in Public"
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-foreground placeholder:text-slate-600 focus:outline-none focus:border-[#128C7E]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Emoji</label>
                  <div className="flex flex-wrap gap-1.5">
                    {EMOJI_OPTIONS.map(e => (
                      <button key={e} type="button" onClick={() => setEmoji(e)}
                        className={`text-lg p-1 rounded-lg transition-colors ${emoji === e ? 'bg-[#128C7E]/30' : 'hover:bg-white/10'}`}
                      >{e}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Color</label>
                  <div className="flex flex-wrap gap-1.5">
                    {COLOR_OPTIONS.map(c => (
                      <button key={c} type="button" onClick={() => setColor(c)}
                        className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-white/40' : ''}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Description (optional)</label>
                <input
                  value={description} onChange={e => setDescription(e.target.value)} maxLength={100}
                  placeholder="What kind of posts go here?"
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-foreground placeholder:text-slate-600 focus:outline-none focus:border-[#128C7E]"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Target share of posts: {targetPct}%</label>
                <input type="range" min={5} max={60} step={5} value={targetPct} onChange={e => setTargetPct(Number(e.target.value))}
                  className="w-full accent-[#128C7E]" />
              </div>

              <button type="submit" disabled={loading || !name.trim()}
                className="w-full py-2.5 rounded-xl bg-[#128C7E] text-white text-sm font-medium hover:bg-[#0e7a6e] disabled:opacity-50 transition-colors">
                {loading ? 'Adding…' : 'Add Pillar'}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/content-arch/pillar-card.tsx src/components/content-arch/pillar-form-modal.tsx
git commit -m "feat: add PillarCard and PillarFormModal components"
```

---

## Task 6: Components — Balance Heatmap and Story Arc

**Files:**
- Create: `src/components/content-arch/balance-heatmap.tsx`
- Create: `src/components/content-arch/story-arc-card.tsx`
- Create: `src/components/content-arch/story-arc-form-modal.tsx`

- [ ] **Step 1: Create BalanceHeatmap**

Create `src/components/content-arch/balance-heatmap.tsx`:

```tsx
'use client'

import { motion } from 'framer-motion'
import type { PillarBalanceRow } from '@/lib/content-arch'

type Props = { rows: PillarBalanceRow[] }

const STATUS_LABEL = { on_target: 'On target', low: '⚠ Low', high: '⚠ High' }
const STATUS_COLOR = { on_target: '#128C7E', low: '#C97D3A', high: '#E05252' }

export function BalanceHeatmap({ rows }: Props) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">Add pillars to see your content balance.</p>
  }

  return (
    <div className="space-y-3">
      {rows.map(row => (
        <div key={row.id} className="flex items-center gap-3">
          <div className="w-32 flex items-center gap-1.5 shrink-0">
            <span>{row.emoji}</span>
            <span className="text-sm text-slate-300 truncate">{row.name}</span>
          </div>
          <div className="flex-1 h-7 rounded-lg bg-white/5 overflow-hidden relative">
            <motion.div
              className="h-full rounded-lg"
              style={{ backgroundColor: row.color }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(row.actual_pct, 100)}%` }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
            />
            <span className="absolute inset-y-0 left-2 flex items-center text-xs text-white font-medium">
              {row.actual_pct}%
            </span>
          </div>
          <div className="w-20 text-right shrink-0">
            <span className="text-xs" style={{ color: STATUS_COLOR[row.status] }}>
              {STATUS_LABEL[row.status]}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create StoryArcCard**

Create `src/components/content-arch/story-arc-card.tsx`:

```tsx
'use client'

import { Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'

type ArcPost = { post_id: string; sequence_order: number }
type Arc = {
  id: string
  name: string
  description?: string | null
  start_date?: string | null
  end_date?: string | null
  status: 'draft' | 'active' | 'completed'
  story_arc_posts: ArcPost[]
}

type Props = { arc: Arc; onDelete: (id: string) => void }

const STATUS_COLOR = { draft: '#888', active: '#128C7E', completed: '#4A90D9' }

export function StoryArcCard({ arc, onDelete }: Props) {
  const postCount = arc.story_arc_posts.length
  const dateRange = arc.start_date && arc.end_date
    ? `${new Date(arc.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} → ${new Date(arc.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : 'No dates set'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden group"
    >
      <div className="px-4 py-3 flex items-center justify-between border-b border-white/5"
        style={{ background: `${STATUS_COLOR[arc.status]}10` }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{arc.name}</span>
          <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ color: STATUS_COLOR[arc.status], background: `${STATUS_COLOR[arc.status]}20` }}>
            {arc.status}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">{dateRange}</span>
          <button onClick={() => onDelete(arc.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-red-400">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="px-4 py-3">
        {arc.description && <p className="text-xs text-slate-500 mb-2">{arc.description}</p>}
        <p className="text-xs text-slate-400">{postCount} post{postCount !== 1 ? 's' : ''} in this arc</p>
      </div>
    </motion.div>
  )
}
```

- [ ] **Step 3: Create StoryArcFormModal**

Create `src/components/content-arch/story-arc-form-modal.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

type Props = {
  open: boolean
  onClose: () => void
  onSubmit: (data: { name: string; description: string; start_date: string; end_date: string }) => Promise<void>
}

export function StoryArcFormModal({ open, onClose, onSubmit }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    await onSubmit({ name, description, start_date: startDate, end_date: endDate })
    setLoading(false)
    setName(''); setDescription(''); setStartDate(''); setEndDate('')
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0B1020] p-6 shadow-2xl space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Plan a Story Arc</h2>
              <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X className="w-4 h-4" /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Arc Name</label>
                <input value={name} onChange={e => setName(e.target.value)} required maxLength={80}
                  placeholder='e.g. "Launching My First Product"'
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-foreground placeholder:text-slate-600 focus:outline-none focus:border-[#128C7E]" />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Description (optional)</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} maxLength={200}
                  placeholder="What story does this arc tell?"
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-foreground placeholder:text-slate-600 focus:outline-none focus:border-[#128C7E] resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Start Date</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#128C7E]" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">End Date</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#128C7E]" />
                </div>
              </div>
              <button type="submit" disabled={loading || !name.trim()}
                className="w-full py-2.5 rounded-xl bg-[#128C7E] text-white text-sm font-medium hover:bg-[#0e7a6e] disabled:opacity-50 transition-colors">
                {loading ? 'Creating…' : 'Create Arc'}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/content-arch/balance-heatmap.tsx src/components/content-arch/story-arc-card.tsx src/components/content-arch/story-arc-form-modal.tsx
git commit -m "feat: add BalanceHeatmap, StoryArcCard, StoryArcFormModal components"
```

---

## Task 7: Content Architecture Page

**Files:**
- Create: `src/app/(app)/content-architecture/page.tsx`

- [ ] **Step 1: Create the page**

Create `src/app/(app)/content-architecture/page.tsx`:

```tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import { computePillarBalance } from '@/lib/content-arch'
import { PillarCard } from '@/components/content-arch/pillar-card'
import { PillarFormModal } from '@/components/content-arch/pillar-form-modal'
import { BalanceHeatmap } from '@/components/content-arch/balance-heatmap'
import { StoryArcCard } from '@/components/content-arch/story-arc-card'
import { StoryArcFormModal } from '@/components/content-arch/story-arc-form-modal'

type Pillar = { id: string; name: string; emoji: string; color: string; description?: string | null; target_pct: number }
type ArcPost = { post_id: string; sequence_order: number }
type Arc = { id: string; name: string; description?: string | null; start_date?: string | null; end_date?: string | null; status: 'draft' | 'active' | 'completed'; story_arc_posts: ArcPost[] }
type Post = { pillar_id: string | null }

export default function ContentArchitecturePage() {
  const [pillars, setPillars] = useState<Pillar[]>([])
  const [arcs, setArcs] = useState<Arc[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [pillarsModal, setPillarsModal] = useState(false)
  const [arcsModal, setArcsModal] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [p, a, po] = await Promise.all([
      fetch('/api/content-pillars').then(r => r.json()),
      fetch('/api/story-arcs').then(r => r.json()),
      fetch('/api/posts?limit=200').then(r => r.json()),
    ])
    setPillars(p.pillars ?? [])
    setArcs(a.arcs ?? [])
    setPosts((po.posts ?? []).map((p: { pillar_id: string | null }) => ({ pillar_id: p.pillar_id })))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleAddPillar = async (data: { name: string; emoji: string; color: string; description: string; target_pct: number }) => {
    await fetch('/api/content-pillars', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    await load()
  }

  const handleDeletePillar = async (id: string) => {
    await fetch(`/api/content-pillars/${id}`, { method: 'DELETE' })
    setPillars(prev => prev.filter(p => p.id !== id))
  }

  const handleAddArc = async (data: { name: string; description: string; start_date: string; end_date: string }) => {
    await fetch('/api/story-arcs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    await load()
  }

  const handleDeleteArc = async (id: string) => {
    await fetch(`/api/story-arcs/${id}`, { method: 'DELETE' })
    setArcs(prev => prev.filter(a => a.id !== id))
  }

  const balanceRows = computePillarBalance(pillars, posts)

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-10">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-foreground">Content Architecture</h1>
        <p className="text-sm text-slate-400 mt-1">Define your brand themes and plan multi-week story arcs.</p>
      </motion.div>

      {/* Pillars */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">Content Pillars</h2>
          {pillars.length < 5 && (
            <button onClick={() => setPillarsModal(true)}
              className="flex items-center gap-1.5 text-xs text-[#128C7E] hover:text-[#0e7a6e] transition-colors">
              <Plus className="w-3.5 h-3.5" /> Add pillar
            </button>
          )}
        </div>
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2].map(i => <div key={i} className="h-28 rounded-xl bg-white/5 animate-pulse" />)}
          </div>
        ) : pillars.length === 0 ? (
          <p className="text-sm text-slate-500">No pillars yet. Add up to 5 themes that define your brand.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {balanceRows.map(row => (
              <PillarCard key={row.id} pillar={row} actualPct={row.actual_pct} postCount={row.post_count} status={row.status} onDelete={handleDeletePillar} />
            ))}
          </div>
        )}
      </section>

      {/* Balance Heatmap */}
      {pillars.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">Content Balance</h2>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <BalanceHeatmap rows={balanceRows} />
          </div>
        </section>
      )}

      {/* Story Arcs */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">Story Arcs</h2>
          <button onClick={() => setArcsModal(true)}
            className="flex items-center gap-1.5 text-xs text-[#128C7E] hover:text-[#0e7a6e] transition-colors">
            <Plus className="w-3.5 h-3.5" /> New arc
          </button>
        </div>
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />)}
          </div>
        ) : arcs.length === 0 ? (
          <p className="text-sm text-slate-500">No arcs yet. Plan a series of connected posts that build toward a conclusion.</p>
        ) : (
          <div className="space-y-2">
            {arcs.map(arc => <StoryArcCard key={arc.id} arc={arc} onDelete={handleDeleteArc} />)}
          </div>
        )}
      </section>

      <PillarFormModal open={pillarsModal} onClose={() => setPillarsModal(false)} onSubmit={handleAddPillar} />
      <StoryArcFormModal open={arcsModal} onClose={() => setArcsModal(false)} onSubmit={handleAddArc} />
    </div>
  )
}
```

- [ ] **Step 2: Add GET /api/posts route (for balance heatmap)**

The page calls `/api/posts?limit=200`. Check if this route exists already by looking in `src/app/api/posts/`. If only `bulk-insert` exists, add a GET handler.

Create `src/app/api/posts/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limit = Number(new URL(req.url).searchParams.get('limit') ?? '50')

  const { data, error } = await supabase
    .from('posts')
    .select('id, content, status, platforms, pillar_id, scheduled_for, published_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(Math.min(limit, 500))

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ posts: data })
}
```

- [ ] **Step 3: Verify no type errors**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/(app)/content-architecture/page.tsx src/app/api/posts/route.ts
git commit -m "feat: add Content Architecture page and /api/posts GET route"
```

---

## Task 8: Publishing Editor — Pillar Selector

**Files:**
- Modify: `src/app/(app)/publishing/page.tsx`

- [ ] **Step 1: Add pillar state and fetch**

At the top of `PublishingPage`, add after existing state:

```ts
const [pillars, setPillars] = useState<{ id: string; name: string; emoji: string; color: string }[]>([])
const [selectedPillar, setSelectedPillar] = useState<string>('')

useEffect(() => {
  fetch('/api/content-pillars')
    .then(r => r.json())
    .then(data => setPillars(data.pillars ?? []))
    .catch(() => {})
}, [])
```

- [ ] **Step 2: Include pillar_id in post submission**

Find the section where the post is submitted to Supabase (the `handleSubmit` or `handlePost` function that calls `supabase.from('posts').insert(...)`). Add `pillar_id: selectedPillar || null` to the insert payload.

- [ ] **Step 3: Add the pillar selector to the JSX**

In the publishing form JSX, below the platforms selector row and above the schedule section, add:

```tsx
{pillars.length > 0 && (
  <div className="space-y-1.5">
    <p className="text-xs text-slate-400 uppercase tracking-wide">Content Pillar</p>
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => setSelectedPillar('')}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
          selectedPillar === '' ? 'border-[#128C7E] text-[#128C7E] bg-[#128C7E]/10' : 'border-white/10 text-slate-400 hover:border-white/20'
        }`}
      >
        None
      </button>
      {pillars.map(p => (
        <button
          key={p.id}
          type="button"
          onClick={() => setSelectedPillar(p.id)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border flex items-center gap-1.5 ${
            selectedPillar === p.id ? 'text-white' : 'border-white/10 text-slate-400 hover:border-white/20'
          }`}
          style={selectedPillar === p.id ? { borderColor: p.color, background: `${p.color}20`, color: p.color } : {}}
        >
          <span>{p.emoji}</span>
          <span>{p.name}</span>
        </button>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 4: Verify no type errors**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/app/(app)/publishing/page.tsx
git commit -m "feat: add pillar selector to publishing editor"
```

---

## Task 9: Sidebar — Add Content Architecture Nav Item

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

- [ ] **Step 1: Add nav item**

In `src/components/layout/sidebar.tsx`, import `Layers` from lucide-react (add to the existing import):

```ts
import { ..., Layers } from 'lucide-react'
```

Add to the `navItems` array, between Analytics and Brand Brain:

```ts
{ name: 'Content Arch',  href: '/content-architecture', icon: Layers },
```

- [ ] **Step 2: Verify no type errors**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Final build check**

```bash
npm run build
```

Expected: builds cleanly.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat: add Content Architecture to sidebar nav"
```
