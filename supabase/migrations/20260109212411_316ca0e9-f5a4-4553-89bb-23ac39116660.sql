-- Create pending_actions table for cross-channel action detection
CREATE TABLE IF NOT EXISTS public.pending_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES public.property_owners(id),
  lead_id uuid REFERENCES public.leads(id),
  property_id uuid REFERENCES public.properties(id),
  communication_id uuid,
  action_type text NOT NULL, -- 'callback', 'task', 'alert', 'escalation', 'payment_reminder'
  title text NOT NULL,
  description text,
  urgency text DEFAULT 'normal', -- 'critical', 'high', 'normal', 'low'
  suggested_response text,
  channel text, -- 'call', 'sms', 'email'
  detected_intent text, -- 'complaint', 'urgent_maintenance', 'booking_inquiry', 'payment_issue', 'cancellation_risk'
  sentiment_score numeric(3,2),
  status text DEFAULT 'pending', -- 'pending', 'approved', 'dismissed', 'auto_resolved'
  approved_by uuid,
  approved_at timestamptz,
  dismissed_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pending_actions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read and update
CREATE POLICY "Authenticated users can read pending_actions"
  ON public.pending_actions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert pending_actions"
  ON public.pending_actions FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update pending_actions"
  ON public.pending_actions FOR UPDATE
  TO authenticated USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.pending_actions;

-- Fix historical call dates from metadata
UPDATE public.lead_communications
SET created_at = COALESCE(
  (metadata->'ghl_data'->>'createdAt')::timestamptz,
  (metadata->'ghl_data'->>'dateAdded')::timestamptz,
  (metadata->>'dateAdded')::timestamptz,
  created_at
)
WHERE communication_type = 'call'
  AND (
    metadata->'ghl_data'->>'createdAt' IS NOT NULL OR
    metadata->'ghl_data'->>'dateAdded' IS NOT NULL OR
    metadata->>'dateAdded' IS NOT NULL
  );