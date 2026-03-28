"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"

export default function CalendarPage() {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dates = Array.from({ length: 35 }, (_, i) => i - 2);

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full h-[calc(100vh-4rem)] flex flex-col relative z-10">
      <div className="flex items-center justify-between mb-8 shrink-0">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-2">Calendar</h1>
          <p className="text-slate-500 text-lg">Manage your content schedule across the month.</p>
        </div>
        <Button className="bg-violet-600 hover:bg-violet-700 text-white shadow-md rounded-lg h-10 transition-colors">
          <Plus className="w-4 h-4 mr-2" />
          Schedule Post
        </Button>
      </div>

      <Card className="flex-1 bg-white border-slate-200 shadow-sm backdrop-blur-xl overflow-hidden flex flex-col min-h-0">
        <CardHeader className="border-b border-slate-100 bg-slate-50/80 p-4 flex flex-row items-center justify-between shrink-0">
          <CardTitle className="text-lg font-bold text-slate-800">October 2026</CardTitle>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-full border-slate-200 shadow-xs text-slate-500 hover:text-slate-900 bg-white hover:bg-slate-50">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 rounded-full border-slate-200 shadow-xs text-slate-600 font-medium px-4 bg-white hover:bg-slate-50">
              Today
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-full border-slate-200 shadow-xs text-slate-500 hover:text-slate-900 bg-white hover:bg-slate-50">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-0 flex flex-col overflow-hidden">
          {/* Days string header */}
          <div className="grid grid-cols-7 border-b border-slate-100 bg-white shrink-0">
            {days.map(day => (
              <div key={day} className="p-3 text-center text-xs font-bold uppercase tracking-widest text-slate-400">
                {day}
              </div>
            ))}
          </div>
          {/* Grid */}
          <div className="flex-1 grid grid-cols-7 grid-rows-5 bg-slate-50/50 overflow-y-auto">
            {dates.map((date, i) => (
              <div
                key={i}
                className={`min-h-[120px] p-2 border-r border-b border-slate-100 bg-white relative transition-colors hover:bg-slate-50/80 group ${date < 1 || date > 31 ? 'opacity-40' : ''}`}
              >
                <div className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full mb-1 transition-colors ${date === 15 ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-500 group-hover:text-slate-900'}`}>
                  {date < 1 ? 30 + date : date > 31 ? date - 31 : date}
                </div>

                {/* Mock data indicator */}
                {date === 12 || date === 18 || date === 24 ? (
                  <div className="mt-1 px-2 py-1.5 bg-indigo-50/80 border border-indigo-100 text-indigo-700 text-xs font-semibold rounded-md truncate shadow-xs">
                    Product Launch Update
                  </div>
                ) : null}
                {date === 18 ? (
                  <div className="mt-1 px-2 py-1.5 bg-emerald-50/80 border border-emerald-100 text-emerald-700 text-xs font-semibold rounded-md truncate shadow-xs">
                    Webinar Announcement
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
