# Fix LinkedIn Image Posting Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the LinkedIn publisher to properly upload images via LinkedIn's two-step upload flow instead of appending the URL as plain text.

**Architecture:** Replace the current text-append hack in `publishers.ts` with the official LinkedIn UGC image flow: (1) register upload → (2) upload image binary to presigned URLs → (3) create UGC post with image URN and `shareMediaCategory: "IMAGE"`.

**Tech Stack:** TypeScript (strict), LinkedIn UGC API v2, Supabase Storage (already has images), Next.js 16

---

### Background: The Bug

In `src/lib/publishers.ts:25-27`, the publisher does this:
```ts
finalContent += `\n\nImage: ${post.media_urls[0]}`
```
This appends the URL as text in the post body. The API call sets `shareMediaCategory: "NONE"`, making it always text-only.

The LinkedIn flow needs three steps:
1. `POST https://api.linkedin.com/v2/assets?action=registerUpload` — returns upload URN + presigned URLs
2. `PUT` image binary to each presigned URL (one for small images, multi-part for large)
3. `POST https://api.linkedin.com/v2/ugcPosts` with `shareMediaCategory: "IMAGE"` and the uploaded media URN

---

### Task 1: Create LinkedIn Image Upload Helper Function

**Files:**
- Modify: `src/lib/publishers.ts:20-56` (rewrite `publishToLinkedIn`)

**Step 1: Add the `uploadImageToLinkedIn` helper function**

```typescript
interface LinkedInUploadResponse {
  value: {
    asset: string;          // e.g. "urn:li:digitalmediaAsset:C4D03AQ..."
    uploadMechanism: {
      "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest": {
        uploadUrl: string;  // presigned URL for uploading
        headers: Record<string, string>;
      }
    };
    mediaArtifact?: string;
  }
}

async function uploadImageToLinkedIn(accessToken: string, imageUrl: string, authorId: string): Promise<string | null> {
  // Step 1: Register upload
  const registerRes = await fetch("https://api.linkedin.com/v2/assets?action=registerUpload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
        supportedAssets: ["urn:li:digitalmediaAsset:UNKNOWN"],
        owner: authorId,
      },
    }),
  });

  if (!registerRes.ok) return null;
  const registerData: LinkedInUploadResponse = await registerRes.json();
  const uploadUrl = registerData.value.uploadMechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"].uploadUrl;
  const assetUrn = registerData.value.asset;

  // Step 2: Download image from Supabase and upload to LinkedIn
  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) return null;
  const imageBuffer = await imageRes.arrayBuffer();

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "x-amz-storage-class": "STANDARD",
    },
    body: imageBuffer,
  });

  if (!uploadRes.ok) return null;
  return assetUrn;
}
```

**Step 2: Update `publishToLinkedIn` to use media when available**

