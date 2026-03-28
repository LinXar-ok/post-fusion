import { NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";

export async function GET() {
  const clientId = process.env.X_CLIENT_ID;
  const redirectUri = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/x/callback`
    : "http://localhost:3000/api/auth/x/callback";

  if (!clientId) {
    return NextResponse.json({ error: "Missing X_CLIENT_ID in environment" }, { status: 500 });
  }

  // Generate PKCE code verifier and challenge required by the X API v2
  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
  const state = Math.random().toString(36).substring(7);

  const authUrl = new URL("https://twitter.com/i/oauth2/authorize");
  authUrl.searchParams.append("response_type", "code");
  authUrl.searchParams.append("client_id", clientId);
  authUrl.searchParams.append("redirect_uri", redirectUri);
  authUrl.searchParams.append("scope", "tweet.read tweet.write users.read offline.access");
  authUrl.searchParams.append("state", state);
  authUrl.searchParams.append("code_challenge", codeChallenge);
  authUrl.searchParams.append("code_challenge_method", "S256");

  const response = NextResponse.redirect(authUrl.toString());

  // Set the code_verifier cookie for the callback route to parse
  response.cookies.set('x_code_verifier', codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 10, // 10 minutes
    path: '/',
  });

  return response;
}
