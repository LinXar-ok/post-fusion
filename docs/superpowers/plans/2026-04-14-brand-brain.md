# Brand Brain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a persistent AI strategist layer that learns the user's brand from their post history, surfaces a weekly content brief, scores voice consistency on drafts, and sends smart nudges — making the app proactive rather than reactive.

**Architecture:** Nudges are computed from raw post data (no AI). Weekly briefs and voice scores call Groq via the existing `/api/ai/generate` pattern with recent posts as context. Briefs are cached in Supabase (`weekly_briefs` table) so Monday's brief is always instant. The sidebar badge reads the unread count from the brief table.

**Tech Stack:** Next.js 16, Supabase SDK (server + client), Groq SDK (`groq-sdk`), Vitest for lib unit tests, Tailwind CSS v4, Framer Motion, Lucide icons.

---

## File Map

**New files:**
- `vitest.config.ts` — test runner config
- `supabase/migrations/20260414000000_brand_brain.sql` — new tables
- `src/lib/brand-brain.ts` — pure functions: `computeNudges`, `buildBriefContext`
- `src/lib/__tests__/brand-brain.test.ts` — unit tests for pure functions
- `src/app/api/brand-brain/nudges/route.ts` — GET active nudges
- `src/app/api/brand-brain/dismiss-nudge/route.ts` — POST dismiss a nudge
- `src/app/api/brand-brain/brief/route.ts` — GET latest brief (generates if none)
- `src/app/api/brand-brain/voice-score/route.ts` — POST voice consistency score
- `src/app/api/cron/generate-brief/route.ts` — weekly cron trigger
- `src/components/brand-brain/voice-score-meter.tsx` — score ring + feedback
- `src/components/brand-brain/nudge-list.tsx` — dismissible nudge cards
- `src/components/brand-brain/weekly-brief-card.tsx` — brief panel with ideas
- `src/app/(app)/brand-brain/page.tsx` — main Brand Brain page

**Modified files:**
- `src/components/layout/sidebar.tsx` — add Brand Brain nav item + unread badge
- `src/app/(app)/publishing/page.tsx` — add debounced voice score panel
- `vercel.json` — add weekly brief cron job

---

## Task 1: Set Up Vitest

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (add test script)

- [ ] **Step 1: Install Vitest**

```bash
cd "/Users/linuxkexordzu/Personal Projects/SOCIAL"
npm install -D vitest @vitejs/plugin-react
```

Expected: vitest added to devDependencies.

- [ ] **Step 2: Create vitest.config.ts**

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 3: Add test script to package.json**

In `package.json`, inside `"scripts"`, add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Write a smoke test to verify setup**

Create `src/lib/__tests__/brand-brain.test.ts`:

```ts
describe('brand-brain (placeholder)', () => {
  it('true is true', () => {
    expect(true).toBe(true)
  })
})
```

- [ ] **Step 5: Run test to confirm Vitest works**

```bash
npm test
```

Expected output:
```
✓ src/lib/__tests__/brand-brain.test.ts (1)
Test Files  1 passed (1)
```

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts package.json src/lib/__tests__/brand-brain.test.ts
git commit -m "chore: add Vitest test runner"
```

---

## Task 2: Database Migration

**Files:**
- Create: `supabase/migrations/20260414000000_brand_brain.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260414000000_brand_brain.sql

-- Weekly AI-generated content briefs (cached so page load is instant)
CREATE TABLE public.weekly_briefs (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start  DATE        NOT NULL,
  summary     TEXT        NOT NULL,
  insights    JSONB       NOT NULL DEFAULT '[]',
  post_ideas  JSONB       NOT NULL DEFAULT '[]',
  actions     JSONB       NOT NULL DEFAULT '[]',
  status      TEXT        NOT NULL DEFAULT 'unread',
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, week_start)
);

-- Tracks which nudge types a user has dismissed (so they don't recur)
CREATE TABLE public.dismissed_nudges (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nudge_type   TEXT        NOT NULL,
  dismissed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, nudge_type)
);

-- RLS: users see only their own rows
ALTER TABLE public.weekly_briefs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dismissed_nudges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own briefs"
  ON public.weekly_briefs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own dismissed nudges"
  ON public.dismissed_nudges FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

- [ ] **Step 2: Push migration to Supabase**

```bash
cd "/Users/linuxkexordzu/Personal Projects/SOCIAL"
supabase db push
```

Expected: migration applies cleanly, no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260414000000_brand_brain.sql
git commit -m "feat: add weekly_briefs and dismissed_nudges tables"
```

---

## Task 3: Brand Brain Lib — computeNudges

**Files:**
- Create: `src/lib/brand-brain.ts`
- Modify: `src/lib/__tests__/brand-brain.test.ts`

- [ ] **Step 1: Write the failing tests for computeNudges**

Replace `src/lib/__tests__/brand-brain.test.ts` with:

```ts
import { computeNudges } from '@/lib/brand-brain'

