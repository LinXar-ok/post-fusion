# Exportable Reports (PDF/CSV) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add date-range-filtered CSV and PDF export capabilities to the Analytics page, enabling users to download branded performance reports for custom time periods.

**Architecture:** A new client-side utility module (`src/lib/report-export.ts`) handles CSV generation (via `Blob` + anchor download) and PDF generation (via `@react-pdf/renderer` document). A new PDF document component (`src/components/reports/pdf-report.tsx`) defines a branded report layout using `@react-pdf/renderer` primitives. The analytics page gains a date range picker (two `datetime-local` inputs) and an export dropdown with CSV/PDF options. All data is derived from the existing `posts` query -- no new API routes or DB changes needed.

**Tech Stack:** TypeScript, Next.js 16 App Router, `@react-pdf/renderer` (client component), recharts, Tailwind CSS v4, shadcn/ui (Base Nova), lucide-react icons.

---

### Task 1: Install `@react-pdf/renderer` and its type shim

**Step 1: Install the dependency**

Run:
```bash
npm install @react-pdf/renderer
```

**Step 2: Verify**

Check that `@react-pdf/renderer` appears in `package.json` under `dependencies`.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @react-pdf/renderer for PDF export"
```

---

### Task 2: Create the report export utility

**Files:**
- Create: `/Users/linuxkexordzu/Personal Projects/SOCIAL/src/lib/report-export.ts`

This module exports two functions:
- `exportCSV(posts: Post[], dateStart: string | null, dateEnd: string | null): void` -- filters posts by date range, builds a CSV string, triggers browser download.
- `exportPDF(posts: Post[], dateStart: string | null, dateEnd: string | null, weeklyData, platformData, statCards): void` -- renders the `@react-pdf/renderer` document and triggers download.

**Step 1: Write the utility module**

```ts
// src/lib/report-export.ts

import type { Post, WeeklyDatum, PlatformDatum } from "@/app/(app)/analytics/page"

export function formatDateLabel(d: Date): string {
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function filterByDateRange(posts: Post[], start: string | null, end: string | null): Post[] {
  if (!start && !end) return posts
  const s = start ? new Date(start).getTime() : 0
  const e = end ? new Date(end).getTime() : Infinity
  return posts.filter(p => {
    const t = p.published_at ? new Date(p.published_at).getTime() : new Date(p.created_at).getTime()
    return t >= s && t <= e
  })
}

export function buildReportTitle(start: string | null, end: string | null): string {
  if (start && end) return `${formatDateLabel(new Date(start))} - ${formatDateLabel(new Date(end))}`
  if (start) return `From ${formatDateLabel(new Date(start))}`
  if (end) return `Until ${formatDateLabel(new Date(end))}`
  return "All Time"
}

export function exportCSV(
  posts: Post[],
  dateStart: string | null,
  dateEnd: string | null
): void {
  const filtered = filterByDateRange(posts, dateStart, dateEnd)
  const header = "ID,Status,Platforms,Content,Published At,Created At\n"
  const rows = filtered.map(p => {
    const content = `"${(p.content || "").replace(/"/g, '""').replace(/\n/g, " ")}"`
    return [p.id, p.status, (p.platforms || []).join("|"), content, p.published_at || "", p.created_at].join(",")
  }).join("\n")
  const csv = header + rows
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `linxar-report-${Date.now()}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function exportPDF(
  filtered: Post[],
  dateStart: string | null,
  dateEnd: string | null,
  weeklyData: { week: string; posts: number }[],
  platformData: { platform: string; posts: number }[],
  statCards: { title: string; value: number; icon: string; color: string }[]
): void {
  // Dynamically import to avoid SSR issues with pdfMake/react-pdf
  import("@/components/reports/pdf-report").then(({ PDFReportDocument }) => {
    import("@react-pdf/renderer").then(({ pdf }) => {
      const doc = pdf(PDFReportDocument({
        dateStart,
        dateEnd,
        filtered,
        weeklyData,
        platformData,
        statCards,
      }))
      doc.toBlob(blob => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `linxar-report-${Date.now()}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      })
    })
  })
}
```

**Step 2: Verify TypeScript**

Run:
```bash
npx tsc --noEmit
```
Expected: no errors (or only pre-existing ones unrelated to this file).

---

### Task 3: Create the branded PDF report document

**Files:**
- Create: `/Users/linuxkexordzu/Personal Projects/SOCIAL/src/components/reports/pdf-report.tsx`

Uses `@react-pdf/renderer` to define a PDF document with LinXar brand colors (#128C7E teal, #0B1020 navy). Contains: page header with logo/name, summary stats table, posts-by-platform table, last 20 posts table, footer with page numbers.

**Step 1: Write the PDF report component**

```tsx
// src/components/reports/pdf-report.tsx

