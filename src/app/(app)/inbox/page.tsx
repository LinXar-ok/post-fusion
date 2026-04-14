"use client"

import { useState, useEffect } from "react"
import { Search, Send, Webhook, RefreshCw } from "lucide-react"
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
  x: "text-foreground",
  facebook: "text-[#1877F2]",
}

type FilterValue = "all" | "unread" | "linkedin" | "x" | "facebook"

export default function InboxPage() {
  const [messages, setMessages]     = useState<InboxMessage[]>([])
  const [selectedMsg, setSelectedMsg] = useState<InboxMessage | null>(null)
  const [filter, setFilter]         = useState<FilterValue>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading]       = useState(true)
  const [replyText, setReplyText]   = useState("")

  const loadMessages = async () => {
    setLoading(true)
    const data  = await getInboxMessages(filter)
    const count = await getUnreadCount()
    setMessages(data)
    setUnreadCount(count)
    setLoading(false)
  }

  useEffect(() => { loadMessages() }, [filter]) // eslint-disable-line react-hooks/exhaustive-deps

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
        m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return "Just now"
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  const filterOptions: { value: FilterValue; label: string }[] = [
    { value: "all",       label: `All (${messages.length})` },
    ...(unreadCount > 0 ? [{ value: "unread" as FilterValue, label: `Unread (${unreadCount})` }] : []),
    { value: "linkedin",  label: "LinkedIn" },
    { value: "x",        label: "X" },
    { value: "facebook",  label: "Facebook" },
  ]

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full flex flex-col gap-6 h-[calc(100vh-4rem)]">

      {/* Page header */}
      <div className="shrink-0">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground mb-1">
          Unified Inbox
        </h1>
        <p className="text-muted-foreground text-sm">
          Respond to comments, mentions, and direct messages in one place.
        </p>
      </div>

      {/* Webhook setup notice */}
      <div
        className="shrink-0 rounded-2xl px-5 py-4 flex items-start gap-3 bg-[var(--nm-bg)]"
        style={{ boxShadow: "var(--nm-raised-sm)" }}
      >
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: "rgba(103,91,71,0.12)", boxShadow: "var(--nm-inset-sm)" }}
        >
          <Webhook className="w-4 h-4 text-amber-500" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground mb-0.5">Webhook setup required</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            To receive live messages, configure platform webhooks in your developer apps pointing to{" "}
            <code
              className="rounded-lg px-1.5 py-0.5 text-[#2E5E99] font-mono bg-[var(--nm-bg)]"
              style={{ boxShadow: "var(--nm-inset-sm)" }}
            >
              yourdomain.com/api/webhooks/inbox?platform=PLATFORM
            </code>
          </p>
        </div>
      </div>

      {/* Two-pane layout */}
      <div
        className="flex-1 min-h-0 rounded-2xl overflow-hidden flex bg-[var(--nm-bg)]"
        style={{ boxShadow: "var(--nm-raised)" }}
      >
        {/* Left pane — message list */}
        <div className="w-full md:w-80 shrink-0 flex flex-col h-full border-r border-[rgba(163,177,198,0.15)]">

          {/* Search + filters */}
          <div className="p-4 flex flex-col gap-3 border-b border-[rgba(163,177,198,0.15)]">
            <div className="flex items-center gap-2">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search conversations…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 rounded-xl text-sm text-foreground bg-[var(--nm-bg)] focus:outline-none placeholder:text-muted-foreground"
                  style={{ boxShadow: "var(--nm-inset-sm)" }}
                />
              </div>

              {/* Refresh */}
              <button
                type="button"
                onClick={loadMessages}
                disabled={loading}
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-[var(--nm-bg)] text-muted-foreground transition-all hover:text-[#2E5E99]"
                style={{ boxShadow: "var(--nm-raised-xs)" }}
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {/* Filter chips */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {filterOptions.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFilter(opt.value)}
                  className="h-7 px-3 rounded-full text-xs font-semibold shrink-0 text-foreground bg-[var(--nm-bg)] transition-all"
                  style={{
                    boxShadow: filter === opt.value ? "var(--nm-inset-sm)" : "var(--nm-raised-xs)",
                    color: filter === opt.value ? "#2E5E99" : undefined,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Mark all read */}
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs font-semibold text-[#2E5E99] text-left hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="overflow-y-auto flex-1">
            {filteredMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 bg-[var(--nm-bg)]"
                  style={{ boxShadow: "var(--nm-inset-sm)" }}
                >
                  <Webhook className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">No messages yet</p>
                <p className="text-xs text-muted-foreground mt-1">Messages will appear once webhooks are connected.</p>
              </div>
            ) : (
              filteredMessages.map(msg => {
                const Icon = platformIcons[msg.platform] ?? FaLinkedin
                const isSelected = selectedMsg?.id === msg.id
                return (
                  <button
                    key={msg.id}
                    type="button"
                    className="w-full text-left px-4 py-4 border-b border-[rgba(163,177,198,0.1)] transition-all"
                    style={isSelected ? { boxShadow: "var(--nm-inset-sm)" } : undefined}
                    onClick={() => handleSelectMessage(msg)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        {!msg.is_read && (
                          <div className="w-2 h-2 rounded-full bg-[#2E5E99] shrink-0" style={{ boxShadow: "0 0 0 3px rgba(46,94,153,0.15)" }} />
                        )}
                        <span className={`text-sm font-semibold truncate ${msg.is_read ? "text-muted-foreground" : "text-foreground"}`}>
                          {msg.sender_name}
                        </span>
                        <Icon className={`w-3.5 h-3.5 shrink-0 ${platformColors[msg.platform] ?? "text-muted-foreground"}`} />
                      </div>
                      <span className="text-[10px] font-semibold text-muted-foreground shrink-0 uppercase tracking-wide">
                        {formatTimeAgo(msg.created_at)}
                      </span>
                    </div>

                    {msg.sender_handle && (
                      <p className="text-xs text-muted-foreground mb-1.5 truncate">{msg.sender_handle}</p>
                    )}

                    <p className={`text-xs leading-relaxed line-clamp-2 ${msg.is_read ? "text-muted-foreground" : "text-foreground"}`}>
                      {msg.content}
                    </p>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Right pane — conversation detail */}
        <div className="hidden md:flex flex-1 flex-col h-full min-w-0">
          {selectedMsg ? (
            <>
              {/* Conversation header */}
              <div
                className="h-16 px-6 flex items-center gap-3 shrink-0 border-b border-[rgba(163,177,198,0.15)]"
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-[#2E5E99] bg-[var(--nm-bg)] shrink-0"
                  style={{ boxShadow: "var(--nm-inset-sm)", background: "rgba(46,94,153,0.1)" }}
                >
                  {selectedMsg.sender_name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground leading-none mb-1">
                    {selectedMsg.sender_name}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    {selectedMsg.platform === "linkedin"  && <FaLinkedin  className="w-3 h-3 text-[#0A66C2]"  />}
                    {selectedMsg.platform === "x"         && <FaXTwitter  className="w-3 h-3 text-foreground" />}
                    {selectedMsg.platform === "facebook"  && <FaFacebook  className="w-3 h-3 text-[#1877F2]"  />}
                    {selectedMsg.sender_handle ?? `via ${selectedMsg.platform}`}
                  </p>
                </div>
              </div>

              {/* Message body */}
              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                <div className="flex justify-center">
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 py-1 rounded-full bg-[var(--nm-bg)]"
                    style={{ boxShadow: "var(--nm-inset-sm)" }}
                  >
                    {formatTimeAgo(selectedMsg.created_at)}
                  </span>
                </div>

                <div
                  className="self-start max-w-lg rounded-2xl rounded-tl-sm px-5 py-4 bg-[var(--nm-bg)]"
                  style={{ boxShadow: "var(--nm-raised)" }}
                >
                  <p className="text-sm text-foreground leading-relaxed">{selectedMsg.content}</p>
                </div>
              </div>

              {/* Reply input */}
              <div className="p-4 shrink-0 border-t border-[rgba(163,177,198,0.15)]">
                <div className="relative flex items-center">
                  <input
                    type="text"
                    placeholder={`Reply to ${selectedMsg.sender_name.split(" ")[0]}…`}
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    className="w-full h-12 px-4 pr-14 rounded-xl text-sm text-foreground bg-[var(--nm-bg)] focus:outline-none placeholder:text-muted-foreground"
                    style={{ boxShadow: "var(--nm-inset-sm)" }}
                  />
                  <button
                    type="button"
                    disabled={!replyText.trim()}
                    className="absolute right-1.5 w-9 h-9 rounded-xl flex items-center justify-center bg-[#2E5E99] text-white transition-all disabled:opacity-40"
                    style={{ boxShadow: "var(--nm-raised-sm)" }}
                  >
                    <Send className="w-4 h-4 ml-0.5" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-[var(--nm-bg)]"
                style={{ boxShadow: "var(--nm-inset-sm)" }}
              >
                <Send className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">No conversation selected</p>
              <p className="text-xs text-muted-foreground">Pick a message from the list to view the thread.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
