"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, CheckCircle2, Clock, AlertTriangle, FileText } from "lucide-react"
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

export default function AnalyticsPage() {
  const supabase = createClient()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

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

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full relative z-10 h-full flex flex-col">
      <div className="mb-8 shrink-0">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-2">Analytics</h1>
        <p className="text-slate-500 text-lg">Detailed performance tracking and post breakdown.</p>
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
              <div className="h-full flex items-center justify-center text-sm text-slate-400">Loading…</div>
            ) : posts.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">No data yet — start publishing.</div>
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
