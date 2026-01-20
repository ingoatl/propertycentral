-- Part 1: Add vendor_access_code column to owner_onboarding_submissions if it doesn't exist
ALTER TABLE owner_onboarding_submissions 
ADD COLUMN IF NOT EXISTS vendor_access_code TEXT;

-- Part 2: Create function to sync onboarding access data to property_maintenance_book
CREATE OR REPLACE FUNCTION sync_onboarding_to_maintenance_book()
RETURNS TRIGGER AS $$
BEGIN
  -- Only sync if property_id is set
  IF NEW.property_id IS NOT NULL THEN
    INSERT INTO property_maintenance_book (
      property_id,
      lockbox_code,
      gate_code,
      alarm_code,
      vendor_access_code,
      access_instructions,
      created_at,
      updated_at
    )
    VALUES (
      NEW.property_id,
      NEW.lockbox_code,
      NEW.gate_code,
      NEW.alarm_code,
      COALESCE(NEW.vendor_access_code, NEW.smart_lock_code),
      CONCAT_WS(' | ',
        CASE WHEN NEW.gate_code IS NOT NULL AND NEW.gate_code != '' 
             THEN 'Gate: ' || NEW.gate_code END,
        CASE WHEN NEW.lockbox_code IS NOT NULL AND NEW.lockbox_code != '' 
             THEN 'Lockbox: ' || NEW.lockbox_code END,
        CASE WHEN NEW.alarm_code IS NOT NULL AND NEW.alarm_code != '' 
             THEN 'Alarm: ' || NEW.alarm_code END,
        CASE WHEN NEW.parking_instructions IS NOT NULL AND NEW.parking_instructions != '' 
             THEN 'Parking: ' || NEW.parking_instructions END
      ),
      NOW(),
      NOW()
    )
    ON CONFLICT (property_id) DO UPDATE SET
      lockbox_code = COALESCE(EXCLUDED.lockbox_code, property_maintenance_book.lockbox_code),
      gate_code = COALESCE(EXCLUDED.gate_code, property_maintenance_book.gate_code),
      alarm_code = COALESCE(EXCLUDED.alarm_code, property_maintenance_book.alarm_code),
      vendor_access_code = COALESCE(EXCLUDED.vendor_access_code, property_maintenance_book.vendor_access_code),
      access_instructions = COALESCE(EXCLUDED.access_instructions, property_maintenance_book.access_instructions),
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Part 3: Create trigger on owner_onboarding_submissions
DROP TRIGGER IF EXISTS trigger_sync_onboarding_to_maintenance_book ON owner_onboarding_submissions;
CREATE TRIGGER trigger_sync_onboarding_to_maintenance_book
AFTER INSERT OR UPDATE ON owner_onboarding_submissions
FOR EACH ROW
EXECUTE FUNCTION sync_onboarding_to_maintenance_book();

-- Part 4: Backfill existing onboarding data to property_maintenance_book
INSERT INTO property_maintenance_book (property_id, lockbox_code, gate_code, alarm_code, vendor_access_code, access_instructions, created_at, updated_at)
SELECT 
  property_id,
  lockbox_code,
  gate_code,
  alarm_code,
  COALESCE(vendor_access_code, smart_lock_code) as vendor_access_code,
  CONCAT_WS(' | ',
    CASE WHEN gate_code IS NOT NULL AND gate_code != '' 
         THEN 'Gate: ' || gate_code END,
    CASE WHEN lockbox_code IS NOT NULL AND lockbox_code != '' 
         THEN 'Lockbox: ' || lockbox_code END,
    CASE WHEN alarm_code IS NOT NULL AND alarm_code != '' 
         THEN 'Alarm: ' || alarm_code END,
    CASE WHEN parking_instructions IS NOT NULL AND parking_instructions != '' 
         THEN 'Parking: ' || parking_instructions END
  ) as access_instructions,
  NOW(),
  NOW()
FROM owner_onboarding_submissions
WHERE property_id IS NOT NULL
ON CONFLICT (property_id) DO UPDATE SET
  lockbox_code = COALESCE(EXCLUDED.lockbox_code, property_maintenance_book.lockbox_code),
  gate_code = COALESCE(EXCLUDED.gate_code, property_maintenance_book.gate_code),
  alarm_code = COALESCE(EXCLUDED.alarm_code, property_maintenance_book.alarm_code),
  vendor_access_code = COALESCE(EXCLUDED.vendor_access_code, property_maintenance_book.vendor_access_code),
  access_instructions = COALESCE(EXCLUDED.access_instructions, property_maintenance_book.access_instructions),
  updated_at = NOW();