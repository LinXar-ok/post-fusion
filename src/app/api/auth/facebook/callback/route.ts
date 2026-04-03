import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const code = searchParams.get("code")
  const error = searchParams.get("error")

  if (error || !code) {
    return NextResponse.redirect(new URL("/settings?error=facebook_auth_failed", req.url))
  }

  const clientId = process.env.FACEBOOK_CLIENT_ID!
  const clientSecret = process.env.FACEBOOK_CLIENT_SECRET!
  const redirectUri = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/facebook/callback`
    : "http://localhost:3000/api/auth/facebook/callback"

  try {
    // 1. Exchange code for a short-lived user access token
    const tokenResponse = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${clientSecret}&code=${code}`
    )
    const tokenData = await tokenResponse.json()
    if (!tokenResponse.ok) throw new Error(tokenData.error?.message || "Token exchange failed")

    const shortLivedToken = tokenData.access_token

    // 2. Exchange short-lived token for a long-lived user token (~60 days)
    const longLivedResponse = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${clientId}&client_secret=${clientSecret}&fb_exchange_token=${shortLivedToken}`
    )
    const longLivedData = await longLivedResponse.json()
    const access_token = longLivedData.access_token || shortLivedToken
    const expires_in = longLivedData.expires_in || 5184000 // 60 days default

    // 3. Fetch user profile
    const profileResponse = await fetch(`https://graph.facebook.com/me?fields=id,name,picture&access_token=${access_token}`)
    const profileData = await profileResponse.json()
    if (!profileResponse.ok) throw new Error("Failed to fetch Facebook profile")

    // 4. Optionally fetch managed pages to get a page access token for publishing
    //    This is stored in metadata for future page publishing use
    const pagesResponse = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${access_token}`)
    const pagesData = await pagesResponse.json()
    const firstPage = pagesData.data?.[0] // Use first managed page if available

    // 5. Store in Supabase
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.redirect(new URL("/login?next=/settings", req.url))

    const { error: dbError } = await supabase.from("social_profiles").upsert({
      user_id: user.id,
      platform: "facebook",
      profile_id: profileData.id,
      profile_name: firstPage?.name || profileData.name || "Facebook User",
      avatar_url: profileData.picture?.data?.url || null,
      // Use page access token if a page is available; otherwise use the user token
      access_token: firstPage?.access_token || access_token,
      refresh_token: null,
      expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
    }, { onConflict: "platform,profile_id" })

    if (dbError) throw dbError

    return NextResponse.redirect(new URL("/settings?success=facebook_connected", req.url))
  } catch (err) {
    console.error("Facebook OAuth Error:", err)
    return NextResponse.redirect(new URL("/settings?error=facebook_connection_failed", req.url))
  }
}
