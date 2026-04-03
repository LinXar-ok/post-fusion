"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { motion, Variants } from "framer-motion"
import { BarChart3, Clock, CheckCircle, Layers } from "lucide-react"
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
  linkedin: "text-[#0A66C2]", x: "text-slate-900", facebook: "text-[#1877F2]",
}

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
}
const staggerItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
}

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

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const dayCounts = days.map((_, i) => posts.filter(p => new Date(p.created_at).getDay() === i).length)
  const maxCount = Math.max(...dayCounts, 1)

  const stats = [
    { title: "Published Posts", value: loading ? "—" : String(publishedCount), sub: "All time", icon: CheckCircle, color: "emerald" },
    { title: "Scheduled Posts", value: loading ? "—" : String(scheduledCount), sub: "Upcoming", icon: Clock, color: "amber" },
    { title: "Total Created", value: loading ? "—" : String(posts.length), sub: "All platforms", icon: Layers, color: "teal" },
    { title: "Connected Profiles", value: loading ? "—" : String(profileCount), sub: "OAuth integrations", icon: BarChart3, color: "rose" },
  ]

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full relative z-10">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-10">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-2">Dashboard Overview</h1>
        <p className="text-slate-500 text-lg">Here is what&apos;s happening with your social presence today.</p>
      </motion.div>

      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {stats.map((stat, i) => (
          <motion.div key={i} variants={staggerItem}>
            <Card className="bg-white/80 border-slate-200 shadow-sm backdrop-blur-xl overflow-hidden relative group transition-all hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-semibold text-slate-600 uppercase tracking-wider">{stat.title}</CardTitle>
                <stat.icon className="w-4 h-4 text-slate-300" />
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-black text-slate-900">{stat.value}</div>
                <p className="text-sm font-medium text-slate-500 mt-2">{stat.sub}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }} className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4 bg-white/80 border-slate-200 shadow-sm backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-slate-900 text-xl font-bold">Post Activity (by Day of Week)</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px] flex items-end gap-2 border-t border-slate-100 pt-6 mt-2 px-6 pb-4">
            {loading ? (
              <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Loading…</div>
            ) : posts.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <div className="bg-[#128C7E]/5 p-4 rounded-full mb-4"><BarChart3 className="w-8 h-8 text-[#128C7E]" /></div>
                <h4 className="text-base font-semibold text-slate-900 mb-1">No data yet</h4>
                <p className="text-slate-500 text-sm max-w-[220px]">Publish your first post to see activity here.</p>
              </div>
            ) : (
              days.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-full bg-[#128C7E]/5 rounded-t-lg relative" style={{ height: "200px" }}>
                    <div
                      className="absolute bottom-0 w-full bg-[#128C7E] rounded-t-lg transition-all duration-700 ease-out"
                      style={{ height: `${(dayCounts[i] / maxCount) * 100}%`, minHeight: dayCounts[i] > 0 ? "4px" : "0" }}
                    />
                    {dayCounts[i] > 0 && (
                      <div className="absolute -top-5 w-full text-center text-[10px] font-bold text-[#0B1020]">{dayCounts[i]}</div>
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">{day}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 bg-white/80 border-slate-200 shadow-sm backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-slate-900 text-xl font-bold">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="border-t border-slate-100 mt-2 pt-6">
            {loading ? (
              <p className="text-sm text-slate-400">Loading…</p>
            ) : recentPosts.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No posts yet. Start publishing!</p>
            ) : (
              <div className="space-y-6">
                {recentPosts.map((post, i) => {
                  const platform = post.platforms?.[0]
                  const PlatformIcon = platform ? platformIcons[platform] : null
                  const iconColor = platform ? platformColors[platform] : "text-slate-400"
                  const statusLabel = post.status === "scheduled" ? "Scheduled post" : post.status === "published" ? "Published post" : `Post ${post.status}`
                  return (
                    <div key={post.id} className="flex items-start space-x-4 relative">
                      {i !== recentPosts.length - 1 && (
                        <div className="absolute top-6 bottom-[-2rem] left-[0.35rem] w-px bg-slate-200" />
                      )}
                      <div className="w-3 h-3 mt-1 rounded-full bg-[#128C7E] shadow-[0_0_0_4px_rgba(18,140,126,0.1)] z-10 shrink-0" />
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900 truncate">{statusLabel}</p>
                          {PlatformIcon && <PlatformIcon className={`w-3.5 h-3.5 ${iconColor} shrink-0`} />}
                        </div>
                        <p className="text-sm text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 line-clamp-2">
                          &quot;{post.content}&quot;
                        </p>
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                          {new Date(post.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
