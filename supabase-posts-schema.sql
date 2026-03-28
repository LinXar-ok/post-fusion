-- 1. Create the structured standard "posts" table for Queue & Orchestration
CREATE TABLE IF NOT EXISTS public.posts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  platforms text[] NOT NULL DEFAULT '{}',
  media_urls text[] DEFAULT '{}',
  hashtags text[] DEFAULT '{}',
  emotion text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'publishing', 'published', 'failed')),
  scheduled_for timestamp with time zone,
  published_at timestamp with time zone,
  error_logs jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Secure the table via RLS
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- 3. Authorization policies for the owner
CREATE POLICY "Users can manage their own orchestrated posts"
ON public.posts
AS PERMISSIVE FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4. Grant explicit CRUD permissions to the roles
GRANT ALL ON TABLE public.posts TO authenticated;
GRANT ALL ON TABLE public.posts TO service_role;

-- 5. Setup Supabase Storage for Media Uploads (Requires the 'storage' schema)
-- Note: Make sure the generalized 'storage' extension is active in your Supabase project.
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

-- 6. Create Storage Policies to let users upload imagery
CREATE POLICY "Authenticated users can upload media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'media' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Public profiles can view media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'media');
