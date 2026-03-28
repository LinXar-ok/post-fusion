-- 1. Grant root schema permissions to Supabase's default roles (Fixes "permission denied for schema public")
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- 2. Drop the original Prisma-generated tables to prevent conflicts and start fresh with Native Supabase
DROP TABLE IF EXISTS public."Post" CASCADE;
DROP TABLE IF EXISTS public."SocialProfile" CASCADE;
DROP TABLE IF EXISTS public."Session" CASCADE;
DROP TABLE IF EXISTS public."Account" CASCADE;
DROP TABLE IF EXISTS public."User" CASCADE;
DROP TABLE IF EXISTS public."_prisma_migrations" CASCADE;

-- 3. Create the proper highly-optimized "social_profiles" mapping table connected directly to Supabase Auth
CREATE TABLE IF NOT EXISTS public.social_profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL,
  profile_id text NOT NULL,
  profile_name text NOT NULL,
  avatar_url text,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(platform, profile_id)
);

-- 4. Secure the table via Row Level Security (RLS)
ALTER TABLE public.social_profiles ENABLE ROW LEVEL SECURITY;

-- 5. Establish full CRUD authorization exclusively for the logged-in owner
CREATE POLICY "Users can manage their own profiles"
ON public.social_profiles
AS PERMISSIVE FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 6. Explicitly grant permission onto the specific table
GRANT ALL ON TABLE public.social_profiles TO authenticated;
GRANT ALL ON TABLE public.social_profiles TO service_role;
