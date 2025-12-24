-- Create lead stage enum
CREATE TYPE lead_stage AS ENUM (
  'new_lead',
  'unreached',
  'call_scheduled',
  'call_attended',
  'send_contract',
  'contract_out',
  'contract_signed',
  'ach_form_signed',
  'onboarding_form_requested',
  'insurance_requested',
  'ops_handoff'
);

-- Create lead source enum
CREATE TYPE lead_source AS ENUM (
  'calendar_booking',
  'referral',
  'website',
  'phone_call',
  'email',
  'other'
);

-- Create leads table
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_number SERIAL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  opportunity_source TEXT,
  opportunity_value NUMERIC DEFAULT 0,
  property_address TEXT,
  property_type TEXT,
  stage lead_stage NOT NULL DEFAULT 'new_lead',
  stage_changed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  assigned_to UUID REFERENCES auth.users(id),
  notes TEXT,
  tags TEXT[],
  ai_summary TEXT,
  ai_next_action TEXT,
  ai_qualification_score INTEGER,
  calendar_event_id TEXT,
  property_id UUID REFERENCES public.properties(id),
  owner_id UUID REFERENCES public.property_owners(id),
  project_id UUID REFERENCES public.onboarding_projects(id),
  signwell_document_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create lead timeline table
CREATE TABLE public.lead_timeline (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  performed_by_user_id UUID REFERENCES auth.users(id),
  performed_by_name TEXT,
  previous_stage lead_stage,
  new_stage lead_stage,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create lead automations table
CREATE TABLE public.lead_automations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  trigger_stage lead_stage NOT NULL,
  action_type TEXT NOT NULL, -- 'email', 'sms', 'create_document', 'create_project', 'ai_qualify'
  delay_minutes INTEGER DEFAULT 0,
  template_content TEXT,
  template_subject TEXT,
  ai_enabled BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create lead communications table
CREATE TABLE public.lead_communications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  communication_type TEXT NOT NULL, -- 'email', 'sms'
  direction TEXT NOT NULL DEFAULT 'outbound', -- 'inbound', 'outbound'
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed'
  external_id TEXT, -- Twilio SID or Resend ID
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_communications ENABLE ROW LEVEL SECURITY;

-- RLS policies for leads
CREATE POLICY "Approved users can view all leads"
ON public.leads FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status
));

CREATE POLICY "Approved users can insert leads"
ON public.leads FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status
));

CREATE POLICY "Approved users can update leads"
ON public.leads FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status
));

CREATE POLICY "Approved users can delete leads"
ON public.leads FOR DELETE
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status
));

-- RLS policies for lead_timeline
CREATE POLICY "Approved users can view all lead timeline"
ON public.lead_timeline FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status
));

CREATE POLICY "Approved users can insert lead timeline"
ON public.lead_timeline FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status
));

-- RLS policies for lead_automations
CREATE POLICY "Admins can manage lead automations"
ON public.lead_automations FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Approved users can view lead automations"
ON public.lead_automations FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status
));

-- RLS policies for lead_communications
CREATE POLICY "Approved users can view all lead communications"
ON public.lead_communications FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status
));

CREATE POLICY "Approved users can insert lead communications"
ON public.lead_communications FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status
));

CREATE POLICY "Approved users can update lead communications"
ON public.lead_communications FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status
));

-- Create indexes for performance
CREATE INDEX idx_leads_stage ON public.leads(stage);
CREATE INDEX idx_leads_created_at ON public.leads(created_at DESC);
CREATE INDEX idx_lead_timeline_lead_id ON public.lead_timeline(lead_id);
CREATE INDEX idx_lead_communications_lead_id ON public.lead_communications(lead_id);

-- Create updated_at trigger for leads
CREATE TRIGGER update_leads_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default automations
INSERT INTO public.lead_automations (name, trigger_stage, action_type, delay_minutes, template_content, template_subject, ai_enabled) VALUES
('Welcome SMS', 'new_lead', 'sms', 0, 'Hi {{name}}! Thanks for scheduling a discovery call with PeachHaus. We''re excited to learn about your property. Reply STOP to opt out.', NULL, false),
('Welcome Email', 'new_lead', 'email', 5, 'Hi {{name}},\n\nThank you for your interest in PeachHaus property management! We received your discovery call booking and look forward to speaking with you.\n\nIn the meantime, feel free to explore our website or reply to this email with any questions.\n\nBest regards,\nThe PeachHaus Team', 'Welcome to PeachHaus!', true),
('Follow-up SMS', 'unreached', 'sms', 1440, 'Hi {{name}}, we tried reaching you about your property management inquiry. Would you like to reschedule your discovery call? Reply YES and we''ll send you a new link.', NULL, false),
('Call Reminder', 'call_scheduled', 'sms', 60, 'Reminder: Your PeachHaus discovery call is coming up! We look forward to speaking with you.', NULL, false),
('Contract Reminder', 'contract_out', 'sms', 2880, 'Hi {{name}}, just a friendly reminder that your PeachHaus management agreement is ready for your signature. Let us know if you have any questions!', NULL, false),
('ACH Form Request', 'contract_signed', 'email', 30, 'Hi {{name}},\n\nThank you for signing your management agreement! To complete your onboarding, please set up your payment method for receiving rental income.\n\nClick here to add your bank account: {{ach_link}}\n\nBest regards,\nThe PeachHaus Team', 'Set Up Your Payment Method - PeachHaus', false),
('Onboarding Form Request', 'ach_form_signed', 'email', 30, 'Hi {{name}},\n\nGreat news - your payment method is set up! The next step is to complete your property onboarding form so we can get your listing live.\n\nComplete your onboarding here: {{onboarding_link}}\n\nBest regards,\nThe PeachHaus Team', 'Complete Your Property Onboarding - PeachHaus', false),
('Insurance Request', 'onboarding_form_requested', 'email', 30, 'Hi {{name}},\n\nThank you for completing your onboarding form! The final step is to provide proof of short-term rental insurance.\n\nPlease reply to this email with your insurance documents or upload them here: {{upload_link}}\n\nBest regards,\nThe PeachHaus Team', 'STR Insurance Required - PeachHaus', false);