# Bulk CSV Scheduling Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to upload a CSV of posts to be parsed, validated, previewed, and bulk-inserted as scheduled posts into the existing queue (picked up automatically by the cron worker).

**Architecture:** Add a collapsible "Bulk Upload" section below the existing post editor on the publishing page. The client parses the CSV with Papa Parse, validates each row, renders a preview table with error badges, then calls a new server route (`/api/posts/bulk-insert`) to insert valid rows in a single transaction. The existing cron at `/api/cron/process-queue` requires no changes.

**Tech Stack:** TypeScript (strict), Next.js 16, Papa Parse (`papaparse`), Supabase SDK, Tailwind CSS v4, shadcn/ui, Framer Motion

---

### Background: CSV Format and Schema

**Expected CSV columns:**

| Column (required)    | Type           | Notes                                              |
|----------------------|----------------|----------------------------------------------------|
| `content`            | string         | Post body text (non-empty)                         |
| `hashtags`           | string         | Semicolon-separated, e.g. `ai;marketing;growth`    |
| `platforms`          | string         | Semicolon-separated, e.g. `linkedin;x;facebook`    |
| `scheduled_datetime` | ISO 8601 string| e.g. `2026-04-10T09:00:00Z` (must be future)        |

`content` and `scheduled_datetime` are required. `hashtags` and `platforms` are optional (default to empty platforms = immediate publish).

**Existing posts table columns relevant to insertion** (from `supabase/migrations/20260328000000_init.sql` + `20260403000000_fix_posts_schema.sql`):

- `id UUID` (auto-generated)
- `user_id UUID NOT NULL`
- `social_profile_id UUID` (nullable after migration)
- `content TEXT NOT NULL`
- `platforms TEXT[] NOT NULL DEFAULT '{}'`
- `hashtags TEXT[]`
- `emotion TEXT` (optional, not in CSV)
- `error_logs JSONB`
- `status TEXT NOT NULL DEFAULT 'draft'`
- `scheduled_for TIMESTAMPTZ`
- `published_at TIMESTAMPTZ`
- `created_at TIMESTAMPTZ NOT NULL`
- `updated_at TIMESTAMPTZ NOT NULL`

Cron picks up rows where `status = 'scheduled' AND scheduled_for <= now()`.

---

### Task 1: Install papaparse and its types

**Files:**
- Modify: `package.json` (install dependency)

**Step 1: Install papaparse**

```bash
npm install papaparse
npm install -D @types/papaparse
```

**Step 2: Verify install**

```bash
node -e "import('papaparse').then(() => console.log('papaparse OK'))"
```

Expected: `papaparse OK`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add papaparse dependency for CSV parsing"
```

---

### Task 2: Create CSV parser utility with validation

**Files:**
- Create: `src/lib/csv-parser.ts`

This module runs entirely on the client (browser) and exports two functions:
1. `parseCSV(file: File): Promise<{ rows: ParsedCSVRow[]; errors: CSVError[] }>`
2. `validateParsedRows(rows: ParsedCSVRow[]): ValidatedRow[]`

**Step 1: Write types**

```typescript
// src/lib/csv-parser.ts

export interface ParsedCSVRow {
  content: string;
  hashtags: string;      // raw semicolon-separated string from CSV
  platforms: string;     // raw semicolon-separated string from CSV
  scheduled_datetime: string;
}

export interface CSVError {
  rowIndex: number;
  field: string;
  message: string;
  rawContent?: string;
}

export interface ValidatedRow {
  content: string;
  hashtags: string[];
  platforms: string[];
  scheduledFor: string | null;  // ISO string or null (= publish now)
  rowIndex: number;
}

export interface ParseResult {
  rows: ParsedCSVRow[];
  parseErrors: CSVError[];
}

const VALID_PLATFORMS = new Set(["linkedin", "x", "facebook", "instagram"]);
```

**Step 2: Write parseCSV**

```typescript
import Papa from "papaparse";

