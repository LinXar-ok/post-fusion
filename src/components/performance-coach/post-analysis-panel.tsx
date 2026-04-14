'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp } from 'lucide-react'

type Analytics = { likes: number; comments: number; shares: number; engagement_rate: number }
type Analysis = { reasons: string[]; hook_type: string; what_to_repeat: string; what_to_avoid: string | null }
type Post = { id: string; content: string }

type Props = { post: Post; analytics: Analytics | null; analysis: Analysis | null }

export function PostAnalysisPanel({ post, analytics, analysis }: Props) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-4 py-3 flex items-start justify-between gap-3 text-left hover:bg-white/[0.02] transition-colors"
      >
        <p className="text-sm text-slate-300 leading-snug line-clamp-2 flex-1">{post.content}</p>
        <div className="flex items-center gap-3 shrink-0">
          {analytics && (
            <span className="text-xs font-semibold text-[#128C7E]">{analytics.engagement_rate}%</span>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t border-white/5 pt-3">
              {/* Metrics */}
              {analytics && (
                <div className="flex gap-4 text-xs text-slate-400">
                  <span>❤ {analytics.likes}</span>
                  <span>💬 {analytics.comments}</span>
                  <span>🔁 {analytics.shares}</span>
                </div>
              )}

              {analysis ? (
                <>
                  <div className="space-y-1.5">
                    <p className="text-xs uppercase tracking-widest text-slate-500">Why it worked</p>
                    {analysis.reasons.map((r, i) => (
                      <div key={i} className="flex gap-2 text-sm text-slate-300">
                        <span className="text-[#128C7E]">✦</span>
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg bg-[#128C7E]/10 border border-[#128C7E]/20 px-3 py-2">
                      <p className="text-xs text-[#128C7E] mb-1">Repeat this</p>
                      <p className="text-slate-300 text-xs leading-snug">{analysis.what_to_repeat}</p>
                    </div>
                    {analysis.what_to_avoid && (
                      <div className="rounded-lg bg-[#C97D3A]/10 border border-[#C97D3A]/20 px-3 py-2">
                        <p className="text-xs text-[#C97D3A] mb-1">Avoid next time</p>
                        <p className="text-slate-300 text-xs leading-snug">{analysis.what_to_avoid}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Hook type:</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-slate-300">{analysis.hook_type}</span>
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-500">
                  {analytics ? 'Analysis not available.' : 'No analytics data yet — add metrics via the Supabase dashboard or analytics API.'}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
