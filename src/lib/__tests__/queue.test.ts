import { nextAvailableSlot } from '@/lib/queue'

type Slot = { day_of_week: number; hour: number; minute: number }

describe('nextAvailableSlot', () => {
  // Freeze to: Wednesday 2026-04-15 10:00:00 UTC (day_of_week=3)
  const NOW = new Date('2026-04-15T10:00:00Z').getTime()

  it('returns the next slot after current time on the same day', () => {
    const slots: Slot[] = [
      { day_of_week: 3, hour: 9,  minute: 0 },  // today, already passed
      { day_of_week: 3, hour: 14, minute: 0 },  // today, future
    ]
    const result = nextAvailableSlot(slots, NOW)
    expect(result).not.toBeNull()
    expect(result!.getUTCHours()).toBe(14)
    expect(result!.getUTCDay()).toBe(3)
  })

  it('wraps to the following week when no slots remain this week', () => {
    const slots: Slot[] = [
      { day_of_week: 2, hour: 9, minute: 0 }, // Tuesday — already passed this week
    ]
    const result = nextAvailableSlot(slots, NOW)
    expect(result).not.toBeNull()
    // Next Tuesday
    expect(result!.getUTCDay()).toBe(2)
    expect(result!.getTime()).toBeGreaterThan(NOW)
  })

  it('returns null when no slots are defined', () => {
    expect(nextAvailableSlot([], NOW)).toBeNull()
  })

  it('picks the earliest future slot across different days', () => {
    const slots: Slot[] = [
      { day_of_week: 5, hour: 9, minute: 0 },  // Friday
      { day_of_week: 4, hour: 8, minute: 0 },  // Thursday — closer
    ]
    const result = nextAvailableSlot(slots, NOW)
    expect(result!.getUTCDay()).toBe(4) // Thursday wins
  })
})
