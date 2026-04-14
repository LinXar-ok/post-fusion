'use client'

import { motion } from 'framer-motion'
import { PenSquare } from 'lucide-react'
import Link from 'next/link'

type PostIdea = { pillar: string; hook: string }

type Props = { ideas: PostIdea[] }

const PILLAR_COLORS: Record<string, string> = {
  'Personal Story':    '#C97D3A',
  'Behind the Scenes': '#128C7E',
  'Tips & Insights':   '#4A90D9',
  'Curated':           '#9B59B6',
}

export function PostIdeasGrid({ ideas }: Props) {
  if (ideas.length === 0) return null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {ideas.map((idea, i) => {
        const color = PILLAR_COLORS[idea.pillar] ?? '#7BA4D0'
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex flex-col gap-3"
          >
            <span
              className="text-xs px-2 py-0.5 rounded-full self-start font-medium"
              style={{ color, background: `${color}20` }}
            >
              {idea.pillar}
            </span>
            <p className="text-sm text-slate-300 leading-snug flex-1">{idea.hook}</p>
            <Link
              href={`/publishing?draft=${encodeURIComponent(idea.hook)}`}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#128C7E] transition-colors mt-auto"
            >
              <PenSquare className="w-3 h-3" />
              Draft this
            </Link>
          </motion.div>
        )
      })}
    </div>
  )
}
