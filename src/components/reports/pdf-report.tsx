import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer"

const teal = "#128C7E"
const navy = "#0B1020"
const lightGray = "#f1f5f9"
const midGray = "#64748b"

const styles = StyleSheet.create({
  page: { padding: 30, fontFamily: "Helvetica" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24, borderBottomWidth: 2, borderBottomColor: teal, paddingBottom: 12 },
  title: { fontSize: 20, fontWeight: "bold", color: navy },
  subtitle: { fontSize: 10, color: midGray, marginTop: 2 },
  period: { fontSize: 11, color: teal },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  statCard: { flex: 1, padding: 12, backgroundColor: lightGray, borderRadius: 4 },
  statLabel: { fontSize: 8, color: midGray, textTransform: "uppercase", marginBottom: 4 },
  statValue: { fontSize: 18, fontWeight: "bold", color: navy },
  sectionTitle: { fontSize: 14, fontWeight: "bold", color: navy, marginBottom: 10, marginTop: 8 },
  barRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  barLabel: { fontSize: 10, color: navy, width: 80 },
  barOuter: { flex: 1, height: 14, backgroundColor: "#e2e8f0", borderRadius: 2 },
  barInner: { height: 14, backgroundColor: teal, borderRadius: 2 },
  table: { marginTop: 16, borderTopWidth: 1, borderTopColor: "#e2e8f0" },
  tableHeader: { flexDirection: "row", backgroundColor: teal, paddingVertical: 6, paddingHorizontal: 8, color: "white" },
  th: { fontSize: 9, fontWeight: "bold", color: "white", flex: 1 },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e2e8f0", paddingVertical: 6, paddingHorizontal: 8 },
  td: { fontSize: 8, color: navy, flex: 1 },
  footer: { position: "absolute", bottom: 30, left: 30, right: 30, borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 10, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 8, color: midGray },
})

type Post = {
  id: string
  status: string
  content: string
  platforms: string[]
  created_at: string
  published_at: string | null
}

type Props = {
  posts: Post[]
  dateRange: string
  stats: { total: number; published: number; scheduled: number; failed: number }
  platformData: { platform: string; posts: number }[]
}

const barColors = ["#128C7E", "#0A66C2", "#1877F2", "#FF9500"]

export const PDFReport = ({ posts, dateRange, stats, platformData }: Props) => {
  const maxPlatform = Math.max(...platformData.map(p => p.posts), 1)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>LinXar Ops: Social</Text>
            <Text style={styles.subtitle}>Analytics Report</Text>
          </View>
          <Text style={styles.period}>{dateRange}</Text>
        </View>

        <View style={styles.statsRow}>
          {[
            { label: "Total", value: stats.total },
            { label: "Published", value: stats.published },
            { label: "Scheduled", value: stats.scheduled },
            { label: "Failed", value: stats.failed },
          ].map((s, i) => (
            <View key={i} style={styles.statCard}>
              <Text style={styles.statLabel}>{s.label}</Text>
              <Text style={styles.statValue}>{s.value}</Text>
            </View>
          ))}
        </View>

        {/* Platform Breakdown */}
        <Text style={styles.sectionTitle}>Posts by Platform</Text>
        {platformData.map((p, i) => (
          <View key={i} style={styles.barRow}>
            <Text style={styles.barLabel}>{p.platform}</Text>
            <View style={styles.barOuter}>
              <View style={{ width: `${(p.posts / maxPlatform) * 100}%`, height: 14, backgroundColor: barColors[i % barColors.length], borderRadius: 2 }} />
            </View>
          </View>
        ))}

        {/* Posts Table */}
        <Text style={styles.sectionTitle}>Recent Posts</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.th}>Status</Text>
            <Text style={styles.th}>Platforms</Text>
            <Text style={styles.th}>Content</Text>
            <Text style={styles.th}>Date</Text>
          </View>
          {posts.slice(0, 20).map((p, i) => {
            const statusColor = p.status === "published" ? teal : p.status === "scheduled" ? "#f59e0b" : "#ef4444"
            return (
              <View key={i} style={styles.tableRow} wrap={false}>
                <Text style={[styles.td, { color: statusColor }]}>{p.status}</Text>
                <Text style={styles.td}>{(p.platforms || []).join(", ")}</Text>
                <Text style={styles.td}>{(p.content || "").substring(0, 50)}...</Text>
                <Text style={styles.td}>{p.published_at ? new Date(p.published_at).toLocaleDateString() : new Date(p.created_at).toLocaleDateString()}</Text>
              </View>
            )
          })}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Generated by LinXar Ops: Social</Text>
          <Text style={styles.footerText}>{new Date().toLocaleDateString()}</Text>
        </View>
      </Page>
    </Document>
  )
}
