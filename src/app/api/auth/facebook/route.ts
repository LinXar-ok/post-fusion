import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.FACEBOOK_CLIENT_ID;
  const redirectUri = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/facebook/callback`
    : "http://localhost:3000/api/auth/facebook/callback";

  if (!clientId) {
    return NextResponse.json({ error: "Missing FACEBOOK_CLIENT_ID in environment" }, { status: 500 });
  }

  // Requesting permissions to manage user's pages and post to connected Instagram Professional accounts
  const scope = "email,pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish";
  const state = Math.random().toString(36).substring(7);

  const authUrl = new URL("https://www.facebook.com/v19.0/dialog/oauth");
  authUrl.searchParams.append("client_id", clientId);
  authUrl.searchParams.append("redirect_uri", redirectUri);
  authUrl.searchParams.append("state", state);
  authUrl.searchParams.append("scope", scope);

  return NextResponse.redirect(authUrl.toString());
}
