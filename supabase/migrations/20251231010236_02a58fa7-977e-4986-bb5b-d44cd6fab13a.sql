-- Add billing lifecycle columns to properties table
ALTER TABLE properties ADD COLUMN IF NOT EXISTS billing_status TEXT DEFAULT 'pending_contract';
-- Values: 'pending_contract', 'pending_onboarding', 'pending_listing', 'active', 'paused', 'offboarded'

ALTER TABLE properties ADD COLUMN IF NOT EXISTS contract_signed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS contract_document_id UUID REFERENCES booking_documents(id);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS first_listing_live_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS onboarding_fee_charged_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS onboarding_fee_amount NUMERIC DEFAULT 500.00;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS first_minimum_charged_at TIMESTAMP WITH TIME ZONE;

-- Add index for billing status queries
CREATE INDEX IF NOT EXISTS idx_properties_billing_status ON properties(billing_status);

-- Add comment for documentation
COMMENT ON COLUMN properties.billing_status IS 'Billing lifecycle: pending_contract, pending_onboarding, pending_listing, active, paused, offboarded';