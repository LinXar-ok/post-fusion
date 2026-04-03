"use client"

import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Filter, Send, Webhook } from "lucide-react"
import { FaLinkedin, FaXTwitter } from "react-icons/fa6"

export default function InboxPage() {
  const messages = [
    { id: 1, name: "Sarah Jenkins", handle: "@sarahj", platform: FaXTwitter, time: "10m ago", excerpt: "When is the new feature dropping?", unread: true },
    { id: 2, name: "Michael Chang", handle: "michael-chang", platform: FaLinkedin, time: "2h ago", excerpt: "Great insights on the latest industry report.", unread: true },
    { id: 3, name: "Jessica Taylor", handle: "@jessicataylor", platform: FaXTwitter, time: "1d ago", excerpt: "I've been using this tool and it's amazing!", unread: false },
    { id: 4, name: "David Roberts", handle: "david-r", platform: FaLinkedin, time: "2d ago", excerpt: "Do you offer enterprise plans?", unread: false },
  ]

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full h-[calc(100vh-4rem)] flex flex-col relative z-10">
      <div className="mb-6 shrink-0">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-2">Unified Inbox</h1>
        <p className="text-slate-500 text-lg">Respond to comments, mentions, and direct messages in one place.</p>
      </div>

      {/* Webhook setup banner */}
      <div className="mb-4 flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 shrink-0">
        <Webhook className="w-5 h-5 mt-0.5 shrink-0 text-amber-600" />
        <div>
          <span className="font-semibold">Webhook setup required</span> — To receive live messages and comments, configure the platform webhooks in your developer apps and point them to your deployment URL.
          Live data will replace these preview messages once connected.
        </div>
      </div>

      <Card className="flex-1 bg-white border-slate-200 shadow-sm backdrop-blur-xl overflow-hidden flex min-h-0">
        <div className="w-full md:w-80 border-r border-slate-100 bg-slate-50/50 flex flex-col h-full shrink-0">
          <div className="p-4 border-b border-slate-100 bg-white">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input placeholder="Search conversations..." className="pl-9 bg-slate-50 border-slate-200 shadow-xs h-9 text-sm rounded-lg focus-visible:ring-[#128C7E]" />
            </div>
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
              <Button variant="secondary" size="sm" className="h-7 text-xs rounded-full bg-[#128C7E]/10 hover:bg-[#128C7E]/20 text-[#0B1020] font-bold border border-[#128C7E]/20 shadow-xs shrink-0">All (4)</Button>
              <Button variant="outline" size="sm" className="h-7 text-xs rounded-full bg-white hover:bg-slate-50 text-slate-600 font-semibold border-slate-200 shadow-xs shrink-0">Unread (2)</Button>
              <Button variant="outline" size="sm" className="h-7 text-xs rounded-full bg-white hover:bg-slate-50 text-slate-600 font-semibold border-slate-200 shadow-xs shrink-0 px-2.5">
                <Filter className="w-3 h-3 mr-1" /> Filters
              </Button>
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {messages.map((msg) => (
              <div key={msg.id} className={`p-4 border-b border-slate-100 cursor-pointer transition-colors ${msg.unread ? "bg-white hover:bg-slate-50" : "hover:bg-slate-100/50 opacity-80"}`}>
                <div className="flex justify-between items-start mb-1">
                  <div className="flex items-center gap-2">
                    <div className="font-bold text-sm text-slate-900">{msg.name}</div>
                    <msg.platform className={`w-3.5 h-3.5 ${msg.platform === FaXTwitter ? "text-slate-900" : "text-[#0A66C2]"}`} />
                  </div>
                  <span className="text-xs font-semibold text-slate-400">{msg.time}</span>
                </div>
                <p className="text-xs font-medium text-slate-500 mt-0.5 truncate">{msg.handle}</p>
                <p className={`text-sm mt-2 line-clamp-2 leading-relaxed ${msg.unread ? "text-slate-800 font-medium" : "text-slate-500"}`}>{msg.excerpt}</p>
                {msg.unread && <div className="w-2 h-2 rounded-full bg-[#128C7E] mt-3 shadow-xs" />}
              </div>
            ))}
          </div>
        </div>

        <div className="hidden md:flex flex-1 flex-col bg-white h-full relative">
          <div className="h-16 border-b border-slate-100 bg-white/80 backdrop-blur-xl flex items-center px-6 shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 font-bold shadow-xs">SJ</div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Sarah Jenkins</h3>
                <p className="text-xs font-medium text-slate-500 flex items-center gap-1 mt-0.5">
                  <FaXTwitter className="w-3 h-3 text-slate-400" /> @sarahj
                </p>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
            <div className="flex flex-col space-y-6">
              <div className="flex justify-center">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-xs">Today, 10:24 AM</span>
              </div>
              <div className="bg-white p-4 rounded-2xl rounded-tl-sm border border-slate-200 shadow-sm max-w-lg self-start">
                <p className="text-slate-700 text-[15px] leading-relaxed">Hey there! I saw the announcement about the new scheduling feature. Absolutely love the layout! When exactly is the new feature dropping for beta users?</p>
              </div>
            </div>
          </div>
          <div className="p-4 border-t border-slate-100 bg-white shrink-0">
            <div className="relative flex items-center">
              <Input placeholder="Type your reply to Sarah..." className="flex-1 pr-12 bg-slate-50 border-slate-200 text-slate-900 h-12 rounded-xl shadow-inner focus-visible:ring-[#128C7E]" />
              <Button size="icon" className="absolute right-1.5 h-9 w-9 rounded-lg bg-[#128C7E] hover:bg-[#0B1020] shadow-sm text-white transition-transform hover:scale-105">
                <Send className="w-4 h-4 ml-0.5" />
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
