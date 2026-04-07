import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

type NormalizedMessage = {
  platform: string
  platform_message_id: string
  sender_name: string
  sender_handle?: string
  sender_avatar_url?: string
  sender_id?: string
  content: string
  platform_type: "comment" | "mention" | "dm" | "reply"
  platform_post_url?: string
  raw_payload: Record<string, unknown>
}

function normalizeLinkedIn(payload: Record<string, unknown>): NormalizedMessage | null {
  const content =
    typeof payload.content === "string"
      ? payload.content
      : (payload.content as { text?: string })?.text ?? ""
  if (!content) return null

  return {
    platform: "linkedin",
    platform_message_id: String(payload.id ?? `lnk-${Date.now()}-${Math.random()}`),
    sender_name: String((payload.actor as Record<string, unknown>)?.localizedName ?? "LinkedIn User"),
    sender_handle: (payload.actor as Record<string, unknown>)?.vanityName
      ? `@${(payload.actor as Record<string, unknown>).vanityName}`
      : undefined,
    sender_avatar_url: (payload.actor as Record<string, unknown>)?.picture as string | undefined,
    sender_id: payload.actor ? String((payload.actor as Record<string, unknown>).id ?? "") : undefined,
    content,
    platform_type: "comment" in payload ? "comment" : "mention",
    platform_post_url: payload.object as string | undefined,
    raw_payload: payload,
  }
}

function normalizeX(payload: Record<string, unknown>): NormalizedMessage | null {
  const tweetEvents = (payload.tweet_create_events as Record<string, unknown>[]) ?? []
  const dmEvents = (payload.direct_message_events as Record<string, unknown>[]) ?? []
  const favEvents = (payload.favorite_events as Record<string, unknown>[]) ?? []
  const data = (tweetEvents[0] ?? dmEvents[0] ?? favEvents[0]) as Record<string, unknown> | undefined
  if (!data) return null

  const isDM = dmEvents.length > 0
  const sender = (data.sender as Record<string, unknown>) ??
    (data.user as Record<string, unknown>) ??
    {}

  return {
    platform: "x",
    platform_message_id: String(data.id ?? `x-${Date.now()}-${Math.random()}`),
    sender_name: String(sender.name ?? "X User"),
    sender_handle: sender.screen_name ? `@${sender.screen_name}` : undefined,
    sender_avatar_url: sender.profile_image_url_https as string | undefined,
    sender_id: sender.id_str ? String(sender.id_str) : String(sender.id ?? ""),
    content: String((data.message_data as Record<string, unknown>)?.text ?? data.text ?? ""),
    platform_type: isDM ? "dm" : "comment",
    platform_post_url: data.url as string | undefined,
    raw_payload: payload,
  }
}

function normalizeFacebook(payload: Record<string, unknown>): NormalizedMessage | null {
  const entry = (payload.entry as Record<string, unknown>[])?.[0]
  if (!entry) return null

  const change = (entry.changes as { value: Record<string, unknown> }[])?.[0]?.value
  if (!change) return null

  if (change.field === "feed") {
    const item = change.item as Record<string, unknown> | undefined
    if (!item) return null
    const from = item.from as Record<string, unknown> | undefined

    return {
      platform: "facebook",
      platform_message_id: String(item.id ?? `fb-${Date.now()}-${Math.random()}`),
      sender_name: String((from as Record<string, unknown>)?.name ?? "Facebook User"),
      sender_id: from?.id ? String(from.id) : undefined,
      content: String(item.message ?? item.story ?? item.description ?? ""),
      platform_type: "comment",
      platform_post_url: item.permalink_url as string | undefined,
      raw_payload: payload,
    }
  }

  if (change.field === "messages" || change.field === "conversations") {
    const message = change.message as Record<string, unknown> | undefined
    if (!message) return null
    const from = message.from as Record<string, unknown> | undefined

    return {
      platform: "facebook",
      platform_message_id: String(message.mid ?? `fb-dm-${Date.now()}-${Math.random()}`),
      sender_name: String((from as Record<string, unknown>)?.name ?? "Facebook User"),
      sender_id: from?.id ? String(from.id) : undefined,
      content: String(message.text ?? ""),
      platform_type: "dm",
      raw_payload: payload,
    }
  }

  return null
}

const platformNormalizers: Record<string, (p: Record<string, unknown>) => NormalizedMessage | null> = {
  linkedin: normalizeLinkedIn,
  x: normalizeX,
  facebook: normalizeFacebook,
}

async function resolveUserIdFromPlatform(platform: string, senderId: string | undefined): Promise<string | null> {
  if (!senderId) return null

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: profile } = await supabaseAdmin
    .from("social_profiles")
    .select("user_id")
    .eq("platform", platform)
    .eq("profile_id", senderId)
    .single()

  return profile?.user_id ?? null
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url)
  const platform = url.searchParams.get("platform")

  if (!platform || !platformNormalizers[platform]) {
    return NextResponse.json(
      { error: "Invalid or missing platform parameter. Use: linkedin, x, facebook" },
      { status: 400 },
    )
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  // Handle webhook verification for Facebook (GET via POST with hub.challenge)
  if ("hub.challenge" in body) {
    return NextResponse.json({ success: true })
  }

  const normalized = platformNormalizers[platform](body)
  if (!normalized) {
    return NextResponse.json({ error: "Could not normalize webhook payload" }, { status: 200 })
  }

  let targetUserId: string | null = process.env.WEBHOOK_TARGET_USER_ID ?? null

  if (!targetUserId) {
    targetUserId = await resolveUserIdFromPlatform(platform, normalized.sender_id)
  }

  if (!targetUserId) {
    return NextResponse.json(
      { error: "Could not determine target user for this webhook" },
      { status: 400 },
    )
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { error: insertError } = await supabaseAdmin
    .from("inbox_messages")
    .upsert({
      user_id: targetUserId,
      platform: normalized.platform,
      platform_message_id: normalized.platform_message_id,
      sender_id: normalized.sender_id,
      sender_name: normalized.sender_name,
      sender_handle: normalized.sender_handle,
      sender_avatar_url: normalized.sender_avatar_url,
      content: normalized.content,
      platform_type: normalized.platform_type,
      platform_post_url: normalized.platform_post_url,
      raw_payload: normalized.raw_payload,
    }, { onConflict: "platform,platform_message_id", ignoreDuplicates: true })

  if (insertError) {
    console.error("Webhook insert error:", insertError)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// GET handler for webhook verification (Facebook, LinkedIn support this)
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  const expectedToken = process.env.WEBHOOK_VERIFY_TOKEN ?? "vista_social_verify"

  if (mode === "subscribe" && token === expectedToken) {
    return NextResponse.json(Number(challenge), { status: 200 })
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 })
}
