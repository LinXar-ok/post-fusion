'use client'

import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'

type Insight = { type: 'positive' | 'gap'; text: string }
type PostIdea = { pillar: string; hook: string }

type Brief = {
  summary: string
  insights: Insight[]
  post_ideas: PostIdea[]
  actions: string[]
}

type Props = {
  brief: Brief | null
  loading: boolean
}

export function WeeklyBriefCard({ brief, loading }: Props) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-[#128C7E]/20 bg-[#128C7E]/5 p-5 space-y-3 animate-pulse">
        <div className="h-4 bg-white/10 rounded w-3/4" />
        <div className="h-4 bg-white/10 rounded w-1/2" />
        <div className="h-4 bg-white/10 rounded w-2/3" />
      </div>
    )
  }

  if (!brief) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
        <p className="text-sm text-slate-500">
          Publish at least 3 posts to unlock your first Brand Brain brief.
        </p>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-[#128C7E]/30 bg-[#128C7E]/[0.07] p-5 space-y-4"
    >
      {/* Summary */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-[#128C7E]" />
          <span className="text-xs uppercase tracking-widest text-[#128C7E]">This Week's Brief</span>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed">{brief.summary}</p>
      </div>

      {/* Insights */}
      {brief.insights.length > 0 && (
        <div className="space-y-1.5">
          {brief.insights.map((ins, i) => (
            <div key={i} className="flex gap-2 text-sm">
              <span>{ins.type === 'positive' ? '✦' : '◌'}</span>
              <span className={ins.type === 'positive' ? 'text-slate-300' : 'text-slate-400'}>{ins.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {brief.actions.length > 0 && (
        <div className="space-y-2 pt-1 border-t border-white/10">
          <p className="text-xs uppercase tracking-widest text-slate-500">Your 3 Actions</p>
          {brief.actions.map((action, i) => (
            <div key={i} className="flex gap-3 items-start">
              <span className="w-5 h-5 rounded-full bg-[#128C7E]/20 text-[#128C7E] text-xs flex items-center justify-center shrink-0 mt-0.5 font-medium">
                {i + 1}
              </span>
              <p className="text-sm text-slate-300 leading-snug">{action}</p>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
