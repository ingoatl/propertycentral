-- Drop existing constraint and add updated one with 'replied' status
ALTER TABLE public.voicemail_messages 
DROP CONSTRAINT IF EXISTS voicemail_messages_status_check;

ALTER TABLE public.voicemail_messages 
ADD CONSTRAINT voicemail_messages_status_check 
CHECK (status = ANY (ARRAY['pending'::text, 'sent'::text, 'delivered'::text, 'opened'::text, 'played'::text, 'failed'::text, 'replied'::text]));