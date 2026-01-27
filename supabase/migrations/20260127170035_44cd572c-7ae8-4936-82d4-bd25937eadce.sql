-- Create social_media_posts table to store posts from GHL and Marketing Hub
CREATE TABLE public.social_media_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- 'instagram', 'facebook', 'tiktok', 'linkedin', 'gmb', 'nextdoor'
  post_type TEXT DEFAULT 'post', -- 'post', 'story', 'reel'
  external_id TEXT, -- GHL post ID
  source TEXT NOT NULL, -- 'ghl_social_planner', 'marketing_hub'
  
  -- Content
  caption TEXT,
  media_url TEXT, -- Primary media URL (image or video)
  media_type TEXT, -- 'image', 'video'
  thumbnail_url TEXT, -- Video thumbnail
  post_url TEXT, -- Live link to the post on the platform
  
  -- Metrics
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  engagement_rate NUMERIC(5,2),
  
  -- Status
  status TEXT DEFAULT 'published', -- 'published', 'scheduled', 'draft'
  published_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ,
  
  -- Sync metadata
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(external_id, source)
);

-- Create indexes for better query performance
CREATE INDEX idx_social_media_posts_property_id ON public.social_media_posts(property_id);
CREATE INDEX idx_social_media_posts_platform ON public.social_media_posts(platform);
CREATE INDEX idx_social_media_posts_published_at ON public.social_media_posts(published_at DESC);

-- Enable RLS
ALTER TABLE public.social_media_posts ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow public read access (owner portal uses magic links)
CREATE POLICY "Anyone can view social media posts" ON public.social_media_posts
  FOR SELECT USING (true);

-- RLS Policy: Only service role can insert/update
CREATE POLICY "Service role can manage social media posts" ON public.social_media_posts
  FOR ALL USING (auth.role() = 'service_role');

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.social_media_posts;