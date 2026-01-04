-- Backfill historical statements from monthly_reconciliations
INSERT INTO owner_statement_archive (
  reconciliation_id, property_id, owner_id, statement_number, 
  statement_date, statement_month, recipient_emails, statement_html,
  net_owner_result, total_revenue, total_expenses, management_fee,
  line_items_snapshot, is_revision, revision_number
)
SELECT 
  mr.id as reconciliation_id,
  mr.property_id,
  mr.owner_id,
  'PH-' || to_char(mr.reconciliation_month, 'YYYYMM') || '-' || upper(left(mr.id::text, 8)),
  COALESCE(mr.statement_sent_at::date, mr.updated_at::date),
  mr.reconciliation_month,
  ARRAY[po.email],
  '<backfilled - original HTML not available>',
  mr.net_to_owner,
  mr.total_revenue,
  mr.total_expenses,
  mr.management_fee,
  jsonb_build_object('backfilled', true, 'source', 'monthly_reconciliations'),
  false,
  1
FROM monthly_reconciliations mr
JOIN property_owners po ON po.id = mr.owner_id
WHERE mr.status = 'statement_sent'
  AND NOT EXISTS (
    SELECT 1 FROM owner_statement_archive osa 
    WHERE osa.reconciliation_id = mr.id
  )
ON CONFLICT DO NOTHING;

-- Create audit access tokens table for shareable links
CREATE TABLE IF NOT EXISTS audit_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  created_by UUID REFERENCES profiles(id),
  expires_at TIMESTAMPTZ NOT NULL,
  access_scope JSONB DEFAULT '{"all": true}'::jsonb,
  accessed_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  accessed_from_ips TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on audit_access_tokens
ALTER TABLE audit_access_tokens ENABLE ROW LEVEL SECURITY;

-- Admins can manage audit tokens
CREATE POLICY "Admins can manage audit tokens" ON audit_access_tokens
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Public can read tokens for validation (but only the token column for lookup)
CREATE POLICY "Public can validate tokens" ON audit_access_tokens
  FOR SELECT USING (is_active = true AND expires_at > now());

-- Create management agreements table
CREATE TABLE IF NOT EXISTS management_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES property_owners(id) ON DELETE CASCADE,
  agreement_date DATE NOT NULL,
  effective_date DATE NOT NULL,
  termination_date DATE,
  management_fee_percentage NUMERIC,
  order_minimum_fee NUMERIC,
  additional_fees JSONB DEFAULT '{}'::jsonb,
  document_path TEXT,
  signed_by_owner BOOLEAN DEFAULT false,
  signed_by_owner_at TIMESTAMPTZ,
  signed_by_company BOOLEAN DEFAULT false,
  signed_by_company_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'terminated', 'expired')),
  termination_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on management_agreements
ALTER TABLE management_agreements ENABLE ROW LEVEL SECURITY;

-- Admins can manage agreements
CREATE POLICY "Admins can manage agreements" ON management_agreements
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Approved users can view agreements
CREATE POLICY "Approved users can view agreements" ON management_agreements
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status
  ));

-- Create tenant applications table for fair housing compliance
CREATE TABLE IF NOT EXISTS tenant_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  applicant_name TEXT NOT NULL,
  applicant_email TEXT,
  applicant_phone TEXT,
  application_date DATE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'withdrawn', 'incomplete')),
  decision_date DATE,
  decision_reason TEXT,
  screening_criteria_used JSONB DEFAULT '{}'::jsonb,
  income_requirement_met BOOLEAN,
  credit_check_passed BOOLEAN,
  background_check_passed BOOLEAN,
  rental_history_verified BOOLEAN,
  income_verified BOOLEAN,
  references_checked BOOLEAN,
  decision_made_by UUID REFERENCES profiles(id),
  denial_letter_sent BOOLEAN DEFAULT false,
  denial_letter_sent_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on tenant_applications
ALTER TABLE tenant_applications ENABLE ROW LEVEL SECURITY;

-- Admins can manage applications
CREATE POLICY "Admins can manage tenant applications" ON tenant_applications
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Approved users can view applications
CREATE POLICY "Approved users can view tenant applications" ON tenant_applications
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status
  ));

-- Create accommodation requests table for fair housing
CREATE TABLE IF NOT EXISTS accommodation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  tenant_name TEXT NOT NULL,
  tenant_email TEXT,
  request_date DATE NOT NULL,
  request_type TEXT CHECK (request_type IN ('service_animal', 'emotional_support_animal', 'physical_modification', 'policy_exception', 'other')),
  request_description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'more_info_needed')),
  decision_date DATE,
  decision_reason TEXT,
  decision_made_by UUID REFERENCES profiles(id),
  documentation_received BOOLEAN DEFAULT false,
  documentation_path TEXT,
  interactive_process_notes TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on accommodation_requests
ALTER TABLE accommodation_requests ENABLE ROW LEVEL SECURITY;

-- Admins can manage accommodation requests
CREATE POLICY "Admins can manage accommodation requests" ON accommodation_requests
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Approved users can view accommodation requests
CREATE POLICY "Approved users can view accommodation requests" ON accommodation_requests
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status
  ));

-- Create compliance training log table
CREATE TABLE IF NOT EXISTS compliance_training_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  training_type TEXT NOT NULL CHECK (training_type IN ('fair_housing', 'grec_law', 'safety', 'sexual_harassment', 'ada_compliance', 'other')),
  training_name TEXT NOT NULL,
  training_date DATE NOT NULL,
  training_provider TEXT,
  certificate_path TEXT,
  expiration_date DATE,
  hours_completed NUMERIC,
  passed BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on compliance_training_log
ALTER TABLE compliance_training_log ENABLE ROW LEVEL SECURITY;

-- Admins can manage training logs
CREATE POLICY "Admins can manage training logs" ON compliance_training_log
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Approved users can view training logs
CREATE POLICY "Approved users can view training logs" ON compliance_training_log
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status
  ));

-- Create audit access log for tracking who viewed what
CREATE TABLE IF NOT EXISTS audit_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID REFERENCES audit_access_tokens(id) ON DELETE CASCADE,
  accessed_at TIMESTAMPTZ DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  sections_viewed TEXT[] DEFAULT '{}'
);

-- Enable RLS on audit_access_log
ALTER TABLE audit_access_log ENABLE ROW LEVEL SECURITY;

-- Allow insert for logging (no auth required for public audit portal)
CREATE POLICY "Allow insert for audit logging" ON audit_access_log
  FOR INSERT WITH CHECK (true);

-- Admins can view audit logs
CREATE POLICY "Admins can view audit access logs" ON audit_access_log
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));