-- Drop the existing check constraint and recreate with 'completed' added
ALTER TABLE public.owner_conversation_actions 
DROP CONSTRAINT owner_conversation_actions_status_check;

ALTER TABLE public.owner_conversation_actions 
ADD CONSTRAINT owner_conversation_actions_status_check 
CHECK (status = ANY (ARRAY['suggested'::text, 'created'::text, 'dismissed'::text, 'completed'::text]));