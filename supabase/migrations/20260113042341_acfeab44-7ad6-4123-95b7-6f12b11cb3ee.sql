
-- Fix service_interest constraint to allow onboarding_inspection
ALTER TABLE discovery_calls DROP CONSTRAINT IF EXISTS discovery_calls_service_interest_check;

-- Add updated constraint that includes inspection service interests
ALTER TABLE discovery_calls ADD CONSTRAINT discovery_calls_service_interest_check 
CHECK (service_interest IS NULL OR service_interest IN ('property_management', 'consulting', 'full_service', 'hybrid', 'onboarding_inspection', 'maintenance'));
