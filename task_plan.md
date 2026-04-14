# Task Plan: Ship All Remaining PRD Features (8 Sequential PRs)

## Goal
Deliver all remaining PRD features + 1 bug fix as 8 sequential small PRs, each independently mergeable to `main`.

## Current Phase
Planning

## Decision Log

| Decision | Rationale | Alternatives | Why |
|----------|-----------|--------------|-----|
| Sequential PRs over one big PR | Easier review, safer merges, testable in isolation | Single monolithic PR | Reduces blast radius, user can review incrementally |
| Order by complexity (easiest first) | Quick wins build momentum, tackle hard problems with fresh context | Order by business value | User chose complexity-based ordering |
| Fix LinkedIn image as PR #0 | Bug affects existing functionality, should be resolved before adding features | Include in first feature | User explicitly requested it as PR #0 |

## Phases

### PR #0: Fix LinkedIn Image Posting (Image renders as text link)
- [x] **Bug identified:** Lines 25-27 of `publishers.ts` append `Image: ${url}` to text content instead of using LinkedIn's register upload API
- [ ] Implement proper LinkedIn image upload flow:
  1. Register upload to LinkedIn (`POST /assets?action=registerUpload`)
  2. Upload image binary to LinkedIn's presigned URL
  3. Reference the returned media URN in the UGC post
  4. Update `shareMediaCategory` from `"NONE"` to `"IMAGE"`
- [ ] Supabase Storage bucket 'media' already exists — images uploaded via UI need to be fetched and re-uploaded to LinkedIn
- [ ] Test with scheduled + immediate posts
- **Status:** pending

### PR #1: Functional Inbox (Real Webhook Data)
- [ ] Create `/api/webhooks/inbox` endpoint to receive messages from LinkedIn, X, Facebook webhooks
- [ ] Add `inbox_messages` table migration (id, user_id, platform, sender_name, sender_id, content, media_url, timestamp, is_read)
- [ ] Update inbox UI page to fetch real data from `inbox_messages` table
- [ ] Remove mock data, keep webhook setup notice for users without webhooks
- [ ] Add unread count badge
- **Status:** pending

### PR #2: OAuth Token Refresh (Background Cron Job)
- [ ] Add `token_expires_at` column to `social_profiles` table
- [ ] Create `/api/cron/refresh-tokens` endpoint
- [ ] Implement refresh logic per platform:
  - LinkedIn: Refresh tokens via OAuth2 token endpoint
  - X: Use stored refresh token from PKCE flow
  - Facebook: Extend long-lived token (60-day expiry)
- [ ] Update cron to check `token_expires_at < NOW() + INTERVAL '1 hour'` and auto-refresh
- [ ] Log refresh attempts/failures for monitoring
- **Status:** pending

### PR #3: Media Library UI
- [ ] Create `/media` page under `(app)/`
- [ ] Implement image upload to Supabase Storage bucket 'media'
- [ ] Grid view of uploaded images with delete functionality
- [ ] Image picker modal for use in compose/publish flow
- [ ] Integrate with existing publishers (LinkedIn image fix from PR #0, Facebook supports images via URL)
- **Status:** pending

### PR #4: Exportable Reports (PDF/CSV)
- [ ] Add export button to analytics page
- [ ] Implement CSV export (built-in, no new deps) — posts, engagement metrics
- [ ] Implement PDF export using `@react-pdf/renderer` — branded with LinXar colors (#128C7E, #0B1020)
- [ ] Add date range picker for custom report periods
- **Status:** pending

### PR #5: Smart Queues / Bulk CSV Scheduling
- [ ] Create CSV upload component on publishing page
- [ ] Parse CSV columns: content, hashtags[], platforms[], scheduled_datetime
- [ ] Validate and bulk-insert into `posts` table with `status: 'scheduled'`
- [ ] Add preview table showing parsed records before confirm
- [ ] Existing cron (`/api/cron/process-queue`) will pick them up automatically
- [ ] Reuse existing queue processing logic
- **Status:** pending

### PR #6: Social Listening / Sentiment Analysis
- [ ] Create `/listening` page under `(app)/`
- [ ] Integrate existing AI assistant (Anthropic/Groq) for sentiment analysis
- [ ] Create `/api/ai/sentiment` endpoint that analyzes post comments/mentions
- [ ] Dashboard showing sentiment breakdown (positive/neutral/negative) over time
- [ ] Keyword monitoring: track mentions of specified terms across platforms
- [ ] Add alerts for negative sentiment spikes
- **Status:** pending

## Key Questions
1. Which platforms' webhooks should we prioritize first for inbox (LinkedIn is most urgent)?
2. For reports, does the user need both PDF and CSV, or is one format sufficient initially?
3. What platforms need token refresh first (LinkedIn tokens expire fastest)?
4. For sentiment analysis, should we use existing Groq/Anthropic API or add a dedicated service?

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| LinkedIn image fix uses registerUpload + upload flow | This is the official LinkedIn API approach for image posts |
| Inbox uses webhook pattern (not polling) | Real-time, cost-effective, standard practice |
| Token refresh runs as cron job | Automated, no user intervention needed |
| Media library reuses existing 'media' bucket | No new infrastructure needed |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|

## Notes
- Each PR: small, focused, independently mergeable
- All existing code patterns preserved (Supabase SDK, Tailwind v4, shadcn/ui)
- Cron jobs secured with CRON_SECRET in production
- Brand colors: #128C7E (primary teal), #0B1020 (deep navy)
