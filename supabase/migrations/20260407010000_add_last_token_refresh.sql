-- Add last_token_refresh column to social_profiles for monitoring
ALTER TABLE public.social_profiles
ADD COLUMN IF NOT EXISTS last_token_refresh TIMESTAMP WITH TIME ZONE;

-- Add index for efficient querying of soon-to-expire tokens
CREATE INDEX IF NOT EXISTS idx_social_profiles_expiring
ON public.social_profiles (expires_at)
WHERE expires_at IS NOT NULL;
