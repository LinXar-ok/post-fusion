# OAuth Token Refresh (Background Cron Job) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an automated background cron job that refreshes OAuth tokens for LinkedIn, X, and Facebook before they expire, preventing publishing failures from stale credentials.

**Architecture:** A new `/api/cron/refresh-tokens` route handler that queries `social_profiles` for tokens nearing expiration, performs the platform-specific OAuth2 token refresh, stores the updated credentials, and logs the results. Triggered by Vercel Cron. Reuses the existing Supabase client, cron security pattern, and OAuth callback flow conventions.

**Tech Stack:** TypeScript (strict), Next.js 16 Route Handlers, Supabase SDK (native), OAuth2 refresh token exchange, Vercel Cron

---

### Background: Current State and Problem

The `social_profiles` table (from `supabase/migrations/20260328000000_init.sql`) already has an `expires_at` column that is set during OAuth connection:
- **LinkedIn:** `expires_at` set to 5,184,000 seconds (60 days). The LinkedIn callback at `src/app/api/auth/linkedin/callback/route.ts:36` receives a `refresh_token` from the token response and stores it.
- **X (Twitter):** `expires_at` set to 7,200 seconds (2 hours). The X callback at `src/app/api/auth/x/callback/route.ts:44` receives `refresh_token` from the PKCE token response and stores it.
- **Facebook:** `expires_at` set to 5,184,000 seconds (60 days). The Facebook callback at `src/app/api/auth/facebook/callback/route.ts` exchanges a short-lived token for a long-lived token. Facebook does not issue a traditional `refresh_token` — instead, you call the same token exchange endpoint with the expired long-lived token to get a fresh one.

**The problem:** Tokens silently expire. When the cron at `/api/cron/process-queue` tries to publish with an expired token, the API returns 401 and the post is marked as failed.

**The solution:** Refresh tokens proactively before they expire, using the existing refresh credentials.

### OAuth Token Refresh Mechanics (Per Platform)

| Platform | Refresh Endpoint | Grant Type | Has Refresh Token? | Notes |
|----------|-----------------|------------|-------------------|-------|
| LinkedIn | `https://www.linkedin.com/oauth/v2/accessToken` | `refresh_token` | Yes | Returns new access_token + refresh_token + expires_in. Must include same client_id/secret/redirect_uri. |
| X (Twitter) | `https://api.twitter.com/2/oauth2/token` | `refresh_token` | Yes | PKCE Basic Auth flow. Returns new access_token + refresh_token + expires_in. |
| Facebook | `https://graph.facebook.com/v19.0/oauth/access_token` | `fb_exchange_token` | No | Pass existing `access_token` as `fb_exchange_token` param to get a fresh long-lived token. |

### Refresh Threshold

Refresh tokens that expire within the next **7 days** (604,800 seconds). This provides ample buffer for retry if the refresh fails.

---

### Task 0: Verify `expires_at` Column Exists (Verification Only)

**Files:**
- Read: `supabase/migrations/20260328000000_init.sql`

The `expires_at TIMESTAMP WITH TIME ZONE` column already exists on the `social_profiles` table from the initial migration. The user's PR mentions adding `token_expires_at`, but the column already exists under the name `expires_at`. No migration needed for this column.

**Step 1: Add `last_token_refresh` column via migration**

Even though `expires_at` exists, we need a new column to track when the last refresh occurred for monitoring.

Create file: `supabase/migrations/20260407000000_add_last_token_refresh.sql`

```sql
-- Add last_token_refresh column to social_profiles for monitoring
ALTER TABLE public.social_profiles
ADD COLUMN IF NOT EXISTS last_token_refresh TIMESTAMP WITH TIME ZONE;

-- Add index for efficient querying of soon-to-expire tokens
CREATE INDEX IF NOT EXISTS idx_social_profiles_expiring
ON public.social_profiles (expires_at)
WHERE expires_at IS NOT NULL;
```

**Step 2: Push migration**

```bash
supabase db push
```

**Step 3: Commit**

