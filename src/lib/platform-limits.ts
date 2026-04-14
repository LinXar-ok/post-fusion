const LIMITS: Record<string, number> = {
  x:         280,
  linkedin:  3000,
  instagram: 2200,
  facebook:  63206,
}

const WARNING_BUFFER = 20

export function getCharLimit(platform: string): number | null {
  return LIMITS[platform.toLowerCase()] ?? null
}

export type OverageInfo = {
  limit: number | null
  used: number
  remaining: number | null
  overage: number
  status: 'ok' | 'warning' | 'over'
}

export function getOverageInfo(platform: string, content: string): OverageInfo {
  const limit = getCharLimit(platform)
  const used = content.length

  if (limit === null) {
    return { limit: null, used, remaining: null, overage: 0, status: 'ok' }
  }

  const remaining = limit - used
  const overage = Math.max(0, -remaining)
  let status: OverageInfo['status'] = 'ok'
  if (remaining < 0) status = 'over'
  else if (remaining <= WARNING_BUFFER) status = 'warning'

  return { limit, used, remaining, overage, status }
}
