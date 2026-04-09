"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-[#128C7E]" />
                Choose an image
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onOpenChange(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-4 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search images..."
                  className="pl-9 bg-slate-50 border-slate-200 h-9 text-sm rounded-lg focus-visible:ring-[#128C7E]"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-[#128C7E] animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {filteredFiles.map(file => (
                    <motion.button
                      key={file.name}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="aspect-square rounded-lg overflow-hidden border-2 border-slate-200 hover:border-[#128C7E] transition-all shadow-sm"
                      onClick={() => handleSelect(file)}
                    >
                      {userId ? (
                        <img
                          src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/${userId}/${file.name}`}
                          alt={file.name}
                          className="w-full h-full object-cover"
                        />
                      ) : null}
                    </motion.button>
                  ))}
                </div>
              )}
              {!loading && filteredFiles.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <ImageIcon className="w-12 h-12 text-slate-300 mb-3" />
                  <p className="text-sm font-medium text-slate-500">No images found</p>
                  <p className="text-xs text-slate-400 mt-1">Upload images from the Media Library page.</p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
