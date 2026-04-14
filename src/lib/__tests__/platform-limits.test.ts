import { getCharLimit, getOverageInfo } from '@/lib/platform-limits'

describe('getCharLimit', () => {
  it('returns 280 for x', () => expect(getCharLimit('x')).toBe(280))
  it('returns 3000 for linkedin', () => expect(getCharLimit('linkedin')).toBe(3000))
  it('returns 2200 for instagram', () => expect(getCharLimit('instagram')).toBe(2200))
  it('returns 63206 for facebook', () => expect(getCharLimit('facebook')).toBe(63206))
  it('returns null for unknown platform', () => expect(getCharLimit('tiktok')).toBeNull())
})

describe('getOverageInfo', () => {
  it('returns status ok when under limit', () => {
    const { status, remaining } = getOverageInfo('x', 'hello world')
    expect(status).toBe('ok')
    expect(remaining).toBe(280 - 11)
  })

  it('returns status warning when within 20 chars of limit', () => {
    const content = 'a'.repeat(265)
    const { status } = getOverageInfo('x', content)
    expect(status).toBe('warning')
  })

  it('returns status over when exceeding limit', () => {
    const content = 'a'.repeat(290)
    const { status, overage } = getOverageInfo('x', content)
    expect(status).toBe('over')
    expect(overage).toBe(10)
  })

  it('returns status ok for unknown platform regardless of length', () => {
    const { status } = getOverageInfo('tiktok', 'a'.repeat(10000))
    expect(status).toBe('ok')
  })
})
