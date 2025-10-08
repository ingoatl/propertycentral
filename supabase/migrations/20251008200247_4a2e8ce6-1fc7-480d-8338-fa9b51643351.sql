-- Fix security warnings

-- 1. Fix function search path
DROP FUNCTION IF EXISTS is_duplicate_expense(UUID, NUMERIC, DATE, TEXT, TEXT);

CREATE OR REPLACE FUNCTION is_duplicate_expense(
  p_property_id UUID,
  p_amount NUMERIC,
  p_date DATE,
  p_purpose TEXT,
  p_order_number TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM expenses
    WHERE property_id = p_property_id
    AND amount = p_amount
    AND (
      (p_order_number IS NOT NULL AND order_number = p_order_number)
      OR
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
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- 2. Move pg_trgm extension to extensions schema
DROP EXTENSION IF EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;

-- Delete duplicate Photo Shoot expenses (keep only the oldest one)
WITH duplicates AS (
  SELECT id, 
         ROW_NUMBER() OVER (
           PARTITION BY property_id, amount, 
           DATE_TRUNC('day', date)
           ORDER BY created_at ASC
         ) as rn
  FROM expenses
  WHERE purpose ILIKE '%Photo Shoot%'
  AND amount = 725.17
)
DELETE FROM expenses
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);