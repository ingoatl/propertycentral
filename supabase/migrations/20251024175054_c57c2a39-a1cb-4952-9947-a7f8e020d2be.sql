-- Clear existing imported data to start fresh (only for Company-Owned properties)
DELETE FROM platform_listings WHERE property_id IN (SELECT id FROM properties WHERE property_type = 'Company-Owned');
DELETE FROM property_contact_info WHERE property_id IN (SELECT id FROM properties WHERE property_type = 'Company-Owned');
DELETE FROM property_schools WHERE property_id IN (SELECT id FROM properties WHERE property_type = 'Company-Owned');
DELETE FROM property_policies WHERE property_id IN (SELECT id FROM properties WHERE property_type = 'Company-Owned');
DELETE FROM property_pricing_history WHERE property_id IN (SELECT id FROM properties WHERE property_type = 'Company-Owned');
DELETE FROM property_details WHERE property_id IN (SELECT id FROM properties WHERE property_type = 'Company-Owned');

-- Import Property Details from CSV with exact data
-- Alpine: 4241 Osburn Ct, Duluth, GA 30096
INSERT INTO property_details (property_id, bedrooms, bathrooms, sqft, brand_name, property_type_detail, stories, parking_type, parking_spaces, fenced_yard, basement, ada_compliant)
SELECT p.id, 3, 3, 2000, 'The Alpine', 'SFH', '2', '1 car garage plus driveway parking for 4 cars', '5', 'YES', 'NO', false
FROM properties p
WHERE p.address LIKE '%4241 Osburn%' AND p.property_type = 'Company-Owned';

-- Family Retreat: 5360 Durham Ridge Ct, Lilburn GA 30047  
INSERT INTO property_details (property_id, bedrooms, bathrooms, sqft, brand_name, property_type_detail, stories, parking_type, parking_spaces, fenced_yard, basement, ada_compliant)
SELECT p.id, 3, 2.5, 2170, 'The Durham Retreat', 'SFH', '2', 'driveway parking', '2', 'partially fenced in', 'NO', false
FROM properties p
WHERE p.address LIKE '%5360 Durham%' AND p.property_type = 'Company-Owned';

-- Scandinavian Retreat: 5198 Laurel Bridge Dr SE, Smyrna, GA 30082
INSERT INTO property_details (property_id, bedrooms, bathrooms, sqft, brand_name, property_type_detail, stories, parking_type, parking_spaces, fenced_yard, basement, ada_compliant)
SELECT p.id, 2, 2.5, 1248, 'The Scandinavian Retreat', 'Townhome', '2', 'driveway parking', '2', 'NO', 'NO', false
FROM properties p
WHERE p.address LIKE '%5198 Laurel%' AND p.property_type = 'Company-Owned';

-- Luxurious & Spacious Apartment: 2580 Old Roswell Rd, House #A, Smyrna, GA 30080
INSERT INTO property_details (property_id, bedrooms, bathrooms, sqft, brand_name, property_type_detail, stories, parking_type, parking_spaces, fenced_yard, basement, ada_compliant)
SELECT p.id, 2, 2.5, 1372, 'Old Rowsell', 'Townhouse', '2', 'driveway parking', '2', 'YES', 'NO', false
FROM properties p
WHERE p.address LIKE '%2580 Old Roswell%' AND p.property_type = 'Company-Owned';

-- Lavish Living: 3069 Rita Way, Smyrna, GA 30080
INSERT INTO property_details (property_id, bedrooms, bathrooms, sqft, brand_name, property_type_detail, stories, parking_type, parking_spaces, fenced_yard, basement, ada_compliant)
SELECT p.id, 3, 2, 1050, 'The Homerun Hideaway', 'SFH', '1 (ranch style)', '1 carport, driveway', '2', 'YES', 'NO', false
FROM properties p
WHERE p.address LIKE '%3069 Rita%' AND p.property_type = 'Company-Owned';

-- Scandi Chic: 3155 Duvall Pl Kennesaw GA 30144
INSERT INTO property_details (property_id, bedrooms, bathrooms, sqft, brand_name, property_type_detail, stories, parking_type, parking_spaces, fenced_yard, basement, ada_compliant)
SELECT p.id, 2, 2, 1600, 'Scandi Chic', 'Townhouse', '2', 'driveway', '3', 'NO', 'NO', false
FROM properties p
WHERE p.address LIKE '%3155 Duvall%' AND p.property_type = 'Company-Owned';