```bash
git add supabase/migrations/20260407000000_add_last_token_refresh.sql
git commit -m "feat: add last_token_refresh column and expiring tokens index for OAuth refresh"
```

---

### Task 1: Create Token Refresh Endpoint

**Files:**
- Create: `src/app/api/cron/refresh-tokens/route.ts`

This endpoint will:
1. Verify the cron secret (same pattern as `/api/cron/process-queue`)
2. Query `social_profiles` for rows where `expires_at` is within the next 7 days
3. Refresh each token using platform-specific logic
4. Update the database with new tokens and `last_token_refresh` timestamp
5. Return a JSON summary of results

**Step 1: Create the route handler**

```typescript
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
        summary: { refreshed: 0, failed: 0, skipped: 0 },
      })
    }

    console.log(`[refresh-tokens] Found ${profiles.length} profile(s) needing token refresh`)

    // Step 2: Refresh each profile's token
    for (const profile of profiles) {
      const result = await refreshProfileToken(profile)
      results.push(result)

      if (result.status === "success") {
        await supabase
          .from("social_profiles")
          .update({
            access_token: result.accessToken,
            refresh_token: result.refreshToken ?? profile.refresh_token,
            expires_at: result.expiresAt,
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

    const refreshed = results.filter((r) => r.status === "success").length
    const failed = results.filter((r) => r.status === "error").length
    const skipped = results.filter((r) => r.status === "skipped").length

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

// --- Platform-specific refresh functions ---

interface ProfileRow {
  id: string
  platform: string
  profile_id: string
  profile_name: string
  access_token: string
  refresh_token: string | null
  expires_at: string | null
}

async function refreshProfileToken(profile: ProfileRow): Promise<RefreshResult & { accessToken?: string; refreshToken?: string | null; expiresAt?: string }> {
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

async function refreshLinkedInToken(
  profile: ProfileRow
): Promise<RefreshResult & { accessToken?: string; refreshToken?: string | null; expiresAt?: string }> {
  const clientId = process.env.LINKEDIN_CLIENT_ID!
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET!
  const redirectUri = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/linkedin/callback`
    : "http://localhost:3000/api/auth/linkedin/callback"

  // LinkedIn uses standard refresh_token grant
  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: profile.refresh_token || "",
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
    message: `New token expires in ${expires_in || 60} days`,
  }
}

async function refreshXToken(
  profile: ProfileRow
): Promise<RefreshResult & { accessToken?: string; refreshToken?: string | null; expiresAt?: string }> {
  const clientId = process.env.X_CLIENT_ID!
  const clientSecret = process.env.X_CLIENT_SECRET!
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")

  // X uses PKCE refresh_token grant with Basic Auth
  const res = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: profile.refresh_token || "",
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
    message: `New token expires in ${Math.round((expires_in || 7200) / 3600)} hours`,
  }
}

