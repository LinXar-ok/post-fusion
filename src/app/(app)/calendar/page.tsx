"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import Link from "next/link"

type Post = {
  id: string
  content: string
  platforms: string[]
  status: string
  scheduled_for: string | null
  published_at: string | null
}

const PLATFORM_COLORS: Record<string, string> = {
  linkedin: "bg-blue-50 border-blue-100 text-blue-700",
  x: "bg-slate-50 border-slate-200 text-slate-700",
  facebook: "bg-indigo-50 border-indigo-100 text-indigo-700",
  instagram: "bg-rose-50 border-rose-100 text-rose-700",
}

const STATUS_COLORS: Record<string, string> = {
  published: "bg-emerald-50 border-emerald-100 text-emerald-700",
  scheduled: "bg-orange-50 border-orange-100 text-orange-700",
  draft: "bg-slate-50 border-slate-200 text-slate-600",
  failed: "bg-red-50 border-red-100 text-red-700",
}

export default function CalendarPage() {
  const supabase = createClient()
  const [now] = useState(new Date())
  const [viewDate, setViewDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1))
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const monthStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).toISOString()
    const monthEnd = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0, 23, 59, 59).toISOString()

    const { data } = await supabase
      .from("posts")
      .select("id, content, platforms, status, scheduled_for, published_at")
      .eq("user_id", user.id)
      .or(
        `and(scheduled_for.gte.${monthStart},scheduled_for.lte.${monthEnd}),and(published_at.gte.${monthStart},published_at.lte.${monthEnd})`
      )

    setPosts(data ?? [])
    setLoading(false)
  }, [viewDate]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchPosts() }, [fetchPosts])

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const monthName = viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })
  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = now.getDate()
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() === month

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const dates = Array.from({ length: 42 }, (_, i) => i - firstDayOfMonth + 1)

  function getPostsForDate(date: number): Post[] {
    if (date < 1 || date > daysInMonth) return []
    return posts.filter(p => {
      const dateStr = p.scheduled_for || p.published_at
      if (!dateStr) return false
      const d = new Date(dateStr)
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === date
    })
  }

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full h-[calc(100vh-4rem)] flex flex-col relative z-10">
      <div className="flex items-center justify-between mb-8 shrink-0">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-2">Calendar</h1>
          <p className="text-slate-500 text-lg">Manage your content schedule across the month.</p>
        </div>
        <Link href="/publishing">
          <Button className="bg-[#128C7E] hover:bg-[#0B1020] text-white shadow-md rounded-lg h-10 transition-colors">
            <Plus className="w-4 h-4 mr-2" />
            Schedule Post
          </Button>
        </Link>
      </div>

      <Card className="flex-1 bg-white border-slate-200 shadow-sm backdrop-blur-xl overflow-hidden flex flex-col min-h-0">
        <CardHeader className="border-b border-slate-100 bg-slate-50/80 p-4 flex flex-row items-center justify-between shrink-0">
          <CardTitle className="text-lg font-bold text-slate-800">{monthName}</CardTitle>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-full border-slate-200 shadow-xs text-slate-500 hover:text-slate-900 bg-white hover:bg-slate-50"
              onClick={() => setViewDate(new Date(year, month - 1, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 rounded-full border-slate-200 shadow-xs text-slate-600 font-medium px-4 bg-white hover:bg-slate-50"
              onClick={() => setViewDate(new Date(now.getFullYear(), now.getMonth(), 1))}>
              Today
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-full border-slate-200 shadow-xs text-slate-500 hover:text-slate-900 bg-white hover:bg-slate-50"
              onClick={() => setViewDate(new Date(year, month + 1, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-0 flex flex-col overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-100 bg-white shrink-0">
            {days.map(day => (
              <div key={day} className="p-3 text-center text-xs font-bold uppercase tracking-widest text-slate-400">{day}</div>
            ))}
          </div>
          <div className="flex-1 grid grid-cols-7 grid-rows-6 bg-slate-50/50 overflow-y-auto">
            {dates.map((date, i) => {
              const dayPosts = getPostsForDate(date)
              const isOutside = date < 1 || date > daysInMonth
              const isToday = isCurrentMonth && date === today
              return (
                <div key={i}
                  className={`min-h-[100px] p-2 border-r border-b border-slate-100 bg-white relative transition-colors hover:bg-slate-50/80 group ${isOutside ? "opacity-30" : ""}`}
                >
                  <div className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full mb-1 transition-colors ${isToday ? "bg-[#128C7E] text-white shadow-sm" : "text-slate-500 group-hover:text-slate-900"}`}>
                    {date < 1 ? new Date(year, month, date).getDate() : date > daysInMonth ? date - daysInMonth : date}
                  </div>
                  {!isOutside && !loading && dayPosts.map(post => {
                    const platform = post.platforms?.[0]
                    const colorClass = platform ? PLATFORM_COLORS[platform] : STATUS_COLORS[post.status] ?? "bg-slate-50 border-slate-200 text-slate-600"
                    return (
                      <div key={post.id} className={`mt-1 px-2 py-1 border text-xs font-semibold rounded-md truncate shadow-xs ${colorClass}`} title={post.content}>
                        {post.content.length > 28 ? post.content.substring(0, 28) + "…" : post.content}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
