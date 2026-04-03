-- The "permission denied" error is a Postgres-level privilege issue, NOT an RLS issue.
-- The anon and authenticated roles need actual GRANT on the tables themselves.
-- RLS DISABLED was set, but without GRANT the roles still can't access the tables.

-- Grant full CRUD to anon role (needed for REST API and SSR client)
GRANT ALL ON public.posts TO anon;
GRANT ALL ON public.social_profiles TO anon;

-- Grant full CRUD to authenticated role
GRANT ALL ON public.posts TO authenticated;
GRANT ALL ON public.social_profiles TO authenticated;

-- Also grant usage on sequences (for auto-incrementing PKs)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
