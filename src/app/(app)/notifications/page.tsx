import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CheckCircle, XCircle, Brain, Zap } from 'lucide-react'

const typeIcon: Record<string, React.ReactNode> = {
  post_published: <CheckCircle className="w-4 h-4 text-[#128C7E]" />,
  post_failed:    <XCircle    className="w-4 h-4 text-destructive" />,
  brief_ready:    <Brain      className="w-4 h-4 text-[#7BA4D0]" />,
  ab_decided:     <Zap        className="w-4 h-4 text-[#675B47]" />,
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 60)  return `${mins}m ago`
  if (hours < 24)  return `${hours}h ago`
  return `${days}d ago`
}

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  const items = notifications ?? []

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-2xl mx-auto w-full">
      <h1 className="font-display text-3xl font-bold tracking-tight text-foreground mb-1">Notifications</h1>
      <p className="text-muted-foreground text-sm mb-8">Your recent activity and alerts.</p>

      {items.length === 0 ? (
        <div className="rounded-2xl p-12 text-center bg-[var(--nm-bg)]" style={{ boxShadow: 'var(--nm-raised)' }}>
          <p className="text-sm text-muted-foreground">No notifications yet.</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden bg-[var(--nm-bg)]" style={{ boxShadow: 'var(--nm-raised)' }}>
          {items.map((n, i) => (
            <div
              key={n.id}
              className={`flex gap-4 items-start px-6 py-5 ${i < items.length - 1 ? 'border-b border-border' : ''} ${!n.read_at ? 'bg-primary/5' : ''}`}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-[var(--nm-bg)]" style={{ boxShadow: 'var(--nm-raised-xs)' }}>
                {typeIcon[n.type]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{n.title}</p>
                {n.body && <p className="text-xs text-muted-foreground mt-1">{n.body}</p>}
                <p className="text-[10px] text-muted-foreground mt-1.5 font-semibold uppercase tracking-wide">{timeAgo(n.created_at)}</p>
              </div>
              {!n.read_at && <span className="w-2 h-2 rounded-full bg-[#128C7E] shrink-0 mt-2" />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
