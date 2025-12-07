-- Add fee breakdown columns to ownerrez_bookings
ALTER TABLE public.ownerrez_bookings
ADD COLUMN IF NOT EXISTS accommodation_revenue numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS cleaning_fee numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS pet_fee numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS other_fees numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS promotions_discount numeric DEFAULT 0;

-- Add fee_type column to reconciliation_line_items for categorization
ALTER TABLE public.reconciliation_line_items
ADD COLUMN IF NOT EXISTS fee_type text;

-- Add comment explaining the fee breakdown
COMMENT ON COLUMN public.ownerrez_bookings.accommodation_revenue IS 'Nightly accommodation revenue only - base for management fee calculation';
COMMENT ON COLUMN public.ownerrez_bookings.cleaning_fee IS 'Cleaning fee collected from guest - pass-through to owner';
COMMENT ON COLUMN public.ownerrez_bookings.pet_fee IS 'Pet fee collected from guest - pass-through to owner';
COMMENT ON COLUMN public.ownerrez_bookings.other_fees IS 'Other surcharges (early check-in, late checkout, etc.)';
COMMENT ON COLUMN public.ownerrez_bookings.promotions_discount IS 'Promotional discounts applied to booking';
COMMENT ON COLUMN public.reconciliation_line_items.fee_type IS 'Type of fee: accommodation, cleaning_fee, pet_fee, visit, expense';