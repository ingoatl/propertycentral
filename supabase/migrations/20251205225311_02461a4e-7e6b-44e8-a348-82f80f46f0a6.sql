-- Add columns to store signing URLs for easy retrieval
ALTER TABLE public.booking_documents 
ADD COLUMN IF NOT EXISTS guest_signing_url text,
ADD COLUMN IF NOT EXISTS host_signing_url text;