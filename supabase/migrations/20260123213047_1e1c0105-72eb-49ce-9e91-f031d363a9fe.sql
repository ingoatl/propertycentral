-- Create a function to trigger booking sync when a new property is added
CREATE OR REPLACE FUNCTION public.notify_new_property()
RETURNS TRIGGER AS $$
BEGIN
  -- Log that a new property was added for booking sync consideration
  RAISE NOTICE 'New property added: % - %', NEW.id, NEW.name;
  
  -- Update any orphaned bookings that match this property's address/name
  UPDATE ownerrez_bookings 
  SET property_id = NEW.id
  WHERE property_id IS NULL
  AND (
    -- Match by address keywords
    LOWER(ownerrez_listing_name) LIKE '%' || LOWER(SPLIT_PART(NEW.address, ',', 1)) || '%'
    OR LOWER(ownerrez_listing_name) LIKE '%' || LOWER(NEW.name) || '%'
    OR LOWER(NEW.name) LIKE '%' || LOWER(ownerrez_listing_name) || '%'
  );
  
  -- Also update orphaned reviews for any bookings now linked to this property
  UPDATE ownerrez_reviews r
  SET property_id = NEW.id
  FROM ownerrez_bookings b
  WHERE b.property_id = NEW.id
  AND r.booking_id = b.booking_id
  AND r.property_id IS NULL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on properties table
DROP TRIGGER IF EXISTS on_property_created ON properties;
CREATE TRIGGER on_property_created
  AFTER INSERT ON properties
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_property();

-- Also create a trigger for when properties are updated (name/address changed)
DROP TRIGGER IF EXISTS on_property_updated ON properties;
CREATE TRIGGER on_property_updated
  AFTER UPDATE OF name, address ON properties
  FOR EACH ROW
  WHEN (OLD.name IS DISTINCT FROM NEW.name OR OLD.address IS DISTINCT FROM NEW.address)
  EXECUTE FUNCTION notify_new_property();