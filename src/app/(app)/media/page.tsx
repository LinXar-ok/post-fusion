"use client"

import { useState, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Image as ImageIcon, Upload, Trash2, Search, Loader2, ImageOff, Eye, X,
} from "lucide-react"

type MediaFile = {
  name: string
  id: string
  updated_at: string
  created_at: string
  last_accessed_at: string
  metadata?: { mimetype?: string; size?: number }
}

export default function MediaLibraryPage() {
  const supabase = createClient()
  const [files, setFiles] = useState<MediaFile[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useState<HTMLInputElement | null>(null)
  const [refs, setRefs] = useState<Map<string, HTMLInputElement | null>>(new Map())

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id ?? null
      setUserId(uid)
      if (uid) loadFiles(uid)
    })
  }, [])

  const loadFiles = async (uid: string) => {
    setLoading(true)
    const { data } = await supabase.storage.from("media").list(uid, {
      limit: 100,
      sortBy: { column: "created_at", order: "desc" },
    })
    setFiles((data?.map(f => ({ ...f, id: f.id ?? "" })) as MediaFile[]) ?? [])
    setLoading(false)
  }

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !userId) return
    const file = e.target.files[0]
    const ext = file.name.split(".").pop()
    const fileName = `${Date.now()}_media.${ext}`

    setUploading(true)
    try {
      const { data, error } = await supabase.storage.from("media").upload(`${userId}/${fileName}`, file)
      if (error) throw new Error(error.message)
      await loadFiles(userId)
    } catch (err) {
      console.error("Upload error:", err)
    } finally {
      setUploading(false)
    }
  }, [userId, supabase])

  const handleDelete = async (fileName: string) => {
    if (!userId) return
    await supabase.storage.from("media").remove([`${userId}/${fileName}`])
    await loadFiles(userId)
    if (previewUrl?.includes(fileName)) setPreviewUrl(null)
  }

  const handlePreview = (fileName: string) => {
    if (!userId) return
    const { data } = supabase.storage.from("media").getPublicUrl(`${userId}/${fileName}`)
    setPreviewUrl(data.publicUrl)
  }

  const filteredFiles = search
    ? files.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
    : files

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return ""
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const fileInputRefSetter = useCallback((node: HTMLInputElement | null) => {
    if (node) setRefs(prev => new Map(prev).set("upload", node))
  }, [])

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full h-[calc(100vh-4rem)] flex flex-col relative z-10">
      <div className="mb-6 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-2">Media Library</h1>
            <p className="text-slate-500 text-lg">Manage your uploaded images and assets.</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRefSetter}
              onChange={handleUpload}
            />
            <Button
              onClick={() => refs.get("upload")?.click()}
              disabled={uploading}
              className="bg-[#128C7E] hover:bg-[#0B1020] text-white shadow-md"
            >
              {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Upload Image
            </Button>
          </div>
        </div>
      </div>

      <Card className="flex-1 bg-white border-slate-200 shadow-sm backdrop-blur-xl overflow-hidden flex flex-col min-h-0">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-[#128C7E]" />
                {files.length} image{files.length !== 1 ? "s" : ""}
              </CardTitle>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search images..."
                className="pl-9 bg-slate-50 border-slate-200 h-9 text-sm rounded-lg focus-visible:ring-[#128C7E]"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-[#128C7E] animate-spin mb-3" />
              <p className="text-sm text-slate-500">Loading media...</p>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <ImageOff className="w-16 h-16 text-slate-300 mb-4" />
              <p className="text-lg font-semibold text-slate-500">
                {search ? "No matching images" : "No images yet"}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                {search ? "Try a different search term." : "Upload images to get started."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredFiles.map((file, i) => (
                <motion.div
                  key={file.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="group relative aspect-square rounded-xl overflow-hidden border-2 border-slate-200 bg-slate-100 shadow-sm hover:border-[#128C7E] hover:shadow-md transition-all"
                >
                  <img
                    src={userId ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/${userId}/${file.name}` : ""}
                    alt={file.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-9 w-9 rounded-full bg-white/90 hover:bg-white shadow-sm text-slate-700"
                      title="Preview"
                      onClick={() => handlePreview(file.name)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="h-9 w-9 rounded-full bg-rose-500/90 hover:bg-rose-500 shadow-sm text-white"
                      title="Delete"
                      onClick={() => handleDelete(file.name)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                    <p className="text-xs text-white font-medium truncate">{file.name}</p>
                    {file.metadata?.size && (
                      <p className="text-[10px] text-white/70">{formatFileSize(file.metadata.size)}</p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Image preview modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8" onClick={() => setPreviewUrl(null)}>
          <div className="relative max-w-4xl max-h-full">
            <img src={previewUrl} alt="Preview" className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl" />
            <Button
              variant="ghost"
              size="icon"
              className="absolute -top-2 -right-2 h-10 w-10 rounded-full bg-white text-slate-700 hover:bg-slate-100 shadow-lg"
              onClick={() => setPreviewUrl(null)}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
