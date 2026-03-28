import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const redirectUri = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/linkedin/callback`
    : "http://localhost:3000/api/auth/linkedin/callback";

  if (!clientId) {
    return NextResponse.json({ error: "Missing LINKEDIN_CLIENT_ID in environment" }, { status: 500 });
  }

  // LinkedIn OIDC scopes for grabbing user identity + social posting capability
  const scope = "openid profile email w_member_social";
  const state = Math.random().toString(36).substring(7);

  const authUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
  authUrl.searchParams.append("response_type", "code");
  authUrl.searchParams.append("client_id", clientId);
  authUrl.searchParams.append("redirect_uri", redirectUri);
  authUrl.searchParams.append("state", state);
  authUrl.searchParams.append("scope", scope);

  return NextResponse.redirect(authUrl.toString());
}
