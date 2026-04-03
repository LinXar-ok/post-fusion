-- Fix posts table: add missing columns and relax constraints

-- Add platforms array (which platforms this post targets)
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS platforms TEXT[] NOT NULL DEFAULT '{}';

-- Add hashtags array
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS hashtags TEXT[];

-- Add tone/emotion metadata
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS emotion TEXT;

-- Add error_logs for publish results
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS error_logs JSONB;

-- social_profile_id was never used by the publish API — make it nullable
ALTER TABLE public.posts
  ALTER COLUMN social_profile_id DROP NOT NULL;

-- Normalise status default to lowercase to match application code
ALTER TABLE public.posts
  ALTER COLUMN status SET DEFAULT 'draft';
