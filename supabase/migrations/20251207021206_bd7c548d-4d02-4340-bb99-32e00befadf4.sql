
-- Create a trigger function to enforce visit prices from property configuration
CREATE OR REPLACE FUNCTION public.enforce_visit_price()
RETURNS TRIGGER AS $$
DECLARE
  property_visit_price NUMERIC;
BEGIN
  -- Get the visit_price from the property
  SELECT visit_price INTO property_visit_price
  FROM public.properties
  WHERE id = NEW.property_id;
  
  -- If property has a visit_price configured, use it as the base price
  -- Only override if hours = 0 (no hourly charges) or if price differs from expected
  IF property_visit_price IS NOT NULL THEN
    -- Calculate expected price: base visit_price + (hours * hourly_rate)
    -- If hours is null or 0, just use the base visit_price
    DECLARE
      hourly_rate NUMERIC := 50;
      expected_price NUMERIC;
    BEGIN
      expected_price := property_visit_price + (COALESCE(NEW.hours, 0) * hourly_rate);
      
      -- Log if there's a mismatch
      IF NEW.price != expected_price THEN
        RAISE NOTICE 'Visit price mismatch: entered %, expected % (base: %, hours: %)', 
          NEW.price, expected_price, property_visit_price, COALESCE(NEW.hours, 0);
      END IF;
      
      -- Always enforce the correct calculated price
      NEW.price := expected_price;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS enforce_visit_price_trigger ON public.visits;

-- Create trigger for INSERT and UPDATE
CREATE TRIGGER enforce_visit_price_trigger
  BEFORE INSERT OR UPDATE ON public.visits
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_visit_price();

-- Add comment explaining the trigger
COMMENT ON FUNCTION public.enforce_visit_price() IS 'Enforces visit prices based on property visit_price configuration. Prevents manual price entry errors.';
