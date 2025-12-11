-- Table to store OwnerRez reviews (5-star only)
CREATE TABLE public.ownerrez_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id TEXT NOT NULL,
  ownerrez_review_id TEXT UNIQUE,
  guest_name TEXT,
  guest_phone TEXT,
  guest_email TEXT,
  property_id UUID REFERENCES public.properties(id),
  review_source TEXT, -- 'Airbnb', 'VRBO'
  star_rating INTEGER,
  review_text TEXT,
  review_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table to track Google Review conversion workflow
CREATE TABLE public.google_review_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID REFERENCES public.ownerrez_reviews(id),
  guest_phone TEXT NOT NULL,
  workflow_status TEXT DEFAULT 'pending', -- 'pending', 'permission_asked', 'permission_granted', 'link_sent', 'completed', 'ignored'
  permission_asked_at TIMESTAMP WITH TIME ZONE,
  permission_granted_at TIMESTAMP WITH TIME ZONE,
  link_sent_at TIMESTAMP WITH TIME ZONE,
  link_clicked_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  nudge_count INTEGER DEFAULT 0,
  last_nudge_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table to log all SMS messages sent
CREATE TABLE public.sms_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.google_review_requests(id),
  phone_number TEXT NOT NULL,
  message_type TEXT, -- 'permission_ask', 'nudge', 'link_delivery', 'review_text', 'final_reminder'
  message_body TEXT,
  twilio_sid TEXT,
  status TEXT DEFAULT 'sent',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.ownerrez_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_review_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ownerrez_reviews
CREATE POLICY "Admins can manage ownerrez reviews"
ON public.ownerrez_reviews FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Approved users can view ownerrez reviews"
ON public.ownerrez_reviews FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid()
  AND profiles.status = 'approved'::account_status
));

-- RLS Policies for google_review_requests
CREATE POLICY "Admins can manage google review requests"
ON public.google_review_requests FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Approved users can view google review requests"
ON public.google_review_requests FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid()
  AND profiles.status = 'approved'::account_status
));

-- RLS Policies for sms_log
CREATE POLICY "Admins can manage sms logs"
ON public.sms_log FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Approved users can view sms logs"
ON public.sms_log FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid()
  AND profiles.status = 'approved'::account_status
));

-- Create index for faster lookups
CREATE INDEX idx_ownerrez_reviews_booking_id ON public.ownerrez_reviews(booking_id);
CREATE INDEX idx_google_review_requests_status ON public.google_review_requests(workflow_status);
CREATE INDEX idx_google_review_requests_review_id ON public.google_review_requests(review_id);