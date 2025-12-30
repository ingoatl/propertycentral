-- Create lead_email_templates table for managing email content
CREATE TABLE public.lead_email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stage TEXT NOT NULL,
  step_number INTEGER NOT NULL DEFAULT 1,
  template_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_content TEXT NOT NULL,
  protected_sections JSONB DEFAULT '[]'::jsonb,
  ai_enhancement_prompt TEXT,
  use_ai_enhancement BOOLEAN DEFAULT true,
  creativity_level INTEGER DEFAULT 50 CHECK (creativity_level >= 0 AND creativity_level <= 100),
  signature_type TEXT NOT NULL DEFAULT 'ingo' CHECK (signature_type IN ('ingo', 'anja', 'both')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(stage, step_number)
);

-- Enable RLS
ALTER TABLE public.lead_email_templates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Admins can manage email templates"
ON public.lead_email_templates
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Approved users can view email templates"
ON public.lead_email_templates
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid()
  AND profiles.status = 'approved'::account_status
));

-- Create updated_at trigger
CREATE TRIGGER update_lead_email_templates_updated_at
BEFORE UPDATE ON public.lead_email_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert the three templates from the document
INSERT INTO public.lead_email_templates (stage, step_number, template_name, subject, body_content, protected_sections, ai_enhancement_prompt, signature_type) VALUES
(
  'contract_signed',
  1,
  'Welcome to PeachHaus',
  'Welcome to the PeachHaus Family!',
  'Hi {{name}},

Welcome to the PeachHaus family!

We''re excited to get your property {{property_address}} onboarded and earning.

Here''s what happens next:
- Please sign ACH / CC Authorization Form
- We''ll finalize your signed contract and start applying for an STR permit (if needed or requested)
- We will start getting pictures and walkthrough videos scheduled and coordinated
- Our team will start configuring your property in our PMS system and all other internal tools, including your owner portal.

You''ll get updates as each milestone is completed. In the meantime, if you have questions, just reply to this email — our team is here to help.

To a smooth and profitable start,',
  '["ACH / CC Authorization Form", "STR permit", "PMS system", "owner portal"]'::jsonb,
  'Make the email warm and celebratory. Personalize based on the property address and owner name. Keep the milestone list exactly as written. Add a sense of excitement about the partnership.',
  'ingo'
),
(
  'onboarding_form',
  1,
  'Onboarding Form Request',
  'Complete Your Property Onboarding Form',
  'Hi {{name}},

We''re ready to capture your property details for {{property_address}} and lock in the next steps. Please complete the onboarding form below.

- For new STR properties (new setup, not yet listed), use: {{new_str_onboarding_url}}
- For pre-existing STR properties (already furnished and listed), use: {{existing_str_onboarding_url}}

Important:
- Accurate data ensures smooth PMS setup, pricing automation, and guest-ready configuration.
- Missing or incorrect details often cause delays and issues down the road (utilities, smart locks, cleaner assignments, etc.).
- Taking the time now prevents headaches later — for both you and our operations team.

Once submitted, we''ll update your opportunity checklist and move to the next onboarding phase.

Thanks for partnering with PeachHaus — together, we''ll make this property perform at its best.',
  '["{{new_str_onboarding_url}}", "{{existing_str_onboarding_url}}", "Accurate data ensures smooth PMS setup", "Missing or incorrect details often cause delays"]'::jsonb,
  'Emphasize the importance of accurate data without being pushy. Add reassurance that the team is here to help. Keep all the specific consequences and requirements verbatim.',
  'ingo'
),
(
  'insurance_requested',
  1,
  'Insurance Documentation Request',
  'STR Insurance Documentation Required',
  'Hi {{name}},

As part of the onboarding process, we need to confirm that your property has the correct insurance coverage in place before it can go live.

Why this matters:
Standard homeowner''s insurance often provides only limited coverage once paying guests are involved. Even for stays longer than thirty days, many policies exclude or deny claims related to guest damage or liability unless the policy explicitly allows rental use.

What we need you to do first:
Please contact your current insurance provider and ask them to confirm in writing that your policy covers rental stays longer than thirty (30) days and includes liability and property damage related to guest occupancy.

- If your insurer confirms this in writing: great — there is no reason to switch.
- If they cannot confirm this coverage: we recommend exploring a rental-specific policy.

Our recommended option (if needed):
We''ve had very good experience with Steadily, and we''ve negotiated special terms for PeachHaus clients. If your current policy does not fully cover extended rental stays, you can review discounted options here: https://phg.steadilypartner.com/

Additional requirements:
Regardless of the insurer, we also need:
- A copy of your current insurance policy for our records
- Written confirmation of rental coverage (from your insurer or Steadily)
- Confirmation that PeachHaus Group LLC has been added as an Additional Insured

Your property cannot go live until this is completed.

Please reply to this email with the requested documentation attached. If you have questions while speaking with your insurer, let us know — we''re happy to help.',
  '["thirty (30) days", "https://phg.steadilypartner.com/", "PeachHaus Group LLC has been added as an Additional Insured", "Your property cannot go live until this is completed"]'::jsonb,
  'Make the email approachable and helpful. The owner may feel overwhelmed by insurance requirements - add reassurance that the team can help. Keep all legal requirements, the 30-day coverage requirement, the Steadily URL, and the Additional Insured requirement exactly as written.',
  'ingo'
);