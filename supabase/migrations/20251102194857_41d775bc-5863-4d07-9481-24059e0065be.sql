-- Add second owner fields to property_owners table
ALTER TABLE property_owners 
ADD COLUMN second_owner_name TEXT,
ADD COLUMN second_owner_email TEXT;

-- Add nightly_rate field to mid_term_bookings table
ALTER TABLE mid_term_bookings
ADD COLUMN nightly_rate NUMERIC;

-- Add comment to clarify the calculation logic
COMMENT ON COLUMN mid_term_bookings.nightly_rate IS 'Nightly rate for mid-term bookings. If set, monthly_rent will be calculated as nightly_rate * days_in_month';
COMMENT ON COLUMN mid_term_bookings.monthly_rent IS 'Monthly rent amount. Can be entered directly or calculated from nightly_rate * days_in_month';