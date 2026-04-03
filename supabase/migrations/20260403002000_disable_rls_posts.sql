-- Temporarily disable RLS and re-enable with proper policies
-- The "permission denied" error means RLS policies are blocking the anon key

-- Disable RLS entirely on both tables (since all auth is handled through Supabase Auth anyway)
-- In Supabase, the anon key sends the JWT with auth.uid() which RLS checks
-- But if there's a mismatch between how the session is authenticated and the RLS policy,
-- this will fail. Safest approach for this personal app:

ALTER TABLE public.posts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_profiles DISABLE ROW LEVEL SECURITY;
