'use client'

import { Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'

type Pillar = {
  id: string
  name: string
  emoji: string
  color: string
  description?: string | null
  target_pct: number
}

type Props = {
  pillar: Pillar
  actualPct: number
  postCount: number
  status: 'on_target' | 'low' | 'high'
  onDelete: (id: string) => void
}

const STATUS_LABEL = { on_target: 'On target', low: '⚠ Low', high: '⚠ High' }
const STATUS_COLOR = { on_target: '#128C7E', low: '#C97D3A', high: '#E05252' }

export function PillarCard({ pillar, actualPct, postCount, status, onDelete }: Props) {
  const color = pillar.color
  const statusColor = STATUS_COLOR[status]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-xl border bg-white/[0.03] p-4 flex flex-col gap-3 relative group"
      style={{ borderColor: `${color}40` }}
    >
      <button
        onClick={() => onDelete(pillar.id)}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-red-400"
        aria-label="Delete pillar"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      <div className="flex items-center gap-2">
        <span className="text-xl">{pillar.emoji}</span>
        <div>
          <p className="text-sm font-semibold text-foreground">{pillar.name}</p>
          {pillar.description && <p className="text-xs text-slate-500">{pillar.description}</p>}
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">Actual</span>
          <span style={{ color: statusColor }}>{actualPct}% · {STATUS_LABEL[status]}</span>
        </div>
        <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: color }}
            initial={{ width: 0 }}
            animate={{ width: `${actualPct}%` }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-500">
          <span>{postCount} posts</span>
          <span>Target: {pillar.target_pct}%</span>
        </div>
      </div>
    </motion.div>
  )
}
