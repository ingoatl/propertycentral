-- Add is_ai_generated flag and lead_id/owner_id to conversation_notes for AI summaries
ALTER TABLE public.conversation_notes 
ADD COLUMN IF NOT EXISTS is_ai_generated boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.property_owners(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS summary_type text; -- 'thread_summary', 'context_note', etc.

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_conversation_notes_lead_id ON public.conversation_notes(lead_id);
CREATE INDEX IF NOT EXISTS idx_conversation_notes_owner_id ON public.conversation_notes(owner_id);
CREATE INDEX IF NOT EXISTS idx_conversation_notes_ai_generated ON public.conversation_notes(is_ai_generated) WHERE is_ai_generated = true;