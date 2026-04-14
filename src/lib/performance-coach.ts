const GAP_THRESHOLD_DAYS = 14

export type PillarRef = { id: string; name: string; emoji: string }
export type PostForGap = { pillar_id: string | null; created_at: string }

/**
 * Returns pillars that haven't been posted to within the threshold window.
 */
export function computeContentGaps(
  pillars: PillarRef[],
  posts: PostForGap[],
  nowMs: number = Date.now()
): PillarRef[] {
  const thresholdMs = GAP_THRESHOLD_DAYS * 24 * 60 * 60 * 1000

  const lastPostedAt: Record<string, number> = {}
  for (const post of posts) {
    if (!post.pillar_id) continue
    const t = new Date(post.created_at).getTime()
    if (!lastPostedAt[post.pillar_id] || t > lastPostedAt[post.pillar_id]) {
      lastPostedAt[post.pillar_id] = t
    }
  }

  return pillars.filter(p => {
    const last = lastPostedAt[p.id]
    if (!last) return true // never posted
    return nowMs - last > thresholdMs
  })
}

export type AnalyticsRow = { id: string; engagement_rate: number }

/**
 * Returns the ID of the post with higher engagement rate.
 * Ties go to post_a.
 */
export function pickAbWinner(postA: AnalyticsRow, postB: AnalyticsRow): string {
  return postB.engagement_rate > postA.engagement_rate ? postB.id : postA.id
}
