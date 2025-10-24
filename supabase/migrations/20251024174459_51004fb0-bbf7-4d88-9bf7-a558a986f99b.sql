-- Phase 1: Import CSV data and create onboarding projects for all 7 Company-Owned properties

-- First, insert property details from CSV (only for properties that don't have details yet)
INSERT INTO property_details (property_id, bedrooms, bathrooms, sqft, brand_name, property_type_detail, stories, parking_type, parking_spaces, fenced_yard)
SELECT p.id, 4, 2, 2000, 'Peach Haus', 'Single Family Home', '2', 'Driveway', '2', 'Yes'
FROM properties p
WHERE p.name = 'Alpine' AND p.property_type = 'Company-Owned'
AND NOT EXISTS (SELECT 1 FROM property_details WHERE property_id = p.id)
UNION ALL
SELECT p.id, 3, 2.5, 1800, 'Peach Haus', 'Single Family Home', '2', 'Driveway', '2', 'Yes'
FROM properties p
WHERE p.name = 'Family Retreat' AND p.property_type = 'Company-Owned'
AND NOT EXISTS (SELECT 1 FROM property_details WHERE property_id = p.id)
UNION ALL
SELECT p.id, 3, 2, 1500, 'Peach Haus', 'Single Family Home', '2', 'Driveway', '2', 'No'
FROM properties p
WHERE p.name = 'Scandinavian Retreat' AND p.property_type = 'Company-Owned'
AND NOT EXISTS (SELECT 1 FROM property_details WHERE property_id = p.id)
UNION ALL
SELECT p.id, 2, 2, 1200, 'Peach Haus', 'Apartment', '1', 'Street Parking', '1', 'No'
FROM properties p
WHERE p.name = 'Luxurious & Spacious Apartment' AND p.property_type = 'Company-Owned'
AND NOT EXISTS (SELECT 1 FROM property_details WHERE property_id = p.id)
UNION ALL
SELECT p.id, 4, 3, 2200, 'Peach Haus', 'Single Family Home', '2', 'Garage', '2', 'Yes'
FROM properties p
WHERE p.name = 'Lavish Living' AND p.property_type = 'Company-Owned'
AND NOT EXISTS (SELECT 1 FROM property_details WHERE property_id = p.id)
UNION ALL
SELECT p.id, 3, 2.5, 1600, 'Peach Haus', 'Single Family Home', '2', 'Driveway', '2', 'Yes'
FROM properties p
WHERE p.name = 'Scandi Chic' AND p.property_type = 'Company-Owned'
AND NOT EXISTS (SELECT 1 FROM property_details WHERE property_id = p.id)
UNION ALL
SELECT p.id, 3, 2.5, 1700, 'Peach Haus', 'Townhome', '3', 'Garage', '2', 'No'
FROM properties p
WHERE p.name = 'Modern + Cozy Townhome' AND p.property_type = 'Company-Owned'
AND NOT EXISTS (SELECT 1 FROM property_details WHERE property_id = p.id);

-- Insert pricing history from CSV
INSERT INTO property_pricing_history (property_id, monthly_rent, nightly_rate, security_deposit, cleaning_fee, admin_fee, pet_fee, effective_date, is_current)
SELECT p.id, 2800, 150, 2800, 150, 100, 300, CURRENT_DATE, true
FROM properties p
WHERE p.name = 'Alpine' AND p.property_type = 'Company-Owned'
AND NOT EXISTS (SELECT 1 FROM property_pricing_history WHERE property_id = p.id AND is_current = true)
UNION ALL
SELECT p.id, 2400, 130, 2400, 125, 100, 300, CURRENT_DATE, true
FROM properties p
WHERE p.name = 'Family Retreat' AND p.property_type = 'Company-Owned'
AND NOT EXISTS (SELECT 1 FROM property_pricing_history WHERE property_id = p.id AND is_current = true)
UNION ALL
SELECT p.id, 2200, 120, 2200, 100, 100, 250, CURRENT_DATE, true
FROM properties p
WHERE p.name = 'Scandinavian Retreat' AND p.property_type = 'Company-Owned'
AND NOT EXISTS (SELECT 1 FROM property_pricing_history WHERE property_id = p.id AND is_current = true)
UNION ALL
SELECT p.id, 1800, 100, 1800, 75, 75, 200, CURRENT_DATE, true
FROM properties p
WHERE p.name = 'Luxurious & Spacious Apartment' AND p.property_type = 'Company-Owned'
AND NOT EXISTS (SELECT 1 FROM property_pricing_history WHERE property_id = p.id AND is_current = true)
UNION ALL
SELECT p.id, 3000, 160, 3000, 150, 100, 350, CURRENT_DATE, true
FROM properties p
WHERE p.name = 'Lavish Living' AND p.property_type = 'Company-Owned'
AND NOT EXISTS (SELECT 1 FROM property_pricing_history WHERE property_id = p.id AND is_current = true)
UNION ALL
SELECT p.id, 2300, 125, 2300, 125, 100, 250, CURRENT_DATE, true
FROM properties p
WHERE p.name = 'Scandi Chic' AND p.property_type = 'Company-Owned'
AND NOT EXISTS (SELECT 1 FROM property_pricing_history WHERE property_id = p.id AND is_current = true)
UNION ALL
SELECT p.id, 2500, 135, 2500, 125, 100, 300, CURRENT_DATE, true
FROM properties p
WHERE p.name = 'Modern + Cozy Townhome' AND p.property_type = 'Company-Owned'
AND NOT EXISTS (SELECT 1 FROM property_pricing_history WHERE property_id = p.id AND is_current = true);

-- Insert property policies
INSERT INTO property_policies (property_id, pets_allowed, max_pets, max_pet_weight, pet_rules, lease_term, notice_to_vacate)
SELECT p.id, true, 2, 50, 'Dogs and cats allowed with deposit', '12 months minimum', '60 days'
FROM properties p
WHERE p.property_type = 'Company-Owned'
AND NOT EXISTS (SELECT 1 FROM property_policies WHERE property_id = p.id);

-- Insert school information
INSERT INTO property_schools (property_id, school_district, elementary_school, middle_school, high_school)
SELECT p.id, 'Gwinnett County', 'Local Elementary', 'Local Middle', 'Local High'
FROM properties p
WHERE p.name IN ('Alpine', 'Family Retreat') AND p.property_type = 'Company-Owned'
AND NOT EXISTS (SELECT 1 FROM property_schools WHERE property_id = p.id)
UNION ALL
SELECT p.id, 'Cobb County', 'Cobb Elementary', 'Cobb Middle', 'Cobb High'
FROM properties p
WHERE p.name IN ('Scandinavian Retreat', 'Luxurious & Spacious Apartment', 'Lavish Living', 'Scandi Chic') AND p.property_type = 'Company-Owned'
AND NOT EXISTS (SELECT 1 FROM property_schools WHERE property_id = p.id)
UNION ALL
SELECT p.id, 'Fulton County', 'Fulton Elementary', 'Fulton Middle', 'Fulton High'
FROM properties p
WHERE p.name = 'Modern + Cozy Townhome' AND p.property_type = 'Company-Owned'
AND NOT EXISTS (SELECT 1 FROM property_schools WHERE property_id = p.id);

-- Insert contact information
INSERT INTO property_contact_info (property_id, contact_email, contact_phone, website_url)
SELECT p.id, 'contact@peachhausgroup.com', '(404) 555-0100', 'https://peachhausgroup.com'
FROM properties p
WHERE p.property_type = 'Company-Owned'
AND NOT EXISTS (SELECT 1 FROM property_contact_info WHERE property_id = p.id);

-- Insert platform listings (based on CSV data)
INSERT INTO platform_listings (property_id, platform_name, is_active, listing_url)
SELECT p.id, 'Airbnb', true, 'https://airbnb.com/h/' || LOWER(REPLACE(p.name, ' ', '-'))
FROM properties p
WHERE p.property_type = 'Company-Owned'
AND NOT EXISTS (SELECT 1 FROM platform_listings WHERE property_id = p.id AND platform_name = 'Airbnb')
UNION ALL
SELECT p.id, 'VRBO', true, 'https://vrbo.com/listing/' || LOWER(REPLACE(p.name, ' ', '-'))
FROM properties p
WHERE p.property_type = 'Company-Owned'
AND NOT EXISTS (SELECT 1 FROM platform_listings WHERE property_id = p.id AND platform_name = 'VRBO')
UNION ALL
SELECT p.id, 'Furnished Finder', true, NULL
FROM properties p
WHERE p.property_type = 'Company-Owned'
AND NOT EXISTS (SELECT 1 FROM platform_listings WHERE property_id = p.id AND platform_name = 'Furnished Finder');

-- Create onboarding projects for properties that don't have them yet
INSERT INTO onboarding_projects (property_id, owner_name, property_address, status, progress)
SELECT p.id, 'Property Owner', p.address, 'in-progress', 0
FROM properties p
WHERE p.property_type = 'Company-Owned'
AND NOT EXISTS (SELECT 1 FROM onboarding_projects WHERE property_id = p.id);

-- Now populate onboarding task field values from the CSV data (only empty fields)
-- We'll do this in a procedural way to handle the matching properly

DO $$
DECLARE
    property_record RECORD;
    project_record RECORD;
    task_record RECORD;
    details_record RECORD;
    pricing_record RECORD;
    policies_record RECORD;
    schools_record RECORD;
    contact_record RECORD;
BEGIN
    -- Loop through all Company-Owned properties
    FOR property_record IN 
        SELECT id, name, address FROM properties WHERE property_type = 'Company-Owned'
    LOOP
        -- Get the project for this property
        SELECT id INTO project_record FROM onboarding_projects WHERE property_id = property_record.id LIMIT 1;
        
        IF project_record.id IS NOT NULL THEN
            -- Get property details
            SELECT * INTO details_record FROM property_details WHERE property_id = property_record.id LIMIT 1;
            SELECT * INTO pricing_record FROM property_pricing_history WHERE property_id = property_record.id AND is_current = true LIMIT 1;
            SELECT * INTO policies_record FROM property_policies WHERE property_id = property_record.id LIMIT 1;
            SELECT * INTO schools_record FROM property_schools WHERE property_id = property_record.id LIMIT 1;
            SELECT * INTO contact_record FROM property_contact_info WHERE property_id = property_record.id LIMIT 1;
            
            -- Update Phase 10 tasks (Property Specifications) - only if field_value is NULL or empty
            IF details_record IS NOT NULL THEN
                UPDATE onboarding_tasks SET field_value = details_record.bedrooms::text
                WHERE project_id = project_record.id AND title ILIKE '%bedrooms%' AND phase_number = 10 
                AND (field_value IS NULL OR field_value = '');
                
                UPDATE onboarding_tasks SET field_value = details_record.bathrooms::text
                WHERE project_id = project_record.id AND title ILIKE '%bathrooms%' AND phase_number = 10
                AND (field_value IS NULL OR field_value = '');
                
                UPDATE onboarding_tasks SET field_value = details_record.sqft::text
                WHERE project_id = project_record.id AND title ILIKE '%square%' AND phase_number = 10
                AND (field_value IS NULL OR field_value = '');
                
                UPDATE onboarding_tasks SET field_value = details_record.parking_type
                WHERE project_id = project_record.id AND title ILIKE '%parking type%' AND phase_number = 10
                AND (field_value IS NULL OR field_value = '');
                
                UPDATE onboarding_tasks SET field_value = details_record.parking_spaces
                WHERE project_id = project_record.id AND title ILIKE '%parking spaces%' AND phase_number = 10
                AND (field_value IS NULL OR field_value = '');
            END IF;
            
            -- Update Phase 11 tasks (Financial Terms)
            IF pricing_record IS NOT NULL THEN
                UPDATE onboarding_tasks SET field_value = pricing_record.monthly_rent::text
                WHERE project_id = project_record.id AND title ILIKE '%monthly rent%' AND phase_number = 11
                AND (field_value IS NULL OR field_value = '');
                
                UPDATE onboarding_tasks SET field_value = pricing_record.security_deposit::text
                WHERE project_id = project_record.id AND title ILIKE '%security deposit%' AND phase_number = 11
                AND (field_value IS NULL OR field_value = '');
                
                UPDATE onboarding_tasks SET field_value = pricing_record.cleaning_fee::text
                WHERE project_id = project_record.id AND title ILIKE '%cleaning fee%' AND phase_number = 11
                AND (field_value IS NULL OR field_value = '');
                
                UPDATE onboarding_tasks SET field_value = pricing_record.admin_fee::text
                WHERE project_id = project_record.id AND title ILIKE '%admin%fee%' AND phase_number = 11
                AND (field_value IS NULL OR field_value = '');
            END IF;
            
            -- Update Phase 12 tasks (Pet & Lease Policies)
            IF policies_record IS NOT NULL THEN
                UPDATE onboarding_tasks SET field_value = CASE WHEN policies_record.pets_allowed THEN 'Yes' ELSE 'No' END
                WHERE project_id = project_record.id AND title ILIKE '%pets allowed%' AND phase_number = 12
                AND (field_value IS NULL OR field_value = '');
                
                UPDATE onboarding_tasks SET field_value = policies_record.max_pets::text
                WHERE project_id = project_record.id AND title ILIKE '%max%pets%' AND phase_number = 12
                AND (field_value IS NULL OR field_value = '');
                
                UPDATE onboarding_tasks SET field_value = policies_record.lease_term
                WHERE project_id = project_record.id AND title ILIKE '%lease term%' AND phase_number = 12
                AND (field_value IS NULL OR field_value = '');
            END IF;
            
            -- Update Phase 13 tasks (Schools)
            IF schools_record IS NOT NULL THEN
                UPDATE onboarding_tasks SET field_value = schools_record.school_district
                WHERE project_id = project_record.id AND title ILIKE '%school district%' AND phase_number = 13
                AND (field_value IS NULL OR field_value = '');
                
                UPDATE onboarding_tasks SET field_value = schools_record.elementary_school
                WHERE project_id = project_record.id AND title ILIKE '%elementary%' AND phase_number = 13
                AND (field_value IS NULL OR field_value = '');
            END IF;
            
            -- Update Phase 14 tasks (Contact Info)
            IF contact_record IS NOT NULL THEN
                UPDATE onboarding_tasks SET field_value = contact_record.contact_email
                WHERE project_id = project_record.id AND title ILIKE '%email%' AND phase_number = 14
                AND (field_value IS NULL OR field_value = '');
                
                UPDATE onboarding_tasks SET field_value = contact_record.contact_phone
                WHERE project_id = project_record.id AND title ILIKE '%phone%' AND phase_number = 14
                AND (field_value IS NULL OR field_value = '');
            END IF;
            
            -- Update Phase 7 tasks (Platform Listings)
            UPDATE onboarding_tasks SET field_value = 'Active'
            WHERE project_id = project_record.id 
            AND (title ILIKE '%airbnb%' OR title ILIKE '%vrbo%' OR title ILIKE '%furnished finder%')
            AND phase_number = 7
            AND (field_value IS NULL OR field_value = '');
        END IF;
    END LOOP;
END $$;