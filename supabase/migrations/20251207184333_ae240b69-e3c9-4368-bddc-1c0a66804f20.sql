-- Add partner_property_id to onboarding_projects to link partner properties
ALTER TABLE public.onboarding_projects 
ADD COLUMN partner_property_id uuid REFERENCES public.partner_properties(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_onboarding_projects_partner_property_id ON public.onboarding_projects(partner_property_id);