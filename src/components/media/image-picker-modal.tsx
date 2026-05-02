"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import { Image as ImageIcon, Search, Loader2, X } from "lucide-react"

type MediaFile = {
  name: string
  id: string
}

export function ImagePickerModal({
  isOpen,
  onOpenChange,
  onSelect,
}: {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (file: { publicUrl: string; name: string }) => void
}) {
  const supabase = createClient()
  const [files, setFiles] = useState<MediaFile[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen && userId) loadFiles(userId)
  }, [isOpen, userId])

  const loadFiles = async (uid: string) => {
    setLoading(true)
    const { data } = await supabase.storage.from("media").list(uid, {
      limit: 100,
      sortBy: { column: "created_at", order: "desc" },
    })
    setFiles((data?.map(f => ({ ...f, id: f.id ?? "" })) as MediaFile[]) ?? [])
    setLoading(false)
  }

  const handleSelect = async (file: MediaFile) => {
    if (!userId) return
    const { data } = supabase.storage.from("media").getPublicUrl(`${userId}/${file.name}`)
    onSelect({ publicUrl: data.publicUrl, name: file.name })
    onOpenChange(false)
  }

  const filteredFiles = search
    ? files.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
    : files

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8"
          onClick={() => onOpenChange(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="rounded-2xl w-full max-w-2xl overflow-hidden max-h-[80vh] flex flex-col bg-[var(--nm-bg)]"
            style={{ boxShadow: "var(--nm-raised-lg)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(163,177,198,0.15)]">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(46,94,153,0.12)", boxShadow: "var(--nm-inset-sm)" }}
                >
                  <ImageIcon className="w-4 h-4 text-[#2E5E99]" />
                </div>
                Choose an image
              </h3>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors bg-[var(--nm-bg)]"
                style={{ boxShadow: "var(--nm-raised-xs)" }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-3 border-b border-[rgba(163,177,198,0.15)]">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search images…"
                  className="w-full h-9 pl-9 pr-3 rounded-xl text-sm text-foreground bg-[var(--nm-bg)] focus:outline-none placeholder:text-muted-foreground"
                  style={{ boxShadow: "var(--nm-inset-sm)" }}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-5">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 bg-[var(--nm-bg)]"
                    style={{ boxShadow: "var(--nm-inset-sm)" }}
                  >
                    <Loader2 className="w-5 h-5 text-[#2E5E99] animate-spin" />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {filteredFiles.map(file => (
                    <motion.button
                      key={file.name}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="aspect-square rounded-xl overflow-hidden bg-[var(--nm-bg)] transition-all"
                      style={{ boxShadow: "var(--nm-inset-sm)" }}
                      onClick={() => handleSelect(file)}
                    >
                      {userId ? (
                        <img
                          src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/${userId}/${file.name}`}
                          alt={file.name}
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                        />
                      ) : null}
                    </motion.button>
                  ))}
                </div>
              )}
              {!loading && filteredFiles.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 bg-[var(--nm-bg)]"
                    style={{ boxShadow: "var(--nm-inset-sm)" }}
                  >
                    <ImageIcon className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-semibold text-foreground mb-1">No images found</p>
                  <p className="text-xs text-muted-foreground">Upload images from the Media Library page.</p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
