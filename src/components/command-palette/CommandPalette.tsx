'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, PenSquare, Image as ImageIcon, Calendar,
  Inbox, Radio, Activity, Layers, Brain, Link2, Settings,
  Plus, Moon,
} from 'lucide-react'

// ── Static items ────────────────────────────────────────────────────────────

type Item = {
  id: string
  group: 'Pages' | 'Posts' | 'Settings' | 'Actions'
  label: string
  description: string
  icon: React.ReactNode
  action: () => void
}

const PAGE_ITEMS: Omit<Item, 'action'>[] = [
  { id: 'dashboard',    group: 'Pages', label: 'Dashboard',        description: 'Overview of your social presence',  icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
  { id: 'publishing',   group: 'Pages', label: 'Publishing',        description: 'Create and schedule posts',         icon: <PenSquare className="w-3.5 h-3.5" /> },
  { id: 'media',        group: 'Pages', label: 'Media Library',     description: 'Manage your uploaded media',        icon: <ImageIcon className="w-3.5 h-3.5" /> },
  { id: 'calendar',     group: 'Pages', label: 'Calendar',          description: 'View scheduled content',           icon: <Calendar className="w-3.5 h-3.5" /> },
  { id: 'inbox',        group: 'Pages', label: 'Inbox',             description: 'Messages and mentions',            icon: <Inbox className="w-3.5 h-3.5" /> },
  { id: 'listening',    group: 'Pages', label: 'Listening',         description: 'Track brand mentions',             icon: <Radio className="w-3.5 h-3.5" /> },
  { id: 'analytics',    group: 'Pages', label: 'Analytics',         description: 'Post performance data',            icon: <Activity className="w-3.5 h-3.5" /> },
  { id: 'content-arch', group: 'Pages', label: 'Content Arch',      description: 'Pillars and story arcs',           icon: <Layers className="w-3.5 h-3.5" /> },
  { id: 'brand-brain',  group: 'Pages', label: 'Brand Brain',       description: 'AI-powered weekly brief',          icon: <Brain className="w-3.5 h-3.5" /> },
  { id: 'link-in-bio',  group: 'Pages', label: 'Link-in-Bio',       description: 'Manage your bio page',             icon: <Link2 className="w-3.5 h-3.5" /> },
  { id: 'settings',     group: 'Pages', label: 'Settings',          description: 'Account and platform settings',    icon: <Settings className="w-3.5 h-3.5" /> },
]

type PostResult = { id: string; content: string; status: string; platforms: string[] }

function match(text: string, query: string): boolean {
  if (!query) return true
  return text.toLowerCase().includes(query.toLowerCase())
}

// ── Component ────────────────────────────────────────────────────────────────

export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen]     = useState(false)
  const [query, setQuery]   = useState('')
  const [posts, setPosts]   = useState<PostResult[]>([])
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Fetch posts once on mount
  useEffect(() => {
    fetch('/api/command-palette/posts')
      .then((r) => r.json())
      .then((d) => setPosts(d.posts ?? []))
      .catch(() => {})
  }, [])

  // Global keyboard listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Expose open function for the header trigger button
  useEffect(() => {
    const trigger = document.getElementById('cmd-palette-trigger')
    if (!trigger) return
    const handler = () => setOpen(true)
    trigger.addEventListener('click', handler)
    return () => trigger.removeEventListener('click', handler)
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const navigate = useCallback((href: string) => {
    setOpen(false)
    router.push(href)
  }, [router])

  const pageItems: Item[] = PAGE_ITEMS
    .filter((item) => match(item.label + ' ' + item.description, query))
    .map((item) => ({ ...item, action: () => navigate(`/${item.id === 'dashboard' ? '' : item.id}`) }))

  const postItems: Item[] = posts
    .filter((p) => match(p.content, query))
    .slice(0, 5)
    .map((p) => ({
      id: p.id,
      group: 'Posts' as const,
      label: p.content.slice(0, 60) + (p.content.length > 60 ? '…' : ''),
      description: `${p.status.charAt(0).toUpperCase() + p.status.slice(1)} · ${p.platforms.join(', ')}`,
      icon: <span className="text-[10px] font-bold text-muted-foreground">{p.platforms[0]?.slice(0, 2).toUpperCase()}</span>,
      action: () => navigate('/publishing'),
    }))

  const actionItems: Item[] = ([
    { id: 'new-post',    group: 'Actions' as const, label: 'New post',          description: 'Open the publishing editor', icon: <Plus  className="w-3.5 h-3.5 text-[#128C7E]" />, action: () => navigate('/publishing') },
    { id: 'go-profile',  group: 'Actions' as const, label: 'Go to Profile',     description: 'Edit your account',         icon: <Settings className="w-3.5 h-3.5" />,              action: () => navigate('/profile') },
    { id: 'toggle-dark', group: 'Actions' as const, label: 'Toggle dark mode',  description: 'Switch theme',              icon: <Moon  className="w-3.5 h-3.5" />,                 action: () => document.documentElement.classList.toggle('dark') },
  ] as Item[]).filter((a) => match(a.label + ' ' + a.description, query))

  const allItems = [...pageItems, ...postItems, ...actionItems]

  // Keyboard navigation inside palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, allItems.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    if (e.key === 'Enter' && allItems[active]) { allItems[active].action() }
  }

  // Group headers
  const groups = Array.from(new Set(allItems.map((i) => i.group)))

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
          {/* Scrim */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="relative w-full max-w-xl rounded-2xl overflow-hidden bg-[var(--nm-bg)] flex flex-col"
            style={{ boxShadow: 'var(--nm-raised-lg)' }}
          >
            {/* Search input row */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
              <svg className="w-4 h-4 text-muted-foreground shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActive(0) }}
                onKeyDown={handleKeyDown}
                placeholder="Search pages, posts, settings…"
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <kbd className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">Esc</kbd>
            </div>

            {/* Results */}
            <div className="max-h-[360px] overflow-y-auto py-2">
              {allItems.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No results for &ldquo;{query}&rdquo;</p>
              )}
              {groups.map((group) => {
                const groupItems = allItems.filter((i) => i.group === group)
                const groupStart = allItems.indexOf(groupItems[0])
                return (
                  <div key={group}>
                    <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{group}</div>
                    {groupItems.map((item, idx) => {
                      const globalIdx = groupStart + idx
                      const isActive = globalIdx === active
                      return (
                        <button
                          key={item.id}
                          onClick={item.action}
                          onMouseEnter={() => setActive(globalIdx)}
                          className={`w-full text-left flex items-center gap-3 px-4 py-2.5 transition-colors cursor-pointer ${isActive ? 'bg-primary/10 border-l-2 border-[#2E5E99]' : 'border-l-2 border-transparent'}`}
                        >
                          <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-[var(--nm-bg)] text-muted-foreground" style={{ boxShadow: isActive ? 'var(--nm-inset-sm)' : 'var(--nm-raised-xs)' }}>
                            {item.icon}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-medium text-foreground">{item.label}</span>
                            <span className="block text-xs text-muted-foreground truncate">{item.description}</span>
                          </span>
                          {isActive && <kbd className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5 shrink-0">↵</kbd>}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-border flex gap-4">
              {[['↑↓', 'navigate'], ['↵', 'open'], ['Esc', 'close']].map(([key, label]) => (
                <span key={key} className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                  <kbd className="border border-border rounded px-1 py-0.5 bg-muted/30">{key}</kbd>
                  {label}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
