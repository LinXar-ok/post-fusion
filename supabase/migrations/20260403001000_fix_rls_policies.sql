-- Fix RLS: recreate policies for posts table from scratch

-- Drop existing policies for posts table
DROP POLICY IF EXISTS "Users can view their own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can insert their own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can update their own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can delete their own posts" ON public.posts;

-- Recreate clean RLS policies for posts
CREATE POLICY "Enable insert for users"
    ON public.posts FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Enable select for own posts"
    ON public.posts FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Enable update for own posts"
    ON public.posts FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Enable delete for own posts"
    ON public.posts FOR DELETE
    USING (user_id = auth.uid());

-- Also re-verify social_profiles policies
DROP POLICY IF EXISTS "Users can view their own social profiles" ON public.social_profiles;
DROP POLICY IF EXISTS "Users can insert their own social profiles" ON public.social_profiles;
DROP POLICY IF EXISTS "Users can update their own social profiles" ON public.social_profiles;
DROP POLICY IF EXISTS "Users can delete their own social_profiles" ON public.social_profiles;

CREATE POLICY "Enable insert for social profiles"
    ON public.social_profiles FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Enable select for social profiles"
    ON public.social_profiles FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Enable update for social profiles"
    ON public.social_profiles FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Enable delete for social profiles"
    ON public.social_profiles FOR DELETE
    USING (user_id = auth.uid());

-- Ensure service role can manage all records (for server-side operations)
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_profiles ENABLE ROW LEVEL SECURITY;

-- Add policy to allow authenticated users to insert their own posts
-- This ensures the authenticated session can write to the table
CREATE POLICY "Authenticated users can insert posts"
    ON public.posts FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND user_id = auth.uid()
    );
