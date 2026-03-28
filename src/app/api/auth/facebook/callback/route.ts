import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/settings?error=facebook_auth_failed", req.url));
  }

  const clientId = process.env.FACEBOOK_CLIENT_ID!;
  const clientSecret = process.env.FACEBOOK_CLIENT_SECRET!;
  const redirectUri = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/facebook/callback`
    : "http://localhost:3000/api/auth/facebook/callback";

  try {
    // 1. Exchange code for user access token
    const tokenResponse = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${clientSecret}&code=${code}`);

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) throw new Error(tokenData.error?.message || "Token exchange failed");

    const { access_token, expires_in } = tokenData;

    // 2. Fetch user profile from Facebook
    const profileResponse = await fetch(`https://graph.facebook.com/me?fields=id,name,picture&access_token=${access_token}`);

    const profileData = await profileResponse.json();
    if (!profileResponse.ok) throw new Error("Failed to fetch Facebook profile");

    // 3. Store the user access token in Supabase
    // Note: In a full pipeline, we would exchange this for a long-lived page token to publish
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL("/login?next=/settings", req.url));
    }

    const { error: dbError } = await supabase.from("social_profiles").upsert({
      user_id: user.id,
      platform: "facebook", // Managing both Facebook Pages and Instagram via Meta Graph API
      profile_id: profileData.id,
      profile_name: profileData.name || "Facebook User",
      avatar_url: profileData.picture?.data?.url || null,
      access_token: access_token,
      expires_at: new Date(Date.now() + (expires_in || 5184000) * 1000).toISOString(),
    }, {
      onConflict: 'platform,profile_id'
    });

    if (dbError) throw dbError;

    return NextResponse.redirect(new URL("/settings?success=facebook_connected", req.url));
  } catch (err) {
    console.error("Facebook OAuth Error:", err);
    return NextResponse.redirect(new URL("/settings?error=facebook_connection_failed", req.url));
  }
}