-- Modern + Cozy Townhome: 169 Willow Stream Ct, Roswell GA 30076
INSERT INTO property_details (property_id, bedrooms, bathrooms, sqft, brand_name, property_type_detail, stories, parking_type, parking_spaces, fenced_yard, basement, ada_compliant)
SELECT p.id, 2, 2, 1280, 'The Bloom', 'Townhouse', '2', 'driveway', '2', 'YES', 'NO', false
FROM properties p
WHERE p.address LIKE '%169 Willow%' AND p.property_type = 'Company-Owned';

-- Import Pricing History from CSV with exact amounts
-- Alpine
INSERT INTO property_pricing_history (property_id, monthly_rent, nightly_rate, security_deposit, utility_cap, cleaning_fee, admin_fee, pet_fee, monthly_pet_rent, monthly_cleaning_fee, effective_date, is_current)
SELECT p.id, 7050, 235, 1500, 500, 450, 350, 300, 150, 150, CURRENT_DATE, true
FROM properties p
WHERE p.address LIKE '%4241 Osburn%' AND p.property_type = 'Company-Owned';

-- Family Retreat
INSERT INTO property_pricing_history (property_id, monthly_rent, nightly_rate, security_deposit, utility_cap, cleaning_fee, admin_fee, pet_fee, monthly_pet_rent, monthly_cleaning_fee, effective_date, is_current)
SELECT p.id, 6420, 214, 1500, 500, 450, 350, 300, 150, 150, CURRENT_DATE, true
FROM properties p
WHERE p.address LIKE '%5360 Durham%' AND p.property_type = 'Company-Owned';

-- Scandinavian Retreat
INSERT INTO property_pricing_history (property_id, monthly_rent, nightly_rate, security_deposit, utility_cap, cleaning_fee, admin_fee, pet_fee, monthly_pet_rent, monthly_cleaning_fee, effective_date, is_current)
SELECT p.id, 4770, 159, 1500, 500, 400, 350, 300, 150, 120, CURRENT_DATE, true
FROM properties p
WHERE p.address LIKE '%5198 Laurel%' AND p.property_type = 'Company-Owned';

-- Luxurious & Spacious Apartment (Old Roswell)
INSERT INTO property_pricing_history (property_id, monthly_rent, nightly_rate, security_deposit, utility_cap, cleaning_fee, admin_fee, pet_fee, monthly_pet_rent, monthly_cleaning_fee, effective_date, is_current)
SELECT p.id, 5640, 188, 1500, 500, 400, 350, 300, 150, 120, CURRENT_DATE, true
FROM properties p
WHERE p.address LIKE '%2580 Old Roswell%' AND p.property_type = 'Company-Owned';

-- Lavish Living (Rita Way)
INSERT INTO property_pricing_history (property_id, monthly_rent, nightly_rate, security_deposit, utility_cap, cleaning_fee, admin_fee, pet_fee, monthly_pet_rent, monthly_cleaning_fee, effective_date, is_current)
SELECT p.id, 6270, 209, 1500, 500, 450, 350, 300, 150, 150, CURRENT_DATE, true
FROM properties p
WHERE p.address LIKE '%3069 Rita%' AND p.property_type = 'Company-Owned';

-- Scandi Chic
INSERT INTO property_pricing_history (property_id, monthly_rent, nightly_rate, security_deposit, utility_cap, cleaning_fee, admin_fee, pet_fee, monthly_pet_rent, monthly_cleaning_fee, effective_date, is_current)
SELECT p.id, 5670, 189, 1500, 500, 400, 350, 300, 150, 120, CURRENT_DATE, true
FROM properties p
WHERE p.address LIKE '%3155 Duvall%' AND p.property_type = 'Company-Owned';

-- Modern + Cozy Townhome (The Bloom)
INSERT INTO property_pricing_history (property_id, monthly_rent, nightly_rate, security_deposit, utility_cap, cleaning_fee, admin_fee, pet_fee, monthly_pet_rent, monthly_cleaning_fee, effective_date, is_current)
SELECT p.id, 5070, 169, 1500, 500, 400, 350, 300, 150, 120, CURRENT_DATE, true
FROM properties p
WHERE p.address LIKE '%169 Willow%' AND p.property_type = 'Company-Owned';

