# Media Library UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a /media page with a grid view of uploaded images, upload/delete capabilities, and a reusable image-picker modal that integrates with the publishing compose flow.

**Architecture:** Create a client-side media library page under `(app)/media` that fetches uploaded files from Supabase Storage, displays them in a responsive grid, and supports upload/delete. Extract a reusable `ImagePickerModal` component that uses Supabase's `list()` API and can be invoked from the publishing page to select existing media instead of uploading new files. All UI follows the existing teal (`#128C7E`) / navy (`#0B1020`) theme with shadcn/ui Base Nova components and Framer Motion for transitions.

**Tech Stack:** TypeScript, Next.js 16 App Router, Supabase Storage SDK, Tailwind CSS v4, shadcn/ui (Base Nova), Framer Motion, lucide-react icons.

---

### Task 1: Add "Media Library" to sidebar navigation

**Files:**
- Modify: `/Users/linuxkexordzu/Personal Projects/SOCIAL/src/components/layout/sidebar.tsx`

Update the `navItems` array to include a new Media Library link between "Publishing" and "Calendar". Use the `ImageIcon` icon from lucide-react.

**Step 1: Add the Media Library nav item**

Modify the sidebar imports and nav items:

```tsx
// Change the import line to add ImageIcon
import { Calendar, Inbox, LayoutDashboard, Settings, Activity, PenSquare, Sparkles, Image as ImageIcon } from "lucide-react";

// Update navItems array — insert after "Publishing":
const navItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Publishing", href: "/publishing", icon: PenSquare },
  { name: "Media Library", href: "/media", icon: ImageIcon },
  { name: "Calendar", href: "/calendar", icon: Calendar },
  { name: "Inbox", href: "/inbox", icon: Inbox },
  { name: "Analytics", href: "/analytics", icon: Activity },
  { name: "Settings", href: "/settings", icon: Settings },
];
```

**Step 2: Verify**

Run `next dev` (if not already running) and navigate to the app shell. Confirm "Media Library" appears in the sidebar between "Publishing" and "Calendar".

**Step 3: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat: add Media Library link to sidebar navigation"
```

---

### Task 2: Create the /media page with grid view

**Files:**
- Create: `/Users/linuxkexordzu/Personal Projects/SOCIAL/src/app/(app)/media/page.tsx`

Create the main media library client page. It fetches all files from the `media` bucket using `supabase.storage.from("media").list()`, filters to only the current user's files (path prefix), and renders them in a responsive grid with a loading state, empty state, and image count header.

**Step 1: Create the media library page**

```tsx
// src/app/(app)/media/page.tsx

"use client"

import { useState, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Image as ImageIcon, Upload, Trash2, Search, Loader2, ImageOff, Eye } from "lucide-react"

type MediaFile = {
  name: string
  id: string
  updated_at: string
  created_at: string
  last_accessed_at: string
  metadata: {
    size: number
    mimetype: string
  }
}

