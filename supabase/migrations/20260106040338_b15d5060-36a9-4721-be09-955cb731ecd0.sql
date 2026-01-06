-- Add unique constraint on property_id for management_agreements
-- This allows upsert to work properly
ALTER TABLE management_agreements ADD CONSTRAINT management_agreements_property_id_key UNIQUE (property_id);