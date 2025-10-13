-- Enhanced duplicate expense function with stricter order number checking
CREATE OR REPLACE FUNCTION public.is_duplicate_expense(
  p_property_id uuid, 
  p_amount numeric, 
  p_date date, 
  p_purpose text, 
  p_order_number text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- If we have an order number, check for exact match on order number ONLY
  IF p_order_number IS NOT NULL AND p_order_number != '' THEN
    RETURN EXISTS (
      SELECT 1 FROM expenses
      WHERE order_number = p_order_number
    );
  END IF;
  
  -- If no order number, use the existing fuzzy matching logic
  RETURN EXISTS (
    SELECT 1 FROM expenses
    WHERE property_id = p_property_id
    AND amount = p_amount
    AND date BETWEEN p_date - INTERVAL '3 days' AND p_date + INTERVAL '3 days'
    AND (
      purpose IS NOT NULL 
      AND p_purpose IS NOT NULL 
      AND (
        LOWER(purpose) = LOWER(p_purpose)
        OR similarity(LOWER(purpose), LOWER(p_purpose)) > 0.6
      )
    )
  );
END;
$function$;