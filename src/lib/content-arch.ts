export type PillarInput = {
  id: string
  name: string
  target_pct: number
  color: string
  emoji: string
}

export type PostForBalance = {
  pillar_id: string | null
}

export type PillarBalanceRow = PillarInput & {
  actual_pct: number
  post_count: number
  status: 'on_target' | 'low' | 'high'
}

const GAP_THRESHOLD = 10

export function computePillarBalance(
  pillars: PillarInput[],
  posts: PostForBalance[]
): PillarBalanceRow[] {
  const tagged = posts.filter(p => p.pillar_id !== null)
  const total = tagged.length

  const counts: Record<string, number> = {}
  for (const p of tagged) {
    if (p.pillar_id) counts[p.pillar_id] = (counts[p.pillar_id] ?? 0) + 1
  }

  return pillars.map(pillar => {
    const post_count = counts[pillar.id] ?? 0
    const actual_pct = total === 0 ? 0 : Math.round((post_count / total) * 100)
    const gap = actual_pct - pillar.target_pct

    let status: PillarBalanceRow['status'] = 'on_target'
    if (gap < -GAP_THRESHOLD) status = 'low'
    else if (gap > GAP_THRESHOLD) status = 'high'

    return { ...pillar, actual_pct, post_count, status }
  })
}
