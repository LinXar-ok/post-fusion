'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { WeeklyBriefCard } from '@/components/brand-brain/weekly-brief-card'
import { NudgeList } from '@/components/brand-brain/nudge-list'
import { PostIdeasGrid } from '@/components/brand-brain/post-ideas-grid'

type Nudge = { type: string; message: string }
type Brief = {
  id: string
  summary: string
  insights: { type: 'positive' | 'gap'; text: string }[]
  post_ideas: { pillar: string; hook: string }[]
  actions: string[]
}

export default function BrandBrainPage() {
  const [brief, setBrief] = useState<Brief | null>(null)
  const [nudges, setNudges] = useState<Nudge[]>([])
  const [briefLoading, setBriefLoading] = useState(true)
  const [nudgesLoading, setNudgesLoading] = useState(true)

  useEffect(() => {
    fetch('/api/brand-brain/brief')
      .then(r => r.json())
      .then(data => { setBrief(data.brief); setBriefLoading(false) })
      .catch(() => setBriefLoading(false))

    fetch('/api/brand-brain/nudges')
      .then(r => r.json())
      .then(data => { setNudges(data.nudges ?? []); setNudgesLoading(false) })
      .catch(() => setNudgesLoading(false))
  }, [])

  const handleDismiss = useCallback(async (type: string) => {
    await fetch('/api/brand-brain/dismiss-nudge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nudge_type: type }),
    })
    setNudges(prev => prev.filter(n => n.type !== type))
  }, [])

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-foreground">Brand Brain</h1>
        <p className="text-sm text-slate-400 mt-1">
          Your personal brand strategist — learns from your posts, tells you what to do next.
        </p>
      </motion.div>

      {/* Weekly Brief */}
      <section>
        <WeeklyBriefCard brief={brief} loading={briefLoading} />
      </section>

      {/* Post Ideas */}
      {!briefLoading && brief && brief.post_ideas.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-widest text-slate-500">Suggested Post Ideas</h2>
          <PostIdeasGrid ideas={brief.post_ideas} />
        </section>
      )}

      {/* Nudges */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-widest text-slate-500">Smart Nudges</h2>
        {nudgesLoading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-10 bg-white/5 rounded-xl" />
            <div className="h-10 bg-white/5 rounded-xl" />
          </div>
        ) : (
          <NudgeList nudges={nudges} onDismiss={handleDismiss} />
        )}
      </section>
    </div>
  )
}
