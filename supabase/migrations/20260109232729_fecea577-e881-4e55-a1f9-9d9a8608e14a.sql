-- Add 'completed' to the allowed status values for pending_call_recaps
ALTER TABLE public.pending_call_recaps DROP CONSTRAINT IF EXISTS pending_call_recaps_status_check;
ALTER TABLE public.pending_call_recaps ADD CONSTRAINT pending_call_recaps_status_check CHECK (status = ANY (ARRAY['pending'::text, 'sent'::text, 'dismissed'::text, 'completed'::text]));