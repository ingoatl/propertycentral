-- Follow-up scheduling tables for enhanced leads pipeline

-- Lead follow-up sequences (templates for multi-step follow-ups)
CREATE TABLE public.lead_follow_up_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  trigger_stage TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  stop_on_response BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.lead_follow_up_sequences ENABLE ROW LEVEL SECURITY;

-- RLS policies for sequences
CREATE POLICY "Approved users can view sequences" ON public.lead_follow_up_sequences
  FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status));

CREATE POLICY "Admins can manage sequences" ON public.lead_follow_up_sequences
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Lead follow-up steps (individual steps within a sequence)
CREATE TABLE public.lead_follow_up_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID REFERENCES public.lead_follow_up_sequences(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  delay_days INTEGER NOT NULL DEFAULT 0,
  delay_hours INTEGER NOT NULL DEFAULT 0,
  action_type TEXT NOT NULL CHECK (action_type IN ('email', 'sms', 'both')),
  template_subject TEXT,
  template_content TEXT NOT NULL,
  send_time TIME DEFAULT '11:00:00',
  send_days TEXT[] DEFAULT ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  ai_personalize BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.lead_follow_up_steps ENABLE ROW LEVEL SECURITY;

-- RLS policies for steps
CREATE POLICY "Approved users can view steps" ON public.lead_follow_up_steps
  FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status));

CREATE POLICY "Admins can manage steps" ON public.lead_follow_up_steps
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Scheduled follow-ups (actual scheduled messages for leads)
CREATE TABLE public.lead_follow_up_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  sequence_id UUID REFERENCES public.lead_follow_up_sequences(id) ON DELETE SET NULL,
  step_id UUID REFERENCES public.lead_follow_up_steps(id) ON DELETE SET NULL,
  step_number INTEGER DEFAULT 1,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled', 'failed', 'skipped')),
  attempt_count INTEGER DEFAULT 0,
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.lead_follow_up_schedules ENABLE ROW LEVEL SECURITY;

-- RLS policies for schedules
CREATE POLICY "Approved users can view schedules" ON public.lead_follow_up_schedules
  FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status));

CREATE POLICY "Approved users can manage schedules" ON public.lead_follow_up_schedules
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status));

