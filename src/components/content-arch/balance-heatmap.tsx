'use client'

import { motion } from 'framer-motion'
import type { PillarBalanceRow } from '@/lib/content-arch'

type Props = { rows: PillarBalanceRow[] }

const STATUS_LABEL = { on_target: 'On target', low: '⚠ Low', high: '⚠ High' }
const STATUS_COLOR = { on_target: '#128C7E', low: '#C97D3A', high: '#E05252' }

export function BalanceHeatmap({ rows }: Props) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">Add pillars to see your content balance.</p>
  }

  return (
    <div className="space-y-3">
      {rows.map(row => (
        <div key={row.id} className="flex items-center gap-3">
          <div className="w-32 flex items-center gap-1.5 shrink-0">
            <span>{row.emoji}</span>
            <span className="text-sm text-slate-300 truncate">{row.name}</span>
          </div>
          <div className="flex-1 h-7 rounded-lg bg-white/5 overflow-hidden relative">
            <motion.div
              className="h-full rounded-lg"
              style={{ backgroundColor: row.color }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(row.actual_pct, 100)}%` }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
            />
            <span className="absolute inset-y-0 left-2 flex items-center text-xs text-white font-medium">
              {row.actual_pct}%
            </span>
          </div>
          <div className="w-20 text-right shrink-0">
            <span className="text-xs" style={{ color: STATUS_COLOR[row.status] }}>
              {STATUS_LABEL[row.status]}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
