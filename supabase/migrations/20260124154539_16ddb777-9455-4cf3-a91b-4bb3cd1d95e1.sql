-- Add text reply columns to voicemail_messages table
ALTER TABLE public.voicemail_messages 
ADD COLUMN IF NOT EXISTS reply_text text,
ADD COLUMN IF NOT EXISTS reply_text_sent_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS reply_method text;

-- Add check constraint for reply_method
ALTER TABLE public.voicemail_messages
DROP CONSTRAINT IF EXISTS voicemail_messages_reply_method_check;

ALTER TABLE public.voicemail_messages
ADD CONSTRAINT voicemail_messages_reply_method_check 
CHECK (reply_method IS NULL OR reply_method IN ('voice', 'text', 'both'));