type Post = {
  content: string
  media_urls?: string[] | null
  status: string
  scheduled_for?: string | null
  created_at: string
}

const NOW = new Date('2026-04-14T10:00:00Z').getTime()

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    content: 'Test post',
    media_urls: null,
    status: 'published',
    scheduled_for: null,
    created_at: new Date(NOW - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    ...overrides,
  }
}

describe('computeNudges', () => {
  it('returns no_photo nudge when last photo post was more than 11 days ago', () => {
    const posts: Post[] = [
      makePost({ media_urls: ['img.jpg'], created_at: new Date(NOW - 12 * 24 * 60 * 60 * 1000).toISOString() }),
      makePost({ content: 'text post' }),
    ]
    const nudges = computeNudges(posts, NOW)
    expect(nudges.some(n => n.type === 'no_photo')).toBe(true)
  })

  it('does not return no_photo nudge when a photo was posted within 11 days', () => {
    const posts: Post[] = [
      makePost({ media_urls: ['img.jpg'], created_at: new Date(NOW - 5 * 24 * 60 * 60 * 1000).toISOString() }),
    ]
    const nudges = computeNudges(posts, NOW)
    expect(nudges.some(n => n.type === 'no_photo')).toBe(false)
  })

  it('returns undrafted_ideas nudge when 3 or more drafts exist', () => {
    const posts: Post[] = [
      makePost({ status: 'draft' }),
      makePost({ status: 'draft' }),
      makePost({ status: 'draft' }),
    ]
    const nudges = computeNudges(posts, NOW)
    expect(nudges.some(n => n.type === 'undrafted_ideas')).toBe(true)
  })

  it('does not return undrafted_ideas nudge when fewer than 3 drafts', () => {
    const posts: Post[] = [
      makePost({ status: 'draft' }),
      makePost({ status: 'draft' }),
    ]
    const nudges = computeNudges(posts, NOW)
    expect(nudges.some(n => n.type === 'undrafted_ideas')).toBe(false)
  })

  it('returns no nudges for an active user with recent photo and few drafts', () => {
    const posts: Post[] = [
      makePost({ media_urls: ['img.jpg'], created_at: new Date(NOW - 3 * 24 * 60 * 60 * 1000).toISOString() }),
      makePost({ status: 'draft' }),
    ]
    const nudges = computeNudges(posts, NOW)
    expect(nudges).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npm test
```

Expected: FAIL — `computeNudges` not found.

- [ ] **Step 3: Implement computeNudges in brand-brain.ts**

Create `src/lib/brand-brain.ts`:

```ts
export type NudgePost = {
  content: string
  media_urls?: string[] | null
  status: string
  scheduled_for?: string | null
  created_at: string
}

export type Nudge = {
  type: 'no_photo' | 'undrafted_ideas'
  message: string
}

const PHOTO_THRESHOLD_DAYS = 11

export function computeNudges(posts: NudgePost[], nowMs: number = Date.now()): Nudge[] {
  const nudges: Nudge[] = []

  // No photo nudge — checks published + scheduled posts only
  const activePosts = posts.filter(p => p.status === 'published' || p.status === 'scheduled')
  const photoPost = activePosts
    .filter(p => p.media_urls && p.media_urls.length > 0)
    .sort((a, b) => {
      const ta = new Date(a.scheduled_for ?? a.created_at).getTime()
      const tb = new Date(b.scheduled_for ?? b.created_at).getTime()
      return tb - ta
    })[0]

  if (!photoPost) {
    nudges.push({ type: 'no_photo', message: "You haven't posted a photo yet — visual posts get more reach." })
  } else {
    const lastPhotoMs = new Date(photoPost.scheduled_for ?? photoPost.created_at).getTime()
    const daysSince = Math.floor((nowMs - lastPhotoMs) / (1000 * 60 * 60 * 24))
    if (daysSince >= PHOTO_THRESHOLD_DAYS) {
      nudges.push({ type: 'no_photo', message: `No photo post in ${daysSince} days — visual content boosts reach.` })
    }
  }

  // Undrafted ideas nudge
  const draftCount = posts.filter(p => p.status === 'draft').length
  if (draftCount >= 3) {
    nudges.push({ type: 'undrafted_ideas', message: `${draftCount} draft posts sitting unpublished — pick one and schedule it.` })
  }

  return nudges
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm test
```

Expected:
```
✓ src/lib/__tests__/brand-brain.test.ts (5)
Test Files  1 passed (1)
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/brand-brain.ts src/lib/__tests__/brand-brain.test.ts
git commit -m "feat: add computeNudges with full test coverage"
```

---

## Task 4: Brand Brain Lib — buildBriefContext

**Files:**
- Modify: `src/lib/brand-brain.ts`
- Modify: `src/lib/__tests__/brand-brain.test.ts`

- [ ] **Step 1: Write failing test for buildBriefContext**

Append to `src/lib/__tests__/brand-brain.test.ts`:

```ts
import { buildBriefContext } from '@/lib/brand-brain'

describe('buildBriefContext', () => {
  it('returns a non-empty string from an array of post contents', () => {
    const posts = ['Post about my morning', 'Thoughts on building in public', 'A lesson I learned']
    const ctx = buildBriefContext(posts)
    expect(typeof ctx).toBe('string')
    expect(ctx.length).toBeGreaterThan(0)
    expect(ctx).toContain('Post about my morning')
  })

  it('caps to 20 posts to stay within token limits', () => {
    const posts = Array.from({ length: 30 }, (_, i) => `Post number ${i}`)
    const ctx = buildBriefContext(posts)
    // 20 posts joined with separator = 19 occurrences of '---'
    const separatorCount = (ctx.match(/---/g) ?? []).length
    expect(separatorCount).toBe(19)
  })
})
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npm test
```

Expected: FAIL — `buildBriefContext` not found.

- [ ] **Step 3: Implement buildBriefContext**

Append to `src/lib/brand-brain.ts`:

```ts
/**
 * Builds a compact text context block from recent post contents for Groq prompts.
 * Caps at 20 posts to stay well within token limits.
 */
export function buildBriefContext(postContents: string[]): string {
  return postContents.slice(0, 20).join('\n---\n')
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm test
```

Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/brand-brain.ts src/lib/__tests__/brand-brain.test.ts
git commit -m "feat: add buildBriefContext helper"
```

---

## Task 5: API Route — GET /api/brand-brain/nudges

**Files:**
- Create: `src/app/api/brand-brain/nudges/route.ts`
- Create: `src/app/api/brand-brain/dismiss-nudge/route.ts`

- [ ] **Step 1: Create the nudges GET route**

Create `src/app/api/brand-brain/nudges/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeNudges, type NudgePost } from '@/lib/brand-brain'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch last 60 days of posts
  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
  const { data: posts, error } = await supabase
    .from('posts')
    .select('content, media_urls, status, scheduled_for, created_at')
    .eq('user_id', user.id)
    .gte('created_at', since)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch dismissed nudge types for this user
  const { data: dismissed } = await supabase
    .from('dismissed_nudges')
    .select('nudge_type')
    .eq('user_id', user.id)

  const dismissedTypes = new Set((dismissed ?? []).map(d => d.nudge_type))

  const allNudges = computeNudges((posts ?? []) as NudgePost[])
  const active = allNudges.filter(n => !dismissedTypes.has(n.type))

  return NextResponse.json({ nudges: active })
}
```

- [ ] **Step 2: Create the dismiss-nudge POST route**

Create `src/app/api/brand-brain/dismiss-nudge/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { nudge_type } = await req.json()
  if (!nudge_type) return NextResponse.json({ error: 'nudge_type required' }, { status: 400 })

  const { error } = await supabase
    .from('dismissed_nudges')
    .upsert({ user_id: user.id, nudge_type, dismissed_at: new Date().toISOString() })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Manually test the route**

Start dev server and verify:

```bash
npm run dev
```

Open a new terminal:
```bash
curl -s http://localhost:3000/api/brand-brain/nudges
```

Expected: `{"error":"Unauthorized"}` (not authenticated — that's correct).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/brand-brain/nudges/route.ts src/app/api/brand-brain/dismiss-nudge/route.ts
git commit -m "feat: add nudges API routes"
```

---

## Task 6: API Route — POST /api/brand-brain/voice-score

**Files:**
- Create: `src/app/api/brand-brain/voice-score/route.ts`

- [ ] **Step 1: Create the voice-score route**

Create `src/app/api/brand-brain/voice-score/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildBriefContext } from '@/lib/brand-brain'
import Groq from 'groq-sdk'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 503 })
  }

  const { content } = await req.json()
  if (!content || content.length < 20) {
    return NextResponse.json({ score: null, traits: [], flags: [] })
  }

  // Fetch last 15 published posts for context
  const { data: posts } = await supabase
    .from('posts')
    .select('content')
    .eq('user_id', user.id)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(15)

  const postContents = (posts ?? []).map(p => p.content)

  if (postContents.length < 3) {
    // Not enough history to score — return null so UI shows nothing
    return NextResponse.json({ score: null, traits: [], flags: [] })
  }

  const context = buildBriefContext(postContents)
  const prompt = `You are a brand voice analyst. Here are someone's recent social media posts (newest first):\n\n${context}\n\n---\n\nNow rate this new draft on brand voice consistency with those posts. Return ONLY valid JSON with no markdown:\n{"score": <integer 0-100>, "traits": [<2-3 positive traits from their established voice>], "flags": [<0-2 ways this draft diverges, or empty array if consistent>]}\n\nDraft to score:\n"${content}"`

  const client = new Groq({ apiKey: process.env.GROQ_API_KEY })

  try {
    const completion = await client.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = completion.choices[0]?.message?.content?.trim() ?? '{}'
    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const result = JSON.parse(cleaned)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ score: null, traits: [], flags: [] })
  }
}
```

- [ ] **Step 2: Verify the route file is syntax-valid**

```bash
npx tsc --noEmit
```

Expected: no errors related to the new file.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/brand-brain/voice-score/route.ts
git commit -m "feat: add voice-score API route"
```

---

## Task 7: API Route — GET /api/brand-brain/brief

**Files:**
- Create: `src/app/api/brand-brain/brief/route.ts`

- [ ] **Step 1: Create the brief GET route**

Create `src/app/api/brand-brain/brief/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildBriefContext } from '@/lib/brand-brain'
import Groq from 'groq-sdk'

function getWeekStart(date: Date): string {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  // Roll back to Monday
  const day = d.getUTCDay()
  const diff = (day === 0 ? -6 : 1 - day)
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().split('T')[0]
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const weekStart = getWeekStart(new Date())

  // Return cached brief if it exists for this week
  const { data: existing } = await supabase
    .from('weekly_briefs')
    .select('*')
    .eq('user_id', user.id)
    .eq('week_start', weekStart)
    .single()

  if (existing) {
    // Mark as read
    if (existing.status === 'unread') {
      await supabase
        .from('weekly_briefs')
        .update({ status: 'read' })
        .eq('id', existing.id)
    }
    return NextResponse.json({ brief: existing })
  }

  // No cached brief — generate one now
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ brief: null })
  }

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: posts } = await supabase
    .from('posts')
    .select('content, status, platforms, created_at')
    .eq('user_id', user.id)
    .in('status', ['published', 'scheduled'])
    .gte('created_at', since)
    .order('created_at', { ascending: false })

  if (!posts || posts.length < 3) {
    return NextResponse.json({ brief: null })
  }

  const context = buildBriefContext(posts.map(p => p.content))
  const prompt = `You are a personal brand strategist. Here are someone's last 30 days of social media posts:\n\n${context}\n\nGenerate a weekly content brief. Return ONLY valid JSON with no markdown:\n{"summary": "<2-3 sentence plain-English summary of what's working and what's missing>", "insights": [{"type": "positive|gap", "text": "<specific insight>"}], "post_ideas": [{"pillar": "<Personal Story|Behind the Scenes|Tips & Insights|Curated>", "hook": "<compelling opening line for a post>"}], "actions": ["<specific actionable instruction>"]}\n\nInclude exactly 2 insights, 3 post_ideas, and 3 actions. Make everything specific to these posts — no generic advice.`

  const client = new Groq({ apiKey: process.env.GROQ_API_KEY })

  try {
    const completion = await client.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = completion.choices[0]?.message?.content?.trim() ?? '{}'
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const result = JSON.parse(cleaned)

    const { data: brief } = await supabase
      .from('weekly_briefs')
      .insert({
        user_id: user.id,
        week_start: weekStart,
        summary: result.summary ?? '',
        insights: result.insights ?? [],
        post_ideas: result.post_ideas ?? [],
        actions: result.actions ?? [],
        status: 'read', // generated on-demand = already being viewed
      })
      .select()
      .single()

    return NextResponse.json({ brief })
  } catch {
    return NextResponse.json({ brief: null })
  }
}
```

- [ ] **Step 2: Verify no type errors**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/brand-brain/brief/route.ts
git commit -m "feat: add weekly brief API route with Groq generation and Supabase caching"
```

---

## Task 8: Cron — Weekly Brief Generation

**Files:**
- Create: `src/app/api/cron/generate-brief/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Create the cron route**

Create `src/app/api/cron/generate-brief/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildBriefContext } from '@/lib/brand-brain'
import Groq from 'groq-sdk'

function getWeekStart(date: Date): string {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  const day = d.getUTCDay()
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day))
  return d.toISOString().split('T')[0]
}

