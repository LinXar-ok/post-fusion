import { computeNudges, buildBriefContext } from '@/lib/brand-brain'

type Post = {
  content: string
  media_urls?: string[] | null
  status: string
  scheduled_for?: string | null
  created_at: string
}

const NOW = new Date('2026-04-14T10:00:00Z').getTime()

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    content: 'Test post',
    media_urls: null,
    status: 'published',
    scheduled_for: null,
    created_at: new Date(NOW - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    ...overrides,
  }
}

describe('computeNudges', () => {
  it('returns no_photo nudge when last photo post was more than 11 days ago', () => {
    const posts: Post[] = [
      makePost({ media_urls: ['img.jpg'], created_at: new Date(NOW - 12 * 24 * 60 * 60 * 1000).toISOString() }),
      makePost({ content: 'text post' }),
    ]
    const nudges = computeNudges(posts, NOW)
    expect(nudges.some(n => n.type === 'no_photo')).toBe(true)
  })

  it('does not return no_photo nudge when a photo was posted within 11 days', () => {
    const posts: Post[] = [
      makePost({ media_urls: ['img.jpg'], created_at: new Date(NOW - 5 * 24 * 60 * 60 * 1000).toISOString() }),
    ]
    const nudges = computeNudges(posts, NOW)
    expect(nudges.some(n => n.type === 'no_photo')).toBe(false)
  })

  it('returns undrafted_ideas nudge when 3 or more drafts exist', () => {
    const posts: Post[] = [
      makePost({ status: 'draft' }),
      makePost({ status: 'draft' }),
      makePost({ status: 'draft' }),
    ]
    const nudges = computeNudges(posts, NOW)
    expect(nudges.some(n => n.type === 'undrafted_ideas')).toBe(true)
  })

  it('does not return undrafted_ideas nudge when fewer than 3 drafts', () => {
    const posts: Post[] = [
      makePost({ status: 'draft' }),
      makePost({ status: 'draft' }),
    ]
    const nudges = computeNudges(posts, NOW)
    expect(nudges.some(n => n.type === 'undrafted_ideas')).toBe(false)
  })

  it('returns no nudges for an active user with recent photo and few drafts', () => {
    const posts: Post[] = [
      makePost({ media_urls: ['img.jpg'], created_at: new Date(NOW - 3 * 24 * 60 * 60 * 1000).toISOString() }),
      makePost({ status: 'draft' }),
    ]
    const nudges = computeNudges(posts, NOW)
    expect(nudges).toHaveLength(0)
  })
})

describe('buildBriefContext', () => {
  it('returns a non-empty string from an array of post contents', () => {
    const posts = ['Post about my morning', 'Thoughts on building in public', 'A lesson I learned']
    const ctx = buildBriefContext(posts)
    expect(typeof ctx).toBe('string')
    expect(ctx.length).toBeGreaterThan(0)
    expect(ctx).toContain('Post about my morning')
  })

  it('caps to 20 posts to stay within token limits', () => {
    const posts = Array.from({ length: 30 }, (_, i) => `Post number ${i}`)
    const ctx = buildBriefContext(posts)
    // 20 posts joined with separator = 19 occurrences of '---'
    const separatorCount = (ctx.match(/---/g) ?? []).length
    expect(separatorCount).toBe(19)
  })
})
