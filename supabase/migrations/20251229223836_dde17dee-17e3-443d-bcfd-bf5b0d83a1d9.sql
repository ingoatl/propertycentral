-- Add service_type to property_owners (cohosting = we charge them, full_service = we pay them)
ALTER TABLE property_owners 
ADD COLUMN IF NOT EXISTS service_type TEXT NOT NULL DEFAULT 'cohosting' 
CHECK (service_type IN ('cohosting', 'full_service'));

-- Add bank account info for full-service payouts
ALTER TABLE property_owners
ADD COLUMN IF NOT EXISTS payout_bank_account_id TEXT,
ADD COLUMN IF NOT EXISTS payout_method TEXT DEFAULT 'ach' CHECK (payout_method IN ('ach', 'check', 'wire'));

-- Link monthly_charges to reconciliations
ALTER TABLE monthly_charges 
ADD COLUMN IF NOT EXISTS reconciliation_id UUID REFERENCES monthly_reconciliations(id),
ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id);

-- Add due_from_owner and payout tracking to reconciliations
ALTER TABLE monthly_reconciliations
ADD COLUMN IF NOT EXISTS due_from_owner NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS payout_to_owner NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS payout_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS payout_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS payout_reference TEXT,
ADD COLUMN IF NOT EXISTS payment_reminder_sent_at TIMESTAMP WITH TIME ZONE;

-- Set all current owners to cohosting (they already default to it, but ensure consistency)
UPDATE property_owners SET service_type = 'cohosting' WHERE service_type IS NULL;