"use client"

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer"
import { buildReportTitle, formatDateLabel } from "@/lib/report-export"

// Brand colors
const TEAL = "#128C7E"
const NAVY = "#0B1020"
const WHITE = "#FFFFFF"
const GRAY_LIGHT = "#f1f5f9"
const GRAY_MID = "#94a3b8"
const GRAY_DARK = "#475569"

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    padding: 30,
    backgroundColor: WHITE,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingBottom: 12,
    marginBottom: 20,
    borderBottom: 3,
    borderBottomColor: TEAL,
  },
  brandName: {
    fontSize: 22,
    fontWeight: "bold",
    color: TEAL,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: NAVY,
    marginTop: 2,
  },
  subtitle: {
    fontSize: 10,
    color: GRAY_MID,
    marginTop: 2,
  },
  generatedDate: {
    fontSize: 8,
    color: GRAY_MID,
    textAlign: "right",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: NAVY,
    marginBottom: 8,
    marginTop: 16,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: GRAY_LIGHT,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    width: "23%",
    padding: 10,
    backgroundColor: GRAY_LIGHT,
    borderRadius: 4,
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: NAVY,
  },
  statLabel: {
    fontSize: 8,
    color: GRAY_MID,
    textTransform: "uppercase",
    marginTop: 2,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: TEAL,
    color: WHITE,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 2,
  },
  tableHeaderText: {
    fontSize: 9,
    fontWeight: "bold",
    color: WHITE,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: GRAY_LIGHT,
  },
  tableRowAlt: {
    backgroundColor: "#f8fafc",
  },
  tableCell: {
    fontSize: 8,
    color: GRAY_DARK,
    flex: 1,
  },
  platformBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  platformName: {
    fontSize: 9,
    color: NAVY,
    width: 70,
    fontWeight: "bold",
  },
  platformBarBg: {
    flex: 1,
    height: 10,
    backgroundColor: GRAY_LIGHT,
    borderRadius: 3,
    overflow: "hidden",
  },
  platformBarFill: {
    height: 10,
    backgroundColor: TEAL,
    borderRadius: 3,
  },
  platformCount: {
    fontSize: 9,
    color: GRAY_DARK,
    marginLeft: 8,
    width: 20,
    textAlign: "right",
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 30,
    right: 30,
    borderTopWidth: 1,
    borderTopColor: GRAY_LIGHT,
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: {
    fontSize: 8,
    color: GRAY_MID,
  },
  pageNumber: {
    fontSize: 8,
    color: GRAY_MID,
  },
  statusPublished: {
    color: "#10b981",
    fontWeight: "bold",
  },
  statusScheduled: {
    color: "#f59e0b",
    fontWeight: "bold",
  },
  statusFailed: {
    color: "#ef4444",
    fontWeight: "bold",
  },
})

// Register a standard font (Helvetica is built-in, no registration needed)

const statusStyle = (status: string) => {
  switch (status) {
    case "published": return styles.statusPublished
    case "scheduled": return styles.statusScheduled
    case "failed": return styles.statusFailed
    default: return {}
  }
}

interface PDFReportProps {
  dateStart: string | null
  dateEnd: string | null
  filtered: Array<{
    id: string
    status: string
    content: string
    platforms: string[]
    created_at: string
    published_at: string | null
  }>
  weeklyData: Array<{ week: string; posts: number }>
  platformData: Array<{ platform: string; posts: number }>
  statCards: Array<{ title: string; value: number }>
}

