-- Fix historical call dates from GHL metadata
-- Update calls where the created_at is wrong but metadata has correct date
UPDATE lead_communications
SET created_at = (metadata->'ghl_data'->>'createdAt')::timestamptz
WHERE ghl_call_id IS NOT NULL 
  AND metadata->'ghl_data'->>'createdAt' IS NOT NULL
  AND created_at::date = CURRENT_DATE;

-- Also fix any calls synced from ghl_sync_conversations with wrong dates
UPDATE lead_communications
SET created_at = (metadata->'ghl_data'->>'dateAdded')::timestamptz
WHERE ghl_message_id IS NOT NULL 
  AND metadata->'ghl_data'->>'dateAdded' IS NOT NULL
  AND created_at::date = CURRENT_DATE;