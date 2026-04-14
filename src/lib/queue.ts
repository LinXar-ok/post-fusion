type Slot = { day_of_week: number; hour: number; minute: number }

/**
 * Given a list of weekly recurring time slots, returns the next Date
 * after `nowMs` when a slot fires. Returns null if no slots are defined.
 *
 * All times are treated as UTC.
 */
export function nextAvailableSlot(slots: Slot[], nowMs: number = Date.now()): Date | null {
  if (slots.length === 0) return null

  const now = new Date(nowMs)
  const currentDay = now.getUTCDay()
  const currentMins = now.getUTCHours() * 60 + now.getUTCMinutes()

  let earliest: Date | null = null

  for (const slot of slots) {
    const slotMins = slot.hour * 60 + slot.minute
    let daysAhead = slot.day_of_week - currentDay

    // Same day but slot already passed → next week
    if (daysAhead === 0 && slotMins <= currentMins) daysAhead = 7
    // Slot is on an earlier day this week → next week
    if (daysAhead < 0) daysAhead += 7

    const candidate = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + daysAhead,
      slot.hour,
      slot.minute,
      0,
      0
    ))

    if (!earliest || candidate < earliest) earliest = candidate
  }

  return earliest
}