export async function POST(req: NextRequest) {
  // Verify cron secret in production
  const secret = req.headers.get('x-cron-secret')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 503 })
  }

  const supabase = await createClient()
  const weekStart = getWeekStart(new Date())

  // Get all users who have posts in the last 30 days
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: activeUsers } = await supabase
    .from('posts')
    .select('user_id')
    .gte('created_at', since)
    .in('status', ['published', 'scheduled'])

  const userIds = [...new Set((activeUsers ?? []).map(r => r.user_id))]

  // Skip users who already have a brief for this week
  const { data: existing } = await supabase
    .from('weekly_briefs')
    .select('user_id')
    .eq('week_start', weekStart)
    .in('user_id', userIds)

  const alreadyGenerated = new Set((existing ?? []).map(r => r.user_id))
  const toGenerate = userIds.filter(id => !alreadyGenerated.has(id))

  const client = new Groq({ apiKey: process.env.GROQ_API_KEY })
  let generated = 0

  for (const userId of toGenerate) {
    const { data: posts } = await supabase
      .from('posts')
      .select('content')
      .eq('user_id', userId)
      .in('status', ['published', 'scheduled'])
      .gte('created_at', since)
      .order('created_at', { ascending: false })

    if (!posts || posts.length < 3) continue

    const context = buildBriefContext(posts.map(p => p.content))
    const prompt = `You are a personal brand strategist. Here are someone's last 30 days of social media posts:\n\n${context}\n\nGenerate a weekly content brief. Return ONLY valid JSON with no markdown:\n{"summary": "<2-3 sentence plain-English summary of what's working and what's missing>", "insights": [{"type": "positive|gap", "text": "<specific insight>"}], "post_ideas": [{"pillar": "<Personal Story|Behind the Scenes|Tips & Insights|Curated>", "hook": "<compelling opening line for a post>"}], "actions": ["<specific actionable instruction>"]}\n\nInclude exactly 2 insights, 3 post_ideas, and 3 actions. Be specific to these posts.`

    try {
      const completion = await client.chat.completions.create({
        model: 'openai/gpt-oss-120b',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      })

      const raw = completion.choices[0]?.message?.content?.trim() ?? '{}'
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
      const result = JSON.parse(cleaned)

      await supabase.from('weekly_briefs').insert({
        user_id: userId,
        week_start: weekStart,
        summary: result.summary ?? '',
        insights: result.insights ?? [],
        post_ideas: result.post_ideas ?? [],
        actions: result.actions ?? [],
        status: 'unread',
      })

      generated++
    } catch {
      // Skip failed users, don't abort the whole batch
      continue
    }
  }

  return NextResponse.json({ generated, skipped: toGenerate.length - generated })
}
```

- [ ] **Step 2: Add cron to vercel.json**

Edit `vercel.json` to:

```json
{
  "crons": [
    {
      "path": "/api/cron/process-queue",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/cron/refresh-tokens",
      "schedule": "0 3 * * *"
    },
    {
      "path": "/api/cron/generate-brief",
      "schedule": "0 7 * * 1"
    }
  ]
}
```

(Runs at 7am every Monday.)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/generate-brief/route.ts vercel.json
git commit -m "feat: add weekly brief cron job (Mondays 7am)"
```

