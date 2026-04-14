"use client"

import { useState, useRef, useEffect } from "react"
import { VoiceScoreMeter } from "@/components/brand-brain/voice-score-meter"
import Papa from "papaparse"
import { parseCSV } from "@/lib/csv-parser"
import { motion, AnimatePresence } from "framer-motion"
import {
  ImageIcon, Calendar as CalendarIcon, Hash, Smile, Send,
  CheckCircle2, AlertCircle, Loader2, X, Clock, Sparkles, WandSparkles,
  FileText, Upload, FolderOpen,
} from "lucide-react"
import { FaLinkedin, FaXTwitter, FaInstagram, FaFacebook } from "react-icons/fa6"
import { createClient } from "@/lib/supabase/client"
import { ImagePickerModal } from "@/components/media/image-picker-modal"
import { cn } from "@/lib/utils"

type AIType = "improve" | "hashtags" | "suggest"

const platforms = ["linkedin", "x", "facebook", "instagram"] as const
type Platform = typeof platforms[number]

const platformIcons: Record<Platform, React.ElementType> = {
  linkedin: FaLinkedin, x: FaXTwitter, facebook: FaFacebook, instagram: FaInstagram,
}
const platformActiveColor: Record<Platform, string> = {
  linkedin: "#0A66C2", x: "#000000", facebook: "#1877F2", instagram: "#E1306C",
}

