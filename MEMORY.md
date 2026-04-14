# VistaClone - Project Memory

## Stack
- Next.js 16 + React 19, TypeScript strict mode
- Supabase (auth + DB + storage), no Prisma
- Tailwind CSS v4, shadcn/ui (Base Nova), Framer Motion
- `supabase db push` to apply migrations (linked to iztpngdunsicmlymuemj)

## Status (April 2026) — All Critical Bugs Fixed
All critical bugs resolved in a comprehensive refactor. Build passes cleanly.

## Architecture
- OAuth: LinkedIn (full), X/PKCE (full), Facebook (long-lived token + page token exchange)
- Publishing: LinkedIn ✅, X ✅, Facebook ✅ — all via `src/lib/publishers.ts` shared helper
- Scheduling: cron at `/api/cron/process-queue` — secured with CRON_SECRET in prod, `vercel.json` configured every 5 min
- Media: Supabase Storage bucket named 'media', AI assistant via Anthropic SDK

## Pages Status (Post-Refactor)
- Route groups: `(app)/` for app shell, `(auth)/` for login/register
- Dashboard: real Supabase data (post counts, activity bar chart, recent posts)
- Analytics: recharts line chart (posts/week) + bar chart (by platform), real DB data
- Calendar: real scheduled/published posts displayed on correct dates, navigable months
- Inbox: mock data with webhook setup notice (requires platform webhooks to populate)
- Publishing: full with AI assistant (improve/hashtags/suggest) via Anthropic claude-haiku-4-5
- Settings: real data from Supabase, shows connected platform status

## Key File Paths
- Middleware: `src/middleware.ts` (correct location)
- Route groups: `src/app/(app)/` and `src/app/(auth)/`
- Publishers helper: `src/lib/publishers.ts`
- AI route: `src/app/api/ai/generate/route.ts` (needs ANTHROPIC_API_KEY in env)
- Migrations: `supabase/migrations/20260403000000_fix_posts_schema.sql` (applied)

## PRD Features Still To Build
- Smart queues / bulk CSV scheduling
- Media library UI
- Token refresh for expired OAuth tokens
- Social listening / sentiment analysis
- Link-in-Bio page
- Functional inbox (requires platform webhooks)
- Exportable reports (PDF/CSV)

## Required Env Vars
ANTHROPIC_API_KEY — for AI assistant features
CRON_SECRET — for production cron security (add to Vercel env)
# currentDate
Today's date is 2026-04-10.

      IMPORTANT: this context may or may not be relevant to your tasks. You should not respond to this context unless it is highly relevant to your task.