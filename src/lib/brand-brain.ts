export type NudgePost = {
  content: string
  media_urls?: string[] | null
  status: string
  scheduled_for?: string | null
  created_at: string
}

export type Nudge = {
  type: 'no_photo' | 'undrafted_ideas'
  message: string
}

const PHOTO_THRESHOLD_DAYS = 11

export function computeNudges(posts: NudgePost[], nowMs: number = Date.now()): Nudge[] {
  const nudges: Nudge[] = []

  // No photo nudge — checks published + scheduled posts only
  const activePosts = posts.filter(p => p.status === 'published' || p.status === 'scheduled')
  const photoPost = activePosts
    .filter(p => p.media_urls && p.media_urls.length > 0)
    .sort((a, b) => {
      const ta = new Date(a.scheduled_for ?? a.created_at).getTime()
      const tb = new Date(b.scheduled_for ?? b.created_at).getTime()
      return tb - ta
    })[0]

  if (!photoPost) {
    nudges.push({ type: 'no_photo', message: "You haven't posted a photo yet — visual posts get more reach." })
  } else {
    const lastPhotoMs = new Date(photoPost.scheduled_for ?? photoPost.created_at).getTime()
    const daysSince = Math.floor((nowMs - lastPhotoMs) / (1000 * 60 * 60 * 24))
    if (daysSince >= PHOTO_THRESHOLD_DAYS) {
      nudges.push({ type: 'no_photo', message: `No photo post in ${daysSince} days — visual content boosts reach.` })
    }
  }

  // Undrafted ideas nudge
  const draftCount = posts.filter(p => p.status === 'draft').length
  if (draftCount >= 3) {
    nudges.push({ type: 'undrafted_ideas', message: `${draftCount} draft posts sitting unpublished — pick one and schedule it.` })
  }

  return nudges
}

/**
 * Builds a compact text context block from recent post contents for Groq prompts.
 * Caps at 20 posts to stay well within token limits.
 */
export function buildBriefContext(postContents: string[]): string {
  return postContents.slice(0, 20).join('\n---\n')
}
