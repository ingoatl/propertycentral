-- Create partner_sync_log table for watchdog monitoring
CREATE TABLE IF NOT EXISTS public.partner_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type text NOT NULL DEFAULT 'incoming',
  source_system text NOT NULL,
  properties_synced integer NOT NULL DEFAULT 0,
  properties_failed integer NOT NULL DEFAULT 0,
  error_details jsonb DEFAULT '[]'::jsonb,
  sync_status text NOT NULL DEFAULT 'completed',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.partner_sync_log ENABLE ROW LEVEL SECURITY;

-- Admins can manage sync logs
CREATE POLICY "Admins can manage partner sync logs"
ON public.partner_sync_log
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Approved users can view sync logs
CREATE POLICY "Approved users can view partner sync logs"
ON public.partner_sync_log
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status
));

-- Create index for efficient queries
CREATE INDEX idx_partner_sync_log_created ON public.partner_sync_log(created_at DESC);
CREATE INDEX idx_partner_sync_log_source ON public.partner_sync_log(source_system);