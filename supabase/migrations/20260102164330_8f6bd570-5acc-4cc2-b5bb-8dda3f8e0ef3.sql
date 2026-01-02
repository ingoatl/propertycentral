-- Create pending_task_confirmations table for approval workflow
CREATE TABLE public.pending_task_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL CHECK (source_type IN ('email', 'sms', 'call_transcript', 'manual', 'owner_conversation')),
  source_id UUID,
  property_id UUID REFERENCES public.properties(id),
  owner_id UUID REFERENCES public.property_owners(id),
  
  -- Task details
  task_title TEXT NOT NULL,
  task_description TEXT,
  task_category TEXT,
  phase_suggestion INTEGER,
  priority TEXT DEFAULT 'medium',
  source_quote TEXT,
  
  -- Approval workflow
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'auto_approved')),
  assigned_to_user_id UUID,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Created task reference
  created_task_id UUID,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days')
);

-- Create watchdog_logs table for system health monitoring
CREATE TABLE public.watchdog_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at TIMESTAMPTZ DEFAULT now(),
  check_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('healthy', 'warning', 'error')),
  details JSONB DEFAULT '{}'::jsonb,
  emails_scanned INTEGER DEFAULT 0,
  owner_emails_detected INTEGER DEFAULT 0,
  tasks_extracted INTEGER DEFAULT 0,
  tasks_confirmed INTEGER DEFAULT 0,
  issues_found TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pending_task_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchdog_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for pending_task_confirmations
CREATE POLICY "Admins can manage all confirmations"
ON public.pending_task_confirmations FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their assigned confirmations"
ON public.pending_task_confirmations FOR SELECT
USING (assigned_to_user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can update their assigned confirmations"
ON public.pending_task_confirmations FOR UPDATE
USING (assigned_to_user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for watchdog_logs
CREATE POLICY "Admins can manage watchdog logs"
ON public.watchdog_logs FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Approved users can view watchdog logs"
ON public.watchdog_logs FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status
));

-- Enable realtime for pending_task_confirmations
ALTER PUBLICATION supabase_realtime ADD TABLE public.pending_task_confirmations;

-- Create indexes for performance
CREATE INDEX idx_pending_confirmations_status ON public.pending_task_confirmations(status);
CREATE INDEX idx_pending_confirmations_assigned ON public.pending_task_confirmations(assigned_to_user_id);
CREATE INDEX idx_pending_confirmations_property ON public.pending_task_confirmations(property_id);
CREATE INDEX idx_watchdog_logs_run_at ON public.watchdog_logs(run_at DESC);