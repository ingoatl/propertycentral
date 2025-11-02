-- Add nightly rate and order minimum fee columns to properties table
ALTER TABLE properties 
ADD COLUMN nightly_rate NUMERIC(10,2) DEFAULT NULL,
ADD COLUMN order_minimum_fee NUMERIC(10,2) DEFAULT 250.00;

COMMENT ON COLUMN properties.nightly_rate IS 'Average nightly rate calculated from OwnerRez bookings';
COMMENT ON COLUMN properties.order_minimum_fee IS 'Monthly order minimum fee based on nightly rate tier';

-- Add order minimum fee column to monthly_reconciliations table
ALTER TABLE monthly_reconciliations 
ADD COLUMN order_minimum_fee NUMERIC(10,2) DEFAULT 0;

COMMENT ON COLUMN monthly_reconciliations.order_minimum_fee IS 'Order minimum fee charged for this reconciliation period';