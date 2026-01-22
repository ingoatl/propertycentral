-- Add meeting_type column to owner_calls table
ALTER TABLE public.owner_calls 
ADD COLUMN IF NOT EXISTS meeting_type text DEFAULT 'video' 
CHECK (meeting_type IN ('video', 'phone'));

-- Add reminder flags if not exists
ALTER TABLE public.owner_calls 
ADD COLUMN IF NOT EXISTS reminder_48h_sent boolean DEFAULT false;

ALTER TABLE public.owner_calls 
ADD COLUMN IF NOT EXISTS reminder_1h_sent boolean DEFAULT false;