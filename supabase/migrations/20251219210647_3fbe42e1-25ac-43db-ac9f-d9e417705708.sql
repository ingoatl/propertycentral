-- Add columns for task assignment and completion tracking to owner_conversation_actions
ALTER TABLE public.owner_conversation_actions 
ADD COLUMN IF NOT EXISTS assigned_to TEXT DEFAULT 'peachhaus',
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_by UUID;