-- Import Property Policies from CSV
-- Alpine
INSERT INTO property_policies (property_id, pets_allowed, max_pets, max_pet_weight, pet_rules, lease_term, notice_to_vacate)
SELECT p.id, true, 2, 40, '2 dogs max, up to 40 lbs', 'month to month', '30 days'
FROM properties p
WHERE p.address LIKE '%4241 Osburn%' AND p.property_type = 'Company-Owned';

-- Family Retreat  
INSERT INTO property_policies (property_id, pets_allowed, max_pets, max_pet_weight, pet_rules, lease_term, notice_to_vacate)
SELECT p.id, true, 2, 40, '2 dogs max, up to 40 lbs', 'month to month', '30 days'
FROM properties p
WHERE p.address LIKE '%5360 Durham%' AND p.property_type = 'Company-Owned';

-- Scandinavian Retreat
INSERT INTO property_policies (property_id, pets_allowed, max_pets, max_pet_weight, pet_rules, lease_term, notice_to_vacate)
SELECT p.id, true, 2, 40, '2 dogs max, up to 40 lbs', 'month to month', '30 days'
FROM properties p
WHERE p.address LIKE '%5198 Laurel%' AND p.property_type = 'Company-Owned';

-- Old Roswell
INSERT INTO property_policies (property_id, pets_allowed, max_pets, max_pet_weight, pet_rules, lease_term, notice_to_vacate)
SELECT p.id, true, 2, 40, '2 dogs max, up to 40 lbs', 'month to month', '30 days'
FROM properties p
WHERE p.address LIKE '%2580 Old Roswell%' AND p.property_type = 'Company-Owned';

-- Rita Way
INSERT INTO property_policies (property_id, pets_allowed, max_pets, max_pet_weight, pet_rules, lease_term, notice_to_vacate)
SELECT p.id, true, 2, 40, '2 dogs max, up to 40 lbs', 'month to month', '30 days'
FROM properties p
WHERE p.address LIKE '%3069 Rita%' AND p.property_type = 'Company-Owned';

-- Scandi Chic
INSERT INTO property_policies (property_id, pets_allowed, max_pets, max_pet_weight, pet_rules, lease_term, notice_to_vacate)
SELECT p.id, true, 2, 40, '2 dogs max, up to 40 lbs', 'month to month', '30 days'
FROM properties p
WHERE p.address LIKE '%3155 Duvall%' AND p.property_type = 'Company-Owned';

-- The Bloom
INSERT INTO property_policies (property_id, pets_allowed, max_pets, max_pet_weight, pet_rules, lease_term, notice_to_vacate)
SELECT p.id, true, 2, 40, '2 dogs max, up to 40 lbs', 'month to month', '30 days'
FROM properties p
WHERE p.address LIKE '%169 Willow%' AND p.property_type = 'Company-Owned';

-- Import School Information from CSV
-- Alpine (Chesney Elementary, Duluth MS, Duluth HS)
INSERT INTO property_schools (property_id, school_district, elementary_school, middle_school, high_school)
SELECT p.id, 'Gwinnett County Schools', 'Chesney Elementary', 'Duluth MS', 'Duluth HS'
FROM properties p
WHERE p.address LIKE '%4241 Osburn%' AND p.property_type = 'Company-Owned';

-- Family Retreat (Hopkins Elementary, Berkmar Middle, Berkmar High)
INSERT INTO property_schools (property_id, school_district, elementary_school, middle_school, high_school)
SELECT p.id, 'Gwinnett County Schools', 'Hopkins Elementary', 'Berkmar Middle', 'Berkmar High'
FROM properties p
WHERE p.address LIKE '%5360 Durham%' AND p.property_type = 'Company-Owned';

-- Scandinavian Retreat (Nickajack Elem, Griffin MS, Campbell HS)
INSERT INTO property_schools (property_id, school_district, elementary_school, middle_school, high_school)
SELECT p.id, 'Cobb County Schools', 'Nickajack Elem', 'Griffin MS', 'Campbell HS'
FROM properties p
WHERE p.address LIKE '%5198 Laurel%' AND p.property_type = 'Company-Owned';

-- Old Roswell (Smyrna Elementary, Campbell Middle, Campbell HS)
INSERT INTO property_schools (property_id, school_district, elementary_school, middle_school, high_school)
SELECT p.id, 'Cobb County Schools', 'Smyrna Elementary', 'Campbell Middle', 'Campbell HS'
FROM properties p
WHERE p.address LIKE '%2580 Old Roswell%' AND p.property_type = 'Company-Owned';

-- Rita Way (Smyrna Elementary, Campbell Middle, Campbell HS)
INSERT INTO property_schools (property_id, school_district, elementary_school, middle_school, high_school)
SELECT p.id, 'Cobb County Schools', 'Smyrna Elementary', 'Campbell Middle', 'Campbell HS'
FROM properties p
WHERE p.address LIKE '%3069 Rita%' AND p.property_type = 'Company-Owned';

-- Scandi Chic (Big Shanty Elementary, Palmer Middle School, North Cobb HS)
INSERT INTO property_schools (property_id, school_district, elementary_school, middle_school, high_school)
SELECT p.id, 'Cobb County Schools', 'Big Shanty Elementary', 'Palmer Middle School', 'North Cobb HS'
FROM properties p
WHERE p.address LIKE '%3155 Duvall%' AND p.property_type = 'Company-Owned';

-- The Bloom (Mimosa Elementary, Elkins Pointe Middle, Roswell HS)
INSERT INTO property_schools (property_id, school_district, elementary_school, middle_school, high_school)
SELECT p.id, 'Fulton County Schools', 'Mimosa Elementary', 'Elkins Pointe Middle', 'Roswell HS'
FROM properties p
WHERE p.address LIKE '%169 Willow%' AND p.property_type = 'Company-Owned';

-- Import Contact Information from CSV
INSERT INTO property_contact_info (property_id, contact_email, contact_phone, website_url)
SELECT p.id, 'anja@peachhausgroup.com', '470-863-8087', 
  CASE 
    WHEN p.address LIKE '%4241 Osburn%' THEN 'https://www.thealpineduluth.com'
    WHEN p.address LIKE '%5360 Durham%' THEN 'https://www.durhamretreat.com'
    WHEN p.address LIKE '%5198 Laurel%' THEN 'scandi-retreat.peachhausgroup.com'
    WHEN p.address LIKE '%2580 Old Roswell%' THEN 'https://oldroswell.peachhausgroup.com/'
    WHEN p.address LIKE '%3069 Rita%' THEN 'https://ritaway.peachhausgroup.com'
    WHEN p.address LIKE '%3155 Duvall%' THEN 'http://scandi-chic.peachhausgroup.com/'
    WHEN p.address LIKE '%169 Willow%' THEN 'https://bloom.peachhausfurnishedrentals.com'
    ELSE NULL
  END
FROM properties p
WHERE p.property_type = 'Company-Owned';

-- Import Platform Listings from CSV (based on TRUE/FALSE values in CSV)
-- Mobile platform (all properties have TRUE)
INSERT INTO platform_listings (property_id, platform_name, is_active, listing_url)
SELECT p.id, 'Mobile', true, '470-863-8087'
FROM properties p
WHERE p.property_type = 'Company-Owned';

-- Homelink platform (all have TRUE)
INSERT INTO platform_listings (property_id, platform_name, is_active, listing_url)
SELECT p.id, 'Homelink', true, NULL
FROM properties p
WHERE p.property_type = 'Company-Owned';

-- CRS Updated (all have TRUE)
INSERT INTO platform_listings (property_id, platform_name, is_active, listing_url)
SELECT p.id, 'CRS Updated', true, NULL
FROM properties p
WHERE p.property_type = 'Company-Owned';

-- ALE (all have TRUE)
INSERT INTO platform_listings (property_id, platform_name, is_active, listing_url)
SELECT p.id, 'ALE', true, NULL
FROM properties p
WHERE p.property_type = 'Company-Owned';

-- NCH (all have TRUE)
INSERT INTO platform_listings (property_id, platform_name, is_active, listing_url)
SELECT p.id, 'NCH', true, NULL
FROM properties p
WHERE p.property_type = 'Company-Owned';

-- CRU Homes (all have TRUE)
INSERT INTO platform_listings (property_id, platform_name, is_active, listing_url)
SELECT p.id, 'CRU Homes', true, NULL
FROM properties p
WHERE p.property_type = 'Company-Owned';

-- Midtermrentals.com (all have FALSE)
INSERT INTO platform_listings (property_id, platform_name, is_active, listing_url)
SELECT p.id, 'Midtermrentals.com', false, NULL
FROM properties p
WHERE p.property_type = 'Company-Owned';

-- Now populate onboarding task field values from the imported CSV data
DO $$
DECLARE
    property_record RECORD;
    project_record RECORD;
    details_record RECORD;
    pricing_record RECORD;
    policies_record RECORD;
    schools_record RECORD;
    contact_record RECORD;
BEGIN
    FOR property_record IN 
        SELECT id, name, address FROM properties WHERE property_type = 'Company-Owned'
    LOOP
        SELECT id INTO project_record FROM onboarding_projects WHERE property_id = property_record.id LIMIT 1;
        
        IF project_record.id IS NOT NULL THEN
            SELECT * INTO details_record FROM property_details WHERE property_id = property_record.id LIMIT 1;
            SELECT * INTO pricing_record FROM property_pricing_history WHERE property_id = property_record.id AND is_current = true LIMIT 1;
            SELECT * INTO policies_record FROM property_policies WHERE property_id = property_record.id LIMIT 1;
            SELECT * INTO schools_record FROM property_schools WHERE property_id = property_record.id LIMIT 1;
            SELECT * INTO contact_record FROM property_contact_info WHERE property_id = property_record.id LIMIT 1;
            
            -- Phase 10: Property Specifications
            IF details_record IS NOT NULL THEN
                UPDATE onboarding_tasks SET field_value = details_record.bedrooms::text
                WHERE project_id = project_record.id AND title ILIKE '%bedroom%' AND phase_number = 10 
                AND (field_value IS NULL OR field_value = '');
                
                UPDATE onboarding_tasks SET field_value = details_record.bathrooms::text
                WHERE project_id = project_record.id AND title ILIKE '%bathroom%' AND phase_number = 10
                AND (field_value IS NULL OR field_value = '');
                
                UPDATE onboarding_tasks SET field_value = details_record.sqft::text
                WHERE project_id = project_record.id AND (title ILIKE '%square%' OR title ILIKE '%sqft%') AND phase_number = 10
                AND (field_value IS NULL OR field_value = '');
                
                UPDATE onboarding_tasks SET field_value = details_record.parking_type
                WHERE project_id = project_record.id AND title ILIKE '%parking%type%' AND phase_number = 10
                AND (field_value IS NULL OR field_value = '');
                
                UPDATE onboarding_tasks SET field_value = details_record.parking_spaces
                WHERE project_id = project_record.id AND title ILIKE '%parking%space%' AND phase_number = 10
                AND (field_value IS NULL OR field_value = '');
                
                UPDATE onboarding_tasks SET field_value = details_record.fenced_yard
                WHERE project_id = project_record.id AND title ILIKE '%fenced%' AND phase_number = 10
                AND (field_value IS NULL OR field_value = '');
                
                UPDATE onboarding_tasks SET field_value = details_record.property_type_detail
                WHERE project_id = project_record.id AND title ILIKE '%property type%' AND phase_number = 10
                AND (field_value IS NULL OR field_value = '');
            END IF;
            
            -- Phase 11: Financial Terms
            IF pricing_record IS NOT NULL THEN
                UPDATE onboarding_tasks SET field_value = '$' || pricing_record.monthly_rent::text
                WHERE project_id = project_record.id AND title ILIKE '%monthly%rent%' AND phase_number = 11
                AND (field_value IS NULL OR field_value = '');
                
                UPDATE onboarding_tasks SET field_value = '$' || pricing_record.security_deposit::text
                WHERE project_id = project_record.id AND title ILIKE '%security%deposit%' AND phase_number = 11
                AND (field_value IS NULL OR field_value = '');
                
                UPDATE onboarding_tasks SET field_value = '$' || pricing_record.cleaning_fee::text
                WHERE project_id = project_record.id AND title ILIKE '%cleaning%fee%' AND phase_number = 11
                AND (field_value IS NULL OR field_value = '');
                
                UPDATE onboarding_tasks SET field_value = '$' || pricing_record.admin_fee::text
                WHERE project_id = project_record.id AND title ILIKE '%admin%fee%' AND phase_number = 11
                AND (field_value IS NULL OR field_value = '');
                
                UPDATE onboarding_tasks SET field_value = '$' || pricing_record.pet_fee::text
                WHERE project_id = project_record.id AND title ILIKE '%pet%fee%' AND phase_number = 11
                AND (field_value IS NULL OR field_value = '');
                
                UPDATE onboarding_tasks SET field_value = '$' || pricing_record.utility_cap::text
                WHERE project_id = project_record.id AND title ILIKE '%utility%' AND phase_number = 11
                AND (field_value IS NULL OR field_value = '');
            END IF;
            
            -- Phase 12: Pet & Lease Policies
            IF policies_record IS NOT NULL THEN
                UPDATE onboarding_tasks SET field_value = CASE WHEN policies_record.pets_allowed THEN 'Yes' ELSE 'No' END
                WHERE project_id = project_record.id AND title ILIKE '%pets%allowed%' AND phase_number = 12
                AND (field_value IS NULL OR field_value = '');
                
                UPDATE onboarding_tasks SET field_value = policies_record.max_pets::text
                WHERE project_id = project_record.id AND title ILIKE '%max%pet%' AND phase_number = 12
                AND (field_value IS NULL OR field_value = '');
                
                UPDATE onboarding_tasks SET field_value = policies_record.pet_rules
                WHERE project_id = project_record.id AND title ILIKE '%pet%rule%' AND phase_number = 12
                AND (field_value IS NULL OR field_value = '');
                
                UPDATE onboarding_tasks SET field_value = policies_record.lease_term
                WHERE project_id = project_record.id AND title ILIKE '%lease%term%' AND phase_number = 12
                AND (field_value IS NULL OR field_value = '');
                
                UPDATE onboarding_tasks SET field_value = policies_record.notice_to_vacate
                WHERE project_id = project_record.id AND title ILIKE '%notice%' AND phase_number = 12
                AND (field_value IS NULL OR field_value = '');
            END IF;
            
            -- Phase 13: Schools
            IF schools_record IS NOT NULL THEN
                UPDATE onboarding_tasks SET field_value = schools_record.school_district
                WHERE project_id = project_record.id AND title ILIKE '%school%district%' AND phase_number = 13
                AND (field_value IS NULL OR field_value = '');
                
                UPDATE onboarding_tasks SET field_value = schools_record.elementary_school
                WHERE project_id = project_record.id AND title ILIKE '%elementary%' AND phase_number = 13
                AND (field_value IS NULL OR field_value = '');
                
                UPDATE onboarding_tasks SET field_value = schools_record.middle_school
                WHERE project_id = project_record.id AND title ILIKE '%middle%' AND phase_number = 13
                AND (field_value IS NULL OR field_value = '');
                
                UPDATE onboarding_tasks SET field_value = schools_record.high_school
                WHERE project_id = project_record.id AND title ILIKE '%high%' AND phase_number = 13
                AND (field_value IS NULL OR field_value = '');
            END IF;
            
            -- Phase 14: Contact Info
            IF contact_record IS NOT NULL THEN
                UPDATE onboarding_tasks SET field_value = contact_record.contact_email
                WHERE project_id = project_record.id AND title ILIKE '%email%' AND phase_number = 14
                AND (field_value IS NULL OR field_value = '');
                
                UPDATE onboarding_tasks SET field_value = contact_record.contact_phone
                WHERE project_id = project_record.id AND title ILIKE '%phone%' AND phase_number = 14
                AND (field_value IS NULL OR field_value = '');
                
                UPDATE onboarding_tasks SET field_value = contact_record.website_url
                WHERE project_id = project_record.id AND title ILIKE '%website%' AND phase_number = 14
                AND (field_value IS NULL OR field_value = '');
            END IF;
            
            -- Phase 7: Platform Listings
            UPDATE onboarding_tasks SET field_value = 'Active on Mobile, Homelink, CRS Updated, ALE, NCH, CRU Homes'
            WHERE project_id = project_record.id 
            AND title ILIKE '%platform%'
            AND phase_number = 7
            AND (field_value IS NULL OR field_value = '');
        END IF;
    END LOOP;
END $$;