-- Add 5-minute reminder tracking columns
ALTER TABLE discovery_calls 
ADD COLUMN IF NOT EXISTS reminder_5min_sent BOOLEAN DEFAULT false;

ALTER TABLE owner_calls 
ADD COLUMN IF NOT EXISTS reminder_5min_sent BOOLEAN DEFAULT false;

-- Create admin call alerts table for real-time notifications
CREATE TABLE IF NOT EXISTS admin_call_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL,
  call_type TEXT NOT NULL CHECK (call_type IN ('discovery', 'owner', 'team_appointment')),
  admin_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  admin_phone TEXT,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('5min', 'due')),
  contact_name TEXT,
  property_address TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  meeting_link TEXT,
  phone_number TEXT,
  phone_call_sent BOOLEAN DEFAULT false,
  phone_call_sid TEXT,
  dismissed BOOLEAN DEFAULT false,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE admin_call_alerts ENABLE ROW LEVEL SECURITY;

-- Policies for admin_call_alerts
CREATE POLICY "Users can view their own alerts"
ON admin_call_alerts
FOR SELECT
USING (admin_user_id = auth.uid());

CREATE POLICY "Users can update their own alerts"
ON admin_call_alerts
FOR UPDATE
USING (admin_user_id = auth.uid());

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_admin_call_alerts_scheduled 
ON admin_call_alerts(scheduled_at) 
WHERE dismissed = false;