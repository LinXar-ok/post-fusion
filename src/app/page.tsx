"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { motion, Variants } from "framer-motion"
import { BarChart3, Clock, TrendingUp, Presentation, CheckCircle } from "lucide-react"

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
}

const staggerItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
}

export default function Dashboard() {
  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full relative z-10">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="mb-10"
      >
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-2">
          Dashboard Overview
        </h1>
        <p className="text-slate-500 text-lg">Here is what&apos;s happening with your social presence today.</p>
      </motion.div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8"
      >
        <motion.div variants={staggerItem}>
          <Card className="bg-white/80 border-slate-200 shadow-sm backdrop-blur-xl overflow-hidden relative group transition-all hover:shadow-md hover:border-violet-200">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <BarChart3 className="w-24 h-24 text-violet-600 absolute -top-4 -right-4" />
            </div>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Total Reach</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-black text-slate-900">14,291</div>
              <p className="text-sm font-medium text-emerald-600 flex items-center mt-2">
                <TrendingUp className="w-4 h-4 mr-1" />
                +20.1% vs last month
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={staggerItem}>
          <Card className="bg-white/80 border-slate-200 shadow-sm backdrop-blur-xl overflow-hidden relative group transition-all hover:shadow-md hover:border-emerald-200">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <CheckCircle className="w-24 h-24 text-emerald-600 absolute -top-4 -right-4" />
            </div>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Published Posts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-black text-slate-900">124</div>
              <p className="text-sm font-medium text-slate-500 mt-2">Across all platforms</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={staggerItem}>
          <Card className="bg-white/80 border-slate-200 shadow-sm backdrop-blur-xl overflow-hidden relative group transition-all hover:shadow-md hover:border-amber-200">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Clock className="w-24 h-24 text-amber-500 absolute -top-4 -right-4" />
            </div>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Scheduled Posts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-black text-slate-900">12</div>
              <p className="text-sm font-medium text-slate-500 mt-2">Next 7 days</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={staggerItem}>
          <Card className="bg-white/80 border-slate-200 shadow-sm backdrop-blur-xl overflow-hidden relative group transition-all hover:shadow-md hover:border-rose-200">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Presentation className="w-24 h-24 text-rose-500 absolute -top-4 -right-4" />
            </div>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Audience Engaged</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-black text-slate-900">4.3%</div>
              <p className="text-sm font-medium text-emerald-600 flex items-center mt-2">
                <TrendingUp className="w-4 h-4 mr-1" />
                +1.2% vs last week
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
        className="grid gap-6 md:grid-cols-2 lg:grid-cols-7"
      >
        <Card className="lg:col-span-4 bg-white/80 border-slate-200 shadow-sm backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-slate-900 text-xl font-bold">Growth Overview</CardTitle>
          </CardHeader>
          <CardContent className="h-[350px] flex items-center justify-center border-t border-slate-100 pt-8 mt-2">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="bg-violet-50 p-4 rounded-full mb-4 ring-8 ring-violet-50/50">
                <BarChart3 className="w-8 h-8 text-violet-600" />
              </div>
              <h4 className="text-lg font-semibold text-slate-900 mb-1">No data available yet</h4>
              <p className="text-slate-500 max-w-[250px]">Connect a social profile to view comprehensive analytics charts.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 bg-white/80 border-slate-200 shadow-sm backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-slate-900 text-xl font-bold">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="border-t border-slate-100 mt-2 pt-6">
            <div className="space-y-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-start space-x-4 relative">
                  {i !== 3 && <div className="absolute top-6 bottom-[-2rem] left-[0.35rem] w-px bg-slate-200" />}
                  <div className="w-3 h-3 mt-1 rounded-full bg-violet-600 shadow-[0_0_0_4px_rgba(139,92,246,0.1)] z-10" />
                  <div className="space-y-1.5 flex-1">
                    <p className="text-sm font-semibold text-slate-900">
                      Scheduled new post on Twitter
                    </p>
                    <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                      &quot;Announcing our Q3 product roadmap...&quot;
                    </p>
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                      {i} hour{i > 1 ? 's' : ''} ago
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