export default function MediaLibraryPage() {
  const supabase = createClient()
  const [media, setMedia] = useState<MediaFile[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedImage, setSelectedImage] = useState<MediaFile | null>(null)

  const fetchMedia = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // List files in user's folder
    const { data, error } = await supabase.storage.from("media").list(user.id, {
      sortBy: { column: "created_at", order: "desc" },
    })
    if (!error && data) {
      setMedia(data)
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchMedia() }, [fetchMedia])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const fileExt = file.name.split(".").pop()
        const fileName = `${Date.now()}_${file.name}`
        await supabase.storage.from("media").upload(`${user.id}/${fileName}`, file)
      }
      await fetchMedia()
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (fileName: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.storage.from("media").remove([`${user.id}/${fileName}`])
    setMedia(prev => prev.filter(f => f.name !== fileName))
    if (selectedImage?.name === fileName) setSelectedImage(null)
  }

  const filteredMedia = media.filter(f =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
  }

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-2">Media Library</h1>
        <p className="text-slate-500 text-lg">Manage your uploaded images and media assets.</p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search images..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 bg-white border-slate-200"
          />
        </div>
        <div className="flex items-center gap-2">
          <Input type="file" accept="image/*" multiple className="hidden" id="media-upload" onChange={handleUpload} disabled={uploading} />
          <label htmlFor="media-upload">
            <Button asChild disabled={uploading} className="bg-[#128C7E] hover:bg-[#0B1020] text-white">
              <span>{uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                {uploading ? "Uploading..." : "Upload Images"}</span>
            </Button>
          </label>
          <Button variant="outline" onClick={fetchMedia} disabled={loading}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#128C7E] mb-3" />
          <p className="text-slate-500 text-sm">Loading media...</p>
        </div>
      ) : filteredMedia.length === 0 ? (
        <Card className="bg-white border-slate-200">
          <CardContent className="flex flex-col items-center justify-center py-16 px-6">
            <ImageIcon className="w-12 h-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-700">
              {searchQuery ? "No images match your search" : "No media uploaded yet"}
            </h3>
            <p className="text-slate-500 text-sm mt-1">
              {searchQuery ? "Try a different search term" : "Upload images to get started with your media library"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredMedia.map((file) => {
            const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/${/* construct full path */file.name}`
            return (
              <motion.div
                key={file.name}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="group relative aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-200 cursor-pointer hover:border-[#128C7E]/40 transition-colors"
                onClick={() => setSelectedImage(file)}
              >
                <img
                  src={publicUrl}
                  alt={file.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback for non-image files
                    (e.target as HTMLImageElement).style.display = "none"
                    const parent = (e.target as HTMLImageElement).parentElement
                    if (parent) {
                      const icon = document.createElement("div")
                      icon.className = "flex flex-col items-center justify-center w-full h-full text-slate-400"
                      icon.innerHTML = '<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>'
                      parent.appendChild(icon)
                    }
                  }}
                />
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button size="icon" variant="secondary" className="h-8 w-8 bg-white/90 hover:bg-white"
                    onClick={(e) => { e.stopPropagation(); setSelectedImage(file) }}>
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="destructive" className="h-8 w-8 bg-red-500/90 hover:bg-red-500"
                    onClick={(e) => { e.stopPropagation(); handleDelete(file.name) }}>
                    <Trash2 className="w-3.5 h-3.5 text-white" />
                  </Button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Image Preview Modal */}
      {selectedImage && (
        <ImagePreviewModal
          file={selectedImage}
          onClose={() => setSelectedImage(null)}
          onDelete={() => { handleDelete(selectedImage.name) }}
        />
      )}
    </div>
  )
}

function ImagePreviewModal({ file, onClose, onDelete }: { file: MediaFile; onClose: () => void; onDelete: () => void }) {
  const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/${file.name}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 truncate mr-4">{file.name}</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">{formatBytes(file.metadata?.size || 0)}</span>
            <Button size="icon" variant="ghost" onClick={onClose} className="h-8 w-8"><X className="w-4 h-4" /></Button>
          </div>
        </div>
        <div className="flex items-center justify-center bg-slate-50 p-4 max-h-[60vh]">
          <img src={publicUrl} alt={file.name} className="max-w-full max-h-[60vh] object-contain rounded-lg" />
        </div>
        <div className="p-4 border-t border-slate-100 flex justify-between items-center">
          <span className="text-xs text-slate-400">
            {file.created_at ? new Date(file.created_at).toLocaleDateString() : ""}
          </span>
          <Button variant="destructive" size="sm" onClick={onDelete}>
            <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
```

Note: The plan above contains the key structure. The actual implementation needs to handle URL construction properly — the `list()` call with a prefix returns relative names; the full URL must include the user ID prefix.

**Step 2: Verify**

Navigate to `/media`. Expected: empty state with upload button. Upload an image, verify it appears in the grid. Hover to see delete/preview buttons. Click to open preview modal.

**Step 3: Commit**

```bash
git add src/app/\(app\)/media/page.tsx
git commit -m "feat: add media library page with grid view, upload, delete"
```

---

### Task 3: Create the reusable ImagePickerModal component

**Files:**
- Create: `/Users/linuxkexordzu/Personal Projects/SOCIAL/src/components/media/image-picker-modal.tsx`

A reusable modal component that can be triggered from the publishing page. It fetches the user's media from Supabase Storage, allows search/filtering, and returns the selected image's public URL and File-like metadata to the caller via an `onSelect` callback.

**Step 1: Create the image picker modal component**

```tsx
// src/components/media/image-picker-modal.tsx

"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, X, Image as ImageIcon, Loader2, Upload } from "lucide-react"

export type MediaSelection = {
  publicUrl: string
  name: string
}

interface ImagePickerModalProps {
  open: boolean
  onClose: () => void
  onSelect: (selection: MediaSelection) => void
}

export function ImagePickerModal({ open, onClose, onSelect }: ImagePickerModalProps) {
  const supabase = createClient()
  const [media, setMedia] = useState<Array<{ name: string }>>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    if (open) fetchMedia()
  }, [open])

  const fetchMedia = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase.storage.from("media").list(user.id, {
      sortBy: { column: "created_at", order: "desc" },
    })
    if (data) setMedia(data)
    setLoading(false)
  }

  const filteredMedia = media.filter(f =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleSelect = (fileName: string) => {
    const { data: { user } } = supabase.auth.getUser()
    // sync getPublicUrl
    const { data } = supabase.storage.from("media").getPublicUrl(`${user.id}/${fileName}`)
    onSelect({ publicUrl: data.publicUrl, name: fileName })
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Choose from Library</h3>
          <Button size="icon" variant="ghost" onClick={onClose} className="h-8 w-8">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search images..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 bg-slate-50 border-slate-200"
            />
          </div>
        </div>

        {/* Grid */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-[#128C7E]" />
            </div>
          ) : filteredMedia.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ImageIcon className="w-10 h-10 text-slate-300 mb-3" />
              <p className="text-slate-600 font-medium">No images found</p>
              <p className="text-slate-400 text-sm mt-1">Upload images from the Media Library first</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {filteredMedia.map(file => {
                const { data } = supabase.storage.from("media").getPublicUrl(
                  /* user ID needed - fetch at component mount or pass via props */
                )
                return (
                  <button
                    key={file.name}
                    onClick={() => handleSelect(file.name)}
                    className="aspect-square rounded-lg overflow-hidden border-2 border-slate-200 hover:border-[#128C7E] transition-colors group"
                  >
                    <img
                      src={/* public URL */}
                      alt={file.name}
                      className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-[#128C7E] text-white text-xs px-2 py-1 rounded-full font-medium">
                        Select
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-100 flex justify-between items-center bg-slate-50">
          <span className="text-xs text-slate-500">{filteredMedia.length} image{filteredMedia.length !== 1 ? "s" : ""}</span>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        </div>
      </motion.div>
    </div>
  )
}
```

**Important implementation detail:** The `getPublicUrl` call is synchronous, but it needs the user ID path prefix. The component should fetch the user ID once on mount and store it in state:

```tsx
const [userId, setUserId] = useState<string | null>(null)

useEffect(() => {
  supabase.auth.getUser().then(({ data: { user } }) => {
    if (user) setUserId(user.id)
  })
}, [])

// Then in render:
const publicUrl = userId
  ? supabase.storage.from("media").getPublicUrl(`${userId}/${file.name}`).data.publicUrl
  : ""
```

Same pattern applies to the `onSelect` handler.

**Step 2: Commit**

```bash
git add src/components/media/image-picker-modal.tsx
git commit -m "feat: add reusable ImagePickerModal component"
```

---

### Task 4: Integrate ImagePickerModal into publishing page

**Files:**
- Modify: `/Users/linuxkexordzu/Personal Projects/SOCIAL/src/app/(app)/publishing/page.tsx`

Add an "Add from Library" button option on the publishing page's image upload toolbar. When clicked, opens the `ImagePickerModal`. When an image is selected, set it as the `mediaFile` for the post (store the public URL).

**Step 1: Update the publishing page imports and state**

Add to imports:
```tsx
import { ImagePickerModal } from "@/components/media/image-picker-modal"
```

Add new state:
```tsx
const [showImagePicker, setShowImagePicker] = useState(false)
const [selectedMediaUrl, setSelectedMediaUrl] = useState<string | null>(null)
```

**Step 2: Add handler for library selection**

```tsx
const handleMediaFromLibrary = (selection: { publicUrl: string; name: string }) => {
  setSelectedMediaUrl(selection.publicUrl)
  // Create a placeholder file-like object for the upload flow
  setMediaFile({ name: selection.name } as File)
  setMediaPreview(selection.publicUrl)
}
```

**Step 3: Add "Add from Library" button next to upload button**

In the toolbar section (around line 284), after the upload button, add:

```tsx
<Button
  variant="ghost"
  size="icon"
  onClick={() => setShowImagePicker(true)}
  title="Choose from library"
  className="text-slate-500 hover:text-[#128C7E] hover:bg-[#128C7E]/5 rounded-full h-9 w-9"
>
  <ImageIcon className="w-5 h-5" />
</Button>
```

Wait — there are already two `ImageIcon` buttons (upload and hash). Let me reconsider the layout. The existing toolbar has:
1. Image upload (file input ref)
2. Hashtags toggle
3. Tone toggle
4. AI assistant toggle

Replace or add a second option: change the image button to a small dropdown or add a "Choose from Library" button in the metadata panel area. The cleanest approach:

Keep the existing upload button. Add a "Choose from Library" text button in the compose area below the textarea but above the tags. Actually, the simplest approach that matches the existing UX:

Add it as a small button next to the existing upload image area. Modify the image upload button to have a tiny "Library" label below, or add it as a menu option.

**Recommended approach:** Change the image upload button to a two-action area:
- Left half: upload from device (existing)
- Right half: "From Library" — opens modal

Or simpler and non-destructive to existing UX:

Add a text button in the compose toolbar after the file-related buttons:

```tsx
<Button
  variant="ghost"
  size="sm"
  onClick={() => setShowImagePicker(true)}
  className="text-slate-500 hover:text-[#128C7E] hover:bg-[#128C7E]/5 rounded-full h-9 text-xs gap-1"
>
  <ImageIcon className="w-3.5 h-3.5" /> Library
</Button>
```

Place this after the existing upload button and before the hashtags button.

**Step 4: Add the modal component to the page**

Place the `ImagePickerModal` at the bottom of the page JSX (same level as `AnimatePresence`):

```tsx
<AnimatePresence>
  {showImagePicker && (
    <ImagePickerModal
      open={showImagePicker}
      onClose={() => setShowImagePicker(false)}
      onSelect={handleMediaFromLibrary}
    />
  )}
</AnimatePresence>
```

**Step 5: Update the preview to use selectedMediaUrl**

The `mediaPreview` already handles URLs (it uses `FileReader.readAsDataURL` for local files, but the preview `img` tag works equally well with a public URL). Since we set `setMediaPreview(selection.publicUrl)` in `handleMediaFromLibrary`, previews will work correctly.

**Step 6: Verify**

Navigate to `/publishing`. Click the "Library" button in the toolbar. The image picker modal opens showing uploaded media. Select an image. The image appears as a preview in the compose area. Publish and verify the `media_urls` payload uses the correct URL.

**Step 7: Commit**

```bash
git add src/app/\(app\)/publishing/page.tsx
git commit -m "feat: integrate image picker modal into publishing page"
```

---

### Task 5: Polish and edge case handling

**Files:**
- Modify: `/Users/linuxkexordzu/Personal Projects/SOCIAL/src/app/(app)/media/page.tsx`
- Modify: `/Users/linuxkexordzu/Personal Projects/SOCIAL/src/components/media/image-picker-modal.tsx`

**Step 1: Handle the image URL construction properly**

In both the media page and image picker, the URL should be constructed correctly. The `list(user.id, ...)` returns files with `name` being just the filename (not the full path). To construct the public URL:

```ts
const bucketUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const publicUrl = `${bucketUrl}/storage/v1/object/public/media/${userId}/${fileName}`
```

Or use the SDK:
```ts
const { data } = supabase.storage.from("media").getPublicUrl(`${userId}/${fileName}`)
const publicUrl = data.publicUrl
```

**Step 2: Fix the missing X icon import in ImagePreviewModal**

The `ImagePreviewModal` component uses `X` but it isn't imported. Add to the import list:

```tsx
import { ... X, Trash2 ...} from "lucide-react"
```

**Step 3: Add pagination or loading for large libraries**

If a user has >100 images, implement simple cursor-based pagination with a "Load more" button at the bottom of the grid. For a personal tool, the `limit` option in `list()` can be set to 100:

```ts
const { data } = await supabase.storage.from("media").list(user.id, {
  limit: 100,
  sortBy: { column: "created_at", order: "desc" },
})
```

For most personal accounts, 100 is sufficient. Add this limit to both the media page and the image picker.

**Step 4: Verify build**

```bash
npm run build
```

Expected: No TypeScript errors. All type-checks pass.

**Step 5: Final commit**

```bash
git add src/app/\(app\)/media/page.tsx src/components/media/image-picker-modal.tsx
git commit -m "fix: handle URL construction, imports, and pagination in media library"
```

---

### Task 6: Test full user flow end-to-end

**Files:** (no changes — testing only)

**Test Checklist:**

1. **Navigation:** Click "Media Library" in sidebar -> navigates to `/media`
2. **Empty state:** Fresh account shows "No media uploaded yet" with upload guidance
3. **Upload:** Upload 2-3 images via the Upload button -> grid updates with new images
4. **Grid display:** Images render as squares in responsive grid (2 cols on mobile, 5 on desktop)
5. **Search:** Type search string -> filters grid results
6. **Preview:** Click an image or hover + click eye icon -> modal opens with full-size preview
7. **Delete:** Click delete on an image (via hover overlay or modal) -> image removed from grid
8. **Image Picker from Publishing:** Go to `/publishing` -> click "Library" -> modal opens with media
9. **Select from Library:** Pick an image -> it appears as preview in compose area
10. **Publish with library image:** Compose post, select library image, publish -> `media_urls` in payload contains the correct public URL
11. **Delete then use:** Delete an image from media library, then try to open picker -> deleted image not visible
12. **Build:** `npm run build` passes with no errors

**Expected result:** All tests pass. No broken flows.

---

## File Summary

| Action | File Path |
|--------|-----------|
| Modify | `/Users/linuxkexordzu/Personal Projects/SOCIAL/src/components/layout/sidebar.tsx` |
| Create | `/Users/linuxkexordzu/Personal Projects/SOCIAL/src/app/(app)/media/page.tsx` |
| Create | `/Users/linuxkexordzu/Personal Projects/SOCIAL/src/components/media/image-picker-modal.tsx` |
| Modify | `/Users/linuxkexordzu/Personal Projects/SOCIAL/src/app/(app)/publishing/page.tsx` |

## Architecture Diagram (mental model)

```
Sidebar
  └── "Media Library" → /media

/media (MediaLibraryPage)
  ├── Fetch: supabase.storage.from("media").list(userId)
  ├── Grid: responsive 2-5 column responsive layout
  ├── Upload: supabase.storage.from("media").upload(userId/filename, file)
  ├── Delete: supabase.storage.from("media").remove([userId/filename])
  ├── Search: client-side filter on file.name
  └── Preview: ImagePreviewModal (inline component)

publishing/page.tsx
  └── "Library" button → ImagePickerModal (reusable component)
        ├── Fetch: supabase.storage.from("media").list(userId)
        ├── Select: getPublicUrl → onSelect callback
        └── Result: sets mediaFile + mediaPreview on publishing page

Supabase Storage: "media" bucket
  └── {userId}/{timestamp}_{filename}
```

---

Plan complete and saved to `/Users/linuxkexordzu/Personal Projects/SOCIAL/docs/plans/2026-04-07-media-library-ui.md`.

Two execution options:

1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration
2. **Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