async function refreshFacebookToken(
  profile: ProfileRow
): Promise<RefreshResult & { accessToken?: string; refreshToken?: string | null; expiresAt?: string }> {
  const clientId = process.env.FACEBOOK_CLIENT_ID!
  const clientSecret = process.env.FACEBOOK_CLIENT_SECRET!

  // Facebook: exchange existing long-lived token for a new long-lived token
  // (same endpoint used during initial OAuth flow)
  const res = await fetch(
    `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${clientId}&client_secret=${clientSecret}&fb_exchange_token=${encodeURIComponent(profile.access_token)}`
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
    message: `New token expires in ${Math.round((expires_in || 5184000) / 86400)} days`,
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/cron/refresh-tokens/route.ts
git commit -m "feat: add OAuth token refresh cron endpoint for LinkedIn, X, and Facebook"
```

---

### Task 2: Register Cron in vercel.json

**Files:**
- Modify: `vercel.json`

**Step 1: Add the refresh-tokens cron to Vercel config**

The existing `vercel.json` has one cron entry for `process-queue`. Add a second entry for the refresh job. Facebook long-lived tokens expire in 60 days, so running once daily is sufficient.

```json
{
  "crons": [
    {
      "path": "/api/cron/process-queue",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/cron/refresh-tokens",
      "schedule": "0 3 * * *"
    }
  ]
}
```

Run at 3:00 AM UTC daily. This is 5 hours before the process-queue cron (8:00 AM), ensuring tokens are fresh before any scheduled posts are processed.

**Step 2: Verify JSON validity**

```bash
node -e "JSON.parse(require('fs').readFileSync('vercel.json', 'utf8')); console.log('Valid JSON')"
```

**Step 3: Commit**

```bash
git add vercel.json
git commit -m "feat: add OAuth token refresh cron to Vercel config (daily at 3 AM UTC)"
```

---

### Task 3: Ensure Environment Variables Are Documented

**Files:**
- Read: `.env.local` or `.env.example` if they exist
- Check: `src/env.ts` or any env validation file

**Step 1: Check for existing env validation**

```bash
# Look for any env validation files
ls src/env* 2>/dev/null || echo "No env validation file found"
```

**Step 2: Document required env vars**

The token refresh endpoint requires these env vars which are already partially set (used by OAuth callbacks):
- `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` — already used in LinkedIn callback
- `X_CLIENT_ID` / `X_CLIENT_SECRET` — already used in X callback
- `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET` — already used in Facebook callback
- `NEXT_PUBLIC_APP_URL` — already used for redirect URIs
- `CRON_SECRET` — already used for protecting cron endpoints

No new env vars are needed. Confirm that all six platform credential env vars are set in the Vercel project dashboard.

**Step 3: Commit (only if an env example file is updated)**

```bash
git add .env.example
git commit -m "docs: document OAuth credentials needed for token refresh cron"
```

---

### Task 4: Add Monitoring via Logging

**Files:**
- Modify: `src/app/api/cron/refresh-tokens/route.ts` (already covered in Task 1)
- Optional: Create `src/lib/cron-logger.ts` if a shared logger is desired

The endpoint already includes:
1. **`console.log`** for each attempt with profile name and platform
2. **`console.error`** for failures with detailed error messages
3. **Structured JSON response** with `summary: { refreshed, failed, skipped }` and per-profile `results` array

**Step 1: Verify logging pattern matches existing conventions**

The existing `/api/cron/process-queue` route uses `console.error` for errors. The new endpoint follows the same pattern, so no additional logging infrastructure is needed. Vercel Functions will capture these logs in the Vercel dashboard.

**If the team wants a shared logger later**, create:

```typescript
// src/lib/cron-logger.ts (deferred — not part of this PR)
export function cronLog(level: "info" | "warn" | "error", job: string, message: string, data?: Record<string, unknown>) {
  const timestamp = new Date().toISOString()
  const logFn = console[level === "error" ? "error" : "log"]
  logFn(`[${timestamp}] [${level.toUpperCase()}] [${job}] ${message}`, data ?? "")
}
```

**Step 2: No-commit verification**

The logging is already in the Task 1 code. No additional files to commit for this task.

---

### Task 5: End-to-End Integration — Verify No Conflicts with Existing Cron

**Files:**
- Read: `src/app/api/cron/process-queue/route.ts`
- Read: `src/lib/publishers.ts`

**Step 1: Verify the process-queue cron will benefit from fresh tokens**

The `process-queue` cron at `src/app/api/cron/process-queue/route.ts` queries `social_profiles` for tokens at publish time (line 35-39). After the refresh cron runs, those profiles will have updated `access_token` values, so the publish calls will succeed with fresh credentials.

No code changes needed in `process-queue` or `publishers.ts` for this integration to work. The two crons share the same `social_profiles` table, so token updates are immediately visible.

**Step 2: Add error handling for expired tokens in publishers (defensive)**

This is a future improvement. For now, if the refresh cron fails for a specific profile and the process-queue cron tries to publish within the 5-hour window, the publish attempt will correctly fail with the platform's error response, which is the existing behavior.

---

### Testing Instructions

**Pre-test setup:**
- `CRON_SECRET` set in `.env.local` for local testing
- At least one OAuth profile connected with a known `access_token` and `refresh_token`
- All platform client IDs/secrets set

**Test 1: Trigger refresh manually (local)**

```bash
# Start dev server
npm run dev

# Trigger the refresh endpoint
curl -H "Authorization: Bearer test-cron-secret" http://localhost:3000/api/cron/refresh-tokens
```

Expected response when no tokens need refreshing:
```json
{
  "message": "No tokens need refreshing.",
  "results": [],
  "summary": { "refreshed": 0, "failed": 0, "skipped": 0 }
}
```

**Test 2: Force a refresh by simulating an expiring token**

```sql
-- Temporarily set a profile's expires_at to tomorrow (within the 7-day window)
UPDATE social_profiles
SET expires_at = NOW() + INTERVAL '1 day'
WHERE platform = 'x'  -- or your connected platform
LIMIT 1;
```

Then re-run the curl from Test 1. Expected:
```json
{
  "success": true,
  "summary": { "refreshed": 1, "failed": 0, "skipped": 0 },
  "results": [{
    "profileId": "...",
    "platform": "x",
    "profileName": "@handle",
    "status": "success",
    "message": "New token expires in 2 hours"
  }]
}
```

Verify in DB:
```sql
SELECT platform, profile_name, expires_at, last_token_refresh
FROM social_profiles
WHERE platform = 'x'
ORDER BY last_token_refresh DESC
LIMIT 1;
```

**Test 3: Test auth protection (no auth header in production mode)**

```bash
NODE_ENV=production curl http://localhost:3000/api/cron/refresh-tokens
```

Expected: `{ "error": "Unauthorized" }` with status 401.

**Test 4: Test all three platforms**

Connect one profile on each platform (LinkedIn, X, Facebook). Manually set all their `expires_at` to tomorrow. Run the cron. Verify:
- LinkedIn: success, new `refresh_token` stored, `expires_at` extended to ~60 days
- X: success, new `refresh_token` stored, `expires_at` extended to ~2 hours
- Facebook: success, `expires_at` extended to ~60 days

**Test 5: Graceful failure for invalid refresh token**

```sql
-- Corrupt a refresh token to simulate revocation
UPDATE social_profiles
SET refresh_token = 'invalid_token_xyz'
WHERE platform = 'x'
LIMIT 1;
```

Run the cron. Expected: `status: "error"` for that profile, other platforms still succeed.

---

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Platform API rate limit on refresh calls | Low | Medium | Only one refresh per profile per 7 days; well within any platform's limits |
| Refresh token revoked by user (deauthorized app) | Low | High | Error is logged, profile is not deleted, will require re-authentication by user |
| Facebook token exchange returns error | Medium | Medium | The `fb_exchange_token` endpoint can fail if the old token is already expired; user must reconnect. Error is logged with details. |
| X refresh token rotation fails | Low | Medium | X rotates refresh tokens. If rotation fails, user must reconnect. Error logged. |
| Double-processing (concurrent cron calls) | Very Low | Medium | Vercel Cron guarantees single execution. No additional locking needed. |
| Migration not pushed | Low | High | CI/CD should run `supabase db push` before deploy. The code tolerates `last_token_refresh` being null (new column allows null). |

---

### Files Summary

| Action | File | Purpose |
|--------|------|---------|
| Create | `supabase/migrations/20260407000000_add_last_token_refresh.sql` | Add `last_token_refresh` column + index |
| Create | `src/app/api/cron/refresh-tokens/route.ts` | Cron endpoint for token refresh |
| Modify | `vercel.json` | Register new cron schedule |

### Commit Plan

1. `feat: add last_token_refresh column and expiring tokens index for OAuth refresh`
2. `feat: add OAuth token refresh cron endpoint for LinkedIn, X, and Facebook`
3. `feat: add OAuth token refresh cron to Vercel config (daily at 3 AM UTC)`

---

Plan complete and saved to `docs/plans/2026-04-07-oauth-token-refresh.md`. Two execution options:

**1. Subagent-Driven (this session)** — I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** — Open new session with executing-plans, batch execution with checkpoints

Which approach?
