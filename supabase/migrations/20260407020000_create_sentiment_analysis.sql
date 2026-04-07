-- Sentiment Analysis: sentiment_logs and tracked_keywords tables

-- Table: tracked_keywords
CREATE TABLE public.tracked_keywords (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    keyword TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, keyword)
);

-- Table: sentiment_logs
CREATE TABLE public.sentiment_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    sentiment TEXT NOT NULL,
    confidence FLOAT NOT NULL,
    score FLOAT NOT NULL,
    keywords_found TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes
CREATE INDEX idx_sentiment_logs_user_created ON public.sentiment_logs(user_id, created_at DESC);
CREATE INDEX idx_sentiment_logs_user_sentiment ON public.sentiment_logs(user_id, sentiment);
CREATE INDEX idx_tracked_keywords_user ON public.tracked_keywords(user_id);

-- RLS: tracked_keywords
ALTER TABLE public.tracked_keywords ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own tracked keywords"
    ON public.tracked_keywords FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- RLS: sentiment_logs
ALTER TABLE public.sentiment_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own sentiment logs"
    ON public.sentiment_logs FOR SELECT
    USING (auth.uid() = user_id);
CREATE POLICY "System can insert sentiment logs"
    ON public.sentiment_logs FOR INSERT
    WITH CHECK (true);
