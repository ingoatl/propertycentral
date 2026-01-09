-- Add ghl_message_id column for deduplication
ALTER TABLE lead_communications 
ADD COLUMN IF NOT EXISTS ghl_message_id TEXT;

-- Add ghl_conversation_id for thread grouping
ALTER TABLE lead_communications 
ADD COLUMN IF NOT EXISTS ghl_conversation_id TEXT;

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_lead_comms_ghl_message_id 
ON lead_communications(ghl_message_id) WHERE ghl_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lead_comms_ghl_conversation_id 
ON lead_communications(ghl_conversation_id) WHERE ghl_conversation_id IS NOT NULL;