"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3, TrendingUp, Users, Activity, Eye, ArrowUpRight } from "lucide-react"

export default function AnalyticsPage() {
  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full relative z-10 h-full flex flex-col">
      <div className="mb-8 shrink-0">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-2">Analytics</h1>
        <p className="text-slate-500 text-lg">Detailed performance tracking and audience growth.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {[
          { title: "Net Audience Growth", value: "+2,431", trend: "+12.4%", icon: Users, color: "violet" },
          { title: "Total Impressions", value: "84.2K", trend: "+5.2%", icon: Eye, color: "emerald" },
          { title: "Engagement Rate", value: "4.8%", trend: "+1.1%", icon: Activity, color: "amber" },
          { title: "Link Clicks", value: "1,204", trend: "+8.9%", icon: ArrowUpRight, color: "rose" },
        ].map((metric, i) => (
          <Card key={i} className="bg-white/80 border-slate-200 shadow-sm backdrop-blur-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-semibold text-slate-600 uppercase tracking-wider">{metric.title}</CardTitle>
              <metric.icon className={`w-4 h-4 text-${metric.color}-500`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-slate-900">{metric.value}</div>
              <p className="text-sm font-medium text-emerald-600 flex items-center mt-2">
                <TrendingUp className="w-4 h-4 mr-1" />
                {metric.trend} this week
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2 flex-1 min-h-[400px]">
        <Card className="bg-white/80 border-slate-200 shadow-sm backdrop-blur-xl overflow-hidden flex flex-col">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-slate-900">Audience Growth Timeline</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex items-center justify-center p-6 border-t border-slate-100 bg-slate-50/50">
            {/* Visual representation of a chart since we don't have recharts yet */}
            <div className="w-full h-full flex flex-col justify-end space-y-2 relative">
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                <BarChart3 className="w-32 h-32 text-violet-600" />
              </div>
              <div className="flex h-full items-end justify-between space-x-2">
                {[40, 30, 50, 40, 70, 60, 85].map((height, i) => (
                  <div key={i} className="w-full bg-violet-100 rounded-t-lg relative group">
                    <div
                      className="absolute bottom-0 w-full bg-violet-600 rounded-t-lg transition-all duration-1000 ease-out shadow-sm"
                      style={{ height: `${height}%` }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 border-slate-200 shadow-sm backdrop-blur-xl overflow-hidden flex flex-col">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-slate-900">Top Performing Posts</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0 flex flex-col overflow-y-auto border-t border-slate-100 bg-slate-50/30">
             <div className="divide-y divide-slate-100">
               {[1, 2, 3, 4, 5].map((i) => (
                 <div key={i} className="p-4 flex items-start justify-between hover:bg-slate-50 hover:cursor-pointer transition-colors">
                   <div className="space-y-1">
                     <p className="text-sm font-semibold text-slate-900 line-clamp-1 max-w-[250px]">
                       Top 5 ways to accelerate your SaaS pipeline in Q4...
                     </p>
                     <p className="text-xs font-medium text-slate-500 uppercase">Oct {12 - i}, 2026</p>
                   </div>
                   <div className="text-right">
                     <div className="text-sm font-bold text-slate-900">{14.2 - i}.{i}K</div>
                     <p className="text-xs text-slate-500 font-medium">Impressions</p>
                   </div>
                 </div>
               ))}
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
