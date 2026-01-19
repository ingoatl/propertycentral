-- Add video MIME types to the message-attachments bucket
UPDATE storage.buckets 
SET allowed_mime_types = ARRAY[
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf', 'application/msword', 
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg', 
  'application/octet-stream',
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'
],
file_size_limit = 104857600  -- 100MB for videos
WHERE id = 'message-attachments';