export function PDFReportDocument({
  dateStart,
  dateEnd,
  filtered,
  platformData,
  statCards,
}: PDFReportProps) {
  const maxPlatformPosts = Math.max(...platformData.map(p => p.posts), 1)
  const reportTitle = buildReportTitle(dateStart, dateEnd)
  const now = new Date()

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brandName}>LinXar Ops: Social</Text>
            <Text style={styles.reportTitle}>Analytics Report: {reportTitle}</Text>
            <Text style={styles.subtitle}>Personal Social Media Management</Text>
          </View>
          <Text style={styles.generatedDate}>
            Generated {formatDateLabel(now)}
          </Text>
        </View>

        {/* Summary Stats */}
        <Text style={styles.sectionTitle}>Summary</Text>
        <View style={styles.statsGrid}>
          {statCards.map((stat, i) => (
            <View key={i} style={styles.statCard}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.title}</Text>
            </View>
          ))}
        </View>

        {/* Posts by Platform */}
        <Text style={styles.sectionTitle}>Posts by Platform</Text>
        {platformData.map((p, i) => (
          <View key={i} style={styles.platformBar}>
            <Text style={styles.platformName}>{p.platform}</Text>
            <View style={styles.platformBarBg}>
              <View style={[styles.platformBarFill, { width: `${(p.posts / maxPlatformPosts) * 100}%` }]} />
            </View>
            <Text style={styles.platformCount}>{p.posts}</Text>
          </View>
        ))}

        {/* Posts Table */}
        <Text style={styles.sectionTitle}>Recent Posts (Last {Math.min(filtered.length, 20)})</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, { flex: 1.5 }]}>Date</Text>
          <Text style={[styles.tableHeaderText, { flex: 1 }]}>Status</Text>
          <Text style={[styles.tableHeaderText, { flex: 1 }]}>Platforms</Text>
          <Text style={[styles.tableHeaderText, { flex: 3 }]}>Content</Text>
        </View>
        {filtered.slice(0, 20).map((post, i) => (
          <View key={post.id} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}>
            <Text style={[styles.tableCell, { flex: 1.5 }]}>
              {post.published_at ? formatDateLabel(new Date(post.published_at)) : formatDateLabel(new Date(post.created_at))}
            </Text>
            <Text style={[styles.tableCell, styles.statusStyle(post.status), { flex: 1 }]}>
              {post.status}
            </Text>
            <Text style={[styles.tableCell, { flex: 1 }]}>{(post.platforms || []).join(", ")}</Text>
            <Text style={[styles.tableCell, { flex: 3 }]} numberOfLines={2}>
              {(post.content || "").substring(0, 80)}{(post.content || "").length > 80 ? "..." : ""}
            </Text>
          </View>
        ))}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>LinXar Ops: Social -- Analytics Report</Text>
          <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (
            `${pageNumber} / ${totalPages}`
          )} />
        </View>
      </Page>
    </Document>
  )
}

