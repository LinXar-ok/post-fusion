"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Plus, ThumbsUp, ThumbsDown, Minus, Radio, Loader2, Trash2, AlertTriangle, BarChart3,
  TrendingUp, MessageSquare, Calendar as CalendarIcon,
} from "lucide-react"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
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

type TrackedKeyword = {
  id: string
  keyword: string
  created_at: string
}

export default function ListeningPage() {
  const supabase = createClient()
  const [keywords, setKeywords] = useState<TrackedKeyword[]>([])
  const [logs, setLogs] = useState<SentimentLog[]>([])
  const [keywordInput, setKeywordInput] = useState("")
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [newKeyword, setNewKeyword] = useState("")

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const { data: kwData } = await supabase.from("tracked_keywords").select("*").order("created_at", { ascending: false })
    setKeywords(kwData ?? [])
    const { data: logData } = await supabase.from("sentiment_logs").select("*").order("created_at", { ascending: false }).limit(100)
    setLogs(logData ?? [])
    setLoading(false)
  }

  const addKeyword = async () => {
    if (!newKeyword.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from("tracked_keywords").insert({ user_id: user.id, keyword: newKeyword.trim().toLowerCase() }).select().single()
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
      const res = await fetch("/api/ai/sentiment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: keywordInput }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from("sentiment_logs").insert({
          user_id: user.id,
          content: keywordInput,
          sentiment: data.sentiment,
          confidence: data.confidence,
          score: data.score,
          keywords_found: data.keywords_found || [],
        })
        await loadData()
      }
    } catch (err) {
      console.error("Sentiment analysis error:", err)
    } finally {
      setAnalyzing(false)
    }
  }

  const stats = {
    positive: logs.filter(l => l.sentiment === "positive").length,
    neutral: logs.filter(l => l.sentiment === "neutral").length,
    negative: logs.filter(l => l.sentiment === "negative").length,
    avgScore: logs.length > 0 ? (logs.reduce((a, b) => a + b.score, 0) / logs.length).toFixed(2) : "0.00",
  }

  const hasNegativeSpikes = logs.filter(l => {
    const d = new Date(l.created_at)
    const hoursAgo = (Date.now() - d.getTime()) / 3600000
    return l.sentiment === "negative" && hoursAgo <= 24
  }).length >= 3

  // Chart data: group by date
  const chartData: { date: string; positive: number; neutral: number; negative: number }[] = []
  const dateMap = new Map<string, { positive: number; neutral: number; negative: number }>()
  logs.forEach(log => {
    const day = new Date(log.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    if (!dateMap.has(day)) dateMap.set(day, { positive: 0, neutral: 0, negative: 0 })
    dateMap.get(day)![log.sentiment]++
  })
  dateMap.forEach((v, k) => chartData.push({ date: k, ...v }))

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full h-[calc(100vh-4rem)] flex flex-col relative z-10 overflow-y-auto">
      <div className="mb-8 shrink-0">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-2">Social Listening</h1>
        <p className="text-slate-500 text-lg">Monitor sentiment and track keywords across your content.</p>
      </div>

      {/* Negative spike alert */}
      {hasNegativeSpikes && (
        <div className="mb-4 flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 shrink-0">
          <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
          <span className="font-semibold">Negative sentiment spike detected</span> — {logs.filter(l => l.sentiment === "negative" && new Date(l.created_at).getTime() > Date.now() - 86400000).length} negative entries in the last 24 hours.
        </div>
      )}

      {/* Keyword tracking */}
      <Card className="bg-white/80 border-slate-200 shadow-sm backdrop-blur-xl mb-6 shrink-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Radio className="w-5 h-5 text-[#128C7E]" /> Tracked Keywords
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Add a keyword to track..."
              value={newKeyword}
              onChange={e => setNewKeyword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addKeyword()}
              className="h-9 text-sm bg-slate-50 border-slate-200 focus-visible:ring-[#128C7E]"
            />
            <Button size="sm" onClick={addKeyword} className="h-9 bg-[#128C7E] hover:bg-[#0B1020] text-white">
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>
          {keywords.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {keywords.map(kw => (
                <div key={kw.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#128C7E]/10 text-[#0B1020] rounded-full text-sm font-medium border border-[#128C7E]/20">
                  <Radio className="w-3 h-3 text-[#128C7E]" />
                  {kw.keyword}
                  <button onClick={() => removeKeyword(kw.id)} className="ml-1 text-slate-400 hover:text-rose-500 transition-colors">
                    <XIcon className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No keywords tracked yet. Add one above.</p>
          )}
        </CardContent>
      </Card>

      {/* Quick sentiment analyzer */}
      <div className="flex gap-3 mb-6 shrink-0">
        <Input
          placeholder="Enter content for sentiment analysis..."
          value={keywordInput}
          onChange={e => setKeywordInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && analyzePost()}
          className="h-10 bg-white border-slate-200 focus-visible:ring-[#128C7E]"
          disabled={analyzing}
        />
        <Button onClick={analyzePost} disabled={!keywordInput || analyzing} className="h-10 bg-[#128C7E] hover:bg-[#0B1020] text-white shrink-0">
          {analyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BarChart3 className="w-4 h-4 mr-2" />}
          Analyze
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 shrink-0">
        {[
          { label: "Positive", value: stats.positive, icon: ThumbsUp, color: "text-emerald-500" },
          { label: "Neutral", value: stats.neutral, icon: Minus, color: "text-amber-500" },
          { label: "Negative", value: stats.negative, icon: ThumbsDown, color: "text-rose-500" },
          { label: "Avg Score", value: stats.avgScore, icon: TrendingUp, color: "text-[#128C7E]" },
        ].map((s, i) => (
          <Card key={i} className="bg-white/80 border-slate-200 shadow-sm backdrop-blur-xl">
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-slate-900">{loading ? "—" : s.value}</div>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <div className="text-xs font-medium text-slate-500 mt-1">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card className="bg-white/80 border-slate-200 shadow-sm backdrop-blur-xl mb-6 shrink-0">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-900">Sentiment Over Time (14 Days)</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Area type="monotone" dataKey="positive" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                <Area type="monotone" dataKey="neutral" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.3} />
                <Area type="monotone" dataKey="negative" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Recent analyzed posts */}
      <Card className="bg-white/80 border-slate-200 shadow-sm backdrop-blur-xl shrink-0">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[#128C7E]" /> Recently Analyzed
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-10">
              <Radio className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-500">No sentiment analysis yet</p>
              <p className="text-xs text-slate-400 mt-1">Submit content above to get started.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {logs.slice(0, 20).map(log => {
                const badge = log.sentiment === "positive"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : log.sentiment === "negative"
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
                return (
                  <div key={log.id} className="flex items-center gap-3 p-3 bg-slate-50/50 rounded-lg border border-slate-100">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border shrink-0 ${badge}`}>
                      {log.sentiment} ({(log.confidence * 100).toFixed(0)}%)
                    </span>
                    <span className="text-sm text-slate-700 truncate flex-1">{log.content}</span>
                    <span className="text-xs text-slate-400 shrink-0">{new Date(log.created_at).toLocaleDateString()}</span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function XIcon(props: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
