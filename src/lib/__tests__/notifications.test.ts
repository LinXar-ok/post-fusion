import { countUnread } from '@/lib/notifications'

type Notif = { read_at: string | null }

describe('countUnread', () => {
  it('returns 0 for empty array', () => {
    expect(countUnread([])).toBe(0)
  })

  it('counts only rows where read_at is null', () => {
    const notifications: Notif[] = [
      { read_at: null },
      { read_at: '2026-04-18T10:00:00Z' },
      { read_at: null },
    ]
    expect(countUnread(notifications)).toBe(2)
  })

  it('returns 0 when all are read', () => {
    const notifications: Notif[] = [
      { read_at: '2026-04-17T09:00:00Z' },
      { read_at: '2026-04-18T10:00:00Z' },
    ]
    expect(countUnread(notifications)).toBe(0)
  })
})
