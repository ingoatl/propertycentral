-- Create storage bucket for owner voice recaps
INSERT INTO storage.buckets (id, name, public)
VALUES ('owner-voice-recaps', 'owner-voice-recaps', true)
ON CONFLICT (id) DO NOTHING;

-- Create policy for public read access
CREATE POLICY "Owner voice recaps are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'owner-voice-recaps');

-- Create policy for authenticated users to upload
CREATE POLICY "Authenticated users can upload voice recaps"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'owner-voice-recaps');

-- Create policy for service role to manage
CREATE POLICY "Service role can manage voice recaps"
ON storage.objects FOR ALL
USING (bucket_id = 'owner-voice-recaps');

-- Create tracking table for sent recaps
CREATE TABLE public.owner_monthly_recaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES property_owners(id) ON DELETE CASCADE,
  recap_month DATE NOT NULL,
  email_sent BOOLEAN DEFAULT FALSE,
  sms_sent BOOLEAN DEFAULT FALSE,
  audio_url TEXT,
  voice_script TEXT,
  email_sent_at TIMESTAMPTZ,
  sms_sent_at TIMESTAMPTZ,
  metrics JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint to prevent duplicates
CREATE UNIQUE INDEX idx_owner_monthly_recaps_unique 
ON owner_monthly_recaps(property_id, recap_month);

-- Add indexes for queries
CREATE INDEX idx_owner_monthly_recaps_owner ON owner_monthly_recaps(owner_id);
CREATE INDEX idx_owner_monthly_recaps_month ON owner_monthly_recaps(recap_month);

-- Enable RLS
ALTER TABLE public.owner_monthly_recaps ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage all recaps"
ON owner_monthly_recaps FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Owners can view their own recaps"
ON owner_monthly_recaps FOR SELECT
USING (
  owner_id IN (
    SELECT id FROM property_owners WHERE email = (SELECT email FROM profiles WHERE id = auth.uid())
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_owner_monthly_recaps_updated_at
BEFORE UPDATE ON owner_monthly_recaps
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();