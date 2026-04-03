# LinXar Ops: Social - Agent Instructions

## 🎨 Brand Identity
- **Name:** LinXar Ops: Social
- **Primary Color:** `#128C7E` (teal)
- **Secondary Color:** `#0B1020` (deep navy)
- Use `#128C7E` in place of violet/purple theme colors throughout the UI
- Use `#0B1020` for primary text on light backgrounds

## 🧠 Project Context
This project is a personal social media management platform.
Key tech stack: TypeScript (strict), Next.js 16, PostgreSQL (Supabase), Supabase SDK (no Prisma), NextAuth, Tailwind CSS v4, shadcn/ui, Framer Motion.
Always read existing code before writing new code. Respect patterns already in use.

## 📄 Important References
- **Product Requirements Document (PRD):** Please refer to the detailed PRD located at `/Users/linuxkexordzu/.gemini/antigravity/brain/1014194a-6d95-4eb0-ab04-6d70c92d74d5/vista_social_clone_prd.md` for full feature specifications, user flows, and product goals.
- **Available Skills:** During development, actively utilize the available agent skills (e.g., `react-nextjs-development`, `frontend-developer`, `backend-architect`, `api-endpoint-builder`, `ui-ux-pro-max`, etc.) whenever tackling a specialized task. Rely on these codified skills rather than generic generation.

## 🗄️ Database & Supabase Commands
**CRITICAL:** We have fully migrated away from Prisma to the native Supabase SDK and CLI to avoid local VPN/firewall TCP blocks.

To manage the database schema:
1. We write raw SQL migrations in `supabase/migrations/` (usually generated via `supabase migration new <name>`).
2. To push these changes to the live Supabase project, always use:
```bash
supabase db push
```
*(Note: Ensure your project is linked first via `supabase link --project-ref iztpngdunsicmlymuemj`)*

## 🏗️ Project Architecture

- **Route Groups:** `(app)/` for authenticated app shell, `(auth)/` for login/register
- **Middleware:** `src/middleware.ts` (handles auth redirects and proxy)
- **Publishers:** `src/lib/publishers.ts` - shared helper for LinkedIn, X, Facebook publishing
- **AI Assistant:** `src/app/api/ai/generate/route.ts` - uses Groq (requires `GROQ_API_KEY`)
- **Cron:** `/api/cron/process-queue` - runs every 5 min, secured with `CRON_SECRET` in production

## 🔑 Required Environment Variables

- `GROQ_API_KEY` - for AI assistant features (dev)
- `CRON_SECRET` - for production cron security (add to Vercel env)

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
