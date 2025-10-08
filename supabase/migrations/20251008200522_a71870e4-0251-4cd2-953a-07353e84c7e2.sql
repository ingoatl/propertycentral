-- Fix the incorrect 2024 dates to 2025 for the Amazon TV order
UPDATE expenses
SET 
  date = '2025-10-07',
  order_date = '2025-10-07'
WHERE id = '67208ed7-3e38-42fb-abe6-96a90b3dbe4c'
AND date = '2024-10-07';

-- Update order numbers to just use the first order number (cleaner display)
UPDATE expenses
SET order_number = '113-4868842-1944206'
WHERE order_number LIKE '%,%'
AND order_number LIKE '113-4868842-1944206%';