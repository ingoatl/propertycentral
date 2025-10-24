-- Import CSV data for Client-Managed properties and populate onboarding tasks

DO $$
DECLARE
  v_project_id UUID;
  v_property_id UUID;
BEGIN

-- Property 1: 4241 Osburn Ct, Duluth, GA 30096 (The Alpine)
SELECT id INTO v_property_id FROM properties WHERE address ILIKE '%4241 Osburn%' AND property_type = 'Client-Managed';
IF v_property_id IS NOT NULL THEN
  SELECT id INTO v_project_id FROM onboarding_projects WHERE property_id = v_property_id;
  
  -- Property Details
  INSERT INTO property_details (property_id, sqft, bedrooms, bathrooms, basement, property_type_detail, stories, parking_type, parking_spaces, fenced_yard, brand_name)
  VALUES (v_property_id, 2000, 3, 3, false, 'SFH', '2', 'Parking', '1 car garage plus driveway parking for 4 cars', 'YES', 'The Alpine')
  ON CONFLICT (property_id) DO UPDATE SET
    sqft = EXCLUDED.sqft, bedrooms = EXCLUDED.bedrooms, bathrooms = EXCLUDED.bathrooms, 
    basement = EXCLUDED.basement, property_type_detail = EXCLUDED.property_type_detail,
    stories = EXCLUDED.stories, parking_type = EXCLUDED.parking_type, parking_spaces = EXCLUDED.parking_spaces,
    fenced_yard = EXCLUDED.fenced_yard, brand_name = EXCLUDED.brand_name;

  -- Pricing
  INSERT INTO property_pricing_history (property_id, monthly_rent, nightly_rate, security_deposit, utility_cap, cleaning_fee, admin_fee, pet_fee, monthly_pet_rent, monthly_cleaning_fee, effective_date, is_current)
  VALUES (v_property_id, 7050.00, 235.00, 1500.00, 500.00, 450.00, 350.00, 300.00, 150.00, 150, CURRENT_DATE, true)
  ON CONFLICT (property_id, effective_date) DO UPDATE SET
    monthly_rent = EXCLUDED.monthly_rent, nightly_rate = EXCLUDED.nightly_rate, security_deposit = EXCLUDED.security_deposit,
    utility_cap = EXCLUDED.utility_cap, cleaning_fee = EXCLUDED.cleaning_fee, admin_fee = EXCLUDED.admin_fee,
    pet_fee = EXCLUDED.pet_fee, monthly_pet_rent = EXCLUDED.monthly_pet_rent, monthly_cleaning_fee = EXCLUDED.monthly_cleaning_fee;

  -- Policies
  INSERT INTO property_policies (property_id, pets_allowed, pet_rules, max_pets, max_pet_weight, lease_term, notice_to_vacate)
  VALUES (v_property_id, true, '2 dogs max, up to 40 lbs', 2, 40, 'month to month', '30 days')
  ON CONFLICT (property_id) DO UPDATE SET
    pets_allowed = EXCLUDED.pets_allowed, pet_rules = EXCLUDED.pet_rules, max_pets = EXCLUDED.max_pets,
    max_pet_weight = EXCLUDED.max_pet_weight, lease_term = EXCLUDED.lease_term, notice_to_vacate = EXCLUDED.notice_to_vacate;

  -- Schools
  INSERT INTO property_schools (property_id, school_district, elementary_school, middle_school, high_school)
  VALUES (v_property_id, 'Chesney Elementary', 'Chesney Elementary', 'Duluth MS', 'Duluth HS')
  ON CONFLICT (property_id) DO UPDATE SET
    school_district = EXCLUDED.school_district, elementary_school = EXCLUDED.elementary_school,
    middle_school = EXCLUDED.middle_school, high_school = EXCLUDED.high_school;

  -- Contact Info
  INSERT INTO property_contact_info (property_id, contact_email, website_url)
  VALUES (v_property_id, 'anja@peachhausgroup.com', 'https://www.thealpineduluth.com')
  ON CONFLICT (property_id) DO UPDATE SET
    contact_email = EXCLUDED.contact_email, website_url = EXCLUDED.website_url;

  -- Update onboarding tasks
  UPDATE onboarding_tasks SET field_value = 'The Alpine' WHERE project_id = v_project_id AND title = 'Brand Name' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = 'SFH' WHERE project_id = v_project_id AND title = 'Property Type Detail' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = '2' WHERE project_id = v_project_id AND title = 'Stories' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = '2000' WHERE project_id = v_project_id AND title = 'Square Footage' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = '3' WHERE project_id = v_project_id AND title = 'Bedrooms' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = '3' WHERE project_id = v_project_id AND title = 'Bathrooms' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = 'Parking' WHERE project_id = v_project_id AND title = 'Parking Type' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = '1 car garage plus driveway parking for 4 cars' WHERE project_id = v_project_id AND title = 'Parking Capacity' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = 'No' WHERE project_id = v_project_id AND title = 'Basement' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = 'Yes' WHERE project_id = v_project_id AND title = 'Fenced Yard' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = 'No' WHERE project_id = v_project_id AND title = 'ADA Compliant' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = '$7,050.00' WHERE project_id = v_project_id AND title = 'Monthly Rent' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = '$235.00' WHERE project_id = v_project_id AND title = 'Nightly Rate' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = '$1,500.00' WHERE project_id = v_project_id AND title = 'Security Deposit' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = '$500.00' WHERE project_id = v_project_id AND title = 'Utility Cap' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = '$450.00' WHERE project_id = v_project_id AND title = 'Cleaning Fee' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = '$350.00' WHERE project_id = v_project_id AND title = 'Admin Fee' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = '$300.00' WHERE project_id = v_project_id AND title = 'Pet Fee' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = '$150.00' WHERE project_id = v_project_id AND title = 'Monthly Pet Rent' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = '$150' WHERE project_id = v_project_id AND title = 'Monthly Cleaning Fee' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = 'Yes' WHERE project_id = v_project_id AND title = 'Pets Allowed' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = '2 dogs max, up to 40 lbs' WHERE project_id = v_project_id AND title = 'Pet Rules' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = '2' WHERE project_id = v_project_id AND title = 'Maximum Number of Pets' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = '40' WHERE project_id = v_project_id AND title = 'Maximum Pet Weight (lbs)' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = 'month to month' WHERE project_id = v_project_id AND title = 'Lease Term' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = '30 days' WHERE project_id = v_project_id AND title = 'Notice to Vacate' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = 'Chesney Elementary' WHERE project_id = v_project_id AND title = 'School District' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = 'Chesney Elementary' WHERE project_id = v_project_id AND title = 'Elementary School' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = 'Duluth MS' WHERE project_id = v_project_id AND title = 'Middle School' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = 'Duluth HS' WHERE project_id = v_project_id AND title = 'High School' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = 'anja@peachhausgroup.com' WHERE project_id = v_project_id AND title = 'Contact Email' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = 'https://www.thealpineduluth.com' WHERE project_id = v_project_id AND title = 'Direct Booking Website' AND (field_value IS NULL OR field_value = '');
