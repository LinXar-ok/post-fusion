'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import { computePillarBalance } from '@/lib/content-arch'
import { PillarCard } from '@/components/content-arch/pillar-card'
import { PillarFormModal } from '@/components/content-arch/pillar-form-modal'
import { BalanceHeatmap } from '@/components/content-arch/balance-heatmap'
import { StoryArcCard } from '@/components/content-arch/story-arc-card'
import { StoryArcFormModal } from '@/components/content-arch/story-arc-form-modal'

type Pillar = { id: string; name: string; emoji: string; color: string; description?: string | null; target_pct: number }
type ArcPost = { post_id: string; sequence_order: number }
type Arc = { id: string; name: string; description?: string | null; start_date?: string | null; end_date?: string | null; status: 'draft' | 'active' | 'completed'; story_arc_posts: ArcPost[] }
type Post = { pillar_id: string | null }

export default function ContentArchitecturePage() {
  const [pillars, setPillars] = useState<Pillar[]>([])
  const [arcs, setArcs] = useState<Arc[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [pillarsModal, setPillarsModal] = useState(false)
  const [arcsModal, setArcsModal] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [p, a, po] = await Promise.all([
      fetch('/api/content-pillars').then(r => r.json()),
      fetch('/api/story-arcs').then(r => r.json()),
      fetch('/api/posts?limit=200').then(r => r.json()),
    ])
    setPillars(p.pillars ?? [])
    setArcs(a.arcs ?? [])
    setPosts((po.posts ?? []).map((p: { pillar_id: string | null }) => ({ pillar_id: p.pillar_id })))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleAddPillar = async (data: { name: string; emoji: string; color: string; description: string; target_pct: number }) => {
    await fetch('/api/content-pillars', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    await load()
  }

  const handleDeletePillar = async (id: string) => {
    await fetch(`/api/content-pillars/${id}`, { method: 'DELETE' })
    setPillars(prev => prev.filter(p => p.id !== id))
  }

  const handleAddArc = async (data: { name: string; description: string; start_date: string; end_date: string }) => {
    await fetch('/api/story-arcs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    await load()
  }

  const handleDeleteArc = async (id: string) => {
    await fetch(`/api/story-arcs/${id}`, { method: 'DELETE' })
    setArcs(prev => prev.filter(a => a.id !== id))
  }

  const balanceRows = computePillarBalance(pillars, posts)

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-10">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-foreground">Content Architecture</h1>
        <p className="text-sm text-slate-400 mt-1">Define your brand themes and plan multi-week story arcs.</p>
      </motion.div>

      {/* Pillars */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">Content Pillars</h2>
          {pillars.length < 5 && (
            <button onClick={() => setPillarsModal(true)}
              className="flex items-center gap-1.5 text-xs text-[#128C7E] hover:text-[#0e7a6e] transition-colors">
              <Plus className="w-3.5 h-3.5" /> Add pillar
            </button>
          )}
        </div>
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2].map(i => <div key={i} className="h-28 rounded-xl bg-white/5 animate-pulse" />)}
          </div>
        ) : pillars.length === 0 ? (
          <p className="text-sm text-slate-500">No pillars yet. Add up to 5 themes that define your brand.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {balanceRows.map(row => (
              <PillarCard key={row.id} pillar={row} actualPct={row.actual_pct} postCount={row.post_count} status={row.status} onDelete={handleDeletePillar} />
            ))}
          </div>
        )}
      </section>

      {/* Balance Heatmap */}
      {pillars.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">Content Balance</h2>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <BalanceHeatmap rows={balanceRows} />
          </div>
        </section>
      )}

      {/* Story Arcs */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">Story Arcs</h2>
          <button onClick={() => setArcsModal(true)}
            className="flex items-center gap-1.5 text-xs text-[#128C7E] hover:text-[#0e7a6e] transition-colors">
            <Plus className="w-3.5 h-3.5" /> New arc
          </button>
        </div>
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />)}
          </div>
        ) : arcs.length === 0 ? (
          <p className="text-sm text-slate-500">No arcs yet. Plan a series of connected posts that build toward a conclusion.</p>
        ) : (
          <div className="space-y-2">
            {arcs.map(arc => <StoryArcCard key={arc.id} arc={arc} onDelete={handleDeleteArc} />)}
          </div>
        )}
      </section>

      <PillarFormModal open={pillarsModal} onClose={() => setPillarsModal(false)} onSubmit={handleAddPillar} />
      <StoryArcFormModal open={arcsModal} onClose={() => setArcsModal(false)} onSubmit={handleAddArc} />
    </div>
  )
}
