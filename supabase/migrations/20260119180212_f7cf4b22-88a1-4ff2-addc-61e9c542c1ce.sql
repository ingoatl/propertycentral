-- Add reply columns to voicemail_messages table
ALTER TABLE public.voicemail_messages 
ADD COLUMN IF NOT EXISTS reply_audio_url text,
ADD COLUMN IF NOT EXISTS reply_recorded_at timestamptz,
ADD COLUMN IF NOT EXISTS reply_duration_seconds integer;

-- Add comment for clarity
COMMENT ON COLUMN public.voicemail_messages.reply_audio_url IS 'URL to the owner reply audio file';
COMMENT ON COLUMN public.voicemail_messages.reply_recorded_at IS 'When the owner recorded their reply';
COMMENT ON COLUMN public.voicemail_messages.reply_duration_seconds IS 'Duration of the reply in seconds';