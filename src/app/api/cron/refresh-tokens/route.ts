import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

// Refresh tokens expiring within the next 7 days
const REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

interface RefreshResult {
  profileId: string
  platform: string
  profileName: string
  status: "success" | "error" | "skipped"
  message?: string
}

interface ProfileRow {
  id: string
  platform: string
  profile_id: string
  profile_name: string
  access_token: string
  refresh_token: string | null
  expires_at: string | null
}

type EnrichedResult = RefreshResult & {
  accessToken?: string
  refreshToken?: string | null
  expiresAt?: string
}

export async function GET(req: NextRequest) {
  // Protect cron in production — set CRON_SECRET in Vercel env vars
  if (process.env.NODE_ENV === "production") {
    const authHeader = req.headers.get("Authorization")
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const supabase = await createClient()
  const results: RefreshResult[] = []

  try {
    // Step 1: Fetch profiles with tokens expiring within the refresh window
    const expiresAtThreshold = new Date(Date.now() + REFRESH_WINDOW_MS).toISOString()

    const { data: profiles, error: fetchError } = await supabase
      .from("social_profiles")
      .select("id, platform, profile_id, profile_name, access_token, refresh_token, expires_at")
      .not("access_token", "is", null)
      .lte("expires_at", expiresAtThreshold)

    if (fetchError) {
      console.error("[refresh-tokens] Error fetching profiles:", fetchError)
      return NextResponse.json(
        { error: "Failed to fetch profiles", details: fetchError },
        { status: 500 }
      )
    }

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({
        message: "No tokens need refreshing.",
        results: [],
        summary: { refreshed: 0, failed: 0, skipped: 0 }
      })
    }

    console.log(`[refresh-tokens] Found ${profiles.length} profile(s) needing token refresh`)

    // Step 2: Refresh each profile's token
    for (const profile of profiles) {
      const result = await refreshProfileToken(profile)
      results.push(result)

      if (result.status === "success") {
        const enriched = result as EnrichedResult
        await supabase
          .from("social_profiles")
          .update({
            access_token: enriched.accessToken,
            refresh_token: enriched.refreshToken ?? profile.refresh_token,
            expires_at: enriched.expiresAt,
            last_token_refresh: new Date().toISOString(),
          })
          .eq("id", profile.id)

        console.log(`[refresh-tokens] Refreshed ${result.platform} token for ${result.profileName}`)
      } else if (result.status === "error") {
        console.error(
          `[refresh-tokens] Failed to refresh ${result.platform} token for ${result.profileName}: ${result.message}`
        )
      }
    }

    const refreshed = results.filter(r => r.status === "success").length
    const failed = results.filter(r => r.status === "error").length
    const skipped = results.filter(r => r.status === "skipped").length

    return NextResponse.json({
      success: true,
      summary: { refreshed, failed, skipped },
      results,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error"
    console.error("[refresh-tokens] Error:", error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function refreshProfileToken(profile: ProfileRow): Promise<EnrichedResult> {
  switch (profile.platform) {
    case "linkedin":
      return refreshLinkedInToken(profile)
    case "x":
      return refreshXToken(profile)
    case "facebook":
      return refreshFacebookToken(profile)
    default:
      return {
        profileId: profile.id,
        platform: profile.platform,
        profileName: profile.profile_name,
        status: "skipped",
        message: `Unknown platform: ${profile.platform}`,
      }
  }
}

async function refreshLinkedInToken(profile: ProfileRow): Promise<EnrichedResult> {
  const clientId = process.env.LINKEDIN_CLIENT_ID!
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET!
  const redirectUri = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/linkedin/callback`
    : "http://localhost:3000/api/auth/linkedin/callback"

  if (!profile.refresh_token) {
    return {
      profileId: profile.id,
      platform: "linkedin",
      profileName: profile.profile_name,
      status: "error",
      message: "No refresh_token available",
    }
  }

  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: profile.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    return {
      profileId: profile.id,
      platform: "linkedin",
      profileName: profile.profile_name,
      status: "error",
      message: data.error_description || data.error || `HTTP ${res.status}`,
    }
  }

  const { access_token, refresh_token, expires_in } = data
  const expiresAt = new Date(Date.now() + (expires_in || 5184000) * 1000).toISOString()

  return {
    profileId: profile.id,
    platform: "linkedin",
    profileName: profile.profile_name,
    status: "success",
    accessToken: access_token,
    refreshToken: refresh_token || profile.refresh_token,
    expiresAt,
    message: `Token refreshed, expires in ${Math.round((expires_in || 5184000) / 86400)} days`,
  }
}

async function refreshXToken(profile: ProfileRow): Promise<EnrichedResult> {
  const clientId = process.env.X_CLIENT_ID!
  const clientSecret = process.env.X_CLIENT_SECRET!
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")

  if (!profile.refresh_token) {
    return {
      profileId: profile.id,
      platform: "x",
      profileName: profile.profile_name,
      status: "error",
      message: "No refresh_token available",
    }
  }

  const res = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: profile.refresh_token,
    }),
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    return {
      profileId: profile.id,
      platform: "x",
      profileName: profile.profile_name,
      status: "error",
      message: data.error_description || data.error || `HTTP ${res.status}`,
    }
  }

  const { access_token, refresh_token, expires_in } = data
  const expiresAt = new Date(Date.now() + (expires_in || 7200) * 1000).toISOString()

  return {
    profileId: profile.id,
    platform: "x",
    profileName: profile.profile_name,
    status: "success",
    accessToken: access_token,
    refreshToken: refresh_token,
    expiresAt,
    message: `Token refreshed, expires in ${Math.round((expires_in || 7200) / 3600)} hours`,
  }
}

async function refreshFacebookToken(profile: ProfileRow): Promise<EnrichedResult> {
  const clientId = process.env.FACEBOOK_CLIENT_ID!
  const clientSecret = process.env.FACEBOOK_CLIENT_SECRET!

  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: clientId,
    client_secret: clientSecret,
    fb_exchange_token: profile.access_token,
  })

  const res = await fetch(
    `https://graph.facebook.com/v19.0/oauth/access_token?${params.toString()}`
  )

  const data = await res.json().catch(() => ({}))

  if (!res.ok || data.error) {
    return {
      profileId: profile.id,
      platform: "facebook",
      profileName: profile.profile_name,
      status: "error",
      message: data.error?.message || data.error_description || `HTTP ${res.status}`,
    }
  }

  const { access_token, expires_in } = data
  const expiresAt = new Date(Date.now() + (expires_in || 5184000) * 1000).toISOString()

  return {
    profileId: profile.id,
    platform: "facebook",
    profileName: profile.profile_name,
    status: "success",
    accessToken: access_token,
    expiresAt,
    message: `Token refreshed, expires in ${Math.round((expires_in || 5184000) / 86400)} days`,
  }
}
