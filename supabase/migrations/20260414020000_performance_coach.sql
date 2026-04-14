-- supabase/migrations/20260414020000_performance_coach.sql

-- Per-post engagement metrics (platform-agnostic: store aggregated totals)
CREATE TABLE public.post_analytics (
  id              UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id         UUID    NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  likes           INTEGER NOT NULL DEFAULT 0,
  comments        INTEGER NOT NULL DEFAULT 0,
  shares          INTEGER NOT NULL DEFAULT 0,
  reach           INTEGER NOT NULL DEFAULT 0,
  impressions     INTEGER NOT NULL DEFAULT 0,
  engagement_rate NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN impressions > 0
    THEN ROUND(((likes + comments + shares)::numeric / impressions) * 100, 2)
    ELSE 0 END
  ) STORED,
  recorded_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id)
);

-- A/B tests: two variants of a post scheduled at different times
CREATE TABLE public.ab_tests (
  id            UUID   DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_a_id     UUID   NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  post_b_id     UUID   NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  winner_post_id UUID  REFERENCES public.posts(id),
  status        TEXT   NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'decided')),
  decide_after  TIMESTAMPTZ NOT NULL,
  decided_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Cached weekly performance digests
CREATE TABLE public.performance_digests (
  id          UUID  DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID  NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start  DATE  NOT NULL,
  summary     TEXT  NOT NULL,
  actions     JSONB NOT NULL DEFAULT '[]',
  top_post_id UUID  REFERENCES public.posts(id),
  metrics     JSONB NOT NULL DEFAULT '{}',
  status      TEXT  NOT NULL DEFAULT 'unread',
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, week_start)
);

-- RLS
ALTER TABLE public.post_analytics     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ab_tests           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_digests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own post analytics"
  ON public.post_analytics FOR ALL
  USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = auth.uid()));

CREATE POLICY "Users manage own ab tests"
  ON public.ab_tests FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own digests"
  ON public.performance_digests FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
