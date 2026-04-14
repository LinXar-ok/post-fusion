# Social Listening / Sentiment Analysis Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a social listening dashboard with AI-powered sentiment analysis of published posts, keyword monitoring, negative sentiment alerts, and a long-form sentiment activity chart.

**Architecture:** Create a new `/listening` page with a client-side component that fetches sentiment logs from a new `sentiment_logs` table. A server-side API route (`/api/ai/sentiment`) will analyze post content via Anthropic Claude (claude-haiku-4-5), returning sentiment scores. A cron-compatible batch endpoint (`/api/cron/sentiment-batch`) will allow bulk scanning of recent unanalyzed posts. Keyword tracking is stored in a `tracked_keywords` table with UI to add/remove terms. All data is scoped to `user_id` with RLS policies.

**Tech Stack:** TypeScript, Next.js 16 App Router, Anthropic SDK (claude-haiku-4-5), Supabase (native SDK), recharts for charts, Tailwind CSS v4, shadcn/ui (Base Nova), Framer Motion, lucide-react icons.

---

### Task 1: Create database migrations for `sentiment_logs` and `tracked_keywords` tables

**Files:**
- Create: `/Users/linuxkexordzu/Personal Projects/SOCIAL/supabase/migrations/20260407000000_sentiment_analysis.sql`

**Step 1: Write the migration SQL**

```sql
-- supabase/migrations/20260407000000_sentiment_analysis.sql

-- Table: tracked_keywords
CREATE TABLE public.tracked_keywords (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    keyword TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, keyword)
);

-- Table: sentiment_logs
CREATE TABLE public.sentiment_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    sentiment TEXT NOT NULL,              -- 'positive', 'neutral', 'negative'
    confidence FLOAT NOT NULL,            -- 0.0 to 1.0
    score FLOAT NOT NULL,                 -- -1.0 (very negative) to +1.0 (very positive)
    keywords_found TEXT[],                -- matched tracked keywords
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for common queries
CREATE INDEX idx_sentiment_logs_user_created ON public.sentiment_logs(user_id, created_at DESC);
CREATE INDEX idx_sentiment_logs_user_sentiment ON public.sentiment_logs(user_id, sentiment);
CREATE INDEX idx_tracked_keywords_user ON public.tracked_keywords(user_id);

-- RLS policies: tracked_keywords
ALTER TABLE public.tracked_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tracked keywords"
    ON public.tracked_keywords FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tracked keywords"
    ON public.tracked_keywords FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tracked keywords"
    ON public.tracked_keywords FOR DELETE
    USING (auth.uid() = user_id);

-- RLS policies: sentiment_logs
ALTER TABLE public.sentiment_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sentiment logs"
    ON public.sentiment_logs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sentiment logs"
    ON public.sentiment_logs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sentiment logs"
    ON public.sentiment_logs FOR DELETE
    USING (auth.uid() = user_id);
```

**Step 2: Apply the migration**

Run:
```bash
supabase db push
```

Expected: Success with both tables created and policies applied.

**Step 3: Verify**

In Supabase dashboard (iztpngdunsicmlymuemj), confirm `sentiment_logs` and `tracked_keywords` appear with correct columns and RLS policies.

**Step 4: Commit**

```bash
git add supabase/migrations/20260407000000_sentiment_analysis.sql
git commit -m "feat: add sentiment_logs and tracked_keywords tables with RLS"
```

---

### Task 2: Create `/api/ai/sentiment` endpoint

**Files:**
- Create: `/Users/linuxkexordzu/Personal Projects/SOCIAL/src/app/api/ai/sentiment/route.ts`

This endpoint accepts post content (and optionally tracked keywords), uses Anthropic Claude haiku to classify sentiment, and returns a structured result.

**Step 1: Create the sentiment analysis API route**

```tsx
// src/app/api/ai/sentiment/route.ts

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import Anthropic from "@anthropic-ai/sdk"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured." },
      { status: 503 }
    )
  }

  const { content, keywords } = await req.json()

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return NextResponse.json(
      { error: "Provide non-empty content for analysis." },
      { status: 400 }
    )
  }

  const keywordPrompt = keywords && keywords.length > 0
    ? `\nAlso check if any of these tracked keywords appear: ${keywords.join(", ")}. Return matched ones in a "keywords_found" array (empty if none).`
    : `\nReturn an empty "keywords_found" array.`

  // Request structured JSON output
  const prompt = `You are a sentiment analysis expert. Analyze the following social media post content and return ONLY a valid JSON object with this exact structure (no markdown, no explanation):

