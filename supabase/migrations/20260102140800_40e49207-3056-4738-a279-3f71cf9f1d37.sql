-- Add missing unique constraint on lead_communications.external_id
-- This is required for the upsert operations in transcribe-call edge function
CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_communications_external_id_unique 
ON public.lead_communications (external_id) 
WHERE external_id IS NOT NULL;

-- Add missing unique constraint on user_phone_calls.external_id  
-- This is required for the upsert operations in telnyx-inbound-voice edge function
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_phone_calls_external_id_unique 
ON public.user_phone_calls (external_id) 
WHERE external_id IS NOT NULL;