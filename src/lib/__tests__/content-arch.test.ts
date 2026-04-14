import { computePillarBalance } from '@/lib/content-arch'

type Pillar = { id: string; name: string; target_pct: number; color: string; emoji: string }
type Post = { pillar_id: string | null }

describe('computePillarBalance', () => {
  const pillars: Pillar[] = [
    { id: 'p1', name: 'Building', target_pct: 30, color: '#128C7E', emoji: '🛠️' },
    { id: 'p2', name: 'Tips',     target_pct: 30, color: '#4A90D9', emoji: '💡' },
    { id: 'p3', name: 'Personal', target_pct: 40, color: '#C97D3A', emoji: '🧬' },
  ]

  it('computes correct actual percentages', () => {
    const posts: Post[] = [
      { pillar_id: 'p1' }, { pillar_id: 'p1' },
      { pillar_id: 'p2' },
      { pillar_id: 'p3' }, { pillar_id: 'p3' }, { pillar_id: 'p3' },
      { pillar_id: null },
    ]
    const result = computePillarBalance(pillars, posts)
    // 6 posts with a pillar: p1=2 (33%), p2=1 (17%), p3=3 (50%)
    expect(result.find(r => r.id === 'p1')!.actual_pct).toBeCloseTo(33, 0)
    expect(result.find(r => r.id === 'p2')!.actual_pct).toBeCloseTo(17, 0)
    expect(result.find(r => r.id === 'p3')!.actual_pct).toBeCloseTo(50, 0)
  })

  it('returns zero actual_pct for all pillars when no posts', () => {
    const result = computePillarBalance(pillars, [])
    result.forEach(r => expect(r.actual_pct).toBe(0))
  })

  it('marks pillar as low when actual is more than 10 points below target', () => {
    const posts: Post[] = [{ pillar_id: 'p1' }, { pillar_id: 'p1' }, { pillar_id: 'p1' }]
    const result = computePillarBalance(pillars, posts)
    // p2 has 0% actual, target 30% → gap of 30 → should be low
    expect(result.find(r => r.id === 'p2')!.status).toBe('low')
  })

  it('marks pillar as on_target when within 10 points of target', () => {
    const posts: Post[] = [
      { pillar_id: 'p1' }, { pillar_id: 'p1' }, { pillar_id: 'p1' },
      { pillar_id: 'p2' }, { pillar_id: 'p2' }, { pillar_id: 'p2' },
      { pillar_id: 'p3' }, { pillar_id: 'p3' }, { pillar_id: 'p3' }, { pillar_id: 'p3' },
    ]
    const result = computePillarBalance(pillars, posts)
    result.forEach(r => expect(r.status).toBe('on_target'))
  })
})
