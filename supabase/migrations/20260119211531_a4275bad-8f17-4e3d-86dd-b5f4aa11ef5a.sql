-- Make audio_url nullable to support video messages
ALTER TABLE public.voicemail_messages 
ALTER COLUMN audio_url DROP NOT NULL;