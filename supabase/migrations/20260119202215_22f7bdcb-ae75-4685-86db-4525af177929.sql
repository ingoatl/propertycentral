-- Add video support columns to voicemail_messages
ALTER TABLE voicemail_messages 
  ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'audio' CHECK (media_type IN ('audio', 'video')),
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;