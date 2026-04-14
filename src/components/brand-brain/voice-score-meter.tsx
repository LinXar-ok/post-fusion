'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

type Props = {
  score: number | null
  traits: string[]
  flags: string[]
  loading?: boolean
}

export function VoiceScoreMeter({ score, traits, flags, loading }: Props) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400 animate-pulse">
        <div className="w-3 h-3 rounded-full bg-slate-600" />
        Scoring voice…
      </div>
    )
  }

  if (score === null) return null

  const color = score >= 80 ? '#128C7E' : score >= 60 ? '#C97D3A' : '#E05252'
  const label = score >= 80 ? 'On-brand' : score >= 60 ? 'Slightly off' : 'Off-brand'

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400 uppercase tracking-wide">Brand Voice</span>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold" style={{ color }}>{score}</span>
          <span className="text-xs" style={{ color }}>{label}</span>
        </div>
      </div>

      {/* Score bar */}
      <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>

      {traits.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {traits.map(t => (
            <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-slate-400">
              ↑ {t}
            </span>
          ))}
          {flags.map(f => (
            <span key={f} className={cn('text-xs px-2 py-0.5 rounded-full bg-white/5')} style={{ color: '#C97D3A' }}>
              ↓ {f}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  )
}
