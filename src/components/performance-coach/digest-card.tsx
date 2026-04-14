'use client'

import { motion } from 'framer-motion'
import { TrendingUp } from 'lucide-react'

type Digest = {
  summary: string
  actions: string[]
  metrics: { total_posts?: number; avg_engagement?: string }
}

type Props = { digest: Digest | null; loading: boolean }

export function DigestCard({ digest, loading }: Props) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-3 animate-pulse">
        <div className="h-4 bg-white/10 rounded w-3/4" />
        <div className="h-4 bg-white/10 rounded w-1/2" />
        <div className="h-4 bg-white/10 rounded w-2/3" />
      </div>
    )
  }

  if (!digest) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
        <p className="text-sm text-slate-500">Publish posts this week to unlock your performance digest.</p>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-[#128C7E]/30 bg-[#128C7E]/[0.07] p-5 space-y-4"
    >
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-[#128C7E]" />
        <span className="text-xs uppercase tracking-widest text-[#128C7E]">This Week&apos;s Performance</span>
      </div>

      {/* Metrics row */}
      <div className="flex gap-4">
        <div>
          <p className="text-xl font-bold text-foreground">{digest.metrics.total_posts ?? '—'}</p>
          <p className="text-xs text-slate-500">Posts published</p>
        </div>
        <div>
          <p className="text-xl font-bold text-foreground">{digest.metrics.avg_engagement ?? '—'}%</p>
          <p className="text-xs text-slate-500">Avg engagement</p>
        </div>
      </div>

      <p className="text-sm text-slate-300 leading-relaxed">{digest.summary}</p>

      {digest.actions.length > 0 && (
        <div className="space-y-2 pt-1 border-t border-white/10">
          <p className="text-xs uppercase tracking-widest text-slate-500">Your 3 Actions This Week</p>
          {digest.actions.map((action, i) => (
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
