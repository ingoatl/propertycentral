-- Add is_admin_preview column to owner_portal_sessions for admin-created sessions
ALTER TABLE public.owner_portal_sessions 
ADD COLUMN IF NOT EXISTS is_admin_preview boolean DEFAULT false;

-- Add property_id column to owner_portal_sessions so we can pass property context
ALTER TABLE public.owner_portal_sessions 
ADD COLUMN IF NOT EXISTS property_id uuid;

-- Add property_name column for display purposes
ALTER TABLE public.owner_portal_sessions 
ADD COLUMN IF NOT EXISTS property_name text;