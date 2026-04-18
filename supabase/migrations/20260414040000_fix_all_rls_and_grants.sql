-- =============================================================
-- Fix RLS + GRANT for ALL tables
-- Problems solved:
--   1. posts / social_profiles had RLS disabled — re-enable with clean policies
--   2. anon role had GRANT ALL on user-data tables — revoke
--   3. Newer tables had no GRANT to authenticated role — add
--   4. sentiment_logs INSERT policy was too permissive — tighten
-- =============================================================


-- ---------------------------------------------------------------
-- 1. RE-ENABLE RLS on posts and social_profiles
-- ---------------------------------------------------------------
ALTER TABLE public.posts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_profiles  ENABLE ROW LEVEL SECURITY;

-- Drop stale/duplicate policies left by earlier migrations
DROP POLICY IF EXISTS "Enable insert for users"            ON public.posts;
DROP POLICY IF EXISTS "Enable select for own posts"        ON public.posts;
DROP POLICY IF EXISTS "Enable update for own posts"        ON public.posts;
DROP POLICY IF EXISTS "Enable delete for own posts"        ON public.posts;
DROP POLICY IF EXISTS "Authenticated users can insert posts" ON public.posts;

DROP POLICY IF EXISTS "Enable insert for social profiles"  ON public.social_profiles;
DROP POLICY IF EXISTS "Enable select for social profiles"  ON public.social_profiles;
DROP POLICY IF EXISTS "Enable update for social profiles"  ON public.social_profiles;
DROP POLICY IF EXISTS "Enable delete for social profiles"  ON public.social_profiles;

-- Clean policies for posts
CREATE POLICY "posts: select own"  ON public.posts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "posts: insert own"  ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "posts: update own"  ON public.posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "posts: delete own"  ON public.posts FOR DELETE USING (auth.uid() = user_id);

-- Clean policies for social_profiles
CREATE POLICY "social_profiles: select own"  ON public.social_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "social_profiles: insert own"  ON public.social_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "social_profiles: update own"  ON public.social_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "social_profiles: delete own"  ON public.social_profiles FOR DELETE USING (auth.uid() = user_id);


-- ---------------------------------------------------------------
-- 2. REVOKE overly-broad anon grants from user-data tables
-- ---------------------------------------------------------------
REVOKE ALL ON public.posts            FROM anon;
REVOKE ALL ON public.social_profiles  FROM anon;


-- ---------------------------------------------------------------
-- 3. GRANT CRUD to authenticated role on ALL user-data tables
-- ---------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts              TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_profiles    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inbox_messages     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tracked_keywords   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sentiment_logs     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_briefs      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dismissed_nudges   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.queue_slots        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bio_pages          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bio_links          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_pillars    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.story_arcs         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.story_arc_posts    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_analytics     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ab_tests           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_digests TO authenticated;

-- Sequences (needed for gen_random_uuid() fallback & serial PKs)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;


-- ---------------------------------------------------------------
-- 4. anon role: only public-facing tables (bio page / links)
-- ---------------------------------------------------------------
GRANT SELECT ON public.bio_pages TO anon;
GRANT SELECT ON public.bio_links TO anon;

-- Allow anon to call the click-increment RPC
GRANT EXECUTE ON FUNCTION public.increment_bio_link_click(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.increment_bio_link_click(UUID) TO authenticated;

-- anon UPDATE is needed for the click-tracking policy on bio_links
GRANT UPDATE (click_count) ON public.bio_links TO anon;


-- ---------------------------------------------------------------
-- 5. Fix sentiment_logs INSERT policy (was open to everyone)
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "System can insert sentiment logs" ON public.sentiment_logs;

CREATE POLICY "sentiment_logs: insert own"
  ON public.sentiment_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);


-- ---------------------------------------------------------------
-- 6. inbox_messages: add missing INSERT + DELETE policies
--    (INSERT is used when webhook data is stored via service_role;
--     service_role bypasses RLS, so INSERT is only needed for
--     direct authenticated-user writes — add it for completeness)
-- ---------------------------------------------------------------
CREATE POLICY "inbox_messages: insert own"
  ON public.inbox_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "inbox_messages: delete own"
  ON public.inbox_messages FOR DELETE
  USING (auth.uid() = user_id);
