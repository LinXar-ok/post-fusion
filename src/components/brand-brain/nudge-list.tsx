'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

type Nudge = { type: string; message: string }

type Props = {
  nudges: Nudge[]
  onDismiss: (type: string) => Promise<void>
}

export function NudgeList({ nudges, onDismiss }: Props) {
  const [dismissing, setDismissing] = useState<string | null>(null)

  const handleDismiss = async (type: string) => {
    setDismissing(type)
    await onDismiss(type)
    setDismissing(null)
  }

  if (nudges.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No nudges right now — you're on track.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <AnimatePresence mode="popLayout">
        {nudges.map(n => (
          <motion.div
            key={n.type}
            layout
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3"
          >
            <p className="text-sm text-slate-300 leading-snug">{n.message}</p>
            <button
              onClick={() => handleDismiss(n.type)}
              disabled={dismissing === n.type}
              className="text-slate-500 hover:text-slate-300 transition-colors shrink-0 mt-0.5"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
