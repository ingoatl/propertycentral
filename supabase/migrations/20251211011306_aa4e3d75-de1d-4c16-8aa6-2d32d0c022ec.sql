-- Add opt-out tracking columns to google_review_requests
ALTER TABLE public.google_review_requests 
ADD COLUMN IF NOT EXISTS opted_out BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS opted_out_at TIMESTAMPTZ;