-- Add conversation tracking columns to lead_communications
ALTER TABLE public.lead_communications 
ADD COLUMN IF NOT EXISTS ghl_conversation_id text,
ADD COLUMN IF NOT EXISTS ghl_contact_id text,
ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false;

-- Add has_unread_messages to leads for quick filtering
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS has_unread_messages boolean DEFAULT false;

-- Create index for faster unread queries
CREATE INDEX IF NOT EXISTS idx_lead_communications_is_read 
ON public.lead_communications(lead_id, is_read) 
WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_leads_has_unread 
ON public.leads(has_unread_messages) 
WHERE has_unread_messages = true;

-- Enable realtime for lead_communications
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_communications;