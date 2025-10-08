-- Create a function to detect duplicate expenses based on multiple criteria
-- This helps prevent the same expense from being created multiple times
CREATE OR REPLACE FUNCTION is_duplicate_expense(
  p_property_id UUID,
  p_amount NUMERIC,
  p_date DATE,
  p_purpose TEXT,
  p_order_number TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  -- Check if a similar expense already exists
  -- Match on: property + amount + date (within 3 days) + similar purpose OR same order number
  RETURN EXISTS (
    SELECT 1 FROM expenses
    WHERE property_id = p_property_id
    AND amount = p_amount
    AND (
      -- Same order number (if provided)
      (p_order_number IS NOT NULL AND order_number = p_order_number)
      OR
      -- Similar expense: same amount, close date, and similar purpose
      (
        date BETWEEN p_date - INTERVAL '3 days' AND p_date + INTERVAL '3 days'
        AND (
          purpose IS NOT NULL 
          AND p_purpose IS NOT NULL 
          AND (
            LOWER(purpose) = LOWER(p_purpose)
            OR similarity(LOWER(purpose), LOWER(p_purpose)) > 0.6
          )
        )
      )
    )
  );
END;
$$ LANGUAGE plpgsql;

-- Enable pg_trgm extension for similarity function
CREATE EXTENSION IF NOT EXISTS pg_trgm;