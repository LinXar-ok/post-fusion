"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { motion, Variants } from "framer-motion"
import { BarChart3, Clock, CheckCircle, Layers, Link2 } from "lucide-react"
import { FaLinkedin, FaXTwitter, FaFacebook } from "react-icons/fa6"

type Post = {
  id: string
  status: string
  content: string
  platforms: string[]
  created_at: string
}

const platformIcons: Record<string, React.ElementType> = {
  linkedin: FaLinkedin, x: FaXTwitter, facebook: FaFacebook,
}
const platformColors: Record<string, string> = {
  linkedin: "text-[#0A66C2]", x: "text-slate-600 dark:text-slate-300", facebook: "text-[#1877F2]",
}

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
}
const staggerItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 280, damping: 26 } },
}

const statMeta = [
  { color: "#128C7E", bg: "rgba(18,140,126,0.12)" },
  { color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
  { color: "#6366F1", bg: "rgba(99,102,241,0.12)" },
  { color: "#F43F5E", bg: "rgba(244,63,94,0.12)" },
]

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export default function Dashboard() {
  const supabase = createClient()
  const [posts, setPosts] = useState<Post[]>([])
  const [profileCount, setProfileCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [postsRes, profilesRes] = await Promise.all([
        supabase.from("posts").select("id, status, content, platforms, created_at")
          .eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
        supabase.from("social_profiles").select("platform", { count: "exact" }).eq("user_id", user.id),
      ])
      setPosts(postsRes.data ?? [])
      setProfileCount(profilesRes.count ?? 0)
      setLoading(false)
    }
    fetchData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const publishedCount = posts.filter(p => p.status === "published").length
  const scheduledCount = posts.filter(p => p.status === "scheduled").length
  const recentPosts = posts.slice(0, 3)
  const dayCounts = days.map((_, i) => posts.filter(p => new Date(p.created_at).getDay() === i).length)
  const maxCount = Math.max(...dayCounts, 1)

  const stats = [
    { title: "Published",        value: loading ? "—" : String(publishedCount), sub: "All time",            icon: CheckCircle, ...statMeta[0] },
    { title: "Scheduled",        value: loading ? "—" : String(scheduledCount), sub: "Upcoming",            icon: Clock,       ...statMeta[1] },
    { title: "Total Created",    value: loading ? "—" : String(posts.length),   sub: "All platforms",       icon: Layers,      ...statMeta[2] },
    { title: "Profiles",         value: loading ? "—" : String(profileCount),   sub: "OAuth connections",   icon: Link2,       ...statMeta[3] },
  ]

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full">

      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="mb-10"
      >
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground mb-1">
          Dashboard
        </h1>
        <p className="text-muted-foreground text-sm">
          Here&apos;s what&apos;s happening with your social presence today.
        </p>
      </motion.div>

      {/* Stat cards */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-7"
      >
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            variants={staggerItem}
            className="rounded-2xl p-5 bg-[var(--nm-bg)] flex flex-col gap-4"
            style={{ boxShadow: "var(--nm-raised)" }}
          >
            {/* Icon badge */}
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: stat.bg,
                boxShadow: "var(--nm-inset-sm)",
              }}
            >
              <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
            </div>

            {/* Value */}
            <div>
              <div className="font-display text-4xl font-bold text-foreground leading-none mb-1.5">
                {stat.value}
              </div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {stat.title}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.sub}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Charts row */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.35 }}
        className="grid gap-5 lg:grid-cols-7"
      >

        {/* Bar chart — Post Activity */}
        <div
          className="lg:col-span-4 rounded-2xl p-6 bg-[var(--nm-bg)]"
          style={{ boxShadow: "var(--nm-raised)" }}
        >
          <h2 className="font-display text-base font-semibold text-foreground mb-1">
            Post Activity
          </h2>
          <p className="text-xs text-muted-foreground mb-6">Posts created by day of week</p>

          {loading ? (
            <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
              Loading…
            </div>
          ) : posts.length === 0 ? (
            <div className="h-[220px] flex flex-col items-center justify-center text-center">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 bg-[var(--nm-bg)]"
                style={{ boxShadow: "var(--nm-inset-sm)" }}
              >
                <BarChart3 className="w-5 h-5 text-[#128C7E]" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">No data yet</p>
              <p className="text-xs text-muted-foreground">Publish your first post to see activity.</p>
            </div>
          ) : (
            <div className="flex items-end gap-2 h-[220px]">
              {days.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  {/* Count label */}
                  <span className="text-[10px] font-bold text-[#128C7E] h-4 flex items-center">
                    {dayCounts[i] > 0 ? dayCounts[i] : ""}
                  </span>

                  {/* Bar track — inset (recessed) */}
                  <div
                    className="w-full rounded-xl relative flex-1 bg-[var(--nm-bg)]"
                    style={{ boxShadow: "var(--nm-inset-sm)" }}
                  >
                    {/* Filled portion */}
                    <motion.div
                      className="absolute bottom-0 left-0 right-0 rounded-xl"
                      style={{
                        background: `linear-gradient(to top, #128C7E, rgba(18,140,126,0.5))`,
                      }}
                      initial={{ height: "0%" }}
                      animate={{ height: `${(dayCounts[i] / maxCount) * 100}%` }}
                      transition={{ duration: 0.7, delay: 0.4 + i * 0.06, ease: "easeOut" }}
                    />
                  </div>

                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {day}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity feed */}
        <div
          className="lg:col-span-3 rounded-2xl p-6 bg-[var(--nm-bg)]"
          style={{ boxShadow: "var(--nm-raised)" }}
        >
          <h2 className="font-display text-base font-semibold text-foreground mb-1">
            Recent Activity
          </h2>
          <p className="text-xs text-muted-foreground mb-6">Your latest post actions</p>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : recentPosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-sm text-muted-foreground">No posts yet. Start publishing!</p>
            </div>
          ) : (
            <div className="space-y-5">
              {recentPosts.map((post, i) => {
                const platform = post.platforms?.[0]
                const PlatformIcon = platform ? platformIcons[platform] : null
                const iconColor = platform ? platformColors[platform] : "text-muted-foreground"
                const statusLabel =
                  post.status === "scheduled" ? "Scheduled"
                  : post.status === "published" ? "Published"
                  : post.status

                return (
                  <div key={post.id} className="flex items-start gap-3 relative">
                    {/* Timeline connector */}
                    {i !== recentPosts.length - 1 && (
                      <div
                        className="absolute top-5 bottom-[-1.25rem] left-[5px] w-px"
                        style={{ background: "linear-gradient(to bottom, rgba(18,140,126,0.3), transparent)" }}
                      />
                    )}

                    {/* Dot */}
                    <div
                      className="w-3 h-3 rounded-full mt-1 shrink-0 bg-[#128C7E]"
                      style={{ boxShadow: "0 0 0 4px rgba(18,140,126,0.12)" }}
                    />

                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-foreground">{statusLabel}</span>
                        {PlatformIcon && <PlatformIcon className={`w-3 h-3 ${iconColor} shrink-0`} />}
                      </div>

                      {/* Content snippet — inset */}
                      <div
                        className="rounded-xl px-3 py-2.5 text-xs text-muted-foreground line-clamp-2 bg-[var(--nm-bg)]"
                        style={{ boxShadow: "var(--nm-inset-sm)" }}
                      >
                        &ldquo;{post.content}&rdquo;
                      </div>

                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                        {new Date(post.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </motion.div>
    </div>
  )
}