---

## Task 9: Component — VoiceScoreMeter

**Files:**
- Create: `src/components/brand-brain/voice-score-meter.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/brand-brain/voice-score-meter.tsx`:

```tsx
'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

type Props = {
  score: number | null
  traits: string[]
  flags: string[]
  loading?: boolean
}

export function VoiceScoreMeter({ score, traits, flags, loading }: Props) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400 animate-pulse">
        <div className="w-3 h-3 rounded-full bg-slate-600" />
        Scoring voice…
      </div>
    )
  }

  if (score === null) return null

  const color = score >= 80 ? '#128C7E' : score >= 60 ? '#C97D3A' : '#E05252'
  const label = score >= 80 ? 'On-brand' : score >= 60 ? 'Slightly off' : 'Off-brand'

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400 uppercase tracking-wide">Brand Voice</span>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold" style={{ color }}>{score}</span>
          <span className="text-xs" style={{ color }}>{label}</span>
        </div>
      </div>

      {/* Score bar */}
      <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>

      {traits.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {traits.map(t => (
            <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-slate-400">
              ↑ {t}
            </span>
          ))}
          {flags.map(f => (
            <span key={f} className={cn('text-xs px-2 py-0.5 rounded-full bg-white/5')} style={{ color: '#C97D3A' }}>
              ↓ {f}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  )
}
```

