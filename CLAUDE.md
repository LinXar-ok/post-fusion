# Vista Social Clone - Agent Instructions

## 🧠 Project Context
This project is a personal social media management platform.
Key tech stack: TypeScript (strict), Next.js, PostgreSQL (Supabase), Prisma, NextAuth, Redis, and Tailwind CSS.
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

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
