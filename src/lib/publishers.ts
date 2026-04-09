export interface PublishResult {
  platform: string
  status: "success" | "error"
  id?: string
  message?: string
  warnings?: string[]
}

interface Profile {
  platform: string
  profile_id: string
  access_token: string
}

interface PostPayload {
  content: string
  hashtags?: string[]
  media_urls?: string[]
}

interface LinkedInUploadResponse {
  value: {
    asset: string
    uploadMechanism: {
      "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest": {
        uploadUrl: string
        headers: Record<string, string>
      }
    }
    mediaArtifact?: string
  }
}

async function uploadImageToLinkedIn(accessToken: string, imageUrl: string, owner: string): Promise<string | null> {
  console.log("[LinkedIn] Starting image upload, URL:", imageUrl)

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
        owner,
      },
    }),
  })

  if (!registerRes.ok) {
    const errText = await registerRes.text().catch(() => "")
    console.error("LinkedIn register upload failed:", registerRes.status, errText)
    return null
  }
  let registerData: LinkedInUploadResponse
  try {
    registerData = await registerRes.json()
  } catch (e) {
    const text = await registerRes.text()
    console.error("[LinkedIn] Failed to parse register response as JSON:", text.slice(0, 500))
    return null
  }
  console.log("[LinkedIn] Register response:", JSON.stringify(registerData).slice(0, 200))

  if (!registerData.value?.uploadMechanism) {
    console.error("[LinkedIn] No upload mechanism in response:", registerData)
    return null
  }

  const uploadUrl = registerData.value.uploadMechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"].uploadUrl
  const assetUrn = registerData.value.asset

  // Step 2: Download image from source URL
  const imageRes = await fetch(imageUrl)
  console.log("[LinkedIn] Fetch image response:", imageRes.status, imageRes.headers.get("content-type"))
  if (!imageRes.ok) {
    console.error("Failed to fetch image from URL:", imageUrl, imageRes.status)
    return null
  }
  const imageBuffer = await imageRes.arrayBuffer()
  console.log("[LinkedIn] Image buffer size:", imageBuffer.byteLength)

  // Step 3: Upload binary to LinkedIn presigned URL
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "x-amz-storage-class": "STANDARD",
    },
    body: imageBuffer,
  })

  if (!uploadRes.ok) {
    console.error("LinkedIn binary upload failed:", uploadRes.status, await uploadRes.text().catch(() => ""))
    return null
  }
  return assetUrn
}

export async function publishToLinkedIn(profile: Profile, post: PostPayload): Promise<PublishResult> {
  let finalContent = post.content
  if (post.hashtags && post.hashtags.length > 0) {
    finalContent += `\n\n${post.hashtags.map(h => `#${h}`).join(" ")}`
  }

  const owner = `urn:li:person:${profile.profile_id}`
  let mediaUrn: string | null = null

  if (post.media_urls && post.media_urls.length > 0) {
    console.log("[LinkedIn] Attempting to upload image, URL:", post.media_urls[0])
    mediaUrn = await uploadImageToLinkedIn(profile.access_token, post.media_urls[0], owner)
    console.log("[LinkedIn] Image upload result, urn:", mediaUrn)
  }

  const body: Record<string, unknown> = {
    author: owner,
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

  if (mediaUrn) {
    const shareContent = body.specificContent as Record<string, unknown>
    shareContent["com.linkedin.ugc.ShareContent"] = {
      shareCommentary: { text: finalContent },
      shareMediaCategory: "IMAGE",
      media: [{
        status: "READY",
        description: { text: "Post image" },
        media: mediaUrn,
        title: { text: "Post image" },
      }],
    }
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
  if (res.ok) {
    const result: PublishResult = { platform: "linkedin", status: "success", id: data.id }
    if (post.media_urls && post.media_urls.length > 0 && !mediaUrn) {
      result.warnings = ["Image upload failed, post published as text-only"]
    }
    return result
  }
  return { platform: "linkedin", status: "error", message: data.message || "Failed to post to LinkedIn" }
}

export async function publishToX(profile: Profile, post: PostPayload): Promise<PublishResult> {
  let text = post.content
  if (post.hashtags && post.hashtags.length > 0) {
    text += ` ${post.hashtags.map(h => `#${h}`).join(" ")}`
  }
  // X has a 280 character limit
  if (text.length > 280) text = text.substring(0, 277) + "..."

  const res = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${profile.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  })

  const data = await res.json().catch(() => ({}))
  if (res.ok) return { platform: "x", status: "success", id: data.data?.id }
  return {
    platform: "x",
    status: "error",
    message: data.detail || data.errors?.[0]?.message || "Failed to post to X",
  }
}

export async function publishToFacebook(profile: Profile, post: PostPayload): Promise<PublishResult> {
  let message = post.content
  if (post.hashtags && post.hashtags.length > 0) {
    message += `\n\n${post.hashtags.map(h => `#${h}`).join(" ")}`
  }

  const params = new URLSearchParams({ message, access_token: profile.access_token })

  const res = await fetch("https://graph.facebook.com/v19.0/me/feed", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  })

  const data = await res.json().catch(() => ({}))
  if (res.ok && data.id) return { platform: "facebook", status: "success", id: data.id }
  return { platform: "facebook", status: "error", message: data.error?.message || "Failed to post to Facebook" }
}
