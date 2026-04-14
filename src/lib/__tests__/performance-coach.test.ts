import { computeContentGaps, pickAbWinner } from '@/lib/performance-coach'

describe('computeContentGaps', () => {
  it('returns pillars missing from the last 14 days', () => {
    const now = new Date('2026-04-14T12:00:00Z').getTime()
    const posts = [
      { pillar_id: 'p1', created_at: new Date(now - 3 * 86400_000).toISOString() },
      { pillar_id: 'p1', created_at: new Date(now - 5 * 86400_000).toISOString() },
      { pillar_id: 'p2', created_at: new Date(now - 20 * 86400_000).toISOString() }, // too old
    ]
    const pillars = [
      { id: 'p1', name: 'Building', emoji: '🛠️' },
      { id: 'p2', name: 'Tips',     emoji: '💡' },
      { id: 'p3', name: 'Personal', emoji: '🧬' },
    ]
    const gaps = computeContentGaps(pillars, posts, now)
    // p2 last posted 20 days ago (> 14), p3 never posted
    expect(gaps.map(g => g.id).sort()).toEqual(['p2', 'p3'].sort())
  })

  it('returns empty array when all pillars were posted recently', () => {
    const now = new Date('2026-04-14T12:00:00Z').getTime()
    const posts = [
      { pillar_id: 'p1', created_at: new Date(now - 2 * 86400_000).toISOString() },
      { pillar_id: 'p2', created_at: new Date(now - 5 * 86400_000).toISOString() },
    ]
    const pillars = [
      { id: 'p1', name: 'Building', emoji: '🛠️' },
      { id: 'p2', name: 'Tips',     emoji: '💡' },
    ]
    const gaps = computeContentGaps(pillars, posts, now)
    expect(gaps).toHaveLength(0)
  })
})

describe('pickAbWinner', () => {
  it('picks the post with higher engagement_rate', () => {
    const a = { id: 'post-a', engagement_rate: 5.2 }
    const b = { id: 'post-b', engagement_rate: 3.1 }
    expect(pickAbWinner(a, b)).toBe('post-a')
  })

  it('returns post_a if engagement rates are equal', () => {
    const a = { id: 'post-a', engagement_rate: 4.0 }
    const b = { id: 'post-b', engagement_rate: 4.0 }
    expect(pickAbWinner(a, b)).toBe('post-a')
  })
})
