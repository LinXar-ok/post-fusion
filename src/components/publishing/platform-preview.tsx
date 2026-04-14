'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { getOverageInfo } from '@/lib/platform-limits'
import { FaLinkedin, FaXTwitter, FaInstagram, FaFacebook } from 'react-icons/fa6'
import { cn } from '@/lib/utils'

const PLATFORM_META: Record<string, { label: string; Icon: React.ElementType; color: string }> = {
  linkedin:  { label: 'LinkedIn',  Icon: FaLinkedin,  color: '#0A66C2' },
  x:         { label: 'X',         Icon: FaXTwitter,  color: '#000000' },
  instagram: { label: 'Instagram', Icon: FaInstagram, color: '#E1306C' },
  facebook:  { label: 'Facebook',  Icon: FaFacebook,  color: '#1877F2' },
}

type Props = {
  content: string
  platforms: string[]
}

export function PlatformPreview({ content, platforms }: Props) {
  if (!content.trim() || platforms.length === 0) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-3"
      >
        <p className="text-xs uppercase tracking-widest text-slate-500">Platform Preview</p>
        {platforms.map(platform => {
          const meta = PLATFORM_META[platform]
          if (!meta) return null
          const info = getOverageInfo(platform, content)
          const preview = info.status === 'over' && info.limit
            ? content.slice(0, info.limit)
            : content

          return (
            <div
              key={platform}
              className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
                <meta.Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
                <span className="text-xs text-slate-400">{meta.label}</span>
                <div className="ml-auto flex items-center gap-2">
                  {info.limit && (
                    <span className={cn(
                      'text-xs font-mono',
                      info.status === 'over'    ? 'text-red-400' :
                      info.status === 'warning' ? 'text-[#C97D3A]' : 'text-slate-500'
                    )}>
                      {info.status === 'over' ? `-${info.overage}` : info.remaining}
                    </span>
                  )}
                </div>
              </div>

              {/* Content preview */}
              <div className="px-3 py-3">
                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap break-words">
                  {preview}
                  {info.status === 'over' && (
                    <span className="text-red-400 bg-red-400/10 rounded px-0.5 ml-0.5">
                      …+{info.overage} chars
                    </span>
                  )}
                </p>
              </div>

              {/* Over-limit warning */}
              {info.status === 'over' && (
                <div className="px-3 py-2 bg-red-400/10 border-t border-red-400/20">
                  <p className="text-xs text-red-400">
                    {info.overage} characters over the {meta.label} limit of {info.limit?.toLocaleString()}. Post will be truncated.
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </motion.div>
    </AnimatePresence>
  )
}
