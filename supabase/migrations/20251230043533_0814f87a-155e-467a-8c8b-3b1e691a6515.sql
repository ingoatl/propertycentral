-- Add header_image_url column to lead_email_templates
ALTER TABLE public.lead_email_templates 
ADD COLUMN header_image_url text;

-- Update the Contract Signed Welcome template with the celebration GIF
UPDATE public.lead_email_templates 
SET 
  header_image_url = 'https://storage.googleapis.com/highlevel-backend.appspot.com/location/xlvBBzSp6gNM8H8fYNlr/workflow/929fb132-e7ea-43d8-a7d9-9aa4b4b03c66/aed8c70b-76cf-4729-971f-3a36f7125065.gif?alt=media&token=606b1c6b-6f8b-40e2-8d5d-b41413263e3f',
  ai_enhancement_prompt = 'Make this email feel like a genuine celebration! Reference any details from their discovery call. If they had specific concerns, add a reassuring line. Match their communication style - if they''ve been formal, stay professional; if casual, be warm and friendly. Make it feel like Anja personally wrote this welcome note to them after their exciting decision to join PeachHaus. Add enthusiasm about their specific property address. Keep all milestone steps and links exactly as written.',
  body_content = 'Hi {{name}},

Welcome to the PeachHaus family! 🎉

We''re thrilled to have you and can''t wait to get {{property_address}} onboarded and earning for you.

Here''s what happens next:

✅ **Step 1:** Please sign the ACH / CC Authorization Form (link will be sent separately)
✅ **Step 2:** We''ll finalize your signed contract and start applying for an STR permit (if needed)
✅ **Step 3:** We''ll schedule professional photography and walkthrough videos
✅ **Step 4:** Our team will configure your property in our PMS system and owner portal

You''ll receive updates as each milestone is completed. In the meantime, if you have any questions at all, just reply to this email — our team is here to help every step of the way.

Here''s to a smooth and profitable start!'
WHERE template_name = 'Welcome to PeachHaus';

-- Add template_id column to lead_follow_up_steps for linking
ALTER TABLE public.lead_follow_up_steps 
ADD COLUMN template_id uuid REFERENCES public.lead_email_templates(id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_lead_follow_up_steps_template_id ON public.lead_follow_up_steps(template_id);