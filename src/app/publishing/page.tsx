"use client"

import { useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Image as ImageIcon, Calendar as CalendarIcon, Hash, Smile, Send, CheckCircle2, AlertCircle, Loader2, X, Clock } from "lucide-react"
import { FaLinkedin, FaXTwitter, FaInstagram, FaFacebook } from "react-icons/fa6"
import { createClient } from "@/lib/supabase/client"

export default function PublishingPage() {
  const supabase = createClient()

  // Core Post State
  const [content, setContent] = useState("")
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])

  // Advanced Metadata State
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaPreview, setMediaPreview] = useState<string | null>(null)
  const [hashtagsInput, setHashtagsInput] = useState("")
  const [emotion, setEmotion] = useState("")
  const [scheduledFor, setScheduledFor] = useState("")

  // Toggles for Advanced Menus
  const [showSchedule, setShowSchedule] = useState(false)
  const [showMetadata, setShowMetadata] = useState(false)

  // App State
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [feedbackMsg, setFeedbackMsg] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value)
  }

  const handleTogglePlatform = (platform: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    )
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setMediaFile(file)
      const renderReader = new FileReader()
      renderReader.onload = (e) => {
        setMediaPreview(e.target?.result as string)
      }
      renderReader.readAsDataURL(file)
    }
  }

  const handlePublish = async () => {
    if (!content) {
      setFeedbackMsg("Post content cannot be empty.")
      setStatus("error")
      return;
    }
    if (selectedPlatforms.length === 0) {
      setFeedbackMsg("Please select at least one platform to publish to.")
      setStatus("error")
      return;
    }

    setStatus("loading")
    setFeedbackMsg("")

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication required.");

      let media_urls: string[] = [];

      // 1. Upload Media to Supabase Storage if present
      if (mediaFile) {
        const fileExt = mediaFile.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}_media.${fileExt}`;
        const { data, error } = await supabase.storage.from('media').upload(fileName, mediaFile);

        if (error) {
          throw new Error(`Media upload failed: ${error.message}`);
        }

        const { data: publicUrlData } = supabase.storage.from('media').getPublicUrl(data.path);
        media_urls.push(publicUrlData.publicUrl);
      }

      // 2. Parse Hastags
      const hashtags = hashtagsInput.split(',').map(tag => tag.trim().replace(/^#/, '')).filter(tag => tag.length > 0)

      // 3. Dispatch Application API Request
      const payload = {
        content,
        platforms: selectedPlatforms,
        media_urls,
        hashtags,
        emotion,
        scheduled_for: showSchedule && scheduledFor ? new Date(scheduledFor).toISOString() : null
      }

      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to orchestrate publication");
      }

      // 4. Success handling
      setStatus("success");
      setFeedbackMsg(data.message || (payload.scheduled_for ? "Successfully scheduled post to the queue!" : "Post completely published to all selected platforms!"));

      // Clear forms
      setContent("");
      setMediaFile(null);
      setMediaPreview(null);
      setHashtagsInput("");
      setEmotion("");
      setScheduledFor("");
      setShowSchedule(false);
      setShowMetadata(false);

    } catch (err: any) {
      setStatus("error");
      setFeedbackMsg(err.message || "An unexpected error occurred.");
    }
  }

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full relative z-10 h-[calc(100vh-4rem)] flex flex-col">
      <div className="mb-6 shrink-0">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-2">Publishing</h1>
        <p className="text-slate-500 text-lg">Compose, enrich, and orchestrate content across your networks.</p>
      </div>

      {status === 'error' && (
        <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl flex items-center shadow-sm">
          <AlertCircle className="w-5 h-5 mr-3 shrink-0" />
          <p className="text-sm font-medium">{feedbackMsg}</p>
        </div>
      )}

      {status === 'success' && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl flex items-center shadow-sm">
          <CheckCircle2 className="w-5 h-5 mr-3 shrink-0" />
          <p className="text-sm font-medium">{feedbackMsg}</p>
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 min-h-0">
        {/* Editor Column */}
        <Card className="lg:col-span-2 bg-white/80 border-slate-200 shadow-sm backdrop-blur-xl h-fit overflow-y-auto max-h-full scrollbar-hide">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-slate-800">New Post</CardTitle>
              <div className="flex space-x-2">
                <Button variant="outline" size="icon" onClick={() => handleTogglePlatform('linkedin')} className={`h-9 w-9 rounded-full transition-all shadow-xs ${selectedPlatforms.includes('linkedin') ? 'bg-[#0A66C2] text-white border-[#0A66C2]' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-400 hover:text-[#0A66C2]'}`}>
                  <FaLinkedin className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => handleTogglePlatform('x')} className={`h-9 w-9 rounded-full transition-all shadow-xs ${selectedPlatforms.includes('x') ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-400 hover:text-slate-900'}`}>
                  <FaXTwitter className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => handleTogglePlatform('facebook')} className={`h-9 w-9 rounded-full transition-all shadow-xs ${selectedPlatforms.includes('facebook') ? 'bg-[#1877F2] text-white border-[#1877F2]' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-400 hover:text-[#1877F2]'}`}>
                  <FaFacebook className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => handleTogglePlatform('instagram')} className={`h-9 w-9 rounded-full transition-all shadow-xs ${selectedPlatforms.includes('instagram') ? 'bg-rose-500 text-white border-rose-500' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-400 hover:text-rose-500'}`}>
                  <FaInstagram className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            <div className="space-y-4">
              <Textarea
                placeholder="What do you want to share with your audience?"
                className="min-h-[160px] text-base resize-none bg-slate-50 border-slate-200 focus-visible:ring-violet-500 shadow-inner rounded-xl p-4"
                value={content}
                onChange={handleContentChange}
                disabled={status === 'loading'}
              />

              {/* Media Preview Box */}
              {mediaPreview && (
                <div className="relative inline-block mt-4">
                  <img src={mediaPreview} alt="Upload preview" className="h-32 object-cover rounded-lg border border-slate-200 shadow-sm" />
                  <Button variant="secondary" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-slate-800 text-white hover:bg-slate-900 shadow-md" onClick={() => { setMediaPreview(null); setMediaFile(null); }}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              )}

              {/* Extended Metadata & Emotion Menus */}
              <AnimatePresence>
                {showMetadata && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="pt-2 overflow-hidden">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-violet-50/50 rounded-xl border border-violet-100">
                      <div>
                        <label className="text-xs font-semibold text-slate-600 mb-1 block">Hashtags (comma separated)</label>
                        <Input placeholder="e.g. marketing, ai, growth" value={hashtagsInput} onChange={e => setHashtagsInput(e.target.value)} className="bg-white border-slate-200 text-sm h-9" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600 mb-1 block">Tone / Emotion</label>
                        <select className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500" value={emotion} onChange={e => setEmotion(e.target.value)}>
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
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="pt-2 overflow-hidden">
                    <div className="p-4 bg-orange-50/50 rounded-xl border border-orange-100 flex flex-col md:flex-row items-center gap-4">
                      <div className="flex-1 w-full">
                        <label className="text-xs font-semibold text-slate-600 mb-1 block flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> Date & Time to Publish
                        </label>
                        <Input type="datetime-local" value={scheduledFor} onChange={e => setScheduledFor(e.target.value)} className="bg-white border-slate-200 text-sm h-9 w-full" />
                      </div>
                      <p className="text-xs text-slate-500 flex-1 italic mt-1 md:mt-5">
                        Leaving this blank or setting it in the past will publish the post immediately.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center space-x-2">
                  <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
                  <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} className="text-slate-500 hover:text-violet-600 hover:bg-violet-50 rounded-full h-9 w-9">
                    <ImageIcon className="w-5 h-5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setShowMetadata(!showMetadata)} className={`rounded-full h-9 w-9 ${showMetadata ? 'text-violet-600 bg-violet-100' : 'text-slate-500 hover:text-violet-600 hover:bg-violet-50'}`}>
                    <Hash className="w-5 h-5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setShowMetadata(!showMetadata)} className={`rounded-full h-9 w-9 ${showMetadata ? 'text-violet-600 bg-violet-100' : 'text-slate-500 hover:text-violet-600 hover:bg-violet-50'}`}>
                    <Smile className="w-5 h-5" />
                  </Button>
                  <div className="h-4 w-px bg-slate-200 mx-2" />
                  <Button variant="outline" size="sm" onClick={() => setShowSchedule(!showSchedule)} className={`shadow-xs h-9 rounded-lg ${showSchedule ? 'text-orange-600 border-orange-200 bg-orange-50' : 'text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                    <CalendarIcon className="w-4 h-4 mr-2" />
                    {scheduledFor ? 'Scheduled!' : 'Schedule for later'}
                  </Button>
                </div>
                <div className="text-xs font-medium text-slate-400">
                  {content.length} characters
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-slate-100 flex justify-end">
                <Button
                  onClick={handlePublish}
                  disabled={status === 'loading'}
                  className={`shadow-md rounded-lg px-8 h-10 transition-colors group ${showSchedule && scheduledFor ? 'bg-orange-600 hover:bg-orange-700 text-white' : 'bg-violet-600 hover:bg-violet-700 text-white'}`}
                >
                  {status === 'loading' ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : showSchedule && scheduledFor ? (
                    <Clock className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                  ) : (
                    <Send className="w-4 h-4 mr-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  )}
                  {status === 'loading' ? 'Processing...' : showSchedule && scheduledFor ? 'Schedule Post' : 'Publish Now'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live Preview Column */}
        <div className="lg:col-span-1 border-l border-slate-200/60 pl-8 hidden lg:block overflow-y-auto">
          <div className="sticky top-0">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-6">Live Preview</h3>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-[2rem] border-[8px] border-slate-100 shadow-xl overflow-hidden aspect-9/18 flex flex-col mx-auto max-w-[320px] ring-1 ring-slate-200/50"
            >
              <div className="bg-slate-50 border-b border-slate-100 p-4 flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center border border-violet-200 shrink-0">
                  <span className="text-violet-700 font-bold text-sm">You</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 leading-none">Your Brand</p>
                  <p className="text-xs font-medium text-slate-500 mt-1">@yourbrand &bull; Just now {emotion && `• Feeling ${emotion}`}</p>
                </div>
              </div>
              <div className="p-4 flex-1 overflow-y-auto bg-white flex flex-col">
                <p className="text-slate-800 text-[15px] whitespace-pre-wrap leading-relaxed">
                  {content || <span className="text-slate-300 italic">Your post preview will appear here as you type...</span>}
                </p>

                {hashtagsInput && (
                  <p className="text-violet-600 text-sm mt-3 font-medium">
                    {hashtagsInput.split(',').map(t => `#${t.trim().replace(/^#/, '')}`).join(' ')}
                  </p>
                )}

                {mediaPreview && (
                  <div className="mt-4 w-full h-40 bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                    <img src={mediaPreview} alt="Preview media" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
              <div className="bg-slate-50 border-t border-slate-100 p-3 flex justify-around text-slate-300 pb-6 pt-4">
                <div className="w-5 h-5 rounded-full bg-slate-200" />
                <div className="w-5 h-5 rounded-full bg-slate-200" />
                <div className="w-5 h-5 rounded-full bg-slate-200" />
                <div className="w-5 h-5 rounded-full bg-slate-200" />
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}
