-- Remove the constraint that blocks unmatched GHL conversations
ALTER TABLE public.lead_communications DROP CONSTRAINT IF EXISTS chk_lead_or_owner;