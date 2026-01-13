
-- Drop the existing constraint and add a more flexible one
ALTER TABLE discovery_calls DROP CONSTRAINT IF EXISTS discovery_calls_meeting_type_check;

-- Add updated constraint that includes inspection types
ALTER TABLE discovery_calls ADD CONSTRAINT discovery_calls_meeting_type_check 
CHECK (meeting_type IS NULL OR meeting_type IN ('phone', 'video', 'in_person', 'inspection', 'virtual_inspection'));
