-- Create inbox_messages table for unified inbox webhook data

CREATE TABLE public.inbox_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    platform_message_id TEXT NOT NULL,
    sender_id TEXT,
    sender_name TEXT NOT NULL,
    sender_handle TEXT,
    sender_avatar_url TEXT,
    content TEXT NOT NULL,
    platform_type TEXT NOT NULL,
    platform_post_url TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    in_reply_to UUID REFERENCES public.inbox_messages(id),
    raw_payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(platform, platform_message_id)
);

ALTER TABLE public.inbox_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own inbox messages"
    ON public.inbox_messages FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own inbox messages"
    ON public.inbox_messages FOR UPDATE
    USING (auth.uid() = user_id);

CREATE INDEX idx_inbox_messages_user_id ON public.inbox_messages(user_id);
CREATE INDEX idx_inbox_messages_user_read ON public.inbox_messages(user_id, is_read);
CREATE INDEX idx_inbox_messages_created ON public.inbox_messages(user_id, created_at DESC);
CREATE INDEX idx_inbox_messages_platform ON public.inbox_messages(user_id, platform);