-- Add tracking columns to lead_communications
ALTER TABLE public.lead_communications 
  ADD COLUMN IF NOT EXISTS sequence_id UUID REFERENCES public.lead_follow_up_sequences(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS step_number INTEGER,
  ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS delivery_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ;

-- Add response tracking to leads table
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_response_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS follow_up_paused BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS active_sequence_id UUID REFERENCES public.lead_follow_up_sequences(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_follow_up_schedules_pending ON public.lead_follow_up_schedules(scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_follow_up_schedules_lead ON public.lead_follow_up_schedules(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_communications_sequence ON public.lead_communications(sequence_id);

-- Insert default follow-up sequences based on research

-- Unreached sequence (5 steps over 30 days)
INSERT INTO public.lead_follow_up_sequences (name, trigger_stage, description) VALUES
('Re-engage Unreached Lead', 'unreached', 'Research-based 5-step sequence for leads who haven''t responded. Based on studies showing 80% of sales require 5+ follow-ups.');

INSERT INTO public.lead_follow_up_steps (sequence_id, step_number, delay_days, delay_hours, action_type, template_subject, template_content, send_time) VALUES
((SELECT id FROM public.lead_follow_up_sequences WHERE name = 'Re-engage Unreached Lead'), 1, 1, 0, 'sms', NULL, 'Hi {{name}}, this is Anja from PeachHaus 🍑 Just wanted to make sure you received our property management info. Any questions I can answer?', '11:00:00'),
((SELECT id FROM public.lead_follow_up_sequences WHERE name = 'Re-engage Unreached Lead'), 2, 3, 0, 'email', 'Quick question about your property', 'Hi {{name}},

I noticed we haven''t connected yet about your property at {{property_address}}. No pressure at all - I just wanted to share a quick success story.

We recently helped a property owner in your area increase their monthly revenue by 40% through our dynamic pricing and professional management.

Would you be open to a quick 15-minute call to see if we might be a good fit?

Best,
Anja
PeachHaus Property Management', '11:00:00'),
((SELECT id FROM public.lead_follow_up_sequences WHERE name = 'Re-engage Unreached Lead'), 3, 7, 0, 'sms', NULL, 'Hey {{name}}, just checking in one more time. If this isn''t a good time, no worries! Feel free to reach out whenever you''re ready. - Anja @ PeachHaus', '14:00:00'),
((SELECT id FROM public.lead_follow_up_sequences WHERE name = 'Re-engage Unreached Lead'), 4, 14, 0, 'email', 'Different approach?', 'Hi {{name}},

I know life gets busy, so I wanted to offer an alternative. Instead of a call, I''d be happy to:

• Send over a free rental analysis for your property
• Answer any questions via email
• Connect you with one of our current property owners for a reference

Just reply with what works best for you!

Warmly,
Anja', '11:00:00'),
((SELECT id FROM public.lead_follow_up_sequences WHERE name = 'Re-engage Unreached Lead'), 5, 30, 0, 'both', 'Closing the loop', 'Hi {{name}},

This will be my last reach-out for now. I don''t want to be a bother, but I also don''t want you to miss out if you''re still interested in property management.

Our door is always open if you''d like to chat in the future. Just reply to this email or text me anytime!

Wishing you the best,
Anja
PeachHaus 🍑', '11:00:00');

-- Contract reminder sequence
INSERT INTO public.lead_follow_up_sequences (name, trigger_stage, description) VALUES
('Contract Signature Reminders', 'contract_out', 'Gentle reminders for unsigned contracts. Psychologically optimized intervals.');

INSERT INTO public.lead_follow_up_steps (sequence_id, step_number, delay_days, delay_hours, action_type, template_subject, template_content, send_time) VALUES
((SELECT id FROM public.lead_follow_up_sequences WHERE name = 'Contract Signature Reminders'), 1, 2, 0, 'sms', NULL, 'Hi {{name}}! Just a friendly reminder about the management agreement I sent over. Let me know if you have any questions! - Anja', '10:00:00'),
((SELECT id FROM public.lead_follow_up_sequences WHERE name = 'Contract Signature Reminders'), 2, 5, 0, 'email', 'Quick follow-up on your agreement', 'Hi {{name}},

I wanted to check in on the management agreement I sent. I know contracts can sometimes raise questions!

Is there anything specific you''d like me to clarify? Happy to hop on a quick call or address anything via email.

Looking forward to getting started!

Best,
Anja', '11:00:00'),
((SELECT id FROM public.lead_follow_up_sequences WHERE name = 'Contract Signature Reminders'), 3, 10, 0, 'sms', NULL, 'Hey {{name}}, just circling back on the contract. Would it help to schedule a quick call to walk through any questions? - Anja @ PeachHaus', '14:00:00');

-- ACH form reminders
INSERT INTO public.lead_follow_up_sequences (name, trigger_stage, description) VALUES
('ACH Form Reminders', 'contract_signed', 'Follow-ups for ACH/payment form completion.');

INSERT INTO public.lead_follow_up_steps (sequence_id, step_number, delay_days, delay_hours, action_type, template_subject, template_content, send_time) VALUES
((SELECT id FROM public.lead_follow_up_sequences WHERE name = 'ACH Form Reminders'), 1, 1, 0, 'sms', NULL, 'Congrats {{name}}! 🎉 Your contract is signed. Next step: complete your ACH form so we can send you payments! Here''s the link: {{ach_link}}', '10:00:00'),
((SELECT id FROM public.lead_follow_up_sequences WHERE name = 'ACH Form Reminders'), 2, 3, 0, 'email', 'Complete your payment setup', 'Hi {{name}},

Great news - your management agreement is all set! 

To ensure smooth payment processing, please complete your ACH form at your earliest convenience: {{ach_link}}

This typically takes just 2-3 minutes and allows us to direct deposit your rental income.

Questions? Just reply to this email!

Best,
Anja', '11:00:00'),
((SELECT id FROM public.lead_follow_up_sequences WHERE name = 'ACH Form Reminders'), 3, 7, 0, 'sms', NULL, 'Quick reminder {{name}} - we still need your ACH form to start sending payments. Takes just 2 min: {{ach_link}} - Anja', '11:00:00');

-- Onboarding form reminders
INSERT INTO public.lead_follow_up_sequences (name, trigger_stage, description) VALUES
('Onboarding Form Reminders', 'onboarding_form_requested', 'Follow-ups for property onboarding form.');

INSERT INTO public.lead_follow_up_steps (sequence_id, step_number, delay_days, delay_hours, action_type, template_subject, template_content, send_time) VALUES
((SELECT id FROM public.lead_follow_up_sequences WHERE name = 'Onboarding Form Reminders'), 1, 1, 0, 'sms', NULL, 'Hey {{name}}! Ready to get your property set up. Please fill out the onboarding form when you get a chance: {{onboarding_link}} - Anja', '10:00:00'),
((SELECT id FROM public.lead_follow_up_sequences WHERE name = 'Onboarding Form Reminders'), 2, 4, 0, 'email', 'Your property onboarding form', 'Hi {{name}},

We''re excited to get your property ready for guests! 

Please complete the onboarding form so we can gather all the details we need: {{onboarding_link}}

This includes info about property access, amenities, and your preferences.

Can''t wait to get started!

Best,
Anja', '11:00:00');