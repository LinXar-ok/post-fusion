'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2, ExternalLink, BarChart2 } from 'lucide-react'

type BioLink = { id: string; label: string; url: string; sort_order: number; click_count: number }
type BioPage = { id: string; slug: string; title: string; bio?: string | null }

export default function LinkInBioPage() {
  const [page, setPage] = useState<BioPage | null>(null)
  const [links, setLinks] = useState<BioLink[]>([])
  const [loading, setLoading] = useState(true)
  const [setupMode, setSetupMode] = useState(false)

  // Setup form state
  const [slug, setSlug] = useState('')
  const [title, setTitle] = useState('My Links')
  const [bio, setBio] = useState('')
  const [setupLoading, setSetupLoading] = useState(false)

  // Add link form state
  const [newLabel, setNewLabel] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [addingLink, setAddingLink] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/bio')
    const data = await res.json()
    if (data.page) {
      setPage(data.page)
      const sorted = [...(data.page.bio_links ?? [])].sort((a: BioLink, b: BioLink) => a.sort_order - b.sort_order)
      setLinks(sorted)
    } else {
      setSetupMode(true)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    setSetupLoading(true)
    await fetch('/api/bio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, title, bio }),
    })
    setSetupLoading(false)
    setSetupMode(false)
    await load()
  }

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLabel.trim() || !newUrl.trim()) return
    setAddingLink(true)
    const res = await fetch('/api/bio/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: newLabel, url: newUrl, sort_order: links.length }),
    })
    const data = await res.json()
    if (data.link) setLinks(prev => [...prev, data.link])
    setNewLabel(''); setNewUrl('')
    setAddingLink(false)
  }

  const handleDeleteLink = async (id: string) => {
    await fetch('/api/bio/links', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setLinks(prev => prev.filter(l => l.id !== id))
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-4 animate-pulse">
        <div className="h-8 bg-white/5 rounded w-1/3" />
        <div className="h-32 bg-white/5 rounded-2xl" />
      </div>
    )
  }

  // Setup flow — no page yet
  if (setupMode) {
    return (
      <div className="max-w-lg mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-foreground mb-2">Set Up Your Link-in-Bio</h1>
        <p className="text-sm text-slate-400 mb-6">Create a public page to share in your social bios.</p>
        <form onSubmit={handleSetup} className="space-y-4">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Page URL slug</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">/bio/</span>
              <input value={slug} onChange={e => setSlug(e.target.value)} required placeholder="yourname"
                className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-foreground placeholder:text-slate-600 focus:outline-none focus:border-[#128C7E]" />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Page title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} required
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#128C7E]" />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Bio (optional)</label>
            <textarea value={bio} onChange={e => setBio(e.target.value)} rows={2} maxLength={160}
              placeholder="Short description of who you are"
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-foreground placeholder:text-slate-600 resize-none focus:outline-none focus:border-[#128C7E]" />
          </div>
          <button type="submit" disabled={setupLoading || !slug.trim()}
            className="w-full py-2.5 rounded-xl bg-[#128C7E] text-white text-sm font-medium hover:bg-[#0e7a6e] disabled:opacity-50 transition-colors">
            {setupLoading ? 'Creating…' : 'Create My Page'}
          </button>
        </form>
      </div>
    )
  }

  const totalClicks = links.reduce((s, l) => s + l.click_count, 0)
  const publicUrl = `/bio/${page?.slug}`

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Link-in-Bio</h1>
          <a href={publicUrl} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 text-sm text-[#128C7E] hover:underline mt-1">
            {typeof window !== 'undefined' ? window.location.origin : ''}{publicUrl} <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-slate-400">
          <BarChart2 className="w-4 h-4" />
          <span>{totalClicks} total clicks</span>
        </div>
      </motion.div>

      {/* Links list */}
      <section className="space-y-2">
        {links.map(link => (
          <motion.div key={link.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 group">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{link.label}</p>
              <p className="text-xs text-slate-500 truncate">{link.url}</p>
            </div>
            <span className="text-xs text-slate-500 shrink-0">{link.click_count} clicks</span>
            <button onClick={() => handleDeleteLink(link.id)}
              className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}

        {/* Add link form */}
        <form onSubmit={handleAddLink} className="flex items-center gap-2 pt-1">
          <input value={newLabel} onChange={e => setNewLabel(e.target.value)} required placeholder="Label"
            className="w-32 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-foreground placeholder:text-slate-600 focus:outline-none focus:border-[#128C7E]" />
          <input value={newUrl} onChange={e => setNewUrl(e.target.value)} required placeholder="https://…" type="url"
            className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-foreground placeholder:text-slate-600 focus:outline-none focus:border-[#128C7E]" />
          <button type="submit" disabled={addingLink}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#128C7E] text-white text-sm hover:bg-[#0e7a6e] disabled:opacity-50 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </form>
      </section>
    </div>
  )
}
