"use client"

import { useState, useRef } from "react"
import Papa from "papaparse"
import { parseCSV } from "@/lib/csv-parser"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import {
  Image as ImageIcon, Calendar as CalendarIcon, Hash, Smile, Send,
  CheckCircle2, AlertCircle, Loader2, X, Clock, Sparkles, WandSparkles, FileText, Upload,
} from "lucide-react"
import { FaLinkedin, FaXTwitter, FaInstagram, FaFacebook } from "react-icons/fa6"
import { createClient } from "@/lib/supabase/client"
import { ImagePickerModal } from "@/components/media/image-picker-modal"

type AIType = "improve" | "hashtags" | "suggest"

export default function PublishingPage() {
  const supabase = createClient()

  const [content, setContent] = useState("")
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaPreview, setMediaPreview] = useState<string | null>(null)
  const [hashtagsInput, setHashtagsInput] = useState("")
  const [emotion, setEmotion] = useState("")
  const [scheduledFor, setScheduledFor] = useState("")
  const [showSchedule, setShowSchedule] = useState(false)
  const [showMetadata, setShowMetadata] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [showImagePicker, setShowImagePicker] = useState(false)

  // Bulk CSV state
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

  const handleTogglePlatform = (platform: string) =>
    setSelectedPlatforms(prev => prev.includes(platform) ? prev.filter(p => p !== platform) : [...prev, platform])

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
    setMediaFile({ name: selection.name } as File)
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
      if (mediaFile) {
        const fileExt = mediaFile.name.split(".").pop()
        const fileName = `${user.id}/${Date.now()}_media.${fileExt}`
        const { data, error } = await supabase.storage.from("media").upload(fileName, mediaFile)
        if (error) throw new Error(`Media upload failed: ${error.message}`)
        const { data: publicUrlData } = supabase.storage.from("media").getPublicUrl(data.path)
        media_urls.push(publicUrlData.publicUrl)
      }

      const hashtags = hashtagsInput.split(",").map(t => t.trim().replace(/^#/, "")).filter(Boolean)
      const payload = {
        content,
        platforms: selectedPlatforms,
        media_urls,
        hashtags,
        emotion,
        scheduled_for: showSchedule && scheduledFor ? new Date(scheduledFor).toISOString() : null,
      }

      const res = await fetch("/api/publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to orchestrate publication")

      setStatus("success")
      setFeedbackMsg(data.message || (payload.scheduled_for ? "Successfully scheduled!" : "Post published to all selected platforms!"))
      setContent(""); setMediaFile(null); setMediaPreview(null); setHashtagsInput("")
      setEmotion(""); setScheduledFor(""); setShowSchedule(false); setShowMetadata(false); setShowBulk(false)
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full relative z-10 h-[calc(100vh-4rem)] flex flex-col">
      <div className="mb-6 shrink-0">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-2">Publishing</h1>
        <p className="text-slate-500 text-lg">Compose, enrich, and orchestrate content across your networks.</p>
      </div>

      {status === "error" && (
        <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl flex items-center shadow-sm shrink-0">
          <AlertCircle className="w-5 h-5 mr-3 shrink-0" />
          <p className="text-sm font-medium">{feedbackMsg}</p>
        </div>
      )}
      {status === "success" && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl flex items-center shadow-sm shrink-0">
          <CheckCircle2 className="w-5 h-5 mr-3 shrink-0" />
          <p className="text-sm font-medium">{feedbackMsg}</p>
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 min-h-0">
        {/* Editor Column */}
        <Card className="lg:col-span-2 bg-white/80 border-slate-200 shadow-sm backdrop-blur-xl h-fit overflow-y-auto max-h-full">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-slate-800">New Post</CardTitle>
              <div className="flex space-x-2">
                {(["linkedin", "x", "facebook", "instagram"] as const).map(platform => {
                  const icons = { linkedin: FaLinkedin, x: FaXTwitter, facebook: FaFacebook, instagram: FaInstagram }
                  const activeColors = { linkedin: "bg-[#0A66C2] text-white border-[#0A66C2]", x: "bg-slate-900 text-white border-slate-900", facebook: "bg-[#1877F2] text-white border-[#1877F2]", instagram: "bg-rose-500 text-white border-rose-500" }
                  const hoverColors = { linkedin: "hover:text-[#0A66C2]", x: "hover:text-slate-900", facebook: "hover:text-[#1877F2]", instagram: "hover:text-rose-500" }
                  const Icon = icons[platform]
                  const isActive = selectedPlatforms.includes(platform)
                  return (
                    <Button key={platform} variant="outline" size="icon" onClick={() => handleTogglePlatform(platform)}
                      className={`h-9 w-9 rounded-full transition-all shadow-xs ${isActive ? activeColors[platform] : `border-slate-200 bg-white hover:bg-slate-50 text-slate-400 ${hoverColors[platform]}`}`}>
                      <Icon className="w-4 h-4" />
                    </Button>
                  )
                })}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              <Textarea
                placeholder="What do you want to share with your audience?"
                className="min-h-[160px] text-base resize-none bg-slate-50 border-slate-200 focus-visible:ring-[#128C7E] shadow-inner rounded-xl p-4"
                value={content}
                onChange={e => setContent(e.target.value)}
                disabled={status === "loading"}
              />

              {mediaPreview && (
                <div className="relative inline-block">
                  <img src={mediaPreview} alt="Upload preview" className="h-32 object-cover rounded-lg border border-slate-200 shadow-sm" />
                  <Button variant="secondary" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-slate-800 text-white hover:bg-slate-900 shadow-md"
                    onClick={() => { setMediaPreview(null); setMediaFile(null) }}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              )}

              {/* AI Assistant Panel */}
              <AnimatePresence>
                {showAI && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="p-4 bg-[#128C7E]/5 rounded-xl border border-[#128C7E]/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-[#0B1020] uppercase tracking-wider flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" /> AI Assistant
                        </p>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleAI("improve")} disabled={aiLoading}
                            className="h-7 text-xs bg-white border-[#128C7E]/20 text-[#0B1020] hover:bg-[#128C7E]/5 font-semibold">
                            {aiLoading && aiType === "improve" ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <WandSparkles className="w-3 h-3 mr-1" />}
                            Improve Caption
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleAI("hashtags")} disabled={aiLoading}
                            className="h-7 text-xs bg-white border-[#128C7E]/20 text-[#0B1020] hover:bg-[#128C7E]/5 font-semibold">
                            {aiLoading && aiType === "hashtags" ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Hash className="w-3 h-3 mr-1" />}
                            Generate Hashtags
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleAI("suggest")} disabled={aiLoading}
                            className="h-7 text-xs bg-white border-[#128C7E]/20 text-[#0B1020] hover:bg-[#128C7E]/5 font-semibold">
                            {aiLoading && aiType === "suggest" ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                            Suggest Opening
                          </Button>
                        </div>
                      </div>
                      {aiLoading && (
                        <div className="flex items-center gap-2 text-[#128C7E] text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Generating…</div>
                      )}
                      {aiResult && !aiLoading && (
                        <div className="bg-white rounded-lg border border-[#128C7E]/10 p-3 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                          {aiResult}
                          <div className="mt-3 flex gap-2">
                            <Button size="sm" onClick={applyAIResult} className="h-7 text-xs bg-[#128C7E] hover:bg-[#0B1020] text-white font-semibold">
                              Apply to Post
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setAiResult("")} className="h-7 text-xs text-slate-500 hover:text-slate-700">
                              Dismiss
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {showMetadata && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-[#128C7E]/5 rounded-xl border border-[#128C7E]/10">
                      <div>
                        <label className="text-xs font-semibold text-slate-600 mb-1 block">Hashtags (comma separated)</label>
                        <Input placeholder="e.g. marketing, ai, growth" value={hashtagsInput} onChange={e => setHashtagsInput(e.target.value)} className="bg-white border-slate-200 text-sm h-9" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600 mb-1 block">Tone / Emotion</label>
                        <select className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#128C7E]" value={emotion} onChange={e => setEmotion(e.target.value)}>
                          <option value="">Neutral (None)</option>
                          <option value="happy">😊 Happy & Excited</option>
                          <option value="professional">💼 Professional & Direct</option>
                          <option value="inspired">💡 Inspired & Motivating</option>
                        </select>
                      </div>
                    </div>
                  </motion.div>
                )}

                {showSchedule && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="p-4 bg-orange-50/50 rounded-xl border border-orange-100 flex flex-col md:flex-row items-center gap-4">
                      <div className="flex-1 w-full">
                        <label className="text-xs font-semibold text-slate-600 mb-1 block flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> Date & Time to Publish
                        </label>
                        <Input type="datetime-local" value={scheduledFor} onChange={e => setScheduledFor(e.target.value)} className="bg-white border-slate-200 text-sm h-9 w-full" />
                      </div>
                      <p className="text-xs text-slate-500 flex-1 italic mt-1 md:mt-5">Leaving this blank or in the past will publish immediately.</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center space-x-1">
                  <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
                  <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} title="Upload image" className="text-slate-500 hover:text-[#128C7E] hover:bg-[#128C7E]/5 rounded-full h-9 w-9">
                    <ImageIcon className="w-5 h-5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setShowImagePicker(true)} title="Choose from library" className="text-slate-500 hover:text-[#128C7E] hover:bg-[#128C7E]/5 rounded-full h-9 w-9">
                    <ImageIcon className="w-5 h-5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setShowMetadata(!showMetadata)} title="Hashtags & Tone"
                    className={`rounded-full h-9 w-9 ${showMetadata ? "text-[#128C7E] bg-[#128C7E]/10" : "text-slate-500 hover:text-[#128C7E] hover:bg-[#128C7E]/5"}`}>
                    <Hash className="w-5 h-5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setShowMetadata(!showMetadata)} title="Tone"
                    className={`rounded-full h-9 w-9 ${showMetadata ? "text-[#128C7E] bg-[#128C7E]/10" : "text-slate-500 hover:text-[#128C7E] hover:bg-[#128C7E]/5"}`}>
                    <Smile className="w-5 h-5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setShowAI(!showAI)} title="AI Assistant"
                    className={`rounded-full h-9 w-9 ${showAI ? "text-[#128C7E] bg-[#128C7E]/10" : "text-slate-500 hover:text-[#128C7E] hover:bg-[#128C7E]/5"}`}>
                    <Sparkles className="w-5 h-5" />
                  </Button>
                  <div className="h-4 w-px bg-slate-200 mx-2" />
                  <Button variant="outline" size="sm" onClick={() => setShowSchedule(!showSchedule)}
                    className={`shadow-xs h-9 rounded-lg ${showSchedule ? "text-orange-600 border-orange-200 bg-orange-50" : "text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
                    <CalendarIcon className="w-4 h-4 mr-2" />
                    {scheduledFor ? "Scheduled!" : "Schedule for later"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowBulk(!showBulk)}
                    className={`shadow-xs h-9 rounded-lg ${showBulk ? "text-violet-600 border-violet-200 bg-violet-50" : "text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
                    <FileText className="w-4 h-4 mr-2" />
                    Bulk Upload
                  </Button>
                </div>
                <div className="text-xs font-medium text-slate-400">{content.length} chars</div>
              </div>

              <div className="pt-6 mt-6 border-t border-slate-100 flex justify-end">
                <Button onClick={handlePublish} disabled={status === "loading"}
                  className={`shadow-md rounded-lg px-8 h-10 transition-colors group ${showSchedule && scheduledFor ? "bg-orange-600 hover:bg-orange-700 text-white" : "bg-[#128C7E] hover:bg-[#0B1020] text-white"}`}>
                  {status === "loading" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : showSchedule && scheduledFor ? <Clock className="w-4 h-4 mr-2" /> : <Send className="w-4 h-4 mr-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />}
                  {status === "loading" ? "Processing…" : showSchedule && scheduledFor ? "Schedule Post" : "Publish Now"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bulk CSV Upload Section */}
        {showBulk && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-2">
            <Card className="bg-white border-slate-200 shadow-sm backdrop-blur-xl">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-violet-500" />
                    Bulk Schedule Posts
                  </CardTitle>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowBulk(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  CSV format: <code className="bg-slate-100 px-1 py-0.5 rounded text-[10px]">content,hashtags,platforms,scheduled_datetime</code> — use semicolons for multi-value fields
                </p>
              </CardHeader>
              <CardContent className="p-6">
                {csvState === "idle" && (
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-10 text-center hover:border-violet-300 transition-colors">
                    <Upload className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-medium text-slate-500 mb-1">Upload your CSV file</p>
                    <p className="text-xs text-slate-400 mb-4">CSV will be parsed and previewed before scheduling</p>
                    <input type="file" accept=".csv" id="csv-input" onChange={handleCSVUpload} className="hidden" />
                    <label htmlFor="csv-input" className="cursor-pointer inline-flex items-center rounded-md bg-white border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 shadow-xs transition-colors">
                      <Upload className="w-4 h-4 mr-2" />
                      Choose CSV File
                    </label>
                  </div>
                )}

                {csvState === "parsed" && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-slate-600">
                        {csvParsed.filter(r => !r.error).length} valid, {csvParsed.filter(r => !!r.error).length} invalid
                      </span>
                    </div>
                    <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-xl mb-4">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="text-left p-2 font-semibold text-slate-600">#</th>
                            <th className="text-left p-2 font-semibold text-slate-600">Content</th>
                            <th className="text-left p-2 font-semibold text-slate-600 w-28">Platforms</th>
                            <th className="text-left p-2 font-semibold text-slate-600 w-36">Schedule</th>
                            <th className="text-left p-2 font-semibold text-slate-600 w-20">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {csvParsed.map((r, i) => (
                            <tr key={i} className={`border-t border-slate-100 ${r.error ? "bg-rose-50/50" : ""}`}>
                              <td className="p-2 text-slate-400">{i + 1}</td>
                              <td className="p-2 text-slate-700 max-w-xs truncate">{r.content}</td>
                              <td className="p-2 text-slate-500">{r.platforms.join(", ")}</td>
                              <td className="p-2 text-slate-500 font-mono">{r.scheduled_datetime}</td>
                              <td className="p-2">
                                {r.error ? (
                                  <span className="text-[10px] font-medium text-rose-500">{r.error}</span>
                                ) : (
                                  <span className="text-[10px] font-medium text-emerald-500">Valid</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" size="sm" onClick={() => { setCsvParsed([]); setCsvState("idle") }}>
                        Choose Another
                      </Button>
                      <Button size="sm" onClick={handleCSVSubmit}
                        disabled={csvParsed.filter(r => !r.error).length === 0}
                        className="bg-violet-600 hover:bg-violet-700 text-white">
                        {csvParsed.filter(r => !r.error).length > 0 ? (
                          <>
                            <Clock className="w-3.5 h-3.5 mr-1.5" />
                            Schedule {csvParsed.filter(r => !r.error).length} Posts
                          </>
                        ) : "No Valid Posts"}
                      </Button>
                    </div>
                  </div>
                )}

                {csvState === "inserting" && (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-violet-500 animate-spin mb-3" />
                    <p className="text-sm font-medium text-slate-500">Scheduling posts…</p>
                  </div>
                )}

                {csvState === "done" && (
                  <div className="flex flex-col items-center justify-center py-10">
                    <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-3" />
                    <p className="text-sm font-medium text-slate-700">Posts scheduled successfully!</p>
                    <p className="text-xs text-slate-400 mt-1">The cron job will pick them up at their scheduled times.</p>
                    <Button variant="outline" size="sm" className="mt-4" onClick={() => { setCsvParsed([]); setCsvState("idle") }}>
                      Upload Another
                    </Button>
                  </div>
                )}

                {csvState === "error" && csvParsed.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10">
                    <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
                    <p className="text-sm font-medium text-slate-700">No valid posts found</p>
                    <p className="text-xs text-slate-400 mt-1">Check your CSV format and try again.</p>
                    <Button variant="outline" size="sm" className="mt-4" onClick={() => setCsvState("idle")}>
                      Upload Another
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
        <div className="lg:col-span-1 border-l border-slate-200/60 pl-8 hidden lg:block overflow-y-auto">
          <div className="sticky top-0">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-6">Live Preview</h3>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-[2rem] border-[8px] border-slate-100 shadow-xl overflow-hidden aspect-9/18 flex flex-col mx-auto max-w-[320px] ring-1 ring-slate-200/50">
              <div className="bg-slate-50 border-b border-slate-100 p-4 flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-[#128C7E]/10 flex items-center justify-center border border-[#128C7E]/20 shrink-0">
                  <span className="text-[#0B1020] font-bold text-sm">You</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 leading-none">Your Brand</p>
                  <p className="text-xs font-medium text-slate-500 mt-1">@yourbrand &bull; Just now {emotion && `• ${emotion}`}</p>
                </div>
              </div>
              <div className="p-4 flex-1 overflow-y-auto bg-white flex flex-col">
                <p className="text-slate-800 text-[15px] whitespace-pre-wrap leading-relaxed">
                  {content || <span className="text-slate-300 italic">Your post preview will appear here…</span>}
                </p>
                {hashtagsInput && (
                  <p className="text-[#128C7E] text-sm mt-3 font-medium">
                    {hashtagsInput.split(",").map(t => `#${t.trim().replace(/^#/, "")}`).join(" ")}
                  </p>
                )}
                {mediaPreview && (
                  <div className="mt-4 w-full h-40 bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                    <img src={mediaPreview} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
              <div className="bg-slate-50 border-t border-slate-100 p-3 flex justify-around text-slate-300 pb-6 pt-4">
                {[...Array(4)].map((_, i) => <div key={i} className="w-5 h-5 rounded-full bg-slate-200" />)}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
      </div>

      <ImagePickerModal
        open={showImagePicker}
        onOpenChange={setShowImagePicker}
        onSelect={handleMediaFromLibrary}
      />
    </div>
  )
}
