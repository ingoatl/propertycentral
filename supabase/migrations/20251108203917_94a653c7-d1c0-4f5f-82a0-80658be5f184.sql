-- Add unique constraints to prevent duplicates

-- Prevent duplicate visits (same property, date, time, price)
CREATE UNIQUE INDEX idx_visits_unique 
ON visits(property_id, date, time, price) 
WHERE billed = false;

-- Prevent duplicate expenses with order numbers
CREATE UNIQUE INDEX idx_expenses_unique_order 
ON expenses(property_id, order_number) 
WHERE order_number IS NOT NULL AND exported = false;

-- Prevent duplicate expenses without order numbers (based on date, amount, purpose)
CREATE UNIQUE INDEX idx_expenses_unique_general
ON expenses(property_id, date, amount, COALESCE(purpose, '')) 
WHERE order_number IS NULL AND exported = false;

-- Prevent duplicate bookings from OwnerRez
CREATE UNIQUE INDEX idx_ownerrez_bookings_unique
ON ownerrez_bookings(ownerrez_listing_id, booking_id)
WHERE booking_id IS NOT NULL;