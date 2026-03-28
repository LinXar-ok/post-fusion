import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  // Securely retrieve the PKCE verifier stored during the initialization handshake
  const codeVerifier = req.cookies.get('x_code_verifier')?.value;

  if (error || !code || !codeVerifier) {
    return NextResponse.redirect(new URL("/settings?error=x_auth_failed", req.url));
  }

  const clientId = process.env.X_CLIENT_ID!;
  const clientSecret = process.env.X_CLIENT_SECRET!;
  const redirectUri = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/x/callback`
    : "http://localhost:3000/api/auth/x/callback";

  try {
    // 1. Exchange code for access token using PKCE Basic Auth
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const tokenResponse = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${basicAuth}`
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: codeVerifier,
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) throw new Error(tokenData.error_description || "Token exchange failed");

    const { access_token, refresh_token, expires_in } = tokenData;

    // 2. Fetch user profile from X API v2
    const profileResponse = await fetch("https://api.twitter.com/2/users/me?user.fields=profile_image_url", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const profileData = await profileResponse.json();
    if (!profileResponse.ok || !profileData.data) throw new Error("Failed to fetch X profile");

    const userProfile = profileData.data;

    // 3. Store in Supabase assigned to the current user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL("/login?next=/settings", req.url));
    }

    const { error: dbError } = await supabase.from("social_profiles").upsert({
      user_id: user.id,
      platform: "x",
      profile_id: userProfile.id,
      profile_name: userProfile.username,
      avatar_url: userProfile.profile_image_url || null,
      access_token: access_token,
      refresh_token: refresh_token || null,
      expires_at: new Date(Date.now() + (expires_in || 7200) * 1000).toISOString(),
    }, {
      onConflict: 'platform,profile_id'
    });

    if (dbError) throw dbError;

    const response = NextResponse.redirect(new URL("/settings?success=x_connected", req.url));
    response.cookies.delete('x_code_verifier'); // Clean up the token handshake wrapper
    return response;

  } catch (err) {
    console.error("X OAuth Error:", err);
    const response = NextResponse.redirect(new URL("/settings?error=x_connection_failed", req.url));
    response.cookies.delete('x_code_verifier');
    return response;
  }
}