- [ ] **Step 2: Verify no type errors**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/brand-brain/voice-score-meter.tsx
git commit -m "feat: add VoiceScoreMeter component"
```

---

## Task 10: Component — NudgeList

**Files:**
- Create: `src/components/brand-brain/nudge-list.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/brand-brain/nudge-list.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

type Nudge = { type: string; message: string }

type Props = {
  nudges: Nudge[]
  onDismiss: (type: string) => Promise<void>
}

export function NudgeList({ nudges, onDismiss }: Props) {
  const [dismissing, setDismissing] = useState<string | null>(null)

  const handleDismiss = async (type: string) => {
    setDismissing(type)
    await onDismiss(type)
    setDismissing(null)
  }

  if (nudges.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No nudges right now — you're on track.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <AnimatePresence mode="popLayout">
        {nudges.map(n => (
          <motion.div
            key={n.type}
            layout
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3"
          >
            <p className="text-sm text-slate-300 leading-snug">{n.message}</p>
            <button
              onClick={() => handleDismiss(n.type)}
              disabled={dismissing === n.type}
              className="text-slate-500 hover:text-slate-300 transition-colors shrink-0 mt-0.5"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/brand-brain/nudge-list.tsx
git commit -m "feat: add NudgeList component"
```

---

## Task 11: Component — WeeklyBriefCard

**Files:**
- Create: `src/components/brand-brain/weekly-brief-card.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/brand-brain/weekly-brief-card.tsx`:

```tsx
'use client'

import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'

type Insight = { type: 'positive' | 'gap'; text: string }
type PostIdea = { pillar: string; hook: string }

type Brief = {
  summary: string
  insights: Insight[]
  post_ideas: PostIdea[]
  actions: string[]
}

type Props = {
  brief: Brief | null
  loading: boolean
}

export function WeeklyBriefCard({ brief, loading }: Props) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-[#128C7E]/20 bg-[#128C7E]/5 p-5 space-y-3 animate-pulse">
        <div className="h-4 bg-white/10 rounded w-3/4" />
        <div className="h-4 bg-white/10 rounded w-1/2" />
        <div className="h-4 bg-white/10 rounded w-2/3" />
      </div>
    )
  }

  if (!brief) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
        <p className="text-sm text-slate-500">
          Publish at least 3 posts to unlock your first Brand Brain brief.
        </p>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-[#128C7E]/30 bg-[#128C7E]/[0.07] p-5 space-y-4"
    >
      {/* Summary */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-[#128C7E]" />
          <span className="text-xs uppercase tracking-widest text-[#128C7E]">This Week's Brief</span>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed">{brief.summary}</p>
      </div>

      {/* Insights */}
      {brief.insights.length > 0 && (
        <div className="space-y-1.5">
          {brief.insights.map((ins, i) => (
            <div key={i} className="flex gap-2 text-sm">
              <span>{ins.type === 'positive' ? '✦' : '◌'}</span>
              <span className={ins.type === 'positive' ? 'text-slate-300' : 'text-slate-400'}>{ins.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {brief.actions.length > 0 && (
        <div className="space-y-2 pt-1 border-t border-white/10">
          <p className="text-xs uppercase tracking-widest text-slate-500">Your 3 Actions</p>
          {brief.actions.map((action, i) => (
            <div key={i} className="flex gap-3 items-start">
              <span className="w-5 h-5 rounded-full bg-[#128C7E]/20 text-[#128C7E] text-xs flex items-center justify-center shrink-0 mt-0.5 font-medium">
                {i + 1}
              </span>
              <p className="text-sm text-slate-300 leading-snug">{action}</p>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/brand-brain/weekly-brief-card.tsx
git commit -m "feat: add WeeklyBriefCard component"
```

---

## Task 12: Component — PostIdeasGrid

**Files:**
- Create: `src/components/brand-brain/post-ideas-grid.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/brand-brain/post-ideas-grid.tsx`:

```tsx
'use client'

import { motion } from 'framer-motion'
import { PenSquare } from 'lucide-react'
import Link from 'next/link'

type PostIdea = { pillar: string; hook: string }

type Props = { ideas: PostIdea[] }

const PILLAR_COLORS: Record<string, string> = {
  'Personal Story':   '#C97D3A',
  'Behind the Scenes': '#128C7E',
  'Tips & Insights':  '#4A90D9',
  'Curated':          '#9B59B6',
}

export function PostIdeasGrid({ ideas }: Props) {
  if (ideas.length === 0) return null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {ideas.map((idea, i) => {
        const color = PILLAR_COLORS[idea.pillar] ?? '#7BA4D0'
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex flex-col gap-3"
          >
            <span
              className="text-xs px-2 py-0.5 rounded-full self-start font-medium"
              style={{ color, background: `${color}20` }}
            >
              {idea.pillar}
            </span>
            <p className="text-sm text-slate-300 leading-snug flex-1">{idea.hook}</p>
            <Link
              href={`/publishing?draft=${encodeURIComponent(idea.hook)}`}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#128C7E] transition-colors mt-auto"
            >
              <PenSquare className="w-3 h-3" />
              Draft this
            </Link>
          </motion.div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/brand-brain/post-ideas-grid.tsx
git commit -m "feat: add PostIdeasGrid component"
```

---

## Task 13: Brand Brain Page

**Files:**
- Create: `src/app/(app)/brand-brain/page.tsx`

- [ ] **Step 1: Create the page**

Create `src/app/(app)/brand-brain/page.tsx`:

```tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { WeeklyBriefCard } from '@/components/brand-brain/weekly-brief-card'
import { NudgeList } from '@/components/brand-brain/nudge-list'
import { PostIdeasGrid } from '@/components/brand-brain/post-ideas-grid'

type Nudge = { type: string; message: string }
type Brief = {
  id: string
  summary: string
  insights: { type: 'positive' | 'gap'; text: string }[]
  post_ideas: { pillar: string; hook: string }[]
  actions: string[]
}

export default function BrandBrainPage() {
  const [brief, setBrief] = useState<Brief | null>(null)
  const [nudges, setNudges] = useState<Nudge[]>([])
  const [briefLoading, setBriefLoading] = useState(true)
  const [nudgesLoading, setNudgesLoading] = useState(true)

  useEffect(() => {
    fetch('/api/brand-brain/brief')
      .then(r => r.json())
      .then(data => { setBrief(data.brief); setBriefLoading(false) })
      .catch(() => setBriefLoading(false))

    fetch('/api/brand-brain/nudges')
      .then(r => r.json())
      .then(data => { setNudges(data.nudges ?? []); setNudgesLoading(false) })
      .catch(() => setNudgesLoading(false))
  }, [])

  const handleDismiss = useCallback(async (type: string) => {
    await fetch('/api/brand-brain/dismiss-nudge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nudge_type: type }),
    })
    setNudges(prev => prev.filter(n => n.type !== type))
  }, [])

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-foreground">Brand Brain</h1>
        <p className="text-sm text-slate-400 mt-1">
          Your personal brand strategist — learns from your posts, tells you what to do next.
        </p>
      </motion.div>

      {/* Weekly Brief */}
      <section>
        <WeeklyBriefCard brief={brief} loading={briefLoading} />
      </section>

      {/* Post Ideas */}
      {!briefLoading && brief && brief.post_ideas.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-widest text-slate-500">Suggested Post Ideas</h2>
          <PostIdeasGrid ideas={brief.post_ideas} />
        </section>
      )}

      {/* Nudges */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-widest text-slate-500">Smart Nudges</h2>
        {nudgesLoading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-10 bg-white/5 rounded-xl" />
            <div className="h-10 bg-white/5 rounded-xl" />
          </div>
        ) : (
          <NudgeList nudges={nudges} onDismiss={handleDismiss} />
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Verify the page renders without type errors**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/brand-brain/page.tsx
git commit -m "feat: add Brand Brain page"
```

---

## Task 14: Sidebar — Add Brand Brain Nav Item with Badge

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

- [ ] **Step 1: Update the sidebar**

Replace the contents of `src/components/layout/sidebar.tsx` with:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Calendar, Inbox, LayoutDashboard, Settings, Activity,
  PenSquare, Sparkles, Image as ImageIcon, Radio, Brain,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { name: 'Dashboard',     href: '/',             icon: LayoutDashboard },
  { name: 'Publishing',    href: '/publishing',    icon: PenSquare },
  { name: 'Media Library', href: '/media',         icon: ImageIcon },
  { name: 'Calendar',      href: '/calendar',      icon: Calendar },
  { name: 'Inbox',         href: '/inbox',         icon: Inbox },
  { name: 'Listening',     href: '/listening',     icon: Radio },
  { name: 'Analytics',     href: '/analytics',     icon: Activity },
  { name: 'Brand Brain',   href: '/brand-brain',   icon: Brain },
  { name: 'Settings',      href: '/settings',      icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const [unreadBriefs, setUnreadBriefs] = useState(0)

  useEffect(() => {
    // Poll for unread brief count (lightweight — no AI call)
    fetch('/api/brand-brain/brief?meta=true')
      .then(r => r.json())
      .then(data => setUnreadBriefs(data.unread ?? 0))
      .catch(() => {})
  }, [pathname])

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <aside
      className="w-64 h-screen hidden md:flex flex-col shrink-0 z-20 relative"
      style={{ background: 'var(--nm-bg)' }}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-5">
        <div
          className="flex items-center gap-2.5 rounded-xl px-3 py-2 bg-[var(--nm-bg)]"
          style={{ boxShadow: 'var(--nm-raised-sm)' }}
        >
          <div
            className="w-7 h-7 rounded-lg bg-[#2E5E99] flex items-center justify-center shrink-0"
            style={{ boxShadow: 'var(--nm-inset-sm)' }}
          >
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-display text-sm font-bold tracking-tight text-[#0D2440] dark:text-foreground leading-none">
            LinXar Ops
          </span>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-4 py-3 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const active = isActive(item.href)
          const isBrain = item.href === '/brand-brain'
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200 bg-[var(--nm-bg)]',
                active
                  ? 'text-[#2E5E99]'
                  : 'text-slate-500 dark:text-slate-400 hover:text-[#0D2440] dark:hover:text-foreground'
              )}
              style={{ boxShadow: active ? 'var(--nm-inset-sm)' : undefined }}
            >
              <item.icon
                className={cn(
                  'h-4 w-4 shrink-0 transition-colors',
                  active ? 'text-[#2E5E99]' : 'text-slate-400 dark:text-slate-500'
                )}
              />
              <span>{item.name}</span>
              {active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#2E5E99] shrink-0 nm-pulse" />
              )}
              {!active && isBrain && unreadBriefs > 0 && (
                <span className="ml-auto h-4 w-4 rounded-full bg-[#128C7E] text-white text-[9px] flex items-center justify-center shrink-0 font-bold">
                  {unreadBriefs}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom teal accent */}
      <div
        className="h-px mx-5 mb-5"
        style={{
          background: 'linear-gradient(to right, transparent, rgba(46,94,153,0.4), transparent)',
        }}
      />
    </aside>
  )
}
```

- [ ] **Step 2: Add `?meta=true` support to the brief route**

Edit `src/app/api/brand-brain/brief/route.ts`. Replace the `GET` function opening with:

```ts
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ?meta=true — return only unread count, no generation
  const meta = new URL(req.url).searchParams.get('meta')
  if (meta === 'true') {
    const { count } = await supabase
      .from('weekly_briefs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'unread')
    return NextResponse.json({ unread: count ?? 0 })
  }
  // ... rest of the existing function unchanged
```

Also update the import at the top of that file to include `NextRequest`:
```ts
import { NextRequest, NextResponse } from 'next/server'
```

- [ ] **Step 3: Verify no type errors**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/sidebar.tsx src/app/api/brand-brain/brief/route.ts
git commit -m "feat: add Brand Brain to sidebar with unread brief badge"
```

---

## Task 15: Publishing Editor — Voice Score Panel

**Files:**
- Modify: `src/app/(app)/publishing/page.tsx`

- [ ] **Step 1: Add VoiceScoreMeter import and state**

At the top of `src/app/(app)/publishing/page.tsx`, add to existing imports:

```ts
import { VoiceScoreMeter } from "@/components/brand-brain/voice-score-meter"
import { useEffect, useRef as _useRef } from "react"
```

Inside `PublishingPage`, add these state variables after the existing `useState` declarations:

```ts
const [voiceScore, setVoiceScore] = useState<{ score: number | null; traits: string[]; flags: string[] } | null>(null)
const [voiceLoading, setVoiceLoading] = useState(false)
const voiceDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
```

- [ ] **Step 2: Add the debounced voice score effect**

After the existing state declarations, add this `useEffect`:

```ts
useEffect(() => {
  if (voiceDebounceRef.current) clearTimeout(voiceDebounceRef.current)
  if (content.length < 80) {
    setVoiceScore(null)
    return
  }
  setVoiceLoading(true)
  voiceDebounceRef.current = setTimeout(async () => {
    try {
      const res = await fetch('/api/brand-brain/voice-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      const data = await res.json()
      setVoiceScore(data)
    } catch {
      setVoiceScore(null)
    } finally {
      setVoiceLoading(false)
    }
  }, 1200)
}, [content])
```

- [ ] **Step 3: Render VoiceScoreMeter below the textarea**

In the JSX, find the textarea that binds to `content`. Directly after the `</textarea>` closing tag (or after the div wrapping it), add:

```tsx
<VoiceScoreMeter
  score={voiceScore?.score ?? null}
  traits={voiceScore?.traits ?? []}
  flags={voiceScore?.flags ?? []}
  loading={voiceLoading}
/>
```

- [ ] **Step 4: Verify no type errors**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Smoke test — open the publishing page in dev**

```bash
npm run dev
```

Navigate to `http://localhost:3000/publishing`, type more than 80 characters into the content field, wait ~1.2 seconds. The voice score meter should appear (or show loading state).

- [ ] **Step 6: Commit**

```bash
git add src/app/(app)/publishing/page.tsx
git commit -m "feat: add live voice score to publishing editor"
```

---

## Task 16: Final Build Check

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 2: Run TypeScript compiler check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run production build**

```bash
npm run build
```

Expected: builds cleanly with no errors. Note any warnings but don't fail on them.

- [ ] **Step 4: Final commit if any lint fixes needed**

```bash
npm run lint -- --fix
git add -A
git commit -m "chore: lint fixes for Brand Brain feature"
```

Only run this step if lint found issues in Step 3.

---

## What's Next

After Brand Brain ships, the next plans in sequence are:

- **Plan 2:** Content Architecture (pillars, story arcs, balance heatmap)
- **Plan 3:** Performance Coach (weekly digest, "why it worked", A/B testing)
- **Plan 4:** PRD Core Remaining (smart queues, platform previews, functional inbox, Link-in-Bio)
