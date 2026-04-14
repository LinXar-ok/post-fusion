"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

type Post = {
  id: string
  content: string
  platforms: string[]
  status: string
  scheduled_for: string | null
  published_at: string | null
}

const PLATFORM_DOT: Record<string, string> = {
  linkedin:  "#0A66C2",
  x:         "#64748b",
  facebook:  "#1877F2",
  instagram: "#E1306C",
}

const STATUS_DOT: Record<string, string> = {
  published: "#7BA4D0",
  scheduled: "#675B47",
  draft:     "#94a3b8",
  failed:    "#363630",
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

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
    const monthEnd   = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0, 23, 59, 59).toISOString()
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

  const year  = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const monthName      = viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })
  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const daysInMonth     = new Date(year, month + 1, 0).getDate()
  const isCurrentMonth  = now.getFullYear() === year && now.getMonth() === month

  const dates = Array.from({ length: 42 }, (_, i) => i - firstDayOfMonth + 1)

  function getPostsForDate(date: number): Post[] {
    if (date < 1 || date > daysInMonth) return []
    return posts.filter(p => {
      const ds = p.scheduled_for || p.published_at
      if (!ds) return false
      const d = new Date(ds)
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === date
    })
  }

  function getDisplayDate(date: number) {
    if (date < 1) return new Date(year, month, date).getDate()
    if (date > daysInMonth) return date - daysInMonth
    return date
  }

  const NavBtn = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={onClick}
      className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors bg-[var(--nm-bg)]"
      style={{ boxShadow: "var(--nm-raised-xs)" }}
    >
      {children}
    </button>
  )

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full h-[calc(100vh-4rem)] flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-start justify-between shrink-0">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground mb-1">
            Calendar
          </h1>
          <p className="text-muted-foreground text-sm">Manage your content schedule across the month.</p>
        </div>
        <Link href="/publishing">
          <button
            type="button"
            className="h-10 px-5 rounded-xl flex items-center gap-2 text-sm font-semibold bg-[#2E5E99] text-white hover:bg-[#0e7066] transition-colors"
            style={{ boxShadow: "var(--nm-raised-sm)" }}
          >
            <Plus className="w-4 h-4" />
            Schedule Post
          </button>
        </Link>
      </div>

      {/* Calendar card */}
      <div
        className="flex-1 rounded-2xl bg-[var(--nm-bg)] flex flex-col overflow-hidden min-h-0"
        style={{ boxShadow: "var(--nm-raised)" }}
      >
        {/* Month nav */}
        <div className="px-6 py-4 flex items-center justify-between shrink-0">
          <h2 className="font-display text-base font-semibold text-foreground">{monthName}</h2>
          <div className="flex items-center gap-1.5">
            <NavBtn onClick={() => setViewDate(new Date(year, month - 1, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </NavBtn>
            <button
              type="button"
              onClick={() => setViewDate(new Date(now.getFullYear(), now.getMonth(), 1))}
              className="h-8 px-4 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors bg-[var(--nm-bg)]"
              style={{ boxShadow: "var(--nm-raised-xs)" }}
            >
              Today
            </button>
            <NavBtn onClick={() => setViewDate(new Date(year, month + 1, 1))}>
              <ChevronRight className="w-4 h-4" />
            </NavBtn>
          </div>
        </div>

        {/* Teal accent line */}
        <div
          className="h-px mx-6 mb-1 shrink-0"
          style={{ background: "linear-gradient(to right, transparent, rgba(46,94,153,0.35), transparent)" }}
        />

        {/* Grid container — recessed well */}
        <div
          className="flex-1 flex flex-col overflow-hidden mx-4 mb-4 rounded-xl bg-[var(--nm-bg)]"
          style={{ boxShadow: "var(--nm-inset-sm)" }}
        >
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 shrink-0">
            {DAY_LABELS.map(day => (
              <div
                key={day}
                className="py-2.5 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Separator */}
          <div
            className="h-px mx-2 shrink-0"
            style={{ background: "rgba(163,177,198,0.25)" }}
          />

          {/* Date cells */}
          <div className="flex-1 grid grid-cols-7 grid-rows-6 overflow-y-auto">
            {dates.map((date, i) => {
              const dayPosts  = getPostsForDate(date)
              const isOutside = date < 1 || date > daysInMonth
              const isToday   = isCurrentMonth && date === now.getDate()
              const showBorderRight  = (i + 1) % 7 !== 0
              const showBorderBottom = i < 35

              return (
                <div
                  key={i}
                  className={cn(
                    "p-2 min-h-[90px]",
                    isOutside ? "opacity-30" : ""
                  )}
                  style={{
                    borderRight:  showBorderRight  ? "1px solid rgba(163,177,198,0.2)" : undefined,
                    borderBottom: showBorderBottom ? "1px solid rgba(163,177,198,0.2)" : undefined,
                  }}
                >
                  {/* Date number */}
                  <div className="flex items-start justify-end mb-1">
                    <span
                      className={cn(
                        "text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full transition-all",
                        isToday
                          ? "bg-[#2E5E99] text-white"
                          : "text-muted-foreground"
                      )}
                      style={isToday ? { boxShadow: "var(--nm-raised-xs)" } : undefined}
                    >
                      {getDisplayDate(date)}
                    </span>
                  </div>

                  {/* Post pills */}
                  {!isOutside && !loading && dayPosts.map(post => {
                    const platform = post.platforms?.[0]
                    const dotColor = platform
                      ? (PLATFORM_DOT[platform] ?? "#2E5E99")
                      : (STATUS_DOT[post.status] ?? "#94a3b8")
                    return (
                      <div
                        key={post.id}
                        title={post.content}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-lg mb-1 bg-[var(--nm-bg)] cursor-default"
                        style={{ boxShadow: "var(--nm-raised-xs)" }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: dotColor }}
                        />
                        <span className="text-[10px] font-medium text-foreground truncate leading-none">
                          {post.content.length > 22
                            ? post.content.substring(0, 22) + "…"
                            : post.content}
                        </span>
                      </div>
                    )
                  })}

                  {/* Loading shimmer */}
                  {!isOutside && loading && (
                    <div className="h-5 rounded-lg bg-[var(--nm-bg)] animate-pulse mt-1"
                      style={{ boxShadow: "var(--nm-raised-xs)" }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
