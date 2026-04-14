import { AlertCircle, CheckCircle2, Plug } from "lucide-react"
import { SmartQueueSection } from "@/components/settings/smart-queue-section"
import { FaLinkedin, FaXTwitter, FaInstagram, FaFacebook } from "react-icons/fa6"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: profiles } = await supabase
    .from("social_profiles")
    .select("platform, profile_name, updated_at")
    .eq("user_id", user.id)

  const isLinkedInConnected = profiles?.some(p => p.platform === "linkedin")
  const linkedInProfile    = profiles?.find(p => p.platform === "linkedin")
  const isXConnected       = profiles?.some(p => p.platform === "x")
  const xProfile           = profiles?.find(p => p.platform === "x")
  const isFacebookConnected = profiles?.some(p => p.platform === "facebook")
  const facebookProfile    = profiles?.find(p => p.platform === "facebook")

  const platforms = [
    {
      id: "linkedin",
      label: "LinkedIn",
      description: "Post updates and articles to your LinkedIn personal profile or company page.",
      icon: <FaLinkedin className="w-5 h-5 text-[#0A66C2]" />,
      accentBg: "rgba(10,102,194,0.1)",
      accentColor: "#0A66C2",
      isConnected: isLinkedInConnected,
      profileName: isLinkedInConnected ? linkedInProfile?.profile_name : null,
      action: "/api/auth/linkedin",
      reconnectLabel: "Reconnect LinkedIn",
      connectLabel: "Connect LinkedIn",
    },
    {
      id: "x",
      label: "X (Twitter)",
      description: "Schedule tweets, threads, and engage with your X audience programmatically.",
      icon: <FaXTwitter className="w-5 h-5 text-foreground" />,
      accentBg: "rgba(15,20,25,0.1)",
      accentColor: "var(--foreground)",
      isConnected: isXConnected,
      profileName: isXConnected ? `@${xProfile?.profile_name}` : null,
      action: "/api/auth/x",
      reconnectLabel: "Reconnect X",
      connectLabel: "Connect X",
    },
    {
      id: "facebook",
      label: "Meta (Facebook & Instagram)",
      description: "Publish reels, posts, and stories to your Business Instagram and Facebook Pages.",
      icon: (
        <div className="flex -space-x-1">
          <div className="bg-[#1877F2] text-white p-1 rounded-full z-10 ring-2 ring-[var(--nm-bg)]">
            <FaFacebook className="w-3 h-3" />
          </div>
          <div className="bg-gradient-to-tr from-yellow-400 via-rose-500 to-purple-600 text-white p-1 rounded-full z-0 ring-2 ring-[var(--nm-bg)]">
            <FaInstagram className="w-3 h-3" />
          </div>
        </div>
      ),
      accentBg: "rgba(24,119,242,0.1)",
      accentColor: "#1877F2",
      isConnected: isFacebookConnected,
      profileName: isFacebookConnected ? facebookProfile?.profile_name : null,
      action: "/api/auth/facebook",
      reconnectLabel: "Reconnect Meta",
      connectLabel: "Connect Meta",
    },
  ]

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-4xl mx-auto w-full">

      {/* Page header */}
      <div className="mb-10">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground mb-1">
          Integrations
        </h1>
        <p className="text-muted-foreground text-sm">
          Connect your social media profiles to start publishing.
        </p>
      </div>

      <div className="flex flex-col gap-5">
        <SmartQueueSection />

        {platforms.map(p => (
          <div
            key={p.id}
            className="rounded-2xl bg-[var(--nm-bg)] overflow-hidden"
            style={{ boxShadow: "var(--nm-raised)" }}
          >
            {/* Card header */}
            <div className="px-6 pt-6 pb-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex items-start gap-4">
                {/* Icon badge */}
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-[var(--nm-bg)]"
                  style={{ boxShadow: "var(--nm-inset-sm)", background: p.accentBg }}
                >
                  {p.icon}
                </div>

                <div>
                  <h2 className="font-display text-base font-semibold text-foreground mb-1">
                    {p.label}
                  </h2>
                  <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
                    {p.description}
                  </p>
                </div>
              </div>

              {/* Status badge */}
              <div
                className="shrink-0 self-start flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[var(--nm-bg)]"
                style={{
                  boxShadow: "var(--nm-inset-sm)",
                  color: p.isConnected ? "#7BA4D0" : "var(--muted-foreground)",
                }}
              >
                {p.isConnected
                  ? <CheckCircle2 className="w-3.5 h-3.5" />
                  : <AlertCircle className="w-3.5 h-3.5" />}
                {p.isConnected ? "Connected" : "Not Connected"}
              </div>
            </div>

            {/* Divider */}
            <div
              className="mx-6 h-px"
              style={{ background: "linear-gradient(to right, transparent, rgba(46,94,153,0.2), transparent)" }}
            />

            {/* Card footer */}
            <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-foreground mb-0.5">Connection Status</p>
                <p className="text-xs text-muted-foreground">
                  {p.isConnected
                    ? <span style={{ color: "#7BA4D0" }} className="font-medium">Linked as {p.profileName}</span>
                    : "No profile currently linked to this app."}
                </p>
              </div>

              <form action={p.action} method="GET">
                <button
                  type="submit"
                  className="h-9 px-5 rounded-xl text-sm font-semibold flex items-center gap-2 bg-[var(--nm-bg)] text-foreground transition-all hover:text-[#2E5E99]"
                  style={{ boxShadow: "var(--nm-raised-sm)" }}
                >
                  <Plug className="w-3.5 h-3.5 text-[#2E5E99]" />
                  {p.isConnected ? p.reconnectLabel : p.connectLabel}
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
