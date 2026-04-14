'use client'

import { Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'

type ArcPost = { post_id: string; sequence_order: number }
type Arc = {
  id: string
  name: string
  description?: string | null
  start_date?: string | null
  end_date?: string | null
  status: 'draft' | 'active' | 'completed'
  story_arc_posts: ArcPost[]
}

type Props = { arc: Arc; onDelete: (id: string) => void }

const STATUS_COLOR = { draft: '#888', active: '#128C7E', completed: '#4A90D9' }

export function StoryArcCard({ arc, onDelete }: Props) {
  const postCount = arc.story_arc_posts.length
  const dateRange = arc.start_date && arc.end_date
    ? `${new Date(arc.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} → ${new Date(arc.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : 'No dates set'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden group"
    >
      <div className="px-4 py-3 flex items-center justify-between border-b border-white/5"
        style={{ background: `${STATUS_COLOR[arc.status]}10` }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{arc.name}</span>
          <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ color: STATUS_COLOR[arc.status], background: `${STATUS_COLOR[arc.status]}20` }}>
            {arc.status}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">{dateRange}</span>
          <button onClick={() => onDelete(arc.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-red-400">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="px-4 py-3">
        {arc.description && <p className="text-xs text-slate-500 mb-2">{arc.description}</p>}
        <p className="text-xs text-slate-400">{postCount} post{postCount !== 1 ? 's' : ''} in this arc</p>
      </div>
    </motion.div>
  )
}
