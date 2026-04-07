"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TrendingUp, CheckCircle2, Clock, AlertTriangle, FileText, Download, ChevronDown } from "lucide-react"
import { exportCSV, buildReportTitle } from "@/lib/report-export"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
} from "recharts"

type Post = {
  id: string
  status: string
  content: string
  platforms: string[]
  created_at: string
  published_at: string | null
}

function getWeeklyData(posts: Post[]) {
  const weeks: { week: string; posts: number }[] = []
  const now = new Date()
  for (let i = 7; i >= 0; i--) {
    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - i * 7)
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)
    const label = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    const count = posts.filter(p => {
      const d = new Date(p.created_at)
      return d >= weekStart && d < weekEnd
    }).length
    weeks.push({ week: label, posts: count })
  }
  return weeks
}

function getPlatformData(posts: Post[]) {
  return ["LinkedIn", "X", "Facebook", "Instagram"].map(name => ({
    platform: name,
    posts: posts.filter(p => p.platforms?.includes(name.toLowerCase() === "x" ? "x" : name.toLowerCase())).length,
  }))
}

type Datum = { platform: string; posts: number }

export default function AnalyticsPage() {
  const supabase = createClient()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [exportOpen, setExportOpen] = useState(false)

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from("posts")
        .select("id, status, content, platforms, created_at, published_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
      setPosts(data ?? [])
      setLoading(false)
    }
    fetchData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const published = posts.filter(p => p.status === "published")
  const scheduled = posts.filter(p => p.status === "scheduled")
  const failed = posts.filter(p => p.status === "failed")
  const weeklyData = getWeeklyData(posts)
  const platformData = getPlatformData(posts)

  const statCards = [
    { title: "Total Posts", value: posts.length, icon: FileText, color: "teal" },
    { title: "Published", value: published.length, icon: CheckCircle2, color: "emerald" },
    { title: "Scheduled", value: scheduled.length, icon: Clock, color: "amber" },
    { title: "Failed", value: failed.length, icon: AlertTriangle, color: "rose" },
  ]

  const dropdownRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setExportOpen(false)
    }
    if (exportOpen) document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [exportOpen])

  const handleExportCSV = () => {
    exportCSV(posts, null, null)
    setExportOpen(false)
  }

  const handleExportPDF = async () => {
    setExportOpen(false)
    const { PDFReport } = await import("@/components/reports/pdf-report")
    const { pdf } = await import("@react-pdf/renderer")
    const doc = pdf(
      <PDFReport
        posts={posts}
        dateRange={buildReportTitle(null, null)}
        stats={{ total: posts.length, published: published.length, scheduled: scheduled.length, failed: failed.length }}
        platformData={platformData}
      />
    )
    const blob = await doc.toBlob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `linxar-report-${Date.now()}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full relative z-10 h-full flex flex-col">
      <div className="mb-8 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-2">Analytics</h1>
            <p className="text-slate-500 text-lg">Detailed performance tracking and post breakdown.</p>
          </div>
          <div className="relative" ref={dropdownRef}>
            <Button
              variant="outline"
              className="h-9 text-sm bg-white border-slate-200 hover:bg-slate-50 text-[#0B1020] font-semibold shadow-xs"
              onClick={() => setExportOpen(!exportOpen)}
            >
              <Download className="w-4 h-4 mr-2" />
              Export
              <ChevronDown className="w-3 h-3 ml-1 text-slate-400" />
            </Button>
            {exportOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl border border-slate-200 shadow-lg z-50 overflow-hidden">
                <button
                  className="w-full px-4 py-2.5 text-sm text-left text-slate-700 hover:bg-[#128C7E]/5 flex items-center gap-2"
                  onClick={handleExportCSV}
                >
                  <FileText className="w-4 h-4 text-[#128C7E]" /> Export as CSV
                </button>
                <button
                  className="w-full px-4 py-2.5 text-sm text-left text-slate-700 hover:bg-[#128C7E]/5 flex items-center gap-2"
                  onClick={handleExportPDF}
                >
                  <Download className="w-4 h-4 text-[#128C7E]" /> Export as PDF
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8 shrink-0">
        {statCards.map((stat, i) => (
          <Card key={i} className="bg-white/80 border-slate-200 shadow-sm backdrop-blur-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-semibold text-slate-600 uppercase tracking-wider">{stat.title}</CardTitle>
              <stat.icon className="w-4 h-4 text-slate-300" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-slate-900">{loading ? "—" : stat.value}</div>
              <p className="text-sm font-medium text-slate-500 flex items-center mt-2">
                <TrendingUp className="w-4 h-4 mr-1 text-emerald-500" />
                All time
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="bg-white/80 border-slate-200 shadow-sm backdrop-blur-xl overflow-hidden">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-slate-900">Posts Created (Last 8 Weeks)</CardTitle>
          </CardHeader>
          <CardContent className="border-t border-slate-100 bg-slate-50/50 p-4">
            {loading ? (
              <div className="h-[300px] flex items-center justify-center text-sm text-slate-400">Loading…</div>
            ) : posts.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-sm text-slate-400">No data yet — start publishing.</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={weeklyData} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }} />
                  <Line type="monotone" dataKey="posts" stroke="#128C7E" strokeWidth={2} dot={{ fill: "#128C7E", r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white/80 border-slate-200 shadow-sm backdrop-blur-xl overflow-hidden">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-slate-900">Posts by Platform</CardTitle>
          </CardHeader>
          <CardContent className="border-t border-slate-100 bg-slate-50/50 p-4">
            {loading ? (
              <div className="h-[300px] flex items-center justify-center text-sm text-slate-400">Loading…</div>
            ) : posts.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-sm text-slate-400">No data yet — start publishing.</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={platformData} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="platform" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }} />
                  <Bar dataKey="posts" fill="#128C7E" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
