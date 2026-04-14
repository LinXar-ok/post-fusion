"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  Plus, ThumbsUp, ThumbsDown, Minus, Radio, Loader2, TrendingUp, MessageSquare, AlertTriangle,
} from "lucide-react"
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts"

type SentimentLog = {
  id: string
  post_id: string | null
  content: string
  sentiment: "positive" | "neutral" | "negative"
  confidence: number
  score: number
  keywords_found: string[]
  created_at: string
}
type TrackedKeyword = { id: string; keyword: string; created_at: string }

function NmTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="px-3 py-2 rounded-xl bg-[var(--nm-bg)] text-xs font-semibold" style={{ boxShadow: "var(--nm-raised-sm)" }}>
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.name === "positive" ? "#7BA4D0" : p.name === "negative" ? "#363630" : "#675B47" }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  )
}

function XIcon(props: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

const sentimentMeta = {
  positive: { color: "#7BA4D0", bg: "rgba(123,164,208,0.12)", label: "Positive", Icon: ThumbsUp   },  // mid blue
  neutral:  { color: "#675B47", bg: "rgba(103,91,71,0.12)",   label: "Neutral",  Icon: Minus      },  // bronze
  negative: { color: "#363630", bg: "rgba(54,54,48,0.12)",    label: "Negative", Icon: ThumbsDown },  // olive
}

export default function ListeningPage() {
  const supabase = createClient()
  const [keywords, setKeywords]   = useState<TrackedKeyword[]>([])
  const [logs, setLogs]           = useState<SentimentLog[]>([])
  const [keywordInput, setKeywordInput] = useState("")
  const [loading, setLoading]     = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [newKeyword, setNewKeyword] = useState("")

  useEffect(() => { loadData() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    setLoading(true)
    const [{ data: kwData }, { data: logData }] = await Promise.all([
      supabase.from("tracked_keywords").select("*").order("created_at", { ascending: false }),
      supabase.from("sentiment_logs").select("*").order("created_at", { ascending: false }).limit(100),
    ])
    setKeywords(kwData ?? [])
    setLogs(logData ?? [])
    setLoading(false)
  }

  const addKeyword = async () => {
    if (!newKeyword.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from("tracked_keywords")
      .insert({ user_id: user.id, keyword: newKeyword.trim().toLowerCase() }).select().single()
    if (data) setKeywords(prev => [data, ...prev])
    setNewKeyword("")
  }

  const removeKeyword = async (id: string) => {
    await supabase.from("tracked_keywords").delete().eq("id", id)
    setKeywords(prev => prev.filter(k => k.id !== id))
  }

  const analyzePost = async () => {
    if (!keywordInput.trim()) return
    setAnalyzing(true)
    try {
      const res  = await fetch("/api/ai/sentiment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: keywordInput }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from("sentiment_logs").insert({ user_id: user.id, content: keywordInput, sentiment: data.sentiment, confidence: data.confidence, score: data.score, keywords_found: data.keywords_found || [] })
        await loadData()
      }
    } catch (err) {
      console.error("Sentiment analysis error:", err)
    } finally {
      setAnalyzing(false)
      setKeywordInput("")
    }
  }

  const stats = {
    positive: logs.filter(l => l.sentiment === "positive").length,
    neutral:  logs.filter(l => l.sentiment === "neutral").length,
    negative: logs.filter(l => l.sentiment === "negative").length,
    avgScore: logs.length > 0 ? (logs.reduce((a, b) => a + b.score, 0) / logs.length).toFixed(2) : "0.00",
  }

  const hasNegativeSpikes = logs.filter(l =>
    l.sentiment === "negative" && (Date.now() - new Date(l.created_at).getTime()) / 3600000 <= 24
  ).length >= 3

  // Chart data grouped by date
  const dateMap = new Map<string, { positive: number; neutral: number; negative: number }>()
  logs.forEach(log => {
    const day = new Date(log.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    if (!dateMap.has(day)) dateMap.set(day, { positive: 0, neutral: 0, negative: 0 })
    dateMap.get(day)![log.sentiment]++
  })
  const chartData = Array.from(dateMap.entries()).map(([date, v]) => ({ date, ...v }))

  const axisProps = { tick: { fontSize: 10, fill: "#94a3b8" } }
  const gridProps = { strokeDasharray: "3 3", stroke: "rgba(163,177,198,0.2)" }

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full flex flex-col gap-6">

      {/* Page header */}
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground mb-1">
          Social Listening
        </h1>
        <p className="text-muted-foreground text-sm">
          Monitor sentiment and track keywords across your content.
        </p>
      </div>

      {/* Negative spike alert */}
      {hasNegativeSpikes && (
        <div
          className="rounded-2xl px-5 py-4 flex items-center gap-3 bg-[var(--nm-bg)]"
          style={{ boxShadow: "var(--nm-raised-sm)" }}
        >
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(54,54,48,0.12)", boxShadow: "var(--nm-inset-sm)" }}
          >
            <AlertTriangle className="w-4 h-4 text-[#363630]" />
          </div>
          <div>
            <span className="text-sm font-semibold text-foreground">Negative sentiment spike detected</span>
            <span className="text-sm text-muted-foreground"> — {logs.filter(l => l.sentiment === "negative" && new Date(l.created_at).getTime() > Date.now() - 86400000).length} negative entries in the last 24 hours.</span>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {(["positive", "neutral", "negative"] as const).map(s => {
          const meta = sentimentMeta[s]
          return (
            <div
              key={s}
              className="rounded-2xl p-5 bg-[var(--nm-bg)] flex flex-col gap-4"
              style={{ boxShadow: "var(--nm-raised)" }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: meta.bg, boxShadow: "var(--nm-inset-sm)" }}
              >
                <meta.Icon className="w-4 h-4" style={{ color: meta.color }} />
              </div>
              <div>
                <div className="font-display text-4xl font-bold text-foreground leading-none mb-1.5">
                  {loading ? "—" : stats[s]}
                </div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{meta.label}</p>
              </div>
            </div>
          )
        })}

        {/* Avg score */}
        <div
          className="rounded-2xl p-5 bg-[var(--nm-bg)] flex flex-col gap-4"
          style={{ boxShadow: "var(--nm-raised)" }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(46,94,153,0.12)", boxShadow: "var(--nm-inset-sm)" }}
          >
            <TrendingUp className="w-4 h-4 text-[#2E5E99]" />
          </div>
          <div>
            <div className="font-display text-4xl font-bold text-foreground leading-none mb-1.5">
              {loading ? "—" : stats.avgScore}
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Avg Score</p>
          </div>
        </div>
      </div>

      {/* Bottom row: keywords + analyzer left, chart + logs right */}
      <div className="grid gap-5 lg:grid-cols-5">

        {/* Left col — keyword tracker + analyzer */}
        <div className="lg:col-span-2 flex flex-col gap-5">

          {/* Tracked keywords */}
          <div
            className="rounded-2xl p-6 bg-[var(--nm-bg)]"
            style={{ boxShadow: "var(--nm-raised)" }}
          >
            <div className="flex items-center gap-2 mb-5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(46,94,153,0.12)", boxShadow: "var(--nm-inset-sm)" }}
              >
                <Radio className="w-4 h-4 text-[#2E5E99]" />
              </div>
              <h2 className="font-display text-base font-semibold text-foreground">Tracked Keywords</h2>
            </div>

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Add keyword…"
                value={newKeyword}
                onChange={e => setNewKeyword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addKeyword()}
                className="flex-1 h-9 px-3 rounded-xl text-sm text-foreground bg-[var(--nm-bg)] focus:outline-none placeholder:text-muted-foreground"
                style={{ boxShadow: "var(--nm-inset-sm)" }}
              />
              <button
                type="button"
                onClick={addKeyword}
                disabled={!newKeyword.trim()}
                className="h-9 w-9 rounded-xl flex items-center justify-center bg-[#2E5E99] text-white shrink-0 disabled:opacity-40"
                style={{ boxShadow: "var(--nm-raised-sm)" }}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {keywords.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {keywords.map(kw => (
                  <div
                    key={kw.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-foreground bg-[var(--nm-bg)]"
                    style={{ boxShadow: "var(--nm-inset-sm)" }}
                  >
                    <Radio className="w-3 h-3 text-[#2E5E99]" />
                    {kw.keyword}
                    <button
                      type="button"
                      onClick={() => removeKeyword(kw.id)}
                      className="ml-1 text-muted-foreground hover:text-[#363630] transition-colors"
                    >
                      <XIcon className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No keywords tracked yet. Add one above.</p>
            )}
          </div>

          {/* Quick analyzer */}
          <div
            className="rounded-2xl p-6 bg-[var(--nm-bg)]"
            style={{ boxShadow: "var(--nm-raised)" }}
          >
            <h2 className="font-display text-base font-semibold text-foreground mb-1">Quick Analyzer</h2>
            <p className="text-xs text-muted-foreground mb-4">Paste content to run sentiment analysis.</p>

            <textarea
              placeholder="Enter content for sentiment analysis…"
              value={keywordInput}
              onChange={e => setKeywordInput(e.target.value)}
              disabled={analyzing}
              rows={4}
              className="w-full px-4 py-3 rounded-xl text-sm text-foreground bg-[var(--nm-bg)] focus:outline-none placeholder:text-muted-foreground resize-none mb-3"
              style={{ boxShadow: "var(--nm-inset-sm)" }}
            />

            <button
              type="button"
              onClick={analyzePost}
              disabled={!keywordInput.trim() || analyzing}
              className="w-full h-9 rounded-xl text-sm font-semibold text-white bg-[#2E5E99] flex items-center justify-center gap-2 disabled:opacity-40 transition-all"
              style={{ boxShadow: "var(--nm-raised-sm)" }}
            >
              {analyzing
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing…</>
                : "Run Analysis"}
            </button>
          </div>
        </div>

        {/* Right col — chart + log */}
        <div className="lg:col-span-3 flex flex-col gap-5">

          {/* Sentiment over time chart */}
          <div
            className="rounded-2xl p-6 bg-[var(--nm-bg)]"
            style={{ boxShadow: "var(--nm-raised)" }}
          >
            <h2 className="font-display text-base font-semibold text-foreground mb-0.5">Sentiment Over Time</h2>
            <p className="text-xs text-muted-foreground mb-5">Stacked area by day</p>

            {chartData.length === 0 ? (
              <div
                className="rounded-xl h-[200px] flex items-center justify-center text-sm text-muted-foreground bg-[var(--nm-bg)]"
                style={{ boxShadow: "var(--nm-inset-sm)" }}
              >
                No sentiment data yet — run an analysis above.
              </div>
            ) : (
              <div
                className="rounded-xl p-4 bg-[var(--nm-bg)]"
                style={{ boxShadow: "var(--nm-inset-sm)" }}
              >
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="date" {...axisProps} />
                    <YAxis {...axisProps} allowDecimals={false} />
                    <Tooltip content={<NmTooltip />} />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <Area type="monotone" dataKey="positive" stackId="1" stroke="#7BA4D0" fill="#7BA4D0" fillOpacity={0.25} />
                    <Area type="monotone" dataKey="neutral"  stackId="1" stroke="#675B47" fill="#675B47" fillOpacity={0.25} />
                    <Area type="monotone" dataKey="negative" stackId="1" stroke="#363630" fill="#363630" fillOpacity={0.25} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Recent analyzed */}
          <div
            className="rounded-2xl p-6 bg-[var(--nm-bg)]"
            style={{ boxShadow: "var(--nm-raised)" }}
          >
            <div className="flex items-center gap-2 mb-5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(46,94,153,0.12)", boxShadow: "var(--nm-inset-sm)" }}
              >
                <MessageSquare className="w-4 h-4 text-[#2E5E99]" />
              </div>
              <h2 className="font-display text-base font-semibold text-foreground">Recently Analyzed</h2>
            </div>

            {logs.length === 0 ? (
              <div className="py-10 flex flex-col items-center text-center">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 bg-[var(--nm-bg)]"
                  style={{ boxShadow: "var(--nm-inset-sm)" }}
                >
                  <Radio className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">No sentiment analysis yet</p>
                <p className="text-xs text-muted-foreground mt-1">Submit content above to get started.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {logs.slice(0, 20).map(log => {
                  const meta = sentimentMeta[log.sentiment]
                  return (
                    <div
                      key={log.id}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--nm-bg)]"
                      style={{ boxShadow: "var(--nm-inset-sm)" }}
                    >
                      <span
                        className="text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0"
                        style={{ background: meta.bg, color: meta.color }}
                      >
                        {log.sentiment} ({(log.confidence * 100).toFixed(0)}%)
                      </span>
                      <span className="text-xs text-foreground truncate flex-1">{log.content}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0 font-semibold uppercase tracking-wide">
                        {new Date(log.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
