import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, CheckCircle2 } from "lucide-react"
import { FaLinkedin, FaXTwitter, FaInstagram } from "react-icons/fa6"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Fetch connected profiles
  const { data: profiles } = await supabase
    .from("social_profiles")
    .select("platform, profile_name, updated_at")
    .eq("user_id", user.id)

  const isLinkedInConnected = profiles?.some(p => p.platform === "linkedin")
  const linkedInProfile = profiles?.find(p => p.platform === "linkedin")

  const isXConnected = profiles?.some(p => p.platform === "x")
  const xProfile = profiles?.find(p => p.platform === "x")

  const isFacebookConnected = profiles?.some(p => p.platform === "facebook")
  const facebookProfile = profiles?.find(p => p.platform === "facebook")

  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-5xl mx-auto w-full relative z-10">
      <div className="mb-10">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-2">
          Integrations
        </h1>
        <p className="text-slate-500 text-lg">Connect your social media profiles to start publishing.</p>
      </div>

      <div className="grid gap-6">
        {/* LinkedIn Integration Card */}
        <Card className="bg-white border-slate-200 shadow-sm backdrop-blur-xl overflow-hidden hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-start justify-between pb-2 bg-slate-50 border-b border-slate-100">
            <div>
              <CardTitle className="text-xl flex items-center gap-2 text-slate-900">
                <FaLinkedin className="w-5 h-5 text-[#0A66C2]" />
                LinkedIn
              </CardTitle>
              <CardDescription className="mt-1.5 text-sm text-slate-500 max-w-md">
                Post updates and articles directly to your LinkedIn personal profile or company page.
              </CardDescription>
            </div>
            {/* Status badge */}
            {isLinkedInConnected ? (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold shadow-xs">
                <CheckCircle2 className="w-3.5 h-3.5" /> Connected
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-white text-slate-500 border border-slate-200 rounded-full text-xs font-semibold shadow-xs">
                <AlertCircle className="w-3.5 h-3.5" /> Not Connected
              </div>
            )}
          </CardHeader>
          <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-800">Connection Status</p>
              <p className="text-sm text-slate-500">
                {isLinkedInConnected ? <span className="text-emerald-600 font-medium">Linked as {linkedInProfile?.profile_name}</span> : "No profile currently linked to this app."}
              </p>
            </div>
            <form action="/api/auth/linkedin" method="GET">
              <Button
                type="submit"
                variant={isLinkedInConnected ? "outline" : "default"}
                className={isLinkedInConnected ? "border-slate-200 text-slate-700 bg-white hover:bg-slate-50 hover:text-[#0A66C2] font-semibold" : "bg-[#0A66C2] hover:bg-[#004182] text-white shadow-sm transition-all w-full sm:w-auto font-medium"}
              >
                {isLinkedInConnected ? "Reconnect LinkedIn" : "Connect LinkedIn"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* X (Twitter) Integration Card */}
        <Card className="bg-white border-slate-200 shadow-sm backdrop-blur-xl overflow-hidden hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-start justify-between pb-2 bg-slate-50 border-b border-slate-100">
            <div>
              <CardTitle className="text-xl flex items-center gap-2 text-slate-900">
                <FaXTwitter className="w-5 h-5 text-slate-900" />
                X (Twitter)
              </CardTitle>
              <CardDescription className="mt-1.5 text-sm text-slate-500 max-w-md">
                Schedule tweets, threads, and engage with your X audience programmatically.
              </CardDescription>
            </div>
            {isXConnected ? (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold shadow-xs">
                <CheckCircle2 className="w-3.5 h-3.5" /> Connected
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-white text-slate-500 border border-slate-200 rounded-full text-xs font-semibold shadow-xs">
                <AlertCircle className="w-3.5 h-3.5" /> Not Connected
              </div>
            )}
          </CardHeader>
          <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-800">Connection Status</p>
              <p className="text-sm text-slate-500">
                {isXConnected ? <span className="text-emerald-600 font-medium">Linked as @{xProfile?.profile_name}</span> : "No profile currently linked to this app."}
              </p>
            </div>
            <form action="/api/auth/x" method="GET">
              <Button
                type="submit"
                variant={isXConnected ? "outline" : "default"}
                className={isXConnected ? "border-slate-200 text-slate-700 bg-white hover:bg-slate-50 hover:text-slate-900 font-semibold" : "bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition-all w-full sm:w-auto font-medium"}
              >
                {isXConnected ? "Reconnect X Network" : "Connect X Network"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Meta (Facebook & Instagram) Integration Card */}
        <Card className="bg-white border-slate-200 shadow-sm backdrop-blur-xl overflow-hidden hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-start justify-between pb-2 bg-slate-50 border-b border-slate-100">
            <div>
              <CardTitle className="text-xl flex items-center gap-2 text-slate-900">
                <div className="flex -space-x-1">
                  <div className="bg-[#1877F2] text-white p-1 rounded-full z-10 ring-2 ring-white">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  </div>
                  <div className="bg-gradient-to-tr from-yellow-400 via-rose-500 to-purple-600 text-white p-1 rounded-full z-0 ring-2 ring-white">
                    <FaInstagram className="w-3 h-3" />
                  </div>
                </div>
                Meta (Facebook & Instagram)
              </CardTitle>
              <CardDescription className="mt-1.5 text-sm text-slate-500 max-w-md">
                Publish reels, posts, and stories to your Business Instagram and Facebook Pages.
              </CardDescription>
            </div>
            {isFacebookConnected ? (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold shadow-xs">
                <CheckCircle2 className="w-3.5 h-3.5" /> Connected
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-white text-slate-500 border border-slate-200 rounded-full text-xs font-semibold shadow-xs">
                <AlertCircle className="w-3.5 h-3.5" /> Not Connected
              </div>
            )}
          </CardHeader>
          <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-800">Connection Status</p>
              <p className="text-sm text-slate-500">
                {isFacebookConnected ? <span className="text-emerald-600 font-medium">Linked as {facebookProfile?.profile_name}</span> : "No profile currently linked to this app."}
              </p>
            </div>
            <form action="/api/auth/facebook" method="GET">
              <Button
                type="submit"
                variant={isFacebookConnected ? "outline" : "default"}
                className={isFacebookConnected ? "border-slate-200 text-slate-700 bg-white hover:bg-slate-50 hover:text-[#1877F2] font-semibold" : "bg-[#1877F2] hover:bg-[#0c59bb] text-white shadow-sm transition-all w-full sm:w-auto font-medium"}
              >
                {isFacebookConnected ? "Reconnect Meta" : "Connect Meta"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
