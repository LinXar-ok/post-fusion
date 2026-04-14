import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden relative" style={{ background: "var(--nm-bg)" }}>
        <Header />
        <main className="flex-1 overflow-auto relative z-0">
          {children}
        </main>
      </div>
    </div>
  )
}