export default function PublishingPage() {
  const supabase = createClient()

  const [content, setContent] = useState("")
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaPreview, setMediaPreview] = useState<string | null>(null)
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [hashtagsInput, setHashtagsInput] = useState("")
  const [emotion, setEmotion] = useState("")
  const [scheduledFor, setScheduledFor] = useState("")
  const [showSchedule, setShowSchedule] = useState(false)
  const [showMetadata, setShowMetadata] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [showImagePicker, setShowImagePicker] = useState(false)

  const [csvRaw, setCsvRaw] = useState<Papa.ParseResult<string[]> | null>(null)
  const [csvParsed, setCsvParsed] = useState<Awaited<ReturnType<typeof parseCSV>>>([])
  const [csvState, setCsvState] = useState<"idle" | "parsed" | "inserting" | "done" | "error">("idle")
  const [showAI, setShowAI] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState("")
  const [aiType, setAiType] = useState<AIType | null>(null)

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [feedbackMsg, setFeedbackMsg] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [voiceScore, setVoiceScore] = useState<{ score: number | null; traits: string[]; flags: string[] } | null>(null)
  const [voiceLoading, setVoiceLoading] = useState(false)
  const voiceDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (voiceDebounceRef.current) clearTimeout(voiceDebounceRef.current)
    if (content.length < 80) {
      setVoiceScore(null)
      return
    }
    setVoiceLoading(true)
    voiceDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/brand-brain/voice-score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        })
        const data = await res.json()
        setVoiceScore(data)
      } catch {
        setVoiceScore(null)
      } finally {
        setVoiceLoading(false)
      }
    }, 1200)
  }, [content])

  const handleTogglePlatform = (platform: string) =>
    setSelectedPlatforms(prev =>
      prev.includes(platform) ? prev.filter(p => p !== platform) : [...prev, platform]
    )

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0]
      setMediaFile(file)
      const reader = new FileReader()
      reader.onload = (e) => setMediaPreview(e.target?.result as string)
      reader.readAsDataURL(file)
    }
  }

  const handleMediaFromLibrary = (selection: { publicUrl: string; name: string }) => {
    setMediaFile(null)
    setMediaUrl(selection.publicUrl)
    setMediaPreview(selection.publicUrl)
  }

  const handleAI = async (type: AIType) => {
    if (!content.trim()) {
      setAiResult("Please write some post content first before using AI assistance.")
      setAiType(type)
      return
    }
    setAiLoading(true)
    setAiType(type)
    setAiResult("")
    try {
      const platform = selectedPlatforms[0] || "social media"
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, content, platform }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "AI generation failed")
      setAiResult(data.result)
    } catch (err: unknown) {
      setAiResult(`Error: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setAiLoading(false)
    }
  }

  const applyAIResult = () => {
    if (!aiResult) return
    if (aiType === "improve" || aiType === "suggest") {
      setContent(aiResult)
    } else if (aiType === "hashtags") {
      setHashtagsInput(aiResult)
      setShowMetadata(true)
    }
    setAiResult("")
    setAiType(null)
  }

  const handlePublish = async () => {
    if (!content) { setFeedbackMsg("Post content cannot be empty."); setStatus("error"); return }
    if (selectedPlatforms.length === 0) { setFeedbackMsg("Please select at least one platform."); setStatus("error"); return }

    setStatus("loading")
    setFeedbackMsg("")

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Authentication required.")

      let media_urls: string[] = []
      if (mediaUrl) {
        media_urls.push(mediaUrl)
      } else if (mediaFile) {
        const fileNameParts = mediaFile.name.split(".")
        const fileExt = fileNameParts.length > 1 ? fileNameParts.pop()?.toLowerCase() : null
        let contentType = mediaFile.type
        if (!contentType || !contentType.startsWith("image/")) {
          const extToMime: Record<string, string> = {
            jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
            gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
          }
          contentType = fileExt ? (extToMime[fileExt] || "image/jpeg") : "image/jpeg"
        }
        const fileName = `${user.id}/${Date.now()}_media.${fileExt || "jpg"}`
        const { data, error } = await supabase.storage.from("media").upload(fileName, mediaFile, {
          contentType, upsert: false,
        })
        if (error) throw new Error(`Media upload failed: ${error.message}`)
        const { data: publicUrlData } = supabase.storage.from("media").getPublicUrl(data.path)
        media_urls.push(publicUrlData.publicUrl)
      }

      const hashtags = hashtagsInput.split(",").map(t => t.trim().replace(/^#/, "")).filter(Boolean)
      const payload = {
        content, platforms: selectedPlatforms, media_urls, hashtags, emotion,
        scheduled_for: showSchedule && scheduledFor ? new Date(scheduledFor).toISOString() : null,
      }

      const res = await fetch("/api/publish", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to orchestrate publication")

      const warnings = data.results?.flatMap((r: { warnings?: string[] }) => r.warnings || []) || []
      const hasImageWarning = warnings.some((w: string) => w.toLowerCase().includes("image"))

      setStatus("success")
      let msg = data.message || (payload.scheduled_for ? "Successfully scheduled!" : "Published to all selected platforms!")
      if (hasImageWarning) msg += " Note: Image could not be attached."
      setFeedbackMsg(msg)

      setContent(""); setMediaFile(null); setMediaPreview(null); setMediaUrl(null)
      setHashtagsInput(""); setEmotion(""); setScheduledFor("")
      setShowSchedule(false); setShowMetadata(false); setShowBulk(false)
      setAiResult(""); setAiType(null)
      setCsvRaw(null); setCsvParsed([]); setCsvState("idle")
    } catch (err: unknown) {
      setStatus("error")
      setFeedbackMsg(err instanceof Error ? err.message : "An unexpected error occurred.")
    }
  }

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const csvText = ev.target?.result as string
      const rows = parseCSV(csvText)
      setCsvParsed(rows)
      setCsvState(rows.length > 0 ? "parsed" : "error")
    }
    reader.readAsText(file)
  }

  const handleCSVSubmit = async () => {
    const validRows = csvParsed.filter(r => !r.error)
    if (validRows.length === 0) return
    setCsvState("inserting")
    try {
      const res = await fetch("/api/posts/bulk-insert", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: validRows }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Bulk insert failed")
      setCsvState("done")
      setFeedbackMsg(`Successfully scheduled ${data.inserted} posts!`)
      setStatus("success")
      setCsvParsed([]); setCsvRaw(null)
    } catch (err: unknown) {
      setCsvState("error")
      setFeedbackMsg(err instanceof Error ? err.message : "Bulk insert failed")
      setStatus("error")
    }
  }

  // ── Reusable nm button ────────────────────────────────────────
  const ToolBtn = ({
    onClick, active, title, children, activeColor,
  }: {
    onClick: () => void
    active?: boolean
    title: string
    children: React.ReactNode
    activeColor?: string
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 bg-[var(--nm-bg)] text-muted-foreground"
      style={{
        boxShadow: active ? "var(--nm-inset-sm)" : "var(--nm-raised-xs)",
        color: active && activeColor ? activeColor : undefined,
      }}
    >
      {children}
    </button>
  )

  const isScheduled = showSchedule && !!scheduledFor

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full h-[calc(100vh-4rem)] flex flex-col">

      {/* Header */}
      <div className="mb-6 shrink-0">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground mb-1">Publishing</h1>
        <p className="text-muted-foreground text-sm">Compose, enrich, and orchestrate content across your networks.</p>
      </div>

      {/* Feedback banners — neumorphic with accent strip */}
      <AnimatePresence>
        {(status === "error" || status === "success") && feedbackMsg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="mb-5 flex items-center gap-3 px-4 py-3 rounded-xl shrink-0 bg-[var(--nm-bg)]"
            style={{ boxShadow: "var(--nm-raised-sm)" }}
          >
            <div className={cn("w-1 h-8 rounded-full shrink-0", status === "error" ? "bg-rose-500" : "bg-[#2E5E99]")} />
            {status === "error"
              ? <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              : <CheckCircle2 className="w-4 h-4 text-[#2E5E99] shrink-0" />
            }
            <p className="text-sm font-medium text-foreground">{feedbackMsg}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">

        {/* ── Editor column ── */}
        <div className="lg:col-span-2 flex flex-col gap-5 overflow-y-auto pr-1">

          {/* Compose card */}
          <div
            className="rounded-2xl bg-[var(--nm-bg)] flex flex-col"
            style={{ boxShadow: "var(--nm-raised)" }}
          >
            {/* Card header — title + platform toggles */}
            <div className="px-6 pt-5 pb-4 flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-foreground">New Post</h2>
              <div className="flex items-center gap-1.5">
                {platforms.map(platform => {
                  const Icon = platformIcons[platform]
                  const active = selectedPlatforms.includes(platform)
                  return (
                    <button
                      key={platform}
                      type="button"
                      onClick={() => handleTogglePlatform(platform)}
                      title={platform}
                      className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 bg-[var(--nm-bg)]"
                      style={{
                        boxShadow: active ? "var(--nm-inset-sm)" : "var(--nm-raised-xs)",
                        color: active ? platformActiveColor[platform] : undefined,
                      }}
                    >
                      <Icon className={cn("w-4 h-4", !active && "text-muted-foreground")} />
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Teal accent divider */}
            <div
              className="h-px mx-6 mb-5"
              style={{ background: "linear-gradient(to right, transparent, rgba(46,94,153,0.35), transparent)" }}
            />

            <div className="px-6 pb-6 space-y-4">
              {/* Textarea — inset */}
              <textarea
                placeholder="What do you want to share with your audience?"
                className="w-full min-h-[160px] rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground bg-[var(--nm-bg)] resize-none focus:outline-none leading-relaxed"
                style={{ boxShadow: "var(--nm-inset)" }}
                value={content}
                onChange={e => setContent(e.target.value)}
                disabled={status === "loading"}
              />

              <VoiceScoreMeter
                score={voiceScore?.score ?? null}
                traits={voiceScore?.traits ?? []}
                flags={voiceScore?.flags ?? []}
                loading={voiceLoading}
              />

              {/* Media preview */}
              {mediaPreview && (
                <div className="relative inline-block">
                  <div
                    className="rounded-xl overflow-hidden"
                    style={{ boxShadow: "var(--nm-raised-sm)" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={mediaPreview} alt="Upload preview" className="h-32 object-cover" />
                  </div>
                  <button
                    type="button"
                    onClick={() => { setMediaPreview(null); setMediaFile(null); setMediaUrl(null) }}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center"
                    style={{ boxShadow: "var(--nm-raised-xs)" }}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* AI Assistant panel */}
              <AnimatePresence>
                {showAI && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div
                      className="rounded-xl p-4 space-y-3 bg-[var(--nm-bg)]"
                      style={{ boxShadow: "var(--nm-raised-sm)" }}
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <p className="text-xs font-bold text-[#2E5E99] uppercase tracking-wider flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" /> AI Assistant
                        </p>
                        <div className="flex gap-1.5">
                          {(["improve", "hashtags", "suggest"] as AIType[]).map(t => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => handleAI(t)}
                              disabled={aiLoading}
                              className="h-7 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1 bg-[var(--nm-bg)] text-foreground disabled:opacity-50 transition-all"
                              style={{ boxShadow: "var(--nm-raised-xs)" }}
                            >
                              {aiLoading && aiType === t ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : t === "improve" ? (
                                <WandSparkles className="w-3 h-3 text-[#2E5E99]" />
                              ) : t === "hashtags" ? (
                                <Hash className="w-3 h-3 text-[#2E5E99]" />
                              ) : (
                                <Sparkles className="w-3 h-3 text-[#2E5E99]" />
                              )}
                              {t === "improve" ? "Improve" : t === "hashtags" ? "Hashtags" : "Suggest"}
                            </button>
                          ))}
                        </div>
                      </div>

                      {aiLoading && (
                        <div className="flex items-center gap-2 text-[#2E5E99] text-xs">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…
                        </div>
                      )}

                      {aiResult && !aiLoading && (
                        <div
                          className="rounded-xl px-4 py-3 text-sm text-foreground whitespace-pre-wrap leading-relaxed bg-[var(--nm-bg)]"
                          style={{ boxShadow: "var(--nm-inset-sm)" }}
                        >
                          {aiResult}
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              onClick={applyAIResult}
                              className="h-7 px-3 rounded-lg text-xs font-semibold bg-[#2E5E99] text-white transition-all hover:bg-[#0e7066]"
                              style={{ boxShadow: "var(--nm-raised-xs)" }}
                            >
                              Apply to Post
                            </button>
                            <button
                              type="button"
                              onClick={() => setAiResult("")}
                              className="h-7 px-3 rounded-lg text-xs font-medium text-muted-foreground bg-[var(--nm-bg)] transition-all"
                              style={{ boxShadow: "var(--nm-raised-xs)" }}
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Metadata — hashtags + tone */}
                {showMetadata && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div
                      className="rounded-xl p-4 bg-[var(--nm-bg)]"
                      style={{ boxShadow: "var(--nm-raised-sm)" }}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                            Hashtags <span className="font-normal">(comma separated)</span>
                          </label>
                          <input
                            placeholder="e.g. marketing, ai, growth"
                            className="h-9 w-full rounded-xl px-3 text-sm bg-[var(--nm-bg)] text-foreground placeholder:text-muted-foreground focus:outline-none"
                            style={{ boxShadow: "var(--nm-inset-sm)" }}
                            value={hashtagsInput}
                            onChange={e => setHashtagsInput(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Tone / Emotion</label>
                          <select
                            className="h-9 w-full rounded-xl px-3 text-sm bg-[var(--nm-bg)] text-foreground focus:outline-none appearance-none"
                            style={{ boxShadow: "var(--nm-inset-sm)" }}
                            value={emotion}
                            onChange={e => setEmotion(e.target.value)}
                          >
                            <option value="">Neutral</option>
                            <option value="happy">😊 Happy & Excited</option>
                            <option value="professional">💼 Professional & Direct</option>
                            <option value="inspired">💡 Inspired & Motivating</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Schedule picker */}
                {showSchedule && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div
                      className="rounded-xl p-4 bg-[var(--nm-bg)]"
                      style={{ boxShadow: "var(--nm-raised-sm)" }}
                    >
                      <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                        <div className="flex-1 w-full">
                          <label className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1 block">
                            <Clock className="w-3.5 h-3.5" /> Date &amp; Time to Publish
                          </label>
                          <input
                            type="datetime-local"
                            className="h-9 w-full rounded-xl px-3 text-sm bg-[var(--nm-bg)] text-foreground focus:outline-none"
                            style={{ boxShadow: "var(--nm-inset-sm)" }}
                            value={scheduledFor}
                            onChange={e => setScheduledFor(e.target.value)}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground flex-1 italic">
                          Leaving this blank or in the past will publish immediately.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Toolbar */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1.5">
                  <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
                  <ToolBtn onClick={() => fileInputRef.current?.click()} title="Upload image">
                    <Upload className="w-4 h-4" />
                  </ToolBtn>
                  <ToolBtn onClick={() => setShowImagePicker(true)} title="Choose from library">
                    <FolderOpen className="w-4 h-4" />
                  </ToolBtn>
                  <ToolBtn onClick={() => setShowMetadata(!showMetadata)} active={showMetadata} title="Hashtags" activeColor="#2E5E99">
                    <Hash className="w-4 h-4" />
                  </ToolBtn>
                  <ToolBtn onClick={() => setShowMetadata(!showMetadata)} active={showMetadata} title="Tone" activeColor="#2E5E99">
                    <Smile className="w-4 h-4" />
                  </ToolBtn>
                  <ToolBtn onClick={() => setShowAI(!showAI)} active={showAI} title="AI Assistant" activeColor="#2E5E99">
                    <Sparkles className="w-4 h-4" />
                  </ToolBtn>

                  {/* Divider */}
                  <div className="w-px h-4 mx-1 rounded-full bg-border" />

                  {/* Schedule button */}
                  <button
                    type="button"
                    onClick={() => setShowSchedule(!showSchedule)}
                    className="h-8 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-[var(--nm-bg)] transition-all"
                    style={{
                      boxShadow: showSchedule ? "var(--nm-inset-sm)" : "var(--nm-raised-xs)",
                      color: showSchedule ? "#675B47" : undefined,
                    }}
                  >
                    <CalendarIcon className="w-3.5 h-3.5" />
                    {scheduledFor ? "Scheduled" : "Schedule"}
                  </button>

                  {/* Bulk upload button */}
                  <button
                    type="button"
                    onClick={() => setShowBulk(!showBulk)}
                    className="h-8 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-[var(--nm-bg)] transition-all text-muted-foreground"
                    style={{
                      boxShadow: showBulk ? "var(--nm-inset-sm)" : "var(--nm-raised-xs)",
                      color: showBulk ? "#363630" : undefined,
                    }}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Bulk CSV
                  </button>
                </div>

                <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
                  {content.length} chars
                </span>
              </div>

              {/* Footer — publish */}
              <div
                className="pt-4 mt-2 flex justify-end"
                style={{ borderTop: "1px solid color-mix(in oklch, var(--border) 60%, transparent)" }}
              >
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={status === "loading"}
                  className={cn(
                    "h-10 px-8 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all disabled:opacity-50",
                    isScheduled
                      ? "bg-amber-500 text-white hover:bg-amber-600"
                      : "bg-[#2E5E99] text-white hover:bg-[#0e7066]"
                  )}
                  style={{ boxShadow: "var(--nm-raised-sm)" }}
                >
                  {status === "loading" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isScheduled ? (
                    <Clock className="w-4 h-4" />
                  ) : (
                    <Send className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  )}
                  {status === "loading" ? "Processing…" : isScheduled ? "Schedule Post" : "Publish Now"}
                </button>
              </div>
            </div>
          </div>

          {/* Bulk CSV card */}
          <AnimatePresence>
            {showBulk && (
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                className="rounded-2xl bg-[var(--nm-bg)]"
                style={{ boxShadow: "var(--nm-raised)" }}
              >
                <div className="px-6 pt-5 pb-4 flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-sm font-semibold text-foreground flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#363630]" />
                      Bulk Schedule Posts
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      CSV: <code className="font-mono text-[10px]">content, hashtags, platforms, scheduled_datetime</code>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowBulk(false)}
                    className="w-7 h-7 rounded-xl flex items-center justify-center text-muted-foreground bg-[var(--nm-bg)]"
                    style={{ boxShadow: "var(--nm-raised-xs)" }}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div
                  className="h-px mx-6 mb-5"
                  style={{ background: "linear-gradient(to right, transparent, rgba(54,54,48,0.3), transparent)" }}
                />

                <div className="px-6 pb-6">
                  {csvState === "idle" && (
                    <div>
                      <label
                        htmlFor="csv-input"
                        className="flex flex-col items-center justify-center rounded-xl py-10 text-center cursor-pointer transition-all bg-[var(--nm-bg)]"
                        style={{ boxShadow: "var(--nm-inset)" }}
                      >
                        <Upload className="w-8 h-8 text-muted-foreground mb-3" />
                        <p className="text-sm font-medium text-foreground mb-1">Upload your CSV file</p>
                        <p className="text-xs text-muted-foreground">Preview before scheduling</p>
                      </label>
                      <input type="file" accept=".csv" id="csv-input" onChange={handleCSVUpload} className="hidden" />
                    </div>
                  )}

                  {csvState === "parsed" && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium text-muted-foreground">
                          <span className="text-[#2E5E99] font-semibold">{csvParsed.filter(r => !r.error).length} valid</span>
                          {csvParsed.filter(r => !!r.error).length > 0 && (
                            <> · <span className="text-rose-500 font-semibold">{csvParsed.filter(r => !!r.error).length} invalid</span></>
                          )}
                        </span>
                      </div>
                      <div
                        className="max-h-56 overflow-y-auto rounded-xl mb-4 bg-[var(--nm-bg)]"
                        style={{ boxShadow: "var(--nm-inset-sm)" }}
                      >
                        <table className="w-full text-xs">
                          <thead>
                            <tr>
                              {["#", "Content", "Platforms", "Schedule", "Status"].map(h => (
                                <th key={h} className="text-left p-2.5 font-semibold text-muted-foreground first:pl-4">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {csvParsed.map((r, i) => (
                              <tr key={i} className={cn("border-t border-border/50", r.error && "opacity-60")}>
                                <td className="p-2 pl-4 text-muted-foreground">{i + 1}</td>
                                <td className="p-2 text-foreground max-w-[160px] truncate">{r.content}</td>
                                <td className="p-2 text-muted-foreground">{r.platforms.join(", ")}</td>
                                <td className="p-2 text-muted-foreground font-mono">{r.scheduled_datetime}</td>
                                <td className="p-2">
                                  {r.error
                                    ? <span className="text-[10px] font-semibold text-rose-500">{r.error}</span>
                                    : <span className="text-[10px] font-semibold text-[#2E5E99]">Valid</span>
                                  }
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => { setCsvParsed([]); setCsvState("idle") }}
                          className="h-8 px-4 rounded-xl text-xs font-medium text-muted-foreground bg-[var(--nm-bg)]"
                          style={{ boxShadow: "var(--nm-raised-xs)" }}
                        >
                          Choose Another
                        </button>
                        <button
                          type="button"
                          onClick={handleCSVSubmit}
                          disabled={csvParsed.filter(r => !r.error).length === 0}
                          className="h-8 px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-[#363630] text-white hover:bg-[#4f46e5] disabled:opacity-50 transition-all"
                          style={{ boxShadow: "var(--nm-raised-xs)" }}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          Schedule {csvParsed.filter(r => !r.error).length} Posts
                        </button>
                      </div>
                    </div>
                  )}

                  {csvState === "inserting" && (
                    <div className="flex flex-col items-center justify-center py-10">
                      <Loader2 className="w-7 h-7 text-[#363630] animate-spin mb-3" />
                      <p className="text-sm font-medium text-muted-foreground">Scheduling posts…</p>
                    </div>
                  )}

                  {csvState === "done" && (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 bg-[var(--nm-bg)]"
                        style={{ boxShadow: "var(--nm-inset-sm)" }}
                      >
                        <CheckCircle2 className="w-6 h-6 text-[#2E5E99]" />
                      </div>
                      <p className="text-sm font-semibold text-foreground mb-1">Posts scheduled!</p>
                      <p className="text-xs text-muted-foreground">The cron job will pick them up at their scheduled times.</p>
                      <button
                        type="button"
                        onClick={() => { setCsvParsed([]); setCsvState("idle") }}
                        className="mt-4 h-8 px-4 rounded-xl text-xs font-medium text-muted-foreground bg-[var(--nm-bg)]"
                        style={{ boxShadow: "var(--nm-raised-xs)" }}
                      >
                        Upload Another
                      </button>
                    </div>
                  )}

                  {csvState === "error" && csvParsed.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 bg-[var(--nm-bg)]"
                        style={{ boxShadow: "var(--nm-inset-sm)" }}
                      >
                        <AlertCircle className="w-6 h-6 text-rose-500" />
                      </div>
                      <p className="text-sm font-semibold text-foreground mb-1">No valid posts found</p>
                      <p className="text-xs text-muted-foreground">Check your CSV format and try again.</p>
                      <button
                        type="button"
                        onClick={() => setCsvState("idle")}
                        className="mt-4 h-8 px-4 rounded-xl text-xs font-medium text-muted-foreground bg-[var(--nm-bg)]"
                        style={{ boxShadow: "var(--nm-raised-xs)" }}
                      >
                        Try Again
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Live Preview column ── */}
        <div className="lg:col-span-1 hidden lg:flex flex-col">
          <div className="sticky top-0">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-5">
              Live Preview
            </p>

            {/* Phone frame */}
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="rounded-3xl overflow-hidden mx-auto max-w-[280px] bg-[var(--nm-bg)]"
              style={{ boxShadow: "var(--nm-raised)" }}
            >
              {/* Profile bar */}
              <div
                className="px-4 py-3.5 flex items-center gap-3 bg-[var(--nm-bg)]"
                style={{ boxShadow: "var(--nm-inset-sm)" }}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-[var(--nm-bg)]"
                  style={{ boxShadow: "var(--nm-raised-sm)" }}
                >
                  <span className="text-[#2E5E99] font-bold text-xs">You</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground leading-none">Your Brand</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    @yourbrand · Just now{emotion ? ` · ${emotion}` : ""}
                  </p>
                </div>
              </div>

              {/* Content area */}
              <div className="px-4 py-4 min-h-[160px]">
                <p className="text-foreground text-[13px] whitespace-pre-wrap leading-relaxed">
                  {content || (
                    <span className="text-muted-foreground italic text-xs">
                      Your post preview will appear here…
                    </span>
                  )}
                </p>
                {hashtagsInput && (
                  <p className="text-[#2E5E99] text-[12px] mt-2.5 font-medium">
                    {hashtagsInput.split(",").map(t => `#${t.trim().replace(/^#/, "")}`).join(" ")}
                  </p>
                )}
                {mediaPreview && (
                  <div
                    className="mt-3 w-full h-36 rounded-xl overflow-hidden bg-[var(--nm-bg)]"
                    style={{ boxShadow: "var(--nm-inset-sm)" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={mediaPreview} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              {/* Bottom bar — platform dots */}
              <div
                className="px-4 pb-5 pt-3 flex justify-around bg-[var(--nm-bg)]"
                style={{ boxShadow: "var(--nm-inset-sm)" }}
              >
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="w-4 h-4 rounded-full bg-[var(--nm-bg)]"
                    style={{ boxShadow: "var(--nm-raised-xs)" }}
                  />
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <ImagePickerModal
        isOpen={showImagePicker}
        onOpenChange={setShowImagePicker}
        onSelect={handleMediaFromLibrary}
      />
    </div>
  )
}