export function parseCSV(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as ParsedCSVRow[];
        const parseErrors: CSVError[] = results.errors.map((e) => ({
          rowIndex: e.row,
          field: "parse",
          message: e.message,
        }));
        resolve({ rows, parseErrors });
      },
    });
  });
}
```

**Step 3: Write validateParsedRows**

```typescript
export function validateParsedRows(rows: ParsedCSVRow[]): {
  valid: ValidatedRow[];
  errors: CSVError[];
} {
  const valid: ValidatedRow[] = [];
  const errors: CSVError[] = [];

  rows.forEach((row, index) => {
    const localErrors: CSVError[] = [];

    // content is required and non-empty
    if (!row.content || !row.content.trim()) {
      localErrors.push({
        rowIndex: index,
        field: "content",
        message: "Content is required and cannot be empty",
        rawContent: row.content,
      });
    }

    // platforms: parse and validate each
    const platforms = (row.platforms || "")
      .split(";")
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean);

    const invalidPlatforms = platforms.filter((p) => !VALID_PLATFORMS.has(p));
    if (invalidPlatforms.length > 0) {
      localErrors.push({
        rowIndex: index,
        field: "platforms",
        message: `Invalid platforms: ${invalidPlatforms.join(", ")}. Valid: linkedin, x, facebook, instagram`,
      });
    }

    // scheduled_datetime: if present, must be valid ISO 8601 and in the future
    let scheduledFor: string | null = null;
    if (row.scheduled_datetime && row.scheduled_datetime.trim()) {
      const parsed = new Date(row.scheduled_datetime.trim());
      if (isNaN(parsed.getTime())) {
        localErrors.push({
          rowIndex: index,
          field: "scheduled_datetime",
          message: `Invalid date format: "${row.scheduled_datetime}"`,
        });
      } else if (parsed <= new Date()) {
        localErrors.push({
          rowIndex: index,
          field: "scheduled_datetime",
          message: `Scheduled date must be in the future (got: ${row.scheduled_datetime})`,
        });
      } else {
        scheduledFor = parsed.toISOString();
      }
    }

    // hashtags: just parse, no validation needed beyond trimming
    const hashtags = (row.hashtags || "")
      .split(";")
      .map((h) => h.trim().replace(/^#/, ""))
      .filter(Boolean);

    if (localErrors.length > 0) {
      errors.push(...localErrors);
    } else {
      valid.push({
        content: row.content.trim(),
        hashtags,
        platforms,
        scheduledFor,
        rowIndex: index,
      });
    }
  });

  return { valid, errors };
}
```

**Step 4: Commit**

```bash
git add src/lib/csv-parser.ts
git commit -m "feat: add CSV parser utility with validation"
```

---

### Task 3: Create CSV Upload Component

**Files:**
- Create: `src/components/csv-upload.tsx`

A self-contained client component with drag-and-drop zone, file picker, and status display.

**Step 1: Create the component**

```tsx
// src/components/csv-upload.tsx
"use client"

import { useState, useCallback } from "react"
import { Upload, FileText, X, AlertCircle } from "lucide-react"

interface CSVUploadProps {
  onFileLoaded: (file: File) => void
  disabled?: boolean
}

export function CSVUpload({ onFileLoaded, disabled }: CSVUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)

  const handleFile = useCallback((file: File) => {
    if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
      return
    }
    setFileName(file.name)
    onFileLoaded(file)
  }, [onFileLoaded])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleClear = () => {
    setFileName(null)
  }

  if (fileName) {
    return (
      <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-emerald-600" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">{fileName}</p>
            <p className="text-xs text-emerald-600">Ready for parsing</p>
          </div>
        </div>
        <button
          onClick={handleClear}
          className="p-1 rounded-full hover:bg-emerald-100 text-emerald-500"
          disabled={disabled}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`relative flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl transition-all cursor-pointer ${
        isDragging
          ? "border-[#128C7E] bg-[#128C7E]/5"
          : "border-slate-300 bg-slate-50/50 hover:border-[#128C7E]/50 hover:bg-[#128C7E]/5"
      } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
    >
      <input
        type="file"
        accept=".csv"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
        disabled={disabled}
      />
      <Upload className="w-8 h-8 text-slate-400 mb-3" />
      <p className="text-sm font-semibold text-slate-700">
        Drop your CSV here or <span className="text-[#128C7E]">browse</span>
      </p>
      <p className="text-xs text-slate-500 mt-1">
        Columns: content, hashtags, platforms, scheduled_datetime
      </p>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/csv-upload.tsx
git commit -m "feat: add CSV upload component with drag-and-drop"
```

---

### Task 4: Create CSV Preview Table Component

**Files:**
- Create: `src/components/csv-preview-table.tsx`

Renders parsed rows in a table with error badges, truncated content preview, platform tags, and scheduled time. Shows a summary footer with valid/invalid counts.

**Step 1: Create the component**

```tsx
// src/components/csv-preview-table.tsx
"use client"

import type { ValidatedRow, CSVError } from "@/lib/csv-parser"
import { AlertCircle, CheckCircle2, Calendar, Hash } from "lucide-react"
import { FaLinkedin, FaXTwitter, FaFacebook, FaInstagram } from "react-icons/fa6"

interface CSVPreviewTableProps {
  validRows: ValidatedRow[]
  errors: CSVError[]
  parseErrors: CSVError[]
}

const platformIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  linkedin: FaLinkedin,
  x: FaXTwitter,
  facebook: FaFacebook,
  instagram: FaInstagram,
}

const platformColors: Record<string, string> = {
  linkedin: "bg-[#0A66C2]/10 text-[#0A66C2]",
  x: "bg-slate-800/10 text-slate-800",
  facebook: "bg-[#1877F2]/10 text-[#1877F2]",
  instagram: "bg-rose-500/10 text-rose-500",
}

export function CSVPreviewTable({ validRows, errors, parseErrors }: CSVPreviewTableProps) {
  const allErrors = [...parseErrors, ...errors]
  const errorRowCounts = new Set(allErrors.map((e) => e.rowIndex))

  if (validRows.length === 0 && allErrors.length === 0) return null

  return (
    <div className="space-y-4">
      {/* Summary Bar */}
      <div className="flex items-center gap-4 text-sm">
        <span className="flex items-center gap-1.5 font-semibold text-emerald-700">
          <CheckCircle2 className="w-4 h-4" /> {validRows.length} valid
        </span>
        {allErrors.length > 0 && (
          <span className="flex items-center gap-1.5 font-semibold text-rose-700">
            <AlertCircle className="w-4 h-4" /> {allErrors.length} error{allErrors.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Valid Rows Table */}
      {validRows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">#</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Content</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Platforms</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Hashtags</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Scheduled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {validRows.map((row) => (
                <tr key={row.rowIndex} className="bg-white hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-slate-400 w-10">{row.rowIndex + 1}</td>
                  <td className="px-4 py-3 max-w-[280px]">
                    <p className="truncate text-slate-800" title={row.content}>{row.content}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {row.platforms.map((p) => {
                        const Icon = platformIcons[p]
                        return Icon ? (
                          <span key={p} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${platformColors[p]}`}>
                            <Icon className="w-3 h-3" /> {p}
                          </span>
                        ) : (
                          <span key={p} className="px-2 py-0.5 rounded-md text-xs bg-slate-100 text-slate-600">{p}</span>
                        )
                      })}
                      {row.platforms.length === 0 && (
                        <span className="text-xs text-slate-400 italic">immediate</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <div className="flex items-center gap-1 text-xs">
                      <Hash className="w-3 h-3" />
                      {row.hashtags.length > 0 ? row.hashtags.join(", ") : "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <div className="flex items-center gap-1 text-xs">
                      <Calendar className="w-3 h-3" />
                      {row.scheduledFor ? new Date(row.scheduledFor).toLocaleString() : "Now"}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Error Rows */}
      {allErrors.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-rose-700 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4" /> Validation Errors
          </h4>
          {allErrors.map((err, i) => (
            <div key={i} className="flex gap-3 p-3 bg-rose-50 border border-rose-100 rounded-lg text-sm">
              <span className="font-mono text-xs text-rose-400 shrink-0 w-12 pt-0.5">Row {err.rowIndex + 1}</span>
              <div className="min-w-0">
                <span className="inline-block px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded text-xs font-semibold mb-1">{err.field}</span>
                <p className="text-rose-600">{err.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/csv-preview-table.tsx
git commit -m "feat: add CSV preview table with error badges"
```

---

### Task 5: Create bulk-insert API route

**Files:**
- Create: `src/app/api/posts/bulk-insert/route.ts`

Server-only route that receives validated rows, inserts them with `status: 'scheduled'`, and returns counts.

**Step 1: Write the API route**

```typescript
// src/app/api/posts/bulk-insert/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const rows: Array<{
      content: string
      hashtags: string[]
      platforms: string[]
      scheduledFor: string | null
    }> = body.rows

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "No rows to insert" }, { status: 400 })
    }

    const insertPayload = rows.map((row) => ({
      user_id: user.id,
      content: row.content,
      hashtags: row.hashtags,
      platforms: row.platforms,
      scheduled_for: row.scheduledFor,
      // If no scheduled time, mark as draft (will need manual publish);
      // otherwise mark as scheduled for the cron to pick up.
      status: row.scheduledFor ? "scheduled" : "draft",
    }))

    const { data, error } = await supabase
      .from("posts")
      .insert(insertPayload)
      .select("id")

    if (error) {
      console.error("Bulk insert error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      inserted: data?.length ?? 0,
      ids: data?.map((d) => d.id) ?? [],
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error"
    console.error("Bulk insert error:", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/posts/bulk-insert/route.ts
git commit -m "feat: add bulk-insert API route for CSV posts"
```

---

### Task 6: Integrate CSV flow into Publishing Page

**Files:**
- Modify: `src/app/(app)/publishing/page.tsx`

Add a collapsible "Bulk Upload via CSV" section below the existing editor card. The section contains: CSVUpload -> parse -> validate -> show preview -> confirm insert button.

**Step 1: Add imports at the top of the file**

Add these imports alongside existing ones:
```typescript
import { CSVUpload } from "@/components/csv-upload"
import { CSVPreviewTable } from "@/components/csv-preview-table"
import { parseCSV, validateParsedRows, type ValidatedRow, type CSVError } from "@/lib/csv-parser"
import { Upload, Loader2, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
```

(Upload, Loader2, CheckCircle2, AlertCircle may already be imported from lucide-react. Add `Upload, ChevronDown, ChevronUp` if missing. `motion, AnimatePresence` already imported.)

**Step 2: Add state variables**

After the existing state declarations, add:

```typescript
const [showBulkUpload, setShowBulkUpload] = useState(false)
const [bulkStep, setBulkStep] = useState<"idle" | "parsing" | "preview" | "inserting" | "done" | "error">("idle")
const [bulkParsedRows, setBulkParsedRows] = useState<ValidatedRow[]>([])
const [bulkErrors, setBulkErrors] = useState<CSVError[]>([])
const [bulkParseErrors, setBulkParseErrors] = useState<CSVError[]>([])
const [bulkResult, setBulkResult] = useState<{ inserted: number } | null>(null)
const [bulkErrorMsg, setBulkErrorMsg] = useState("")
```

**Step 3: Add handlers**

```typescript
const handleFileLoaded = async (file: File) => {
  setBulkStep("parsing")
  setBulkErrorMsg("")
  setBulkResult(null)
  try {
    const { rows, parseErrors } = await parseCSV(file)
    setBulkParseErrors(parseErrors)
    const { valid, errors } = validateParsedRows(rows)
    setBulkParsedRows(valid)
    setBulkErrors(errors)
    setBulkStep("preview")
  } catch (err: unknown) {
    setBulkErrorMsg(err instanceof Error ? err.message : "Failed to parse CSV")
    setBulkStep("error")
  }
}

const handleBulkInsert = async () => {
  if (bulkParsedRows.length === 0) return
  setBulkStep("inserting")
  try {
    const res = await fetch("/api/posts/bulk-insert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: bulkParsedRows }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || "Bulk insert failed")
    setBulkResult({ inserted: data.inserted })
    setBulkStep("done")
  } catch (err: unknown) {
    setBulkErrorMsg(err instanceof Error ? err.message : "Bulk insert failed")
    setBulkStep("error")
  }
}

const resetBulkUpload = () => {
  setShowBulkUpload(false)
  setBulkStep("idle")
  setBulkParsedRows([])
  setBulkErrors([])
  setBulkParseErrors([])
  setBulkResult(null)
  setBulkErrorMsg("")
}
```

**Step 4: Add the Bulk Upload section in JSX**

Insert this block **between** the feedback message divs (line ~156, after the success div, closing `</div>`) and **before** the two-column grid (line ~158, the `div className="flex-1 grid..."`):

```tsx
      {/* Bulk CSV Upload Section */}
      <AnimatePresence>
        {showBulkUpload && (
          <motion.div
            key="bulk-upload"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-6 overflow-hidden shrink-0"
          >
            <Card className="bg-white/80 border-slate-200 shadow-sm backdrop-blur-xl">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Upload className="w-5 h-5 text-[#128C7E]" />
                    <h2 className="text-lg font-semibold text-slate-800">Bulk Upload via CSV</h2>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetBulkUpload}
                    className="text-slate-500 hover:text-slate-700"
                  >
                    Close
                  </Button>
                </div>

                {/* Step 1: Upload */}
                {bulkStep === "idle" && (
                  <CSVUpload onFileLoaded={handleFileLoaded} />
                )}

                {/* Step 2: Parsing */}
                {bulkStep === "parsing" && (
                  <div className="flex items-center justify-center py-12 text-[#128C7E]">
                    <Loader2 className="w-6 h-6 animate-spin mr-2" />
                    <span className="text-sm font-medium">Parsing CSV…</span>
                  </div>
                )}

                {/* Step 3: Preview */}
                {bulkStep === "preview" && (
                  <div className="space-y-4">
                    <CSVPreviewTable
                      validRows={bulkParsedRows}
                      errors={bulkErrors}
                      parseErrors={bulkParseErrors}
                    />
                    <div className="flex justify-between pt-4 border-t border-slate-100">
                      <Button variant="outline" size="sm" onClick={() => { setBulkStep("idle"); setBulkParsedRows([]); setBulkErrors([]); setBulkParseErrors([]) }}>
                        Upload different file
                      </Button>
                      <Button
                        disabled={bulkParsedRows.length === 0}
                        onClick={handleBulkInsert}
                        className="bg-[#128C7E] hover:bg-[#0B1020] text-white"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Insert {bulkParsedRows.length} scheduled post{bulkParsedRows.length !== 1 ? "s" : ""}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step 4: Inserting */}
                {bulkStep === "inserting" && (
                  <div className="flex items-center justify-center py-12 text-[#128C7E]">
                    <Loader2 className="w-6 h-6 animate-spin mr-2" />
                    <span className="text-sm font-medium">Inserting posts…</span>
                  </div>
                )}

                {/* Step 5: Done */}
                {bulkStep === "done" && bulkResult && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
                    <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-600 mb-2" />
                    <h3 className="text-lg font-semibold text-emerald-800">
                      {bulkResult.inserted} post{bulkResult.inserted !== 1 ? "s" : ""} scheduled!
                    </h3>
                    <p className="text-sm text-emerald-700 mt-1">
                      The cron will process them at the scheduled times.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => { setBulkStep("idle"); setBulkParsedRows([]); setBulkErrors([]); setBulkParseErrors([]); setBulkResult(null) }}
                    >
                      Upload more
                    </Button>
                  </div>
                )}

                {/* Error state */}
                {bulkStep === "error" && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center">
                    <AlertCircle className="w-10 h-10 mx-auto text-rose-600 mb-2" />
                    <p className="text-sm font-medium text-rose-800">{bulkErrorMsg}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => { setBulkStep("idle"); setBulkErrorMsg("") }}
                    >
                      Try again
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle button (always visible, shows when bulk upload is closed) */}
      {!showBulkUpload && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowBulkUpload(true)}
          className="mb-6 shrink-0 text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-[#128C7E]/30"
        >
          <Upload className="w-4 h-4 mr-2" />
          Bulk Upload via CSV
          <ChevronDown className="w-4 h-4 ml-2" />
        </Button>
      )}
```

**Step 5: Commit**

```bash
git add src/app/\(app\)/publishing/page.tsx
git commit -m "feat: integrate CSV bulk upload flow into publishing page"
```

---

### Task 7: Manual Testing and Validation

**Step 1: Create a test CSV file**

```
content,hashtags,platforms,scheduled_datetime
"Hello world from bulk upload",ai;social,linkedin;x,2026-04-10T09:00:00Z
"Another test post",growth;x,facebook,2026-04-11T14:30:00Z
"Immediate post",,,,
```

**Step 2: Run the dev server**

```bash
npm run dev
```

**Step 3: Test the flow (all in one session)**

1. Navigate to `http://localhost:3000` and sign in
2. Go to the Publishing page
3. Click **"Bulk Upload via CSV"** — the section should expand
4. Upload the test CSV — you should see:
   - Row 1: valid (2 platforms, scheduled April 10)
   - Row 2: valid (1 platform, scheduled April 11)
   - Row 3: error (empty content, empty platforms, empty scheduled_datetime — should fail on content)
5. Confirm insert — verify 2 posts are inserted
6. Navigate to Calendar page — verify the 2 posts appear on the correct dates
7. Run the cron locally: `curl http://localhost:3000/api/cron/process-queue` to verify the empty-posts row gets picked up (draft status won't execute; only scheduled will)

**Step 4: Edge-case tests (all in one session)**

1. Upload an empty CSV — should show "0 valid, 0 errors"
2. Upload a non-CSV file — drag-and-drop should reject it
3. Upload with a row in the past date — should show a validation error
4. Upload with a misspelled platform (e.g. "twiter") — should show a validation error
5. Upload a CSV with extra unknown columns — Papa Parse should ignore them (header mode)

---

### Task 8: Add a sample CSV download link (polish)

**Files:**
- Modify: `src/components/csv-upload.tsx` (add sample link)

**Step 1: Add a "Download sample CSV" link**

In the upload zone, add below the hint text:

```tsx
<a
  href="/sample-posts.csv"
  download
  className="text-xs text-[#128C7E] hover:underline mt-2 inline-block"
>
  Download sample CSV template
</a>
```

**Step 2: Create the sample CSV in public/**

Create: `public/sample-posts.csv`

```
content,hashtags,platforms,scheduled_datetime
Excited to share our latest product update! Check it out.,product;launch;saas,linkedin;x,2026-05-01T10:00:00Z
What are your thoughts on the future of AI?,ai;future;x,linkedin;x;facebook,2026-05-03T09:00:00Z
```

**Step 3: Commit**

```bash
git add public/sample-posts.csv src/components/csv-upload.tsx
git commit -m "feat: add sample CSV download template"
```

---

### Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `package.json` | Modify | Add `papaparse` + `@types/papaparse` |
| `src/lib/csv-parser.ts` | **Create** | Parse CSV + validate rows |
| `src/components/csv-upload.tsx` | **Create** | Drag-and-drop upload zone |
| `src/components/csv-preview-table.tsx` | **Create** | Preview table with error display |
| `src/app/api/posts/bulk-insert/route.ts` | **Create** | Server route for bulk insert |
| `src/app/(app)/publishing/page.tsx` | Modify | Integrate bulk upload UI |
| `public/sample-posts.csv` | **Create** | Downloadable CSV template |

### Architecture Diagram

```
User uploads CSV
       │
       ▼
 ┌─────────────┐
 │  CSVUpload   │ (client component)
 └──────┬───────┘
        │ File
        ▼
 ┌─────────────┐
 │  csv-parser  │ (parse + validate)
 └──────┬───────┘
        │ { valid[], errors[] }
        ▼
 ┌─────────────────┐
 │ Preview Table   │ (user reviews)
 └──────┬──────────┘
        │ POST /api/posts/bulk-insert
        ▼
 ┌───────────────────┐
 │  bulk-insert API  │ (server, auth check)
 └──────┬────────────┘
        │ INSERT into posts (status='scheduled')
        ▼
 ┌───────────────────┐
 │  Cron (existing)  │ — picks up scheduled posts
 └───────────────────┘
```
