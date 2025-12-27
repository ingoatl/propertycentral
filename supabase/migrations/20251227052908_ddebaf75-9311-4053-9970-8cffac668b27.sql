-- Table to store GBP reviews synced from Google
CREATE TABLE public.gbp_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gbp_review_name TEXT UNIQUE NOT NULL,
  reviewer_name TEXT,
  reviewer_profile_photo_url TEXT,
  star_rating INTEGER CHECK (star_rating >= 1 AND star_rating <= 5),
  review_text TEXT,
  review_reply TEXT,
  reply_posted_at TIMESTAMPTZ,
  ai_generated_reply TEXT,
  review_created_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  needs_reply BOOLEAN DEFAULT TRUE,
  auto_replied BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table to store scheduled/posted GBP content
CREATE TABLE public.gbp_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT DEFAULT 'STANDARD' CHECK (content_type IN ('STANDARD', 'EVENT', 'OFFER')),
  summary TEXT NOT NULL,
  media_url TEXT,
  call_to_action_type TEXT,
  call_to_action_url TEXT,
  scheduled_for TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  gbp_post_name TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'posted', 'failed')),
  error_message TEXT,
  ai_generated BOOLEAN DEFAULT FALSE,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for daily content ideas/templates
CREATE TABLE public.gbp_content_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN ('property_highlight', 'local_area', 'seasonal', 'testimonial', 'tip', 'behind_scenes', 'amenity')),
  topic TEXT NOT NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for GBP settings
CREATE TABLE public.gbp_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gbp_account_id TEXT,
  gbp_location_id TEXT,
  auto_reply_enabled BOOLEAN DEFAULT FALSE,
  auto_post_enabled BOOLEAN DEFAULT FALSE,
  post_time TEXT DEFAULT '10:00',
  reply_delay_minutes INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.gbp_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gbp_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gbp_content_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gbp_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for gbp_reviews
CREATE POLICY "Admins can manage GBP reviews" ON public.gbp_reviews
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Approved users can view GBP reviews" ON public.gbp_reviews
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status
  ));

-- RLS policies for gbp_posts
CREATE POLICY "Admins can manage GBP posts" ON public.gbp_posts
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Approved users can view GBP posts" ON public.gbp_posts
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status
  ));

-- RLS policies for gbp_content_ideas
CREATE POLICY "Admins can manage GBP content ideas" ON public.gbp_content_ideas
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Approved users can view GBP content ideas" ON public.gbp_content_ideas
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status
  ));

-- RLS policies for gbp_settings
CREATE POLICY "Admins can manage GBP settings" ON public.gbp_settings
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Approved users can view GBP settings" ON public.gbp_settings
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status
  ));

-- Create updated_at trigger for gbp_reviews
CREATE TRIGGER update_gbp_reviews_updated_at
  BEFORE UPDATE ON public.gbp_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create updated_at trigger for gbp_posts
CREATE TRIGGER update_gbp_posts_updated_at
  BEFORE UPDATE ON public.gbp_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create updated_at trigger for gbp_settings
CREATE TRIGGER update_gbp_settings_updated_at
  BEFORE UPDATE ON public.gbp_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default settings row
INSERT INTO public.gbp_settings (id) VALUES (gen_random_uuid());

-- Seed some initial content ideas
INSERT INTO public.gbp_content_ideas (category, topic) VALUES
  ('property_highlight', 'Showcase our spacious living areas perfect for families'),
  ('property_highlight', 'Feature our fully equipped modern kitchens'),
  ('property_highlight', 'Highlight private outdoor spaces and patios'),
  ('local_area', 'Best coffee shops within walking distance'),
  ('local_area', 'Top-rated restaurants in the neighborhood'),
  ('local_area', 'Weekend farmers markets and local events'),
  ('local_area', 'Parks and outdoor activities nearby'),
  ('tip', 'How to make the most of your Atlanta stay'),
  ('tip', 'Packing essentials for mid-term rentals'),
  ('tip', 'Working remotely from our properties'),
  ('behind_scenes', 'Meet the PeachHaus cleaning team'),
  ('behind_scenes', 'How we prepare properties between guests'),
  ('amenity', 'High-speed WiFi for remote workers'),
  ('amenity', 'Smart home features in our properties'),
  ('amenity', 'Washer/dryer in every unit'),
  ('seasonal', 'Summer in Atlanta - what to expect'),
  ('seasonal', 'Holiday decorations at PeachHaus properties'),
  ('testimonial', 'What our guests are saying about their stays');