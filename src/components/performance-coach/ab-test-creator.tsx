'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { FlaskConical, Trophy } from 'lucide-react'

type AbTest = {
  id: string
  status: 'running' | 'decided'
  decide_after: string
  post_a: { id: string; content: string; post_analytics?: { engagement_rate: number } | null }
  post_b: { id: string; content: string; post_analytics?: { engagement_rate: number } | null }
  winner?: { id: string; content: string } | null
}

type Props = {
  tests: AbTest[]
  onDecide: (testId: string) => Promise<void>
}

export function AbTestCreator({ tests, onDecide }: Props) {
  const [deciding, setDeciding] = useState<string | null>(null)

  const handleDecide = async (id: string) => {
    setDeciding(id)
    await onDecide(id)
    setDeciding(null)
  }

  if (tests.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-center">
        <FlaskConical className="w-8 h-8 text-slate-600 mx-auto mb-2" />
        <p className="text-sm text-slate-500">No A/B tests yet.</p>
        <p className="text-xs text-slate-600 mt-1">Create a test from the publishing editor by toggling A/B mode.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {tests.map(test => (
        <motion.div
          key={test.id}
          layout
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-3.5 h-3.5 text-slate-400" />
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${test.status === 'running' ? 'text-[#C97D3A] bg-[#C97D3A]/15' : 'text-[#128C7E] bg-[#128C7E]/15'}`}>
                {test.status === 'running' ? 'Running' : 'Decided'}
              </span>
            </div>
            {test.status === 'running' && new Date(test.decide_after) <= new Date() && (
              <button
                onClick={() => handleDecide(test.id)}
                disabled={deciding === test.id}
                className="text-xs px-3 py-1 rounded-lg bg-[#128C7E]/20 text-[#128C7E] hover:bg-[#128C7E]/30 transition-colors disabled:opacity-50"
              >
                {deciding === test.id ? 'Picking winner…' : 'Pick winner now'}
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 divide-x divide-white/10">
            {[{ label: 'A', post: test.post_a, isWinner: test.winner?.id === test.post_a.id },
              { label: 'B', post: test.post_b, isWinner: test.winner?.id === test.post_b.id }].map(({ label, post, isWinner }) => (
              <div key={label} className={`px-4 py-3 ${isWinner ? 'bg-[#128C7E]/10' : ''}`}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-xs text-slate-500 font-semibold">Variant {label}</span>
                  {isWinner && <Trophy className="w-3 h-3 text-[#128C7E]" />}
                </div>
                <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">{post.content}</p>
                {post.post_analytics && (
                  <p className="text-xs text-[#128C7E] mt-2 font-semibold">{post.post_analytics.engagement_rate}% eng.</p>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  )
}
