-- Make signed-documents bucket public so SignWell can access templates
UPDATE storage.buckets 
SET public = true 
WHERE id = 'signed-documents';