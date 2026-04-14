"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  TrendingUp, CheckCircle2, Clock, AlertTriangle,
  FileText, Download, ChevronDown, Calendar,
} from "lucide-react"
import { exportCSV, buildReportTitle } from "@/lib/report-export"
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, LineChart, Line,
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
    posts: posts.filter(p =>
      p.platforms?.includes(name.toLowerCase() === "x" ? "x" : name.toLowerCase())
    ).length,
  }))
}

// Custom recharts tooltip styled to the nm surface
function NmTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="px-3 py-2 rounded-xl bg-[var(--nm-bg)] text-foreground text-xs font-semibold"
      style={{ boxShadow: "var(--nm-raised-sm)" }}
    >
      <p className="text-muted-foreground font-medium mb-0.5">{label}</p>
      <p style={{ color: "#2E5E99" }}>{payload[0].value} posts</p>
    </div>
  )
}

const statMeta = [
  { color: "#2E5E99", bg: "rgba(46,94,153,0.12)"  },
  { color: "#10B981", bg: "rgba(16,185,129,0.12)"  },
  { color: "#F59E0B", bg: "rgba(245,158,11,0.12)"  },
  { color: "#F43F5E", bg: "rgba(244,63,94,0.12)"   },
]

export default function AnalyticsPage() {
  const supabase = createClient()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [exportOpen, setExportOpen] = useState(false)
  const [dateStart, setDateStart] = useState("")
  const [dateEnd, setDateEnd] = useState("")
  const dropdownRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setExportOpen(false)
    }
    if (exportOpen) document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [exportOpen])

  const filtered = posts.filter(p => {
    const t = p.published_at
      ? new Date(p.published_at).getTime()
      : new Date(p.created_at).getTime()
    const startMs = dateStart ? new Date(dateStart).getTime() : 0
    const endMs   = dateEnd   ? new Date(dateEnd).getTime()   : Infinity
    return t >= startMs && t <= endMs
  })

  const published  = filtered.filter(p => p.status === "published")
  const scheduled  = filtered.filter(p => p.status === "scheduled")
  const failed     = filtered.filter(p => p.status === "failed")
  const weeklyData = getWeeklyData(filtered)
  const platformData = getPlatformData(filtered)

  const statCards = [
    { title: "Total Posts", value: posts.length,      icon: FileText,      ...statMeta[0] },
    { title: "Published",   value: published.length,  icon: CheckCircle2,  ...statMeta[1] },
    { title: "Scheduled",   value: scheduled.length,  icon: Clock,         ...statMeta[2] },
    { title: "Failed",      value: failed.length,     icon: AlertTriangle, ...statMeta[3] },
  ]

  const handleExportCSV = () => {
    exportCSV(filtered, dateStart || null, dateEnd || null)
    setExportOpen(false)
  }

  const handleExportPDF = async () => {
    setExportOpen(false)
    const { PDFReport } = await import("@/components/reports/pdf-report")
    const { pdf } = await import("@react-pdf/renderer")
    const doc = pdf(
      <PDFReport
        posts={filtered}
        dateRange={buildReportTitle(dateStart || null, dateEnd || null)}
        stats={{
          total: filtered.length,
          published: published.length,
          scheduled: scheduled.length,
          failed: failed.length,
        }}
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

  // Shared axis / grid props so charts look consistent
  const axisProps = { tick: { fontSize: 10, fill: "#94a3b8" } }
  const gridProps = { strokeDasharray: "3 3", stroke: "rgba(163,177,198,0.2)" }

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full flex flex-col gap-7">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground mb-1">
            Analytics
          </h1>
          <p className="text-muted-foreground text-sm">Detailed performance tracking and post breakdown.</p>
        </div>

        {/* Export dropdown */}
        <div className="relative shrink-0" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setExportOpen(!exportOpen)}
            className="h-9 px-4 rounded-xl flex items-center gap-2 text-sm font-semibold text-foreground bg-[var(--nm-bg)] transition-all"
            style={{ boxShadow: exportOpen ? "var(--nm-inset-sm)" : "var(--nm-raised-sm)" }}
          >
            <Download className="w-4 h-4 text-[#2E5E99]" />
            Export
            <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${exportOpen ? "rotate-180" : ""}`} />
          </button>

          {exportOpen && (
            <div
              className="absolute right-0 mt-2 w-48 rounded-xl overflow-hidden z-50 bg-[var(--nm-bg)]"
              style={{ boxShadow: "var(--nm-raised)" }}
            >
              <div
                className="h-px mx-3 mb-1 mt-1"
                style={{ background: "linear-gradient(to right, transparent, rgba(46,94,153,0.3), transparent)" }}
              />
              {[
                { label: "Export as CSV", icon: FileText, action: handleExportCSV },
                { label: "Export as PDF", icon: Download, action: handleExportPDF },
              ].map(({ label, icon: Icon, action }) => (
                <button
                  key={label}
                  type="button"
                  onClick={action}
                  className="w-full px-4 py-2.5 text-sm text-left text-foreground flex items-center gap-2.5 transition-all hover:text-[#2E5E99]"
                >
                  <Icon className="w-4 h-4 text-[#2E5E99] shrink-0" />
                  {label}
                </button>
              ))}
              <div className="h-1" />
            </div>
          )}
        </div>
      </div>

      {/* Date range filter */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center bg-[var(--nm-bg)] shrink-0"
          style={{ boxShadow: "var(--nm-raised-xs)" }}
        >
          <Calendar className="w-3.5 h-3.5 text-[#2E5E99]" />
        </div>

        <input
          type="date"
          value={dateStart}
          onChange={e => setDateStart(e.target.value)}
          aria-label="Start date"
          className="h-8 rounded-xl px-3 text-xs text-foreground bg-[var(--nm-bg)] focus:outline-none"
          style={{ boxShadow: "var(--nm-inset-sm)" }}
        />
        <span className="text-xs text-muted-foreground font-medium">to</span>
        <input
          type="date"
          value={dateEnd}
          onChange={e => setDateEnd(e.target.value)}
          aria-label="End date"
          className="h-8 rounded-xl px-3 text-xs text-foreground bg-[var(--nm-bg)] focus:outline-none"
          style={{ boxShadow: "var(--nm-inset-sm)" }}
        />
        {(dateStart || dateEnd) && (
          <button
            type="button"
            onClick={() => { setDateStart(""); setDateEnd("") }}
            className="h-8 px-3 rounded-xl text-xs font-medium text-muted-foreground bg-[var(--nm-bg)] transition-all"
            style={{ boxShadow: "var(--nm-raised-xs)" }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, i) => (
          <div
            key={i}
            className="rounded-2xl p-5 bg-[var(--nm-bg)] flex flex-col gap-4"
            style={{ boxShadow: "var(--nm-raised)" }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: stat.bg, boxShadow: "var(--nm-inset-sm)" }}
            >
              <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
            </div>
            <div>
              <div className="font-display text-4xl font-bold text-foreground leading-none mb-1.5">
                {loading ? "—" : stat.value}
              </div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {stat.title}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-[#10B981]" />
                All time
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-5 lg:grid-cols-2">

        {/* Line chart — posts per week */}
        <div
          className="rounded-2xl p-6 bg-[var(--nm-bg)]"
          style={{ boxShadow: "var(--nm-raised)" }}
        >
          <h2 className="font-display text-base font-semibold text-foreground mb-0.5">
            Posts Created
          </h2>
          <p className="text-xs text-muted-foreground mb-5">Last 8 weeks</p>

          <div
            className="rounded-xl p-4 bg-[var(--nm-bg)]"
            style={{ boxShadow: "var(--nm-inset-sm)" }}
          >
            {loading ? (
              <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
                Loading…
              </div>
            ) : posts.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
                No data yet — start publishing.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={weeklyData} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="week" {...axisProps} />
                  <YAxis {...axisProps} allowDecimals={false} />
                  <Tooltip content={<NmTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="posts"
                    stroke="#2E5E99"
                    strokeWidth={2.5}
                    dot={{ fill: "#2E5E99", r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: "#2E5E99", strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Bar chart — posts by platform */}
        <div
          className="rounded-2xl p-6 bg-[var(--nm-bg)]"
          style={{ boxShadow: "var(--nm-raised)" }}
        >
          <h2 className="font-display text-base font-semibold text-foreground mb-0.5">
            Posts by Platform
          </h2>
          <p className="text-xs text-muted-foreground mb-5">All time distribution</p>

          <div
            className="rounded-xl p-4 bg-[var(--nm-bg)]"
            style={{ boxShadow: "var(--nm-inset-sm)" }}
          >
            {loading ? (
              <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
                Loading…
              </div>
            ) : posts.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
                No data yet — start publishing.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={platformData} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="platform" {...axisProps} />
                  <YAxis {...axisProps} allowDecimals={false} />
                  <Tooltip content={<NmTooltip />} />
                  <Bar
                    dataKey="posts"
                    fill="#2E5E99"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
