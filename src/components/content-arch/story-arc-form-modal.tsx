'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

type Props = {
  open: boolean
  onClose: () => void
  onSubmit: (data: { name: string; description: string; start_date: string; end_date: string }) => Promise<void>
}

export function StoryArcFormModal({ open, onClose, onSubmit }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    await onSubmit({ name, description, start_date: startDate, end_date: endDate })
    setLoading(false)
    setName(''); setDescription(''); setStartDate(''); setEndDate('')
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0B1020] p-6 shadow-2xl space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Plan a Story Arc</h2>
              <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X className="w-4 h-4" /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Arc Name</label>
                <input value={name} onChange={e => setName(e.target.value)} required maxLength={80}
                  placeholder='e.g. "Launching My First Product"'
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-foreground placeholder:text-slate-600 focus:outline-none focus:border-[#128C7E]" />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Description (optional)</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} maxLength={200}
                  placeholder="What story does this arc tell?"
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-foreground placeholder:text-slate-600 focus:outline-none focus:border-[#128C7E] resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Start Date</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#128C7E]" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">End Date</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#128C7E]" />
                </div>
              </div>
              <button type="submit" disabled={loading || !name.trim()}
                className="w-full py-2.5 rounded-xl bg-[#128C7E] text-white text-sm font-medium hover:bg-[#0e7a6e] disabled:opacity-50 transition-colors">
                {loading ? 'Creating…' : 'Create Arc'}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
