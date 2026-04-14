'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ExternalLink } from 'lucide-react'

type BioLink = { id: string; label: string; url: string; sort_order: number }
type BioPage = { title: string; bio?: string | null; avatar_url?: string | null; theme: string }

type Props = { page: BioPage; links: BioLink[] }

export function BioPageView({ page, links }: Props) {
  const [clicked, setClicked] = useState<string | null>(null)

  const handleClick = async (link: BioLink) => {
    setClicked(link.id)
    // Fire-and-forget click tracking
    fetch(`/api/bio/links/${link.id}/click`, { method: 'POST' }).catch(() => {})
    // Small delay so user sees the highlight, then navigate
    await new Promise(r => setTimeout(r, 200))
    window.open(link.url, '_blank', 'noopener,noreferrer')
    setClicked(null)
  }

  return (
    <div className="min-h-screen flex items-start justify-center py-16 px-4"
      style={{ background: page.theme === 'dark' ? '#0B1020' : '#F8FAFC' }}>
      <div className="w-full max-w-sm space-y-8">
        {/* Profile */}
        <div className="text-center space-y-2">
          {page.avatar_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={page.avatar_url} alt={page.title}
              className="w-20 h-20 rounded-full mx-auto object-cover border-2 border-[#128C7E]" />
          )}
          <h1 className={`text-xl font-bold ${page.theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            {page.title}
          </h1>
          {page.bio && (
            <p className={`text-sm ${page.theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{page.bio}</p>
          )}
        </div>

        {/* Links */}
        <div className="space-y-3">
          {links.map((link, i) => (
            <motion.button
              key={link.id}
              onClick={() => handleClick(link)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className={`w-full flex items-center justify-between px-5 py-3.5 rounded-2xl text-sm font-medium transition-all ${
                clicked === link.id ? 'scale-95' : 'scale-100'
              } ${
                page.theme === 'dark'
                  ? 'bg-white/10 hover:bg-white/15 text-white border border-white/10'
                  : 'bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 shadow-sm'
              }`}
            >
              <span>{link.label}</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-50" />
            </motion.button>
          ))}
        </div>

        <p className={`text-center text-xs ${page.theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`}>
          Made with LinXar Ops
        </p>
      </div>
    </div>
  )
}
