-- Create compliance message log table
CREATE TABLE public.compliance_message_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID,
  original_message TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('sms', 'email')),
  sender_user_id UUID,
  sender_role TEXT,
  recipient_type TEXT,
  
  -- Fair Housing Analysis
  fh_compliant BOOLEAN NOT NULL DEFAULT true,
  fh_risk_score INTEGER DEFAULT 0,
  fh_issues JSONB DEFAULT '[]',
  fh_blocked_phrases TEXT[] DEFAULT '{}',
  
  -- GA License Compliance
  ga_compliant BOOLEAN NOT NULL DEFAULT true,
  requires_broker_review BOOLEAN DEFAULT false,
  topic_classification TEXT,
  
  -- Action taken
  action_taken TEXT CHECK (action_taken IN ('sent', 'blocked', 'modified', 'escalated')),
  modified_message TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create AI circuit breaker table
CREATE TABLE public.ai_circuit_breaker (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT UNIQUE NOT NULL,
  state TEXT CHECK (state IN ('closed', 'open', 'half_open')) DEFAULT 'closed',
  failure_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  last_failure_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error_message TEXT,
  opened_at TIMESTAMPTZ,
  half_open_at TIMESTAMPTZ,
  failure_threshold INTEGER DEFAULT 5,
  success_threshold INTEGER DEFAULT 3,
  reset_timeout_seconds INTEGER DEFAULT 60,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.compliance_message_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_circuit_breaker ENABLE ROW LEVEL SECURITY;

-- Policies for compliance_message_log (admin only)
CREATE POLICY "Admins can view compliance logs"
ON public.compliance_message_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can insert compliance logs"
ON public.compliance_message_log
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policies for ai_circuit_breaker (admin view, service write)
CREATE POLICY "Admins can view circuit breaker"
ON public.ai_circuit_breaker
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can manage circuit breaker"
ON public.ai_circuit_breaker
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Initialize default circuit breakers
INSERT INTO public.ai_circuit_breaker (service_name, state, failure_threshold, reset_timeout_seconds)
VALUES 
  ('unified-ai-compose', 'closed', 5, 60),
  ('generate-market-insights', 'closed', 3, 120),
  ('lovable-ai-gateway', 'closed', 5, 30)
ON CONFLICT (service_name) DO NOTHING;

-- Create index for faster lookups
CREATE INDEX idx_compliance_log_created_at ON public.compliance_message_log(created_at DESC);
CREATE INDEX idx_compliance_log_fh_compliant ON public.compliance_message_log(fh_compliant);
CREATE INDEX idx_circuit_breaker_service ON public.ai_circuit_breaker(service_name);