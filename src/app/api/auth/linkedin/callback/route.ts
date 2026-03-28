import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/settings?error=linkedin_auth_failed", req.url));
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID!;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET!;
  const redirectUri = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/linkedin/callback`
    : "http://localhost:3000/api/auth/linkedin/callback";

  try {
    // 1. Exchange code for access token
    const tokenResponse = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) throw new Error(tokenData.error_description || "Token exchange failed");

    const { access_token, refresh_token, expires_in } = tokenData;

    // 2. Fetch user profile from LinkedIn OIDC endpoint
    const profileResponse = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const profileData = await profileResponse.json();
    if (!profileResponse.ok) throw new Error("Failed to fetch LinkedIn profile");

    // 3. Store in Supabase assigned to the current user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL("/login?next=/settings", req.url));
    }

    const { error: dbError } = await supabase.from("social_profiles").upsert({
      user_id: user.id,
      platform: "linkedin",
      profile_id: profileData.sub,
      profile_name: profileData.name || "LinkedIn User",
      avatar_url: profileData.picture || null,
      access_token: access_token,
      refresh_token: refresh_token || null,
      expires_at: new Date(Date.now() + (expires_in || 5184000) * 1000).toISOString(),
    }, {
      onConflict: 'platform,profile_id'
    });

    if (dbError) throw dbError;

    return NextResponse.redirect(new URL("/settings?success=linkedin_connected", req.url));
  } catch (err) {
    console.error("LinkedIn OAuth Error:", err);
    return NextResponse.redirect(new URL("/settings?error=linkedin_connection_failed", req.url));
  }
}
