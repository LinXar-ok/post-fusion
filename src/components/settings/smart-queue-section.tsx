'use client'

import { useState, useEffect } from 'react'

type Slot = { id: string; day_of_week: number; hour: number; minute: number }

export function SmartQueueSection() {
  const [slots, setSlots] = useState<Slot[]>([])
  const [newSlotDay, setNewSlotDay] = useState(1)
  const [newSlotHour, setNewSlotHour] = useState(9)
  const [newSlotMin] = useState(0)

  useEffect(() => {
    fetch('/api/queue-slots')
      .then(r => r.json())
      .then(d => setSlots(d.slots ?? []))
      .catch(() => {})
  }, [])

  const handleAddSlot = async () => {
    const res = await fetch('/api/queue-slots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ day_of_week: newSlotDay, hour: newSlotHour, minute: newSlotMin }),
    })
    const data = await res.json()
    if (data.slot) setSlots(prev => [...prev, data.slot])
  }

  const handleDeleteSlot = async (id: string) => {
    await fetch('/api/queue-slots', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setSlots(prev => prev.filter(s => s.id !== id))
  }

  return (
    <div className="rounded-2xl bg-[var(--nm-bg)] overflow-hidden" style={{ boxShadow: 'var(--nm-raised)' }}>
      <div className="px-6 pt-6 pb-5">
        <h2 className="font-display text-base font-semibold text-foreground mb-1">Smart Queue</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Define weekly posting time slots. &ldquo;Add to Queue&rdquo; in the editor picks the next free slot automatically.
        </p>
      </div>

      <div
        className="mx-6 h-px"
        style={{ background: 'linear-gradient(to right, transparent, rgba(46,94,153,0.2), transparent)' }}
      />

      <div className="px-6 py-5 space-y-4">
        {/* Existing slots */}
        {slots.length > 0 && (
          <div className="space-y-1.5">
            {slots.map(slot => {
              const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
              const time = `${String(slot.hour).padStart(2, '0')}:${String(slot.minute).padStart(2, '0')}`
              return (
                <div key={slot.id} className="flex items-center justify-between rounded-xl bg-[var(--nm-bg)] px-3 py-2.5" style={{ boxShadow: 'var(--nm-inset-sm)' }}>
                  <span className="text-sm text-foreground">{days[slot.day_of_week]} at {time} UTC</span>
                  <button
                    onClick={() => handleDeleteSlot(slot.id)}
                    className="text-muted-foreground hover:text-red-400 transition-colors text-xs"
                  >
                    Remove
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {slots.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No time slots added yet.</p>
        )}

        {/* Add new slot */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={newSlotDay}
            onChange={e => setNewSlotDay(Number(e.target.value))}
            className="rounded-xl bg-[var(--nm-bg)] px-3 py-2 text-sm text-foreground focus:outline-none"
            style={{ boxShadow: 'var(--nm-inset-sm)' }}
          >
            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) => (
              <option key={i} value={i}>{d}</option>
            ))}
          </select>
          <select
            value={newSlotHour}
            onChange={e => setNewSlotHour(Number(e.target.value))}
            className="rounded-xl bg-[var(--nm-bg)] px-3 py-2 text-sm text-foreground focus:outline-none"
            style={{ boxShadow: 'var(--nm-inset-sm)' }}
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>{String(i).padStart(2, '0')}:00 UTC</option>
            ))}
          </select>
          <button
            onClick={handleAddSlot}
            className="h-9 px-4 rounded-xl bg-[#128C7E] text-white text-sm font-semibold hover:bg-[#0e7a6e] transition-colors"
            style={{ boxShadow: 'var(--nm-raised-sm)' }}
          >
            Add Slot
          </button>
        </div>
      </div>
    </div>
  )
}