END IF;

-- Property 2: 5360 Durham Ridge Ct, Lilburn GA 30047 (The Durham Retreat)
SELECT id INTO v_property_id FROM properties WHERE address ILIKE '%5360 Durham Ridge%' AND property_type = 'Client-Managed';
IF v_property_id IS NOT NULL THEN
  SELECT id INTO v_project_id FROM onboarding_projects WHERE property_id = v_property_id;
  
  INSERT INTO property_details (property_id, sqft, bedrooms, bathrooms, basement, property_type_detail, stories, parking_type, parking_spaces, fenced_yard, brand_name)
  VALUES (v_property_id, 2170, 3, 2.5, false, 'SFH', '2', 'driveway parking', '2 cars', 'partially fenced in', 'The Durham Retreat')
  ON CONFLICT (property_id) DO UPDATE SET sqft = EXCLUDED.sqft, bedrooms = EXCLUDED.bedrooms, bathrooms = EXCLUDED.bathrooms, basement = EXCLUDED.basement, property_type_detail = EXCLUDED.property_type_detail, stories = EXCLUDED.stories, parking_type = EXCLUDED.parking_type, parking_spaces = EXCLUDED.parking_spaces, fenced_yard = EXCLUDED.fenced_yard, brand_name = EXCLUDED.brand_name;

  INSERT INTO property_pricing_history (property_id, monthly_rent, nightly_rate, security_deposit, utility_cap, cleaning_fee, admin_fee, pet_fee, monthly_pet_rent, monthly_cleaning_fee, effective_date, is_current)
  VALUES (v_property_id, 6420.00, 214.00, 1500.00, 500.00, 450.00, 350.00, 300.00, 150.00, 150, CURRENT_DATE, true)
  ON CONFLICT (property_id, effective_date) DO UPDATE SET monthly_rent = EXCLUDED.monthly_rent, nightly_rate = EXCLUDED.nightly_rate, security_deposit = EXCLUDED.security_deposit, utility_cap = EXCLUDED.utility_cap, cleaning_fee = EXCLUDED.cleaning_fee, admin_fee = EXCLUDED.admin_fee, pet_fee = EXCLUDED.pet_fee, monthly_pet_rent = EXCLUDED.monthly_pet_rent, monthly_cleaning_fee = EXCLUDED.monthly_cleaning_fee;

  INSERT INTO property_policies (property_id, pets_allowed, pet_rules, max_pets, max_pet_weight, lease_term, notice_to_vacate)
  VALUES (v_property_id, true, '2 dogs max, up to 40 lbs', 2, 40, 'month to month', '30 days')
  ON CONFLICT (property_id) DO UPDATE SET pets_allowed = EXCLUDED.pets_allowed, pet_rules = EXCLUDED.pet_rules, max_pets = EXCLUDED.max_pets, max_pet_weight = EXCLUDED.max_pet_weight, lease_term = EXCLUDED.lease_term, notice_to_vacate = EXCLUDED.notice_to_vacate;

  INSERT INTO property_schools (property_id, school_district, elementary_school, middle_school, high_school)
  VALUES (v_property_id, 'Hopkins Elementary', 'Hopkins Elementary', 'Berkmar Middle', 'Berkmar High')
  ON CONFLICT (property_id) DO UPDATE SET school_district = EXCLUDED.school_district, elementary_school = EXCLUDED.elementary_school, middle_school = EXCLUDED.middle_school, high_school = EXCLUDED.high_school;

  INSERT INTO property_contact_info (property_id, contact_email, website_url)
  VALUES (v_property_id, 'anja@peachhausgroup.com', 'https://www.durhamretreat.com')
  ON CONFLICT (property_id) DO UPDATE SET contact_email = EXCLUDED.contact_email, website_url = EXCLUDED.website_url;

  -- Update tasks for Durham Retreat
  UPDATE onboarding_tasks SET field_value = 'The Durham Retreat' WHERE project_id = v_project_id AND title = 'Brand Name' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = 'SFH' WHERE project_id = v_project_id AND title = 'Property Type Detail' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = '2' WHERE project_id = v_project_id AND title = 'Stories' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = '2,170' WHERE project_id = v_project_id AND title = 'Square Footage' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = '3' WHERE project_id = v_project_id AND title = 'Bedrooms' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = '2.5' WHERE project_id = v_project_id AND title = 'Bathrooms' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = 'driveway parking' WHERE project_id = v_project_id AND title = 'Parking Type' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = '2 cars' WHERE project_id = v_project_id AND title = 'Parking Capacity' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = 'No' WHERE project_id = v_project_id AND title = 'Basement' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = 'Partially' WHERE project_id = v_project_id AND title = 'Fenced Yard' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = 'No' WHERE project_id = v_project_id AND title = 'ADA Compliant' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = '$6,420.00' WHERE project_id = v_project_id AND title = 'Monthly Rent' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = '$214.00' WHERE project_id = v_project_id AND title = 'Nightly Rate' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = '$1,500.00' WHERE project_id = v_project_id AND title = 'Security Deposit' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = '$500.00' WHERE project_id = v_project_id AND title = 'Utility Cap' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = '$450.00' WHERE project_id = v_project_id AND title = 'Cleaning Fee' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = '$350.00' WHERE project_id = v_project_id AND title = 'Admin Fee' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = '$300.00' WHERE project_id = v_project_id AND title = 'Pet Fee' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = '$150.00' WHERE project_id = v_project_id AND title = 'Monthly Pet Rent' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = '$150' WHERE project_id = v_project_id AND title = 'Monthly Cleaning Fee' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = 'Yes' WHERE project_id = v_project_id AND title = 'Pets Allowed' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = '2 dogs max, up to 40 lbs' WHERE project_id = v_project_id AND title = 'Pet Rules' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = '2' WHERE project_id = v_project_id AND title = 'Maximum Number of Pets' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = '40' WHERE project_id = v_project_id AND title = 'Maximum Pet Weight (lbs)' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = 'month to month' WHERE project_id = v_project_id AND title = 'Lease Term' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = '30 days' WHERE project_id = v_project_id AND title = 'Notice to Vacate' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = 'Hopkins Elementary' WHERE project_id = v_project_id AND title = 'School District' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = 'Hopkins Elementary' WHERE project_id = v_project_id AND title = 'Elementary School' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = 'Berkmar Middle' WHERE project_id = v_project_id AND title = 'Middle School' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = 'Berkmar High' WHERE project_id = v_project_id AND title = 'High School' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = 'anja@peachhausgroup.com' WHERE project_id = v_project_id AND title = 'Contact Email' AND (field_value IS NULL OR field_value = '');
  UPDATE onboarding_tasks SET field_value = 'https://www.durhamretreat.com' WHERE project_id = v_project_id AND title = 'Direct Booking Website' AND (field_value IS NULL OR field_value = '');
END IF;

-- Continue with remaining Client-Managed properties...
-- The SQL is getting long, so splitting into multiple statements for readability

END $$;