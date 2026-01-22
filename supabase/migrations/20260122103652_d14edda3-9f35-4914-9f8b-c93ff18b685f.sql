-- Create guest_screenings table for tracking verification results
CREATE TABLE guest_screenings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES ownerrez_bookings(id) ON DELETE SET NULL,
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE,
  guest_name text NOT NULL,
  guest_email text,
  screening_provider text, -- 'truvi', 'authenticate', 'manual'
  screening_status text CHECK (screening_status IN ('passed', 'failed', 'pending', 'flagged')),
  verification_type text, -- 'id_verified', 'background_check', 'watchlist', 'full'
  id_verified boolean DEFAULT false,
  background_passed boolean DEFAULT null,
  watchlist_clear boolean DEFAULT null,
  risk_score text CHECK (risk_score IN ('low', 'medium', 'high')),
  screening_date timestamptz,
  raw_result jsonb,
  gmail_message_id text UNIQUE,
  notes text,
  owner_notified boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX idx_guest_screenings_booking ON guest_screenings(booking_id);
CREATE INDEX idx_guest_screenings_property ON guest_screenings(property_id);
CREATE INDEX idx_guest_screenings_status ON guest_screenings(screening_status);
CREATE INDEX idx_guest_screenings_date ON guest_screenings(screening_date DESC);

-- Extend ownerrez_bookings with group composition
ALTER TABLE ownerrez_bookings
ADD COLUMN IF NOT EXISTS adults integer,
ADD COLUMN IF NOT EXISTS children integer,
ADD COLUMN IF NOT EXISTS pets integer;

-- Enable RLS
ALTER TABLE guest_screenings ENABLE ROW LEVEL SECURITY;

-- RLS policies for guest_screenings
CREATE POLICY "Admins can manage all screenings"
ON guest_screenings FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Owners can view screenings for properties they own
CREATE POLICY "Owners can view screenings for their properties"
ON guest_screenings FOR SELECT
USING (
  property_id IN (
    SELECT p.id FROM properties p
    WHERE p.owner_id IN (
      SELECT po.id FROM property_owners po WHERE po.email = auth.email()
    )
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_guest_screenings_updated_at
BEFORE UPDATE ON guest_screenings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();