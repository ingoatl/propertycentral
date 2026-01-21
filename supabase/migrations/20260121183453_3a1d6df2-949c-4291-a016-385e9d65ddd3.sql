-- Drop the existing check constraint and recreate with 'awaiting' status included
ALTER TABLE conversation_status DROP CONSTRAINT IF EXISTS conversation_status_status_check;

ALTER TABLE conversation_status ADD CONSTRAINT conversation_status_status_check 
CHECK (status = ANY (ARRAY['open'::text, 'snoozed'::text, 'done'::text, 'archived'::text, 'awaiting'::text]));