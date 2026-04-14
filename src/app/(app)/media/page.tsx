"use client"

import { useState, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
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

const staggerContainer = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { staggerChildren: 0.04 } },
}
const staggerItem = {
  hidden: { opacity: 0, scale: 0.95 },
  show:   { opacity: 1, scale: 1, transition: { type: "spring" as const, stiffness: 280, damping: 26 } },
}

export default function MediaLibraryPage() {
  const supabase = createClient()
  const [files, setFiles]       = useState<MediaFile[]>([])
  const [userId, setUserId]     = useState<string | null>(null)
  const [search, setSearch]     = useState("")
  const [loading, setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [inputRef, setInputRef] = useState<HTMLInputElement | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id ?? null
      setUserId(uid)
      if (uid) loadFiles(uid)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
    const ext  = file.name.split(".").pop()
    const fileName = `${Date.now()}_media.${ext}`
    setUploading(true)
    try {
      const { error } = await supabase.storage.from("media").upload(`${userId}/${fileName}`, file)
      if (error) throw new Error(error.message)
      await loadFiles(userId)
    } catch (err) {
      console.error("Upload error:", err)
    } finally {
      setUploading(false)
    }
  }, [userId, supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (fileName: string) => {
    if (!userId) return
    await supabase.storage.from("media").remove([`${userId}/${fileName}`])
    setFiles(prev => prev.filter(f => f.name !== fileName))
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

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full flex flex-col gap-6 h-[calc(100vh-4rem)]">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4 shrink-0">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground mb-1">
            Media Library
          </h1>
          <p className="text-muted-foreground text-sm">Manage your uploaded images and assets.</p>
        </div>

        {/* Upload button */}
        <div>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={setInputRef}
            onChange={handleUpload}
            title="Upload image"
            aria-label="Upload image"
          />
          <button
            type="button"
            onClick={() => inputRef?.click()}
            disabled={uploading}
            className="h-9 px-5 rounded-xl text-sm font-semibold flex items-center gap-2 text-white bg-[#2E5E99] disabled:opacity-60 transition-all"
            style={{ boxShadow: "var(--nm-raised-sm)" }}
          >
            {uploading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
              : <><Upload className="w-4 h-4" /> Upload</>}
          </button>
        </div>
      </div>

      {/* Main card */}
      <div
        className="flex-1 min-h-0 rounded-2xl flex flex-col overflow-hidden bg-[var(--nm-bg)]"
        style={{ boxShadow: "var(--nm-raised)" }}
      >
        {/* Toolbar */}
        <div className="px-6 py-4 flex items-center justify-between gap-4 shrink-0 border-b border-[rgba(163,177,198,0.15)]">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center bg-[var(--nm-bg)]"
              style={{ background: "rgba(46,94,153,0.12)", boxShadow: "var(--nm-inset-sm)" }}
            >
              <ImageIcon className="w-4 h-4 text-[#2E5E99]" />
            </div>
            <span className="text-sm font-semibold text-foreground">
              {files.length} image{files.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Search */}
          <div className="relative w-56">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search images…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-xl text-sm text-foreground bg-[var(--nm-bg)] focus:outline-none placeholder:text-muted-foreground"
              style={{ boxShadow: "var(--nm-inset-sm)" }}
            />
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-[var(--nm-bg)]"
                style={{ boxShadow: "var(--nm-inset-sm)" }}
              >
                <Loader2 className="w-6 h-6 text-[#2E5E99] animate-spin" />
              </div>
              <p className="text-sm text-muted-foreground">Loading media…</p>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 bg-[var(--nm-bg)]"
                style={{ boxShadow: "var(--nm-inset-sm)" }}
              >
                <ImageOff className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="text-base font-semibold text-foreground mb-1">
                {search ? "No matching images" : "No images yet"}
              </p>
              <p className="text-sm text-muted-foreground">
                {search ? "Try a different search term." : "Upload images to get started."}
              </p>
            </div>
          ) : (
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
            >
              {filteredFiles.map(file => (
                <motion.div
                  key={file.name}
                  variants={staggerItem}
                  className="group relative aspect-square rounded-2xl overflow-hidden bg-[var(--nm-bg)]"
                  style={{ boxShadow: "var(--nm-inset-sm)" }}
                >
                  {/* Image */}
                  <img
                    src={userId ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/${userId}/${file.name}` : ""}
                    alt={file.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-200 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    <button
                      type="button"
                      title="Preview"
                      onClick={() => handlePreview(file.name)}
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white bg-[var(--nm-bg)] transition-all"
                      style={{ background: "rgba(255,255,255,0.15)", boxShadow: "var(--nm-raised-sm)" }}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      title="Delete"
                      onClick={() => handleDelete(file.name)}
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white transition-all"
                      style={{ background: "rgba(244,63,94,0.8)", boxShadow: "var(--nm-raised-sm)" }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* File info */}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
                    <p className="text-[10px] text-white font-medium truncate">{file.name}</p>
                    {file.metadata?.size && (
                      <p className="text-[9px] text-white/60">{formatFileSize(file.metadata.size)}</p>
                    )}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </div>

      {/* Preview modal */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8"
          onClick={() => setPreviewUrl(null)}
        >
          <div className="relative max-w-4xl max-h-full" onClick={e => e.stopPropagation()}>
            <img
              src={previewUrl}
              alt="Preview"
              className="max-w-full max-h-[80vh] object-contain rounded-2xl"
              style={{ boxShadow: "var(--nm-raised)" }}
            />
            <button
              type="button"
              onClick={() => setPreviewUrl(null)}
              className="absolute -top-3 -right-3 w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--nm-bg)] text-foreground"
              style={{ boxShadow: "var(--nm-raised-sm)" }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