Rewrite the function to:
1. Check if `media_urls` is provided and non-empty
2. If yes, call `uploadImageToLinkedIn` to get the asset URN
3. If successful, set `shareMediaCategory: "IMAGE"` and include the media URN
4. If failed, fall back to text-only post (log warning, don't fail)

```typescript
export async function publishToLinkedIn(profile: Profile, post: PostPayload): Promise<PublishResult> {
  let finalContent = post.content
  if (post.hashtags && post.hashtags.length > 0) {
    finalContent += `\n\n${post.hashtags.map(h => `#${h}`).join(" ")}`
  }

  const authorUrn = `urn:li:person:${profile.profile_id}`
  let mediaUrn: string | null = null

  // Upload image to LinkedIn if media provided
  if (post.media_urls && post.media_urls.length > 0) {
    mediaUrn = await uploadImageToLinkedIn(profile.access_token, post.media_urls[0], authorUrn)
  }

  const body: Record<string, unknown> = {
    author: authorUrn,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: finalContent },
        shareMediaCategory: mediaUrn ? "IMAGE" : "NONE",
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  }

  // Add media URN if upload succeeded
  if (mediaUrn) {
    body.specificContent["com.linkedin.ugc.ShareContent"].media = [{
      status: "READY",
      description: { text: "Post image" },
      media: mediaUrn,
      title: { text: "Post image" },
    }]
  }

  const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${profile.access_token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(body),
  })

  const data = await res.json().catch(() => ({}))
  if (res.ok) return { platform: "linkedin", status: "success", id: data.id }
  return { platform: "linkedin", status: "error", message: data.message || "Failed to post to LinkedIn" }
}
```

**Step 3: Commit**

```bash
git add src/lib/publishers.ts
git commit -m "fix: replace text-append LinkedIn image hack with proper two-step upload flow"
```

---

### Task 2: Update Cron Job to Pass Full Image URLs

**Files:**
- Read: `src/app/api/cron/process-queue/route.ts:46`
- **No change needed** — the cron already passes `media_urls: dbPost.media_urls` from the database, and the publishing page uploads to Supabase Storage which stores public URLs in the DB. The flow is already correct.

**Verification only:** Confirm that `posts.media_urls` contains actual public Supabase URLs by tracing the publishing flow.

```bash
git status
# Should show no changes
```

---

### Task 3: Update Cron to Handle Image Upload Failures Gracefully

**Files:**
- Modify: `src/lib/publishers.ts` (the `publishToLinkedIn` function)
- Modify: `src/app/api/cron/process-queue/route.ts` (add logging for partial failures)

If the LinkedIn image upload fails, the post should still be published as text-only and the result should indicate this. This is handled by the current code — `uploadImageToLinkedIn` returns `null` on failure, and the fallback is text-only.

**Step 1: Add a message to PublishResult when image upload fails**

Add optional `warnings?: string[]` to `PublishResult` interface:

```typescript
export interface PublishResult {
  platform: string
  status: "success" | "error"
  id?: string
  message?: string
  warnings?: string[]
}
```

**Step 2: Add warning when image upload fails**

In `publishToLinkedIn`, after the `media_urls` check, add:

```typescript
if (post.media_urls && post.media_urls.length > 0 && !mediaUrn) {
  // Return with warning rather than hard failure
  // Fall through to publish text-only post below...
}
```

And after the successful post, include the warning:

```typescript
if (res.ok) {
  const result: PublishResult = { platform: "linkedin", status: "success", id: data.id }
  if (post.media_urls && post.media_urls.length > 0 && !mediaUrn) {
    result.warnings = ["Image upload failed, post published as text-only"]
  }
  return result
}
```

**Step 3: Commit**

```bash
git add src/lib/publishers.ts
git commit -m "feat: add warnings to PublishResult when image upload falls back to text-only"
```

---

### Task 4: Manual Testing Instructions

**Pre-test requirements:**
- LinkedIn OAuth connection established
- Supabase Storage 'media' bucket configured and accessible
- Image upload working in publishing UI

**Test 1: LinkedIn post with image (immediate publish)**
1. Go to `/publish` page
2. Write a short post
3. Upload an image
4. Select LinkedIn only
5. Click "Publish Now"
6. Verify: Image appears as a LinkedIn post image (not a URL in text)
7. Verify: Database `posts` status = "published"

**Test 2: LinkedIn post with image (scheduled)**
1. Repeat Test 1 but set a schedule time 2 minutes in the future
2. Wait for the cron to run (or manually trigger with `curl http://localhost:3000/api/cron/process-queue`)
3. Verify: Same as Test 1

**Test 3: LinkedIn post without image (regression)**
1. Write a short post, no image
2. Select LinkedIn only
3. Verify: Post publishes as text-only, no errors

**Test 4: Multiple platforms with image**
1. Write a post with an image
2. Select LinkedIn + X + Facebook
3. Verify: LinkedIn gets the image, X and Facebook get text-only (as expected)

---

### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| LinkedIn image download from Supabase fails | `uploadImageToLinkedIn` returns `null`, falls back to text |
| LinkedIn upload API rejects the image | Same fallback with warning in result |
| Large images (>20MB) may hit multi-part upload | Add basic validation — reject images >10MB with error message in UI |
| CORS issues with fetch-ing Supabase URL from server | Server-side `fetch` doesn't have CORS restrictions |
