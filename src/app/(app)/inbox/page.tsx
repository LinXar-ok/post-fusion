"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Filter, Send, Webhook, RefreshCw } from "lucide-react"
import { FaLinkedin, FaXTwitter, FaFacebook } from "react-icons/fa6"
import {
  getInboxMessages,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  type InboxMessage,
} from "./actions"

const platformIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  linkedin: FaLinkedin,
  x: FaXTwitter,
  facebook: FaFacebook,
}

const platformColors: Record<string, string> = {
  linkedin: "text-[#0A66C2]",
  x: "text-slate-900",
  facebook: "text-[#1877F2]",
}

export default function InboxPage() {
  const [messages, setMessages] = useState<InboxMessage[]>([])
  const [selectedMsg, setSelectedMsg] = useState<InboxMessage | null>(null)
  const [filter, setFilter] = useState<"all" | "unread" | "linkedin" | "x" | "facebook">("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const loadMessages = async () => {
    setLoading(true)
    const data = await getInboxMessages(filter)
    setMessages(data)
    const count = await getUnreadCount()
    setUnreadCount(count)
    setLoading(false)
  }

  useEffect(() => { loadMessages() }, [filter])

  const handleSelectMessage = async (msg: InboxMessage) => {
    setSelectedMsg(msg)
    if (!msg.is_read) {
      await markAsRead(msg.id)
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_read: true } : m))
      setUnreadCount(prev => Math.max(0, prev - 1))
    }
  }

  const handleMarkAllRead = async () => {
    await markAllAsRead()
    setMessages(prev => prev.map(m => ({ ...m, is_read: true })))
    setUnreadCount(0)
  }

  const filteredMessages = searchQuery
    ? messages.filter(m =>
        m.sender_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.content.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : messages

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return "Just now"
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  const FilterButton = ({ value, label }: { value: typeof filter; label: string }) => {
    const isActive = filter === value
    return (
      <Button
        variant={isActive ? "secondary" : "outline"}
        size="sm"
        className={`h-7 text-xs rounded-full font-bold shadow-xs shrink-0 ${
          isActive
            ? "bg-[#128C7E]/10 hover:bg-[#128C7E]/20 text-[#0B1020] border border-[#128C7E]/20"
            : "bg-white hover:bg-slate-50 text-slate-600 border-slate-200"
        }`}
        onClick={() => setFilter(value)}
      >
        {label}
      </Button>
    )
  }

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
          <span className="font-semibold">Webhook setup required</span> — To receive live messages and comments, configure the platform webhooks in your developer apps pointing to{" "}
          <code className="text-xs bg-amber-100 px-1 py-0.5 rounded">yourdomain.com/api/webhooks/inbox?platform=PLATFORM</code>.
          Live data will replace these preview messages once connected.
        </div>
      </div>

      <Card className="flex-1 bg-white border-slate-200 shadow-sm backdrop-blur-xl overflow-hidden flex min-h-0">
        <div className="w-full md:w-80 border-r border-slate-100 bg-slate-50/50 flex flex-col h-full shrink-0">
          <div className="p-4 border-b border-slate-100 bg-white">
            <div className="flex items-center gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search conversations..."
                  className="pl-9 bg-slate-50 border-slate-200 shadow-xs h-9 text-sm rounded-lg focus-visible:ring-[#128C7E]"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={loadMessages}
                disabled={loading}
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 text-slate-500 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              <FilterButton value="all" label={`All (${messages.length})`} />
              {unreadCount > 0 && (
                <FilterButton value="unread" label={`Unread (${unreadCount})`} />
              )}
              <FilterButton value="linkedin" label="LinkedIn" />
              <FilterButton value="x" label="X" />
              <FilterButton value="facebook" label="Facebook" />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {filteredMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <Webhook className="w-12 h-12 text-slate-300 mb-4" />
                <p className="text-sm font-medium text-slate-500">No messages yet</p>
                <p className="text-xs text-slate-400 mt-1">Messages will appear once webhooks are connected.</p>
              </div>
            ) : (
              filteredMessages.map(msg => {
                const Icon = platformIcons[msg.platform] ?? FaLinkedin
                return (
                  <div
                    key={msg.id}
                    className={`p-4 border-b border-slate-100 cursor-pointer transition-colors ${
                      !msg.is_read ? "bg-white hover:bg-slate-50" : "hover:bg-slate-100/50 opacity-80"
                    } ${selectedMsg?.id === msg.id ? "bg-white" : ""}`}
                    onClick={() => handleSelectMessage(msg)}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center gap-2">
                        <div className="font-bold text-sm text-slate-900">{msg.sender_name}</div>
                        <Icon className={`w-3.5 h-3.5 ${platformColors[msg.platform] ?? "text-slate-400"}`} />
                      </div>
                      <span className="text-xs font-semibold text-slate-400">{formatTimeAgo(msg.created_at)}</span>
                    </div>
                    {msg.sender_handle && (
                      <p className="text-xs font-medium text-slate-500 mt-0.5 truncate">{msg.sender_handle}</p>
                    )}
                    <p className={`text-sm mt-2 line-clamp-2 leading-relaxed ${msg.is_read ? "text-slate-500" : "text-slate-800 font-medium"}`}>
                      {msg.content}
                    </p>
                    {!msg.is_read && (
                      <div className="w-2 h-2 rounded-full bg-[#128C7E] mt-3 shadow-xs" />
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="hidden md:flex flex-1 flex-col bg-white h-full relative">
          {selectedMsg ? (
            <>
              <div className="h-16 border-b border-slate-100 bg-white/80 backdrop-blur-xl flex items-center px-6 shrink-0">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 font-bold shadow-xs">
                    {selectedMsg.sender_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{selectedMsg.sender_name}</h3>
                    <p className="text-xs font-medium text-slate-500 flex items-center gap-1 mt-0.5">
                      {selectedMsg.platform === "x" && <FaXTwitter className="w-3 h-3 text-slate-400" />}
                      {selectedMsg.platform === "linkedin" && <FaLinkedin className="w-3 h-3 text-[#0A66C2]" />}
                      {selectedMsg.platform === "facebook" && <FaFacebook className="w-3 h-3 text-[#1877F2]" />}
                      {selectedMsg.sender_handle ?? `via ${selectedMsg.platform}`}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
                <div className="flex flex-col space-y-6">
                  <div className="flex justify-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-xs">
                      {formatTimeAgo(selectedMsg.created_at)}
                    </span>
                  </div>
                  <div className="bg-white p-4 rounded-2xl rounded-tl-sm border border-slate-200 shadow-sm max-w-lg self-start">
                    <p className="text-slate-700 text-[15px] leading-relaxed">{selectedMsg.content}</p>
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-slate-100 bg-white shrink-0">
                <div className="relative flex items-center">
                  <Input
                    placeholder={`Type your reply to ${selectedMsg.sender_name.split(" ")[0]}...`}
                    className="flex-1 pr-12 bg-slate-50 border-slate-200 text-slate-900 h-12 rounded-xl shadow-inner focus-visible:ring-[#128C7E]"
                  />
                  <Button
                    size="icon"
                    className="absolute right-1.5 h-9 w-9 rounded-lg bg-[#128C7E] hover:bg-[#0B1020] shadow-sm text-white transition-transform hover:scale-105"
                  >
                    <Send className="w-4 h-4 ml-0.5" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <p className="text-sm font-medium text-slate-400">Select a conversation to view details</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