export default PDFReportDocument
```

**Step 2: Verify**

Run:
```bash
npx tsc --noEmit
```
Expected: no errors related to the new component.

Note: `@react-pdf/renderer` includes its own types; if TypeScript warns about missing the `render` prop or `numberOfLines`, those are valid props on `@react-pdf/renderer` v4+. The skill uses `v4` API.

**Step 3: Commit**

```bash
git add src/components/reports/pdf-report.tsx
git commit -m "feat: add branded PDF report document component"
```

---

### Task 4: Integrate date range picker and export UI into analytics page

**Files:**
- Modify: `/Users/linuxkexordzu/Personal Projects/SOCIAL/src/app/(app)/analytics/page.tsx`

The analytics page gains:
- Two `datetime-local` inputs (start/end date) for filtering
- An export button with a dropdown (or two side-by-side buttons) for CSV/PDF export
- All data and charts dynamically reflect the selected date range
- Export functions pass in the filtered subset

**Step 1: Add new imports**

At the top of the file, add:
```tsx
import { Download, Calendar, ChevronDown } from "lucide-react"
import { exportCSV, exportPDF, buildReportTitle } from "@/lib/report-export"
```

Also add `useState` for the date range:
```tsx
const [exportOpen, setExportOpen] = useState(false)
```

**Step 2: Add date range state and filtering**

After the existing `useState` declarations, add:
```tsx
const [dateStart, setDateStart] = useState<string>("")
const [dateEnd, setDateEnd] = useState<string>("")
```

After computing `published`, `scheduled`, `failed`, add:
```tsx
const filtered = posts.filter(p => {
  const t = p.published_at ? new Date(p.published_at).getTime() : new Date(p.created_at).getTime()
  const startMs = dateStart ? new Date(dateStart).getTime() : 0
  const endMs = dateEnd ? new Date(dateEnd).getTime() : Infinity
  return t >= startMs && t <= endMs
})
```

Derive all stats from `filtered` instead of `posts`:
```tsx
const publishedFiltered = filtered.filter(p => p.status === "published")
const scheduledFiltered = filtered.filter(p => p.status === "scheduled")
const failedFiltered = filtered.filter(p => p.status === "failed")
```

Create filtered versions of `weeklyData` and `platformData` (or compute them from `filtered`):
```tsx
const weeklyDataFiltered = getWeeklyData(filtered)
const platformDataFiltered = getPlatformData(filtered)
```

Update the stat cards:
```tsx
const statCards = [
  { title: "Total Posts", value: filtered.length, icon: FileText, color: "teal" },
  { title: "Published", value: publishedFiltered.length, icon: CheckCircle2, color: "emerald" },
  { title: "Scheduled", value: scheduledFiltered.length, icon: Clock, color: "amber" },
  { title: "Failed", value: failedFiltered.length, icon: AlertTriangle, color: "rose" },
]
```

**Step 3: Add the date range picker and export toolbar**

Insert between the header `div` and the stat cards grid:
```tsx
{/* Date Range & Export Bar */}
<div className="flex flex-wrap items-center gap-3 mb-6 shrink-0">
  <div className="flex items-center gap-2">
    <Calendar className="w-4 h-4 text-slate-400" />
    <input
      type="datetime-local"
      value={dateStart}
      onChange={e => setDateStart(e.target.value)}
      className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#128C7E]/50 focus-visible:border-[#128C7E]"
      aria-label="Start date"
    />
    <span className="text-xs text-slate-400">to</span>
    <input
      type="datetime-local"
      value={dateEnd}
      onChange={e => setDateEnd(e.target.value)}
      className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#128C7E]/50 focus-visible:border-[#128C7E]"
      aria-label="End date"
    />
    {(dateStart || dateEnd) && (
      <button
        onClick={() => { setDateStart(""); setDateEnd("") }}
        className="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2"
      >
        Clear
      </button>
    )}
  </div>

  <div className="relative ml-auto">
    <button
      onClick={() => setExportOpen(!exportOpen)}
      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#128C7E] text-white text-xs font-medium hover:bg-[#0e7a6e] transition-colors"
    >
      <Download className="w-3.5 h-3.5" /> Export
      <ChevronDown className="w-3 h-3" />
    </button>
    {exportOpen && (
      <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden">
        <button
          onClick={() => {
            exportCSV(filtered, dateStart || null, dateEnd || null)
            setExportOpen(false)
          }}
          className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-[#128C7E]/5 transition-colors flex items-center gap-2"
        >
          <span className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded">.csv</span>
          Export CSV
        </button>
        <button
          onClick={() => {
            exportPDF(filtered, dateStart || null, dateEnd || null, weeklyDataFiltered, platformDataFiltered, statCards)
            setExportOpen(false)
          }}
          className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-[#128C7E]/5 transition-colors flex items-center gap-2"
        >
          <span className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded text-red-500">.pdf</span>
          Export PDF
        </button>
      </div>
    )}
  </div>
</div>
```

**Step 4: Close dropdown on outside click**

Add this near the top of the component:
```tsx
useEffect(() => {
  const handler = (e: MouseEvent) => {
    if (exportOpen) setExportOpen(false)
  }
  document.addEventListener("click", handler)
  return () => document.removeEventListener("click", handler)
}, [exportOpen])
```

And add `e.stopPropagation()` to the export button:
```tsx
<button
  onClick={(e) => { e.stopPropagation(); setExportOpen(!exportOpen) }}
```

**Step 5: Update chart data sources**

Ensure the LineChart and BarChart use the filtered data:
- Change `weeklyData` to `weeklyDataFiltered` in `<LineChart data={weeklyDataFiltered} ...>`
- Change `platformData` to `platformDataFiltered` in `<BarChart data={platformDataFiltered} ...>`

**Step 6: Verify build**

Run:
```bash
npm run build
```
Expected: no new TypeScript errors.

**Step 7: Commit**

```bash
git add src/app/\(app\)/analytics/page.tsx src/lib/report-export.ts
git commit -m "feat: add date range picker and CSV/PDF export to analytics"
```

---

### Task 5: Test end-to-end user flows

**Files:** (no changes -- testing only)

**Test Checklist:**

1. **Navigate to Analytics** -> page loads, stat cards and charts render with full data
2. **Set start date** -> stat cards update to show only posts from that date onwards
3. **Set end date** -> stat cards further filter to only posts before that date
4. **Clear filter** -> click "Clear" button -> all data is visible again
5. **Export CSV** -> click Export -> CSV -> browser downloads `.csv` file
6. **Open CSV** -> verify: correct columns (ID, Status, Platforms, Content, Published At, Created At), correct number of rows matching the filtered set
7. **Export PDF** -> click Export -> PDF -> browser downloads `.pdf` file
8. **Open PDF** -> verify: "LinXar Ops: Social" branding in teal header, correct date range in title, summary stats, platform bars, posts table, page numbers in footer
9. **Empty state** -> set a date range with no posts -> stats show 0, charts show empty, CSV exports with header only, PDF shows empty stats
10. **Dropdown close** -> clicking outside the export dropdown closes it
11. **Build** -> `npm run build` passes cleanly

---

## File Summary

| Action | File Path |
|--------|-----------|
| Create | `/Users/linuxkexordzu/Personal Projects/SOCIAL/src/lib/report-export.ts` |
| Create | `/Users/linuxkexordzu/Personal Projects/SOCIAL/src/components/reports/pdf-report.tsx` |
| Modify | `/Users/linuxkexordzu/Personal Projects/SOCIAL/src/app/(app)/analytics/page.tsx` |
| Install | `@react-pdf/renderer` (dependency) |

## Architecture Diagram (mental model)

```
Analytics Page (src/app/(app)/analytics/page.tsx)
  ├── Data: fetches posts from Supabase (existing)
  ├── Filter: dateStart/dateEnd state -> filtered subset
  ├── Charts: LineChart + BarChart use filtered data
  ├── Stat Cards: computed from filtered
  ├── Date Range Picker: 2x datetime-local inputs + Clear button
  └── Export Dropdown:
        ├── Export CSV -> report-export.ts::exportCSV() -> Blob download
        └── Export PDF -> report-export.ts::exportPDF() -> pdf() -> Blob download
              └── pdf-report.tsx (PDFReportDocument)
                    ├── Header: "LinXar Ops: Social" branding
                    ├── Summary: 4 stat cards
                    ├── Platform bars (horizontal bar chart)
                    ├── Posts table (last 20)
                    └── Footer: "Generated on..." + page numbers

Colors:
  Primary: #128C7E (teal)
  Text: #0B1020 (deep navy)
```

## Design Notes

- The date range inputs use native `datetime-local` rather than adding a date picker library -- this keeps the dependency footprint at zero new packages beyond `@react-pdf/renderer`.
- The export dropdown is built with plain HTML (no shadcn `DropdownMenu`) to avoid adding `radix-ui` dependencies beyond what's already in the project, and to keep the UI simple.
- The PDF uses built-in `Helvetica` font -- no external font registration needed, avoiding font loading complexity.
- All data is client-side filtered; no new API routes or server functions are needed.
- The `exportPDF()` function dynamically imports `@react-pdf/renderer` to avoid SSR hydration issues -- it only runs on the client after clicking Export.

---

Plan complete and saved to `/Users/linuxkexordzu/Personal Projects/SOCIAL/docs/plans/2026-04-07-exportable-reports.md`.

Two execution options:

1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration
2. **Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
