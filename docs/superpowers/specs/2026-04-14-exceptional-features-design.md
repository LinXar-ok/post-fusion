# LinXar Ops: Social — Exceptional Features Design

**Date:** 2026-04-14  
**Status:** Approved  
**Build order:** Core PRD → Brand Brain → Content Architecture → Performance Coach

---

## 1. Overview

Two-layer roadmap to make LinXar Ops: Social exceptional:

- **Layer 1 — PRD Completion:** Finish the features already spec'd but not yet built.
- **Layer 2 — Differentiators:** Add three interconnected features that no existing tool (Buffer, Vista Social, Later) offers together — a persistent AI strategist, structured content architecture, and a closed performance feedback loop.

The central insight driving differentiation: existing tools are reactive. They help you execute a post. They never tell you what to create next, why something worked, or whether you're building a coherent brand story. These three features close that gap.

---

## 2. Layer 1 — PRD Core Completion

Features already specified in the PRD that remain unbuilt:

| Feature | Description |
|---|---|
| Smart queues | Auto-schedule posts into optimal time slots based on historical performance |
| Bulk CSV scheduling | Upload and schedule multiple posts via CSV import |
| Drag-and-drop calendar | Full drag-and-drop support for rescheduling on the calendar view |
| Media library UI | Browsable, searchable UI for uploaded media in Supabase Storage |
| Platform-specific previews | Per-platform post preview (character limits, aspect ratios) in the editor |
| OAuth token refresh | Automatic refresh of expired OAuth tokens for all connected platforms |
| Functional inbox | Webhook-based inbox for replies, comments, DMs from connected platforms |
| Exportable reports | PDF and CSV export of monthly analytics summaries |
| Link-in-Bio builder | Drag-and-drop landing page builder with link click analytics |
| Social listening | Keyword monitoring with sentiment analysis (positive/neutral/negative) |

---

## 3. Layer 2 — Differentiators

### 3.1 Brand Brain — Persistent AI Memory

**What it is:** A dedicated page in the app (`/brand-brain`) backed by a persistent AI memory layer that learns the user's brand voice, content patterns, and what resonates — across all posts over time. It surfaces weekly briefs and proactive nudges rather than waiting to be asked.

**Key components:**

- **Weekly Content Brief** — Auto-generated every Monday. Summarises last 30 days of performance, identifies what's working, and surfaces 3 post ideas tailored to the user's own patterns (not generic trends).
- **Brand Voice Score** — A 0–100 score shown on every draft in the publishing editor. Scores consistency with the user's established tone across prior posts. Flags if a draft drifts significantly.
- **Smart Nudges** — Proactive alerts: "No photo post in 11 days", "LinkedIn engagement down 30% this week", "3 saved ideas still undrafted."
- **AI Post Ideas** — Suggested post hooks generated from the user's pattern data, labelled by pillar (Personal Story, Behind the Scenes, Lesson Learned, etc.).

**Data model additions:**
- `brand_memory` table: stores embeddings of published posts, aggregated tone/topic metadata, performance signals per post
- `weekly_briefs` table: generated briefs with status (unread/dismissed/actioned)
- `brand_nudges` table: active nudges with type, trigger condition, created_at, dismissed_at

**Integration points:**
- Publishing editor: live voice score computed on draft text
- Sidebar nav: badge when a new weekly brief is ready
- Dashboard: "Brand Brain summary" widget showing top nudge

**AI implementation:** Uses the existing Groq/Anthropic AI route (`/api/ai/generate`). Brand memory context is retrieved via embedding similarity search before each generation call. Embeddings stored in Supabase using `pgvector`.

---

### 3.2 Content Architecture — Pillars & Story Arcs

**What it is:** A structural layer above scheduling that lets the user define their brand in terms of content pillars (recurring themes) and story arcs (multi-week narratives). Every post is tagged to a pillar; arcs connect individual posts into a planned sequence.

**Key components:**

- **Content Pillars Setup** — User defines 3–5 named pillars with an emoji, description, and target posting frequency. Accessible via Settings → Content Pillars. Each pillar has a colour for visual identification across the calendar.
- **Pillar Balance Heatmap** — Analytics view showing the actual distribution of posts across pillars vs. target. Flags pillars that are overposted or underposted. Updates in real time as posts are scheduled.
- **Pillar Tagging in Editor** — Every post in the publishing editor has a pillar selector. Brand Brain uses this data for its weekly brief and voice scoring.
- **Story Arcs Planner** — Users create a named arc with a start/end date and a sequence of planned posts (each linked to a pillar). The calendar view shows arc lanes alongside individual posts. Progress indicator shows how many arc posts are published vs. planned.

