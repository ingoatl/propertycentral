-- Create a comprehensive view for easy property data retrieval (for listing exports)
CREATE OR REPLACE VIEW public.comprehensive_property_data AS
SELECT 
  p.id,
  p.name,
  p.address,
  p.rental_type,
  p.property_type,
  p.visit_price,
  p.image_path,
  p.created_at as property_created_at,
  
  -- Property details
  pd.brand_name,
  pd.property_type_detail,
  pd.stories,
  pd.sqft,
  pd.bedrooms,
  pd.bathrooms,
  pd.parking_type,
  pd.parking_spaces,
  pd.basement,
  pd.fenced_yard,
  pd.ada_compliant,
  
  -- Current pricing
  pp.monthly_rent,
  pp.nightly_rate,
  pp.security_deposit,
  pp.utility_cap,
  pp.cleaning_fee,
  pp.admin_fee,
  pp.pet_fee,
  pp.monthly_pet_rent,
  pp.monthly_cleaning_fee,
  pp.effective_date as pricing_effective_date,
  
  -- Policies
  pol.pets_allowed,
  pol.pet_rules,
  pol.max_pets,
  pol.max_pet_weight,
  pol.lease_term,
  pol.notice_to_vacate,
  
  -- Schools
  ps.school_district,
  ps.elementary_school,
  ps.middle_school,
  ps.high_school,
  
  -- Contact info
  pc.contact_email,
  pc.contact_phone,
  pc.website_url

FROM public.properties p
LEFT JOIN public.property_details pd ON p.id = pd.property_id
LEFT JOIN public.property_pricing_history pp ON p.id = pp.property_id AND pp.is_current = true
LEFT JOIN public.property_policies pol ON p.id = pol.property_id
LEFT JOIN public.property_schools ps ON p.id = ps.property_id
LEFT JOIN public.property_contact_info pc ON p.id = pc.property_id;

-- Grant select permission to approved users
GRANT SELECT ON public.comprehensive_property_data TO authenticated;

-- Create RLS policy for the view
ALTER VIEW public.comprehensive_property_data SET (security_invoker = on);

-- Create a function to get platform listings for a property
CREATE OR REPLACE FUNCTION public.get_property_platforms(p_property_id UUID)
RETURNS TABLE (
  platform_name TEXT,
  is_active BOOLEAN,
  listing_url TEXT
) 
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    platform_name,
    is_active,
    listing_url
  FROM public.platform_listings
  WHERE property_id = p_property_id
  ORDER BY platform_name;
$$;

-- Create function to get listing data formatted for copy/paste
CREATE OR REPLACE FUNCTION public.get_listing_export_data(p_property_id UUID)
RETURNS JSON
LANGUAGE PLPGSQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  property_data JSON;
  platforms_data JSON;
BEGIN
  -- Get comprehensive property data
  SELECT row_to_json(cpd.*)
  INTO property_data
  FROM public.comprehensive_property_data cpd
  WHERE cpd.id = p_property_id;
  
  -- Get platform listings
  SELECT json_agg(
    json_build_object(
      'platform', platform_name,
      'active', is_active,
      'url', listing_url
    )
  )
  INTO platforms_data
  FROM public.platform_listings
  WHERE property_id = p_property_id;
  
  -- Return combined data
  RETURN json_build_object(
    'property', property_data,
    'platforms', COALESCE(platforms_data, '[]'::json)
  );
END;
$$;