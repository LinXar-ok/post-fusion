type Post = {
  id: string
  status: string
  content: string
  platforms: string[]
  created_at: string
  published_at: string | null
}

export function formatDateLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
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
  const published = filtered.filter(p => p.status === "published")
  const scheduled = filtered.filter(p => p.status === "scheduled")
  const failed = filtered.filter(p => p.status === "failed")
  const line = (vals: string[]) => vals.join(",")
  const header = [
    "LinXar Ops: Social - Analytics Report",
    `Period: ${buildReportTitle(dateStart, dateEnd)}`,
    `Generated: ${new Date().toISOString()}`,
    "",
    line(["Metric", "Count"]),
    line(["Total Posts", String(filtered.length)]),
    line(["Published", String(published.length)]),
    line(["Scheduled", String(scheduled.length)]),
    line(["Failed", String(failed.length)]),
    "",
    line(["ID", "Status", "Platforms", "Created At", "Published At"]),
  ].join("\n")
  const rows = filtered.map(p =>
    line([p.id, p.status, (p.platforms || []).join(" | "), p.created_at, p.published_at || ""])
  ).join("\n")
  const blob = new Blob([header + "\n" + rows], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `linxar-report-${Date.now()}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