**Data model additions:**
- `content_pillars` table: id, user_id, name, emoji, color, description, target_percentage
- `story_arcs` table: id, user_id, name, description, start_date, end_date, status
- `story_arc_posts` table: arc_id, post_id, sequence_order
- `posts` table: add `pillar_id` foreign key column

**Integration points:**
- Publishing editor: pillar selector dropdown
- Calendar: arc lane view toggle
- Analytics: new "Content Balance" tab
- Brand Brain: pillar data feeds into weekly brief generation

---

### 3.3 Performance Coach — Closed Feedback Loop

**What it is:** A dedicated analytics layer that closes the loop between what was posted and what to do next. Goes beyond vanity metrics to surface the specific reasons a post succeeded or failed, and generates concrete weekly actions.

**Key components:**

- **Weekly Strategy Digest** — Auto-generated summary of the past 7 days: top metrics, biggest wins, biggest drops, and exactly 3 specific next actions backed by data. Delivered as a notification and accessible at `/analytics?tab=digest`.
- **"Why It Worked" Post Breakdown** — Per-post analysis panel showing: which signals drove performance (hook type, posting time, pillar, format, hashtag usage, caption length). Pulls from Brand Brain's memory to compare against baseline. Includes a "Use as template" button that pre-fills the editor with the post's structural pattern.
- **A/B Caption Testing** — In the publishing editor, user can write two caption variants for the same post. Platform posts Variant A at the scheduled time and Variant B at a configurable offset (e.g., same day 6 hours later, or same time slot the following day) — both to the same audience. After both have 48 hours of data, the winner is recorded and used to inform Brand Brain's future suggestions.
- **Content Gap Detector** — Surfaces topics/pillars the user hasn't covered recently relative to their historical posting pattern. Shown as a card on the Performance Coach page and fed into the weekly digest.

**Data model additions:**
- `post_analytics` table: post_id, platform, likes, comments, shares, reach, impressions, engagement_rate, recorded_at
- `ab_tests` table: id, post_a_id, post_b_id, winner_post_id, decided_at
- `weekly_digests` table: id, user_id, week_start, summary_json, actions_json, status

**Integration points:**
- Analytics page: new "Performance Coach" tab
- Publishing editor: A/B variant toggle, "why it worked" template loader
- Brand Brain: digest and gap data feeds into weekly brief
- Dashboard: "This week's 3 actions" widget

---

## 4. Architecture Notes

### How the three layers interconnect

```
Content Architecture (Pillars + Arcs)
        ↓ tags every post with pillar + arc context
Brand Brain (AI Memory)
        ↓ learns from tagged posts + performance signals
Performance Coach (Feedback Loop)
        ↓ surfaces insights + actions → feeds back into Brand Brain
```

Each layer independently adds value but becomes significantly more powerful when all three are in place. Build order matters: pillars give the AI meaningful structure to learn from; performance data gives it signals to act on.

### AI / embedding infrastructure

- Supabase `pgvector` extension for storing post embeddings
- Embeddings generated via existing AI route on post publish
- Similarity search at brief-generation time to retrieve relevant past posts
- All AI calls routed through `/api/ai/generate` — no new AI providers needed

### Incremental delivery

Each differentiator can ship independently without breaking the others:

1. **Brand Brain v1** — Weekly brief + voice score in editor (no pillar data needed, works from raw post history)
2. **Content Architecture v1** — Pillars setup + tagging in editor + balance heatmap (Brand Brain passively benefits)
3. **Performance Coach v1** — Weekly digest + "why it worked" (uses existing analytics data)
4. **A/B Testing + Story Arcs** — Second wave, higher complexity

---

## 5. Success Criteria

- User opens Brand Brain and finds the weekly brief actionable (not generic)
- Voice score in the editor correctly flags off-brand drafts
- Pillar balance heatmap accurately reflects the user's posting history
- Weekly digest surfaces at least 2 of the 3 actions the user would have independently identified as priorities
- A/B test winner is correctly identified and stored after 48h

---

## 6. Out of Scope

- Mobile app (iOS/Android)
- Competitor tracking beyond what's already in the PRD
- Monetisation integrations (Patreon, Ko-fi)
- Multi-user / team features
- Real-time collaboration on posts
