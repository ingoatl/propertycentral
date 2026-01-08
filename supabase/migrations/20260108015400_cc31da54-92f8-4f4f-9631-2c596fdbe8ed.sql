-- Add new columns for rental strategy and listing info
ALTER TABLE public.discovery_calls 
  ADD COLUMN IF NOT EXISTS rental_strategy TEXT,
  ADD COLUMN IF NOT EXISTS existing_listing_url TEXT,
  ADD COLUMN IF NOT EXISTS current_situation TEXT;