export type ParsedRow = {
  content: string
  hashtags: string[]
  platforms: string[]
  scheduled_datetime: string
  error?: string
}

const validPlatforms = new Set(["linkedin", "x", "facebook", "instagram"])

export function parseCSV(csvText: string): ParsedRow[] {
  const lines = csvText.trim().split("\n")
  if (lines.length < 2) return []

  const header = lines[0].split(",").map(h => h.trim().toLowerCase())
  const contentIdx = header.indexOf("content")
  const hashtagIdx = header.indexOf("hashtags")
  const platformIdx = header.indexOf("platforms")
  const datetimeIdx = header.indexOf("scheduled_datetime")

  if (contentIdx === -1) return []

  return lines.slice(1).map(line => {
    // Handle CSV splitting by commas within quotes
    const values: string[] = []
    let current = ""
    let inQuote = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { inQuote = !inQuote }
      else if (ch === "," && !inQuote) { values.push(current.trim()); current = "" }
      else { current += ch }
    }
    values.push(current.trim())

    const content = values[contentIdx] || ""
    const hashtags = hashtagIdx >= 0 ? (values[hashtagIdx] || "").split(";").map(s => s.trim().replace(/^#/, "")).filter(Boolean) : []
    const platforms = platformIdx >= 0 ? (values[platformIdx] || "").split(";").map(s => s.trim().toLowerCase()).filter(Boolean) : []
    const datetime = datetimeIdx >= 0 ? values[datetimeIdx]?.trim() || "" : ""

    // Validation
    let error: string | undefined
    if (!content) error = "Missing content"
    else if (!datetime) error = "Missing scheduled_datetime"
    else if (isNaN(Date.parse(datetime))) error = "Invalid datetime format"
    else if (new Date(datetime) <= new Date()) error = "Date is in the past"
    else {
      const invalidPlatforms = platforms.filter(p => !validPlatforms.has(p))
      if (invalidPlatforms.length > 0) error = `Invalid platform: ${invalidPlatforms.join(", ")}`
    }

    return {
      content: content.replace(/^"|"$/g, "").replace(/""/g, '"'),
      hashtags,
      platforms,
      scheduled_datetime: datetime,
      error,
    }
  })
}
