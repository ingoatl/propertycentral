-- Create function to transfer stripe_customer_id from lead to owner
CREATE OR REPLACE FUNCTION public.transfer_stripe_customer_from_lead()
RETURNS TRIGGER AS $$
DECLARE
  lead_record RECORD;
BEGIN
  -- Only process if new owner has an email
  IF NEW.email IS NOT NULL THEN
    -- Find a lead with matching email that has stripe_customer_id
    SELECT id, stripe_customer_id, payment_method, has_payment_method
    INTO lead_record
    FROM public.leads
    WHERE LOWER(email) = LOWER(NEW.email)
      AND stripe_customer_id IS NOT NULL
    ORDER BY updated_at DESC
    LIMIT 1;
    
    -- If found, transfer the stripe data to the new owner
    IF lead_record.stripe_customer_id IS NOT NULL THEN
      NEW.stripe_customer_id := lead_record.stripe_customer_id;
      NEW.payment_method := COALESCE(lead_record.payment_method, NEW.payment_method);
      NEW.has_payment_method := COALESCE(lead_record.has_payment_method, false);
      
      RAISE NOTICE 'Transferred stripe_customer_id % from lead % to new owner %', 
        lead_record.stripe_customer_id, lead_record.id, NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger on property_owners to transfer stripe data from leads
DROP TRIGGER IF EXISTS transfer_stripe_from_lead_trigger ON public.property_owners;
CREATE TRIGGER transfer_stripe_from_lead_trigger
  BEFORE INSERT ON public.property_owners
  FOR EACH ROW
  EXECUTE FUNCTION public.transfer_stripe_customer_from_lead();