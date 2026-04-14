-- supabase/migrations/20260414000000_brand_brain.sql

-- Weekly AI-generated content briefs (cached so page load is instant)
CREATE TABLE public.weekly_briefs (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start  DATE        NOT NULL,
  summary     TEXT        NOT NULL,
  insights    JSONB       NOT NULL DEFAULT '[]',
  post_ideas  JSONB       NOT NULL DEFAULT '[]',
  actions     JSONB       NOT NULL DEFAULT '[]',
  status      TEXT        NOT NULL DEFAULT 'unread',
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, week_start)
);

-- Tracks which nudge types a user has dismissed (so they don't recur)
CREATE TABLE public.dismissed_nudges (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nudge_type   TEXT        NOT NULL,
  dismissed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, nudge_type)
);

-- RLS: users see only their own rows
ALTER TABLE public.weekly_briefs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dismissed_nudges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own briefs"
  ON public.weekly_briefs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own dismissed nudges"
  ON public.dismissed_nudges FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
