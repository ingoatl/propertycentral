-- Create table to store marketing activities synced from GuestConnect
CREATE TABLE owner_marketing_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES property_owners(id),
  
  -- Activity Details
  activity_type TEXT NOT NULL,
  platform TEXT,
  title TEXT NOT NULL,
  description TEXT,
  
  -- Metrics (JSON for flexibility)
  metrics JSONB DEFAULT '{}',
  
  -- Source tracking
  external_id TEXT,
  source_project TEXT DEFAULT 'guestconnect',
  activity_url TEXT,
  
  -- Timestamps
  activity_date TIMESTAMPTZ NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast owner portal queries
CREATE INDEX idx_marketing_activities_property ON owner_marketing_activities(property_id);
CREATE INDEX idx_marketing_activities_owner ON owner_marketing_activities(owner_id);
CREATE INDEX idx_marketing_activities_date ON owner_marketing_activities(activity_date DESC);
CREATE INDEX idx_marketing_activities_type ON owner_marketing_activities(activity_type);

-- Prevent duplicates from same source
CREATE UNIQUE INDEX idx_marketing_activities_external 
  ON owner_marketing_activities(external_id, source_project) 
  WHERE external_id IS NOT NULL;

-- Enable RLS
ALTER TABLE owner_marketing_activities ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can do everything
CREATE POLICY "Admins can manage all marketing activities"
ON owner_marketing_activities
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  )
);

-- Policy: Owners can view their own properties' marketing activities
CREATE POLICY "Owners can view their properties marketing activities"
ON owner_marketing_activities
FOR SELECT
USING (
  owner_id IN (
    SELECT id FROM property_owners 
    WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);

-- Add comment for documentation
COMMENT ON TABLE owner_marketing_activities IS 'Stores marketing activities synced from peachhaus-guestconnect project';