-- supabase/migrations/20260414010000_content_architecture.sql

CREATE TABLE public.content_pillars (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  emoji       TEXT    NOT NULL DEFAULT '📌',
  color       TEXT    NOT NULL DEFAULT '#128C7E',
  description TEXT,
  target_pct  INTEGER NOT NULL DEFAULT 20 CHECK (target_pct BETWEEN 1 AND 100),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.story_arcs (
  id          UUID   DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT   NOT NULL,
  description TEXT,
  start_date  DATE,
  end_date    DATE,
  status      TEXT   NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed')),
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.story_arc_posts (
  arc_id         UUID    NOT NULL REFERENCES public.story_arcs(id) ON DELETE CASCADE,
  post_id        UUID    NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  sequence_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (arc_id, post_id)
);

-- Add pillar_id to posts (nullable — existing posts have no pillar)
ALTER TABLE public.posts ADD COLUMN pillar_id UUID REFERENCES public.content_pillars(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE public.content_pillars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_arcs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_arc_posts  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own pillars"
  ON public.content_pillars FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own arcs"
  ON public.story_arcs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage arc posts for own arcs"
  ON public.story_arc_posts FOR ALL
  USING (EXISTS (SELECT 1 FROM public.story_arcs a WHERE a.id = arc_id AND a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.story_arcs a WHERE a.id = arc_id AND a.user_id = auth.uid()));
