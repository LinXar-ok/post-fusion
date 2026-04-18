import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ThemeToggle } from './theme-toggle'
import { NotifBell } from '@/components/notifications/NotifBell'
import { AvatarMenu } from './AvatarMenu'

export async function Header() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const name      = (user?.user_metadata?.name as string | undefined) ?? 'User'
  const avatarUrl = (user?.user_metadata?.avatar_url as string | undefined) ?? ''

  return (
    <header
      className="h-16 px-6 flex items-center justify-between sticky top-0 z-10 w-full"
      style={{ background: 'var(--nm-bg)' }}
    >
      {/* Left: mobile menu + search trigger */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden text-slate-500 hover:text-foreground rounded-xl hover:bg-transparent bg-[var(--nm-bg)]"
          style={{ boxShadow: 'var(--nm-raised-sm)' }}
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Search — opens command palette, not a real input */}
        <button
          id="cmd-palette-trigger"
          className="relative hidden sm:flex items-center rounded-xl bg-[var(--nm-bg)] h-9 px-3 w-56 lg:w-72 gap-2 cursor-pointer text-left"
          style={{ boxShadow: 'var(--nm-inset-sm)' }}
          aria-label="Open command palette"
        >
          <svg className="h-3.5 w-3.5 text-muted-foreground shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <span className="text-sm text-muted-foreground flex-1">Search…</span>
          <kbd className="text-[10px] text-muted-foreground border border-border rounded px-1 py-0.5 hidden lg:inline">⌘K</kbd>
        </button>
      </div>

      {/* Right: theme + notifications + avatar */}
      <div className="flex items-center gap-2.5">
        <ThemeToggle />
        <NotifBell />
        {user ? (
          <AvatarMenu name={name} avatarUrl={avatarUrl} />
        ) : (
          <Link href="/login">
            <Button size="sm" className="rounded-xl bg-[#2E5E99] text-white" style={{ boxShadow: 'var(--nm-raised-sm)' }}>
              Sign In
            </Button>
          </Link>
        )}
      </div>
    </header>
  )
}
