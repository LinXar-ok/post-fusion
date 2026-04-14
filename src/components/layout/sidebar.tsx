'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Calendar, Inbox, LayoutDashboard, Settings, Activity,
  PenSquare, Sparkles, Image as ImageIcon, Radio, Brain, Link2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { name: 'Dashboard',     href: '/',             icon: LayoutDashboard },
  { name: 'Publishing',    href: '/publishing',    icon: PenSquare },
  { name: 'Media Library', href: '/media',         icon: ImageIcon },
  { name: 'Calendar',      href: '/calendar',      icon: Calendar },
  { name: 'Inbox',         href: '/inbox',         icon: Inbox },
  { name: 'Listening',     href: '/listening',     icon: Radio },
  { name: 'Analytics',     href: '/analytics',     icon: Activity },
  { name: 'Brand Brain',   href: '/brand-brain',   icon: Brain },
  { name: 'Link-in-Bio',   href: '/link-in-bio',   icon: Link2 },
  { name: 'Settings',      href: '/settings',      icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const [unreadBriefs, setUnreadBriefs] = useState(0)

  useEffect(() => {
    // Poll for unread brief count (lightweight — no AI call)
    fetch('/api/brand-brain/brief?meta=true')
      .then(r => r.json())
      .then(data => setUnreadBriefs(data.unread ?? 0))
      .catch(() => {})
  }, [pathname])

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <aside
      className="w-64 h-screen hidden md:flex flex-col shrink-0 z-20 relative"
      style={{ background: 'var(--nm-bg)' }}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-5">
        <div
          className="flex items-center gap-2.5 rounded-xl px-3 py-2 bg-[var(--nm-bg)]"
          style={{ boxShadow: 'var(--nm-raised-sm)' }}
        >
          <div
            className="w-7 h-7 rounded-lg bg-[#2E5E99] flex items-center justify-center shrink-0"
            style={{ boxShadow: 'var(--nm-inset-sm)' }}
          >
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-display text-sm font-bold tracking-tight text-[#0D2440] dark:text-foreground leading-none">
            LinXar Ops
          </span>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-4 py-3 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const active = isActive(item.href)
          const isBrain = item.href === '/brand-brain'
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200 bg-[var(--nm-bg)]',
                active
                  ? 'text-[#2E5E99]'
                  : 'text-slate-500 dark:text-slate-400 hover:text-[#0D2440] dark:hover:text-foreground'
              )}
              style={{ boxShadow: active ? 'var(--nm-inset-sm)' : undefined }}
            >
              <item.icon
                className={cn(
                  'h-4 w-4 shrink-0 transition-colors',
                  active ? 'text-[#2E5E99]' : 'text-slate-400 dark:text-slate-500'
                )}
              />
              <span>{item.name}</span>
              {active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#2E5E99] shrink-0 nm-pulse" />
              )}
              {!active && isBrain && unreadBriefs > 0 && (
                <span className="ml-auto h-4 w-4 rounded-full bg-[#128C7E] text-white text-[9px] flex items-center justify-center shrink-0 font-bold">
                  {unreadBriefs}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom teal accent */}
      <div
        className="h-px mx-5 mb-5"
        style={{
          background: 'linear-gradient(to right, transparent, rgba(46,94,153,0.4), transparent)',
        }}
      />
    </aside>
  )
}
