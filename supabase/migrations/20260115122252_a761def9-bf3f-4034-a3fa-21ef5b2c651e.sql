-- Phase 1: Add unique constraint on external_id for reliable upserts
-- First check for duplicates and keep only the newest for each external_id
WITH duplicates AS (
  SELECT id,
         external_id,
         ROW_NUMBER() OVER (PARTITION BY external_id ORDER BY created_at DESC) as rn
  FROM lead_communications
  WHERE external_id IS NOT NULL
)
DELETE FROM lead_communications
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Now add the unique constraint
ALTER TABLE lead_communications 
ADD CONSTRAINT lead_communications_external_id_unique UNIQUE (external_id);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_lead_communications_external_id 
ON lead_communications(external_id) WHERE external_id IS NOT NULL;

-- Add composite indexes for common query patterns (performance optimization)
CREATE INDEX IF NOT EXISTS idx_lead_comms_type_created 
ON lead_communications(communication_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_comms_assigned_created 
ON lead_communications(assigned_to, created_at DESC) 
WHERE assigned_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lead_comms_lead_created 
ON lead_communications(lead_id, created_at DESC) 
WHERE lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lead_comms_owner_created 
ON lead_communications(owner_id, created_at DESC) 
WHERE owner_id IS NOT NULL;