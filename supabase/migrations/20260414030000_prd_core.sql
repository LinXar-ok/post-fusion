-- supabase/migrations/20260414030000_prd_core.sql

-- Smart queue: user-defined weekly posting time slots
CREATE TABLE public.queue_slots (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday
  hour        INTEGER NOT NULL CHECK (hour BETWEEN 0 AND 23),
  minute      INTEGER NOT NULL DEFAULT 0 CHECK (minute IN (0, 15, 30, 45)),
  platform    TEXT,   -- null = any platform
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, day_of_week, hour, minute)
);

-- Link-in-Bio: one page per user
CREATE TABLE public.bio_pages (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID    NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  slug        TEXT    NOT NULL UNIQUE,
  title       TEXT    NOT NULL DEFAULT 'My Links',
  bio         TEXT,
  avatar_url  TEXT,
  theme       TEXT    NOT NULL DEFAULT 'dark',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Link-in-Bio: links on a page
CREATE TABLE public.bio_links (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id     UUID    NOT NULL REFERENCES public.bio_pages(id) ON DELETE CASCADE,
  label       TEXT    NOT NULL,
  url         TEXT    NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  click_count INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.queue_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bio_pages   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bio_links   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own queue slots"
  ON public.queue_slots FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own bio page"
  ON public.bio_pages FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Bio pages are publicly readable (for the /bio/[slug] public route)
CREATE POLICY "Bio pages are publicly readable"
  ON public.bio_pages FOR SELECT USING (true);

CREATE POLICY "Users manage own bio links"
  ON public.bio_links FOR ALL
  USING (EXISTS (SELECT 1 FROM public.bio_pages bp WHERE bp.id = page_id AND bp.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.bio_pages bp WHERE bp.id = page_id AND bp.user_id = auth.uid()));

-- Bio links are publicly readable
CREATE POLICY "Bio links are publicly readable"
  ON public.bio_links FOR SELECT USING (true);

-- Bio link clicks can be incremented by anyone (anonymous click tracking)
CREATE POLICY "Anyone can increment bio link clicks"
  ON public.bio_links FOR UPDATE USING (true) WITH CHECK (true);
