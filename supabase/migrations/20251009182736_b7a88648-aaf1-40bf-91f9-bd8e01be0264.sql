
-- Add section_header to the field_type check constraint
ALTER TABLE onboarding_tasks DROP CONSTRAINT IF EXISTS onboarding_tasks_field_type_check;

ALTER TABLE onboarding_tasks 
ADD CONSTRAINT onboarding_tasks_field_type_check 
CHECK (field_type = ANY (ARRAY['text'::text, 'textarea'::text, 'checkbox'::text, 'date'::text, 'file'::text, 'currency'::text, 'phone'::text, 'radio'::text, 'multiselect'::text, 'section_header'::text]));