{
  "sentiment": "positive" | "neutral" | "negative",
  "score": <number between -1.0 and 1.0, where -1.0 is very negative, 0 is neutral, 1.0 is very positive>,
  "confidence": <number between 0.0 and 1.0, how confident you are in the classification>,
  "keywords_found": ["array" | "of" | "matched" | "keywords"]
}

Rules:
- "sentiment" MUST be exactly one of: "positive", "neutral", "negative"
- "score" maps to sentiment: positive > 0, neutral ~= 0, negative < 0
- "confidence" should reflect how clear-cut the sentiment is${keywordPrompt}

Content to analyze:
"""${content}"""`

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 256,
      temperature: 0,
      messages: [
        { role: "user", content: prompt },
      ],
    })

    const text = response.content[0]?.text?.trim() ?? ""
    const jsonStr = text.replace(/```json\s*|\s*```/g, "").trim()
    const result = JSON.parse(jsonStr)

    // Validate result shape
    if (!result.sentiment || !["positive", "neutral", "negative"].includes(result.sentiment)) {
      return NextResponse.json({ error: "Invalid sentiment result from AI." }, { status: 500 })
    }

    return NextResponse.json({
      sentiment: result.sentiment,
      score: typeof result.score === "number" ? result.score : 0,
      confidence: typeof result.confidence === "number" ? result.confidence : 0.5,
      keywords_found: Array.isArray(result.keywords_found) ? result.keywords_found : [],
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message ?? "Sentiment analysis failed." },
      { status: 500 }
    )
  }
}
```

**Step 2: Install Anthropic SDK if not present**

Run:
```bash
grep -q "@anthropic-ai/sdk" package.json || npm install @anthropic-ai/sdk
```

**Step 3: Verify**

Start `next dev`. Test with curl (authenticated):
```bash
curl -X POST http://localhost:3000/api/ai/sentiment \
  -H "Content-Type: application/json" \
  -H "Cookie: $(get your auth cookie)" \
  -d '{"content": "Love this product, absolutely amazing!", "keywords": ["product", "amazing"]}'
```

Expected: JSON with `sentiment: "positive"`, positive `score`, high `confidence`, and `keywords_found: ["product", "amazing"]`.

**Step 4: Commit**

```bash
git add src/app/api/ai/sentiment/route.ts
git commit -m "feat: add sentiment analysis API endpoint using Anthropic Claude"
```

---

### Task 3: Create `/api/cron/sentiment-batch` endpoint for bulk scanning

**Files:**
- Create: `/Users/linuxkexordzu/Personal Projects/SOCIAL/src/app/api/cron/sentiment-batch/route.ts`

**Step 1: Create the batch sentiment cron endpoint**

This endpoint scans published posts that have not yet been analyzed, runs them through the sentiment API, and stores results in `sentiment_logs`. Protected by `CRON_SECRET`, but also callable manually by auth users for on-demand analysis.

```tsx
// src/app/api/cron/sentiment-batch/route.ts

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import Anthropic from "@anthropic-ai/sdk"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Allow if authenticated user OR valid CRON_SECRET
  const authHeader = req.headers.get("authorization")
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`

  if (!user && !isCron) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const targetUserId = user?.id ?? req.headers.get("x-user-id")
  if (!targetUserId) {
    return NextResponse.json({ error: "No user identified." }, { status: 400 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured." },
      { status: 503 }
    )
  }

  // Fetch published posts not yet analyzed
  const { data: posts, error } = await supabase
    .from("posts")
    .select("id, content")
    .eq("user_id", targetUserId)
    .eq("status", "published")
    .not("id", "in",
      supabase.from("sentiment_logs").select("post_id").eq("user_id", targetUserId)
    )
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!posts || posts.length === 0) {
    return NextResponse.json({ processed: 0, message: "No posts to analyze." })
  }

  // Fetch tracked keywords for this user
  const { data: kwData } = await supabase
    .from("tracked_keywords")
    .select("keyword")
    .eq("user_id", targetUserId)
  const keywords = kwData?.map(k => k.keyword) ?? []

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  let processed = 0

  for (const post of posts) {
    if (!post.content) continue

    const prompt = `You are a sentiment analysis expert. Analyze the following social media post content and return ONLY a valid JSON object with this exact structure (no markdown, no explanation):

{
  "sentiment": "positive" | "neutral" | "negative",
  "score": <number between -1.0 and 1.0>,
  "confidence": <number between 0.0 and 1.0>,
  "keywords_found": ["matched_keywords_only"]
}

Return an empty "keywords_found" array if none match.${keywords.length > 0 ? ` Tracked keywords: ${keywords.join(", ")}.` : ""}

Content: """${post.content}"""`

    try {
      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 256,
        temperature: 0,
        messages: [{ role: "user", content: prompt }],
      })

      const text = response.content[0]?.text?.trim() ?? ""
      const jsonStr = text.replace(/```json\s*|\s*```/g, "").trim()
      const result = JSON.parse(jsonStr)

      await supabase.from("sentiment_logs").insert({
        user_id: targetUserId,
        post_id: post.id,
        content: post.content.slice(0, 1000),
        sentiment: result.sentiment ?? "neutral",
        score: typeof result.score === "number" ? result.score : 0,
        confidence: typeof result.confidence === "number" ? result.confidence : 0.5,
        keywords_found: Array.isArray(result.keywords_found) ? result.keywords_found : [],
      })
      processed++
    } catch {
      // Skip failed posts, continue processing
    }
  }

  return NextResponse.json({ processed, total: posts.length })
}
```

**Step 2: (Optional) Add to vercel.json cron configuration**

If the project uses Vercel cron, edit `/Users/linuxkexordzu/Personal Projects/SOCIAL/vercel.json` to add:

```json
{
  "crons": [
    ... existing crons ...,
    {
      "path": "/api/cron/sentiment-batch",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

**Step 3: Verify**

With published posts that lack sentiment logs, call:
```bash
curl -X POST http://localhost:3000/api/cron/sentiment-batch
```

Expected: `{ processed: N, total: N }` with rows inserted into `sentiment_logs`.

**Step 4: Commit**

```bash
git add src/app/api/cron/sentiment-batch/route.ts
git commit -m "feat: add batch sentiment cron endpoint"
```

---

### Task 4: Add "Listening" nav link to sidebar

**Files:**
- Modify: `/Users/linuxkexordzu/Personal Projects/SOCIAL/src/components/layout/sidebar.tsx`

**Step 1: Update the sidebar**

Add the `Ear` or `Radio` icon for Listening. Import from `lucide-react`.

Modify the import line:
```tsx
import { Calendar, Inbox, LayoutDashboard, Settings, Activity, PenSquare, Sparkles, Radio } from "lucide-react";
```

Add the nav item (after "Inbox", before "Analytics"):
```tsx
const navItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Publishing", href: "/publishing", icon: PenSquare },
  { name: "Calendar", href: "/calendar", icon: Calendar },
  { name: "Inbox", href: "/inbox", icon: Inbox },
  { name: "Listening", href: "/listening", icon: Radio },
  { name: "Analytics", href: "/analytics", icon: Activity },
  { name: "Settings", href: "/settings", icon: Settings },
];
```

**Step 2: Verify**

Run `next dev` and confirm "Listening" appears in the sidebar with the Radio icon.

**Step 3: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat: add Listening link to sidebar navigation"
```

---

### Task 5: Create the `/listening` page shell and keyword monitoring UI

**Files:**
- Create: `/Users/linuxkexordzu/Personal Projects/SOCIAL/src/app/(app)/listening/page.tsx`

**Step 1: Create the full listening page**

This is a large component but follows established patterns from `analytics/page.tsx` and `dashboard/page.tsx`. It contains:
- Keyword monitoring section (add/remove tracked keywords)
- Sentiment overview stat cards (positive/neutral/negative counts, avg score)
- Sentiment timeline chart (stacked area or line chart)
- Negative alert indicators
- Recent analyzed posts list

```tsx
// src/app/(app)/listening/page.tsx

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { motion } from "framer-motion"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
} from "recharts"
import {
  Radio,
  Plus,
  X as XIcon,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  MessageSquare,
  Zap,
} from "lucide-react"

type SentimentLog = {
  id: string
  post_id: string | null
  content: string
  sentiment: string
  confidence: number
  score: number
  keywords_found: string[]
  created_at: string
}

type TrackedKeyword = {
  id: string
  keyword: string
  created_at: string
}

type SentimentSummary = {
  date: string
  positive: number
  neutral: number
  negative: number
}

export default function ListeningPage() {
  const supabase = createClient()
  const [logs, setLogs] = useState<SentimentLog[]>([])
  const [keywords, setKeywords] = useState<TrackedKeyword[]>([])
  const [newKeyword, setNewKeyword] = useState("")
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [addingKeyword, setAddingKeyword] = useState(false)

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [logsRes, kwRes] = await Promise.all([
      supabase
        .from("sentiment_logs")
        .select("id, post_id, content, sentiment, confidence, score, keywords_found, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("tracked_keywords")
        .select("id, keyword, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ])

    setLogs(logsRes.data ?? [])
    setKeywords(kwRes.data ?? [])
    setLoading(false)
  }

  async function handleScan() {
    setScanning(true)
    const resp = await fetch("/api/cron/sentiment-batch", { method: "POST" })
    if (resp.ok) {
      await fetchData()
    }
    setScanning(false)
  }

  async function handleAddKeyword() {
    const trimmed = newKeyword.trim().toLowerCase()
    if (!trimmed) return
    setAddingKeyword(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from("tracked_keywords").insert({
      user_id: user.id,
      keyword: trimmed,
    })

    if (!error) {
      setNewKeyword("")
      await fetchData()
    }
    setAddingKeyword(false)
  }

  async function handleRemoveKeyword(id: string) {
    await supabase.from("tracked_keywords").delete().eq("id", id)
    await fetchData()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleAddKeyword()
  }

  const positive = logs.filter(l => l.sentiment === "positive").length
  const neutral = logs.filter(l => l.sentiment === "neutral").length
  const negative = logs.filter(l => l.sentiment === "negative").length
  const avgScore = logs.length > 0
    ? (logs.reduce((sum, l) => sum + l.score, 0) / logs.length).toFixed(2)
    : "0.00"

  // Negative sentiment spike alert: if > 3 in last 24h
  const recent24h = logs.filter(l => {
    const diff = Date.now() - new Date(l.created_at).getTime()
    return diff < 86400000
  })
  const recentNegative = recent24h.filter(l => l.sentiment === "negative").length
  const hasNegativeSpike = recentNegative >= 3

  // Build timeline data: group by day for last 14 days
  const timelineData = getTimelineData(logs)

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full relative z-10">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-2">Social Listening</h1>
        <p className="text-slate-500 text-lg">AI-powered sentiment analysis and keyword monitoring for your published posts.</p>
      </motion.div>

      {negative > 0 && hasNegativeSpike && (
        <motion.div
          initial={{ opacity: 0, scaleY: 0 }}
          animate={{ opacity: 1, scaleY: 1 }}
          className="mb-6"
        >
          <Card className="bg-red-50 border-red-200">
            <CardContent className="flex items-center gap-3 py-3">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-700">
                  Negative Sentiment Spike Detected
                </p>
                <p className="text-xs text-red-600">
                  {recentNegative} negative posts detected in the last 24 hours.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Keyword Monitoring */}
      <Card className="bg-white/80 border-slate-200 shadow-sm backdrop-blur-xl mb-6 overflow-hidden">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Radio className="w-5 h-5 text-[#128C7E]" />
            Tracked Keywords
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Add a keyword to track..."
              value={newKeyword}
              onChange={e => setNewKeyword(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={addingKeyword}
              className="max-w-xs"
            />
            <Button
              onClick={handleAddKeyword}
              disabled={addingKeyword || !newKeyword.trim()}
              className="bg-[#128C7E] hover:bg-[#128C7E]/90"
            >
              {addingKeyword ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Add
            </Button>
            <Button
              variant="outline"
              onClick={handleScan}
              disabled={scanning}
              className="ml-auto"
            >
              {scanning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              Scan Posts
            </Button>
          </div>
          {keywords.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">
              No keywords tracked yet. Add terms to monitor for mentions.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {keywords.map(kw => (
                <Badge
                  key={kw.id}
                  variant="secondary"
                  className="flex items-center gap-1 px-3 py-1 text-sm bg-[#128C7E]/10 text-[#0B1020] border-none"
                >
                  {kw.keyword}
                  <button
                    onClick={() => handleRemoveKeyword(kw.id)}
                    className="ml-1 hover:text-red-500 transition-colors"
                    aria-label={`Remove ${kw.keyword}`}
                  >
                    <XIcon className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6 shrink-0">
        <StatCard
          title="Positive"
          value={String(positive)}
          icon={TrendingUp}
          color="emerald"
        />
        <StatCard
          title="Neutral"
          value={String(neutral)}
          icon={Minus}
          color="amber"
        />
        <StatCard
          title="Negative"
          value={String(negative)}
          icon={TrendingDown}
          color="rose"
        />
        <StatCard
          title="Avg Score"
          value={avgScore}
          icon={MessageSquare}
          color="teal"
        />
      </div>

      {/* Chart */}
      <Card className="bg-white/80 border-slate-200 shadow-sm backdrop-blur-xl mb-6 overflow-hidden">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-slate-900">Sentiment Over Time (14 Days)</CardTitle>
        </CardHeader>
        <CardContent className="border-t border-slate-100 bg-slate-50/50 p-4">
          {loading ? (
            <div className="h-[300px] flex items-center justify-center text-sm text-slate-400">Loading...</div>
          ) : timelineData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-sm text-slate-400">
              No data. Connect accounts and click "Scan Posts" to begin analysis.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={timelineData} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    fontSize: "12px",
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="positive"
                  stackId="1"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="neutral"
                  stackId="1"
                  stroke="#f59e0b"
                  fill="#f59e0b"
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="negative"
                  stackId="1"
                  stroke="#f43f5e"
                  fill="#f43f5e"
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Recent Analyzed Posts */}
      <Card className="bg-white/80 border-slate-200 shadow-sm backdrop-blur-xl overflow-hidden">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-slate-900">Recently Analyzed Posts</CardTitle>
        </CardHeader>
        <CardContent className="border-t border-slate-100 pt-4">
          {logs.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">
              No analyzed posts yet. Add your social accounts and run a scan.
            </p>
          ) : (
            <div className="space-y-4">
              {logs.slice(0, 10).map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50/50"
                >
                  <SentimentBadge sentiment={log.sentiment} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 line-clamp-2">{log.content}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-slate-400">
                        Score: {log.score.toFixed(2)}
                      </span>
                      <span className="text-xs text-slate-400">
                        Confidence: {(log.confidence * 100).toFixed(0)}%
                      </span>
                      {log.keywords_found.length > 0 && (
                        <span className="text-xs text-[#128C7E]">
                          Keywords: {log.keywords_found.join(", ")}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0">
                    {new Date(log.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// --- Sub-components ---

function StatCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string
  value: string
  icon: any
  color: string
}) {
  const colorMap: Record<string, string> = {
    emerald: "text-emerald-600 bg-emerald-50",
    amber: "text-amber-600 bg-amber-50",
    rose: "text-rose-600 bg-rose-50",
    teal: "text-[#128C7E] bg-[#128C7E]/10",
  }

  return (
    <Card className="bg-white/80 border-slate-200 shadow-sm backdrop-blur-xl overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-semibold text-slate-600 uppercase tracking-wider">
          {title}
        </CardTitle>
        <Icon className={`w-4 h-4 ${colorMap[color]?.includes("text") ? colorMap[color].split(" ")[0] : "text-slate-300"}`} />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-black text-slate-900">{value}</div>
      </CardContent>
    </Card>
  )
}

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    positive: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", label: "Positive" },
    neutral: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", label: "Neutral" },
    negative: { bg: "bg-rose-50 border-rose-200", text: "text-rose-700", label: "Negative" },
  }
  const c = config[sentiment] ?? config.neutral
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${c.bg} ${c.text} shrink-0`}>
      {c.label}
    </span>
  )
}

function getTimelineData(logs: SentimentLog[]): SentimentSummary[] {
  const days: SentimentSummary[] = []
  const now = new Date()
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    d.setHours(0, 0, 0, 0)
    const end = new Date(d)
    end.setDate(end.getDate() + 1)
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    const dayLogs = logs.filter(l => {
      const ld = new Date(l.created_at)
      return ld >= d && ld < end
    })
    days.push({
      date: label,
      positive: dayLogs.filter(l => l.sentiment === "positive").length,
      neutral: dayLogs.filter(l => l.sentiment === "neutral").length,
      negative: dayLogs.filter(l => l.sentiment === "negative").length,
    })
  }
  return days
}
```

**Step 2: Add Badge component if missing**

Check if `/Users/linuxkexordzu/Personal Projects/SOCIAL/src/components/ui/badge.tsx` exists. If not, create it:

```tsx
// src/components/ui/badge.tsx

import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
```

**Step 3: Verify**

Run `next dev`, navigate to `/listening`. Verify:
- Page loads with correct header
- "Scan Posts" button works (after adding published posts)
- Keyword add/remove works
- All stat cards display
- Chart area renders (empty state initially)
- No TypeScript errors

Run:
```bash
npx tsc --noEmit
```

Ensure zero errors.

**Step 4: Commit**

```bash
git add src/app/(app)/listening/page.tsx src/components/ui/badge.tsx
git commit -m "feat: add Social Listening page with sentiment dashboard and keyword monitoring"
```

---

### Task 6: Wire up auto-analysis for new published posts (optional enhancement)

**Files:**
- Modify: `/Users/linuxkexordzu/Personal Projects/SOCIAL/src/lib/publishers.ts`

**Step 1:** After a post successfully publishes, call the sentiment API in the background and store the result.

This is optional YAGNI-friendly -- the batch cron endpoint (Task 3) already covers this need. Only implement if the team wants real-time sentiment on publish.

Skip for now unless requested. The batch scanner handles coverage.

---

### Task 7: Final verification and testing

**Step 1: Full end-to-end test**

1. Start `next dev`
2. Navigate to `/listening`
3. Add 2-3 tracked keywords (e.g., "myBrand", "productName")
4. Ensure there are published posts in the system
5. Click "Scan Posts"
6. Wait for scan to complete
7. Verify sentiment stat cards update
8. Verify the timeline chart shows data
9. Verify the recent posts list shows analyzed entries with badges
10. Verify negative spike alert (if 3+ negative in 24h)

**Step 2: TypeScript verification**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

**Step 3: Next.js build**

```bash
next build
```

Expected: Build succeeds with no errors.

**Step 4: Final commit**

```bash
git add -A
git commit -m "fix: verify clean build for social listening feature"
```

---

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/20260407000000_sentiment_analysis.sql` | Create | DB schema for `sentiment_logs` and `tracked_keywords` |
| `src/app/api/ai/sentiment/route.ts` | Create | Single-post AI sentiment analysis endpoint |
| `src/app/api/cron/sentiment-batch/route.ts` | Create | Batch scan endpoint for unanalyzed posts |
| `src/components/layout/sidebar.tsx` | Modify | Add "Listening" nav link |
| `src/components/ui/badge.tsx` | Create (if missing) | Badge UI component for keyword tags and sentiment |
| `src/app/(app)/listening/page.tsx` | Create | Social Listening / Sentiment Dashboard page |
| `vercel.json` | Modify (optional) | Add cron schedule for sentiment scanning |

## Environment Variables Required

- `ANTHROPIC_API_KEY` -- already in use for AI generate, must have this set
- `CRON_SECRET` -- for production cron security (if cron is used)

## Testing Strategy

1. **Unit:** Test the `getTimelineData` function with sample data to verify correct day-grouping
2. **Integration:** POST to `/api/ai/sentiment` with known-positive/known-negative/nknown-neutral text and verify response shape
3. **E2E:** Add keywords, publish posts, run batch scan, verify data appears in UI

## Rollout Order

1. Migration (Task 1) -- database first
2. API endpoints (Tasks 2-3) -- backend before frontend
3. Sidebar nav (Task 4) -- can be done any time after or in parallel
4. Listening page (Task 5) -- depends on DB + API
5. Verification (Task 7)

Plan complete and saved to `/Users/linuxkexordzu/Personal Projects/SOCIAL/docs/plans/2026-04-07-social-listening-sentiment.md`.

Two execution options:

1. **Subagent-Driven (this session)** -- I dispatch fresh subagent per task, review between tasks, fast iteration
2. **Parallel Session (separate)** -- Open new session with executing-plans, batch execution with checkpoints

Which approach?
