-- Remove the old check constraint and add a new one that allows phases 1-14
ALTER TABLE onboarding_tasks DROP CONSTRAINT IF EXISTS onboarding_tasks_phase_number_check;
ALTER TABLE onboarding_tasks ADD CONSTRAINT onboarding_tasks_phase_number_check CHECK (phase_number >= 1 AND phase_number <= 14);

-- Now create all tasks for the 6 properties that don't have tasks
INSERT INTO onboarding_tasks (project_id, phase_number, phase_title, title, field_type, status)
SELECT project_id, phase_num, phase_title, task_title, task_field_type, 'pending'
FROM (
  SELECT 
    op.id as project_id,
    10 as phase_num,
    'Property Specifications' as phase_title,
    unnest(ARRAY['Number of Bedrooms', 'Number of Bathrooms', 'Square Footage', 'Property Type', 'Number of Stories', 'Parking Type', 'Parking Spaces', 'Fenced Yard', 'Basement', 'ADA Compliant']) as task_title,
    unnest(ARRAY['text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text']) as task_field_type
  FROM onboarding_projects op
  JOIN properties p ON p.id = op.property_id
  WHERE p.property_type = 'Company-Owned'
  AND NOT EXISTS (SELECT 1 FROM onboarding_tasks WHERE project_id = op.id LIMIT 1)
  
  UNION ALL
  
  SELECT 
    op.id,
    11,
    'Financial Terms',
    unnest(ARRAY['Monthly Rent', 'Nightly Rate', 'Security Deposit', 'Utility Cap', 'Cleaning Fee', 'Admin Fee', 'Pet Fee', 'Monthly Pet Rent', 'Monthly Cleaning Fee']),
    unnest(ARRAY['currency', 'currency', 'currency', 'currency', 'currency', 'currency', 'currency', 'currency', 'currency'])
  FROM onboarding_projects op
  JOIN properties p ON p.id = op.property_id
  WHERE p.property_type = 'Company-Owned'
  AND NOT EXISTS (SELECT 1 FROM onboarding_tasks WHERE project_id = op.id LIMIT 1)
  
  UNION ALL
  
  SELECT 
    op.id,
    12,
    'Pet & Lease Policies',
    unnest(ARRAY['Pets Allowed', 'Pet Rules', 'Maximum Number of Pets', 'Maximum Pet Weight (lbs)', 'Lease Term', 'Notice to Vacate']),
    unnest(ARRAY['radio', 'textarea', 'text', 'text', 'text', 'text'])
  FROM onboarding_projects op
  JOIN properties p ON p.id = op.property_id
  WHERE p.property_type = 'Company-Owned'
  AND NOT EXISTS (SELECT 1 FROM onboarding_tasks WHERE project_id = op.id LIMIT 1)
  
  UNION ALL
  
  SELECT 
    op.id,
    13,
    'Schools & Neighborhood',
    unnest(ARRAY['School District', 'Elementary School', 'Middle School', 'High School']),
    unnest(ARRAY['text', 'text', 'text', 'text'])
  FROM onboarding_projects op
  JOIN properties p ON p.id = op.property_id
  WHERE p.property_type = 'Company-Owned'
  AND NOT EXISTS (SELECT 1 FROM onboarding_tasks WHERE project_id = op.id LIMIT 1)
  
  UNION ALL
  
  SELECT 
    op.id,
    14,
    'Contact & Website Information',
    unnest(ARRAY['Contact Email', 'Contact Phone', 'Direct Booking Website']),
    unnest(ARRAY['text', 'phone', 'text'])
  FROM onboarding_projects op
  JOIN properties p ON p.id = op.property_id
  WHERE p.property_type = 'Company-Owned'
  AND NOT EXISTS (SELECT 1 FROM onboarding_tasks WHERE project_id = op.id LIMIT 1)
) tasks;

-- Now populate all tasks with the imported data
UPDATE onboarding_tasks ot
SET field_value = pd.bedrooms::text
FROM onboarding_projects op
JOIN properties p ON p.id = op.property_id
JOIN property_details pd ON p.id = pd.property_id
WHERE ot.project_id = op.id
AND p.property_type = 'Company-Owned'
AND ot.title = 'Number of Bedrooms'
AND (ot.field_value IS NULL OR ot.field_value = '');

UPDATE onboarding_tasks ot
SET field_value = pd.bathrooms::text
FROM onboarding_projects op
JOIN properties p ON p.id = op.property_id
JOIN property_details pd ON p.id = pd.property_id
WHERE ot.project_id = op.id
AND p.property_type = 'Company-Owned'
AND ot.title = 'Number of Bathrooms'
AND (ot.field_value IS NULL OR ot.field_value = '');

UPDATE onboarding_tasks ot
SET field_value = pd.sqft::text
FROM onboarding_projects op
JOIN properties p ON p.id = op.property_id
JOIN property_details pd ON p.id = pd.property_id
WHERE ot.project_id = op.id
AND p.property_type = 'Company-Owned'
AND ot.title = 'Square Footage'
AND (ot.field_value IS NULL OR ot.field_value = '');

UPDATE onboarding_tasks ot
SET field_value = pd.property_type_detail
FROM onboarding_projects op
JOIN properties p ON p.id = op.property_id
JOIN property_details pd ON p.id = pd.property_id
WHERE ot.project_id = op.id
AND p.property_type = 'Company-Owned'
AND ot.title = 'Property Type'
AND (ot.field_value IS NULL OR ot.field_value = '');

UPDATE onboarding_tasks ot
SET field_value = pd.stories
FROM onboarding_projects op
JOIN properties p ON p.id = op.property_id
JOIN property_details pd ON p.id = pd.property_id
WHERE ot.project_id = op.id
AND p.property_type = 'Company-Owned'
AND ot.title = 'Number of Stories'
AND (ot.field_value IS NULL OR ot.field_value = '');

UPDATE onboarding_tasks ot
SET field_value = pd.parking_type
FROM onboarding_projects op
JOIN properties p ON p.id = op.property_id
JOIN property_details pd ON p.id = pd.property_id
WHERE ot.project_id = op.id
AND p.property_type = 'Company-Owned'
AND ot.title = 'Parking Type'
AND (ot.field_value IS NULL OR ot.field_value = '');

UPDATE onboarding_tasks ot
SET field_value = pd.parking_spaces
FROM onboarding_projects op
JOIN properties p ON p.id = op.property_id
JOIN property_details pd ON p.id = pd.property_id
WHERE ot.project_id = op.id
AND p.property_type = 'Company-Owned'
AND ot.title = 'Parking Spaces'
AND (ot.field_value IS NULL OR ot.field_value = '');

UPDATE onboarding_tasks ot
SET field_value = pd.fenced_yard
FROM onboarding_projects op
JOIN properties p ON p.id = op.property_id
JOIN property_details pd ON p.id = pd.property_id
WHERE ot.project_id = op.id
AND p.property_type = 'Company-Owned'
AND ot.title = 'Fenced Yard'
AND (ot.field_value IS NULL OR ot.field_value = '');

UPDATE onboarding_tasks ot
SET field_value = pd.basement
FROM onboarding_projects op
JOIN properties p ON p.id = op.property_id
JOIN property_details pd ON p.id = pd.property_id
WHERE ot.project_id = op.id
AND p.property_type = 'Company-Owned'
AND ot.title = 'Basement'
AND (ot.field_value IS NULL OR ot.field_value = '');

-- Financial Terms
UPDATE onboarding_tasks ot
SET field_value = '$' || ph.monthly_rent::text
FROM onboarding_projects op
JOIN properties p ON p.id = op.property_id
JOIN property_pricing_history ph ON p.id = ph.property_id AND ph.is_current = true
WHERE ot.project_id = op.id
AND p.property_type = 'Company-Owned'
AND ot.title = 'Monthly Rent'
AND (ot.field_value IS NULL OR ot.field_value = '');

UPDATE onboarding_tasks ot
SET field_value = '$' || ph.nightly_rate::text
FROM onboarding_projects op
JOIN properties p ON p.id = op.property_id
JOIN property_pricing_history ph ON p.id = ph.property_id AND ph.is_current = true
WHERE ot.project_id = op.id
AND p.property_type = 'Company-Owned'
AND ot.title = 'Nightly Rate'
AND (ot.field_value IS NULL OR ot.field_value = '');

UPDATE onboarding_tasks ot
SET field_value = '$' || ph.security_deposit::text
FROM onboarding_projects op
JOIN properties p ON p.id = op.property_id
JOIN property_pricing_history ph ON p.id = ph.property_id AND ph.is_current = true
WHERE ot.project_id = op.id
AND p.property_type = 'Company-Owned'
AND ot.title = 'Security Deposit'
AND (ot.field_value IS NULL OR ot.field_value = '');

UPDATE onboarding_tasks ot
SET field_value = '$' || ph.utility_cap::text
FROM onboarding_projects op
JOIN properties p ON p.id = op.property_id
JOIN property_pricing_history ph ON p.id = ph.property_id AND ph.is_current = true
WHERE ot.project_id = op.id
AND p.property_type = 'Company-Owned'
AND ot.title = 'Utility Cap'
AND (ot.field_value IS NULL OR ot.field_value = '');

UPDATE onboarding_tasks ot
SET field_value = '$' || ph.cleaning_fee::text
FROM onboarding_projects op
JOIN properties p ON p.id = op.property_id
JOIN property_pricing_history ph ON p.id = ph.property_id AND ph.is_current = true
WHERE ot.project_id = op.id
AND p.property_type = 'Company-Owned'
AND ot.title = 'Cleaning Fee'
AND (ot.field_value IS NULL OR ot.field_value = '');

UPDATE onboarding_tasks ot
SET field_value = '$' || ph.admin_fee::text
FROM onboarding_projects op
JOIN properties p ON p.id = op.property_id
JOIN property_pricing_history ph ON p.id = ph.property_id AND ph.is_current = true
WHERE ot.project_id = op.id
AND p.property_type = 'Company-Owned'
AND ot.title = 'Admin Fee'
AND (ot.field_value IS NULL OR ot.field_value = '');

UPDATE onboarding_tasks ot
SET field_value = '$' || ph.pet_fee::text
FROM onboarding_projects op
JOIN properties p ON p.id = op.property_id
JOIN property_pricing_history ph ON p.id = ph.property_id AND ph.is_current = true
WHERE ot.project_id = op.id
AND p.property_type = 'Company-Owned'
AND ot.title = 'Pet Fee'
AND (ot.field_value IS NULL OR ot.field_value = '');

UPDATE onboarding_tasks ot
SET field_value = '$' || ph.monthly_pet_rent::text
FROM onboarding_projects op
JOIN properties p ON p.id = op.property_id
JOIN property_pricing_history ph ON p.id = ph.property_id AND ph.is_current = true
WHERE ot.project_id = op.id
AND p.property_type = 'Company-Owned'
AND ot.title = 'Monthly Pet Rent'
AND (ot.field_value IS NULL OR ot.field_value = '');

UPDATE onboarding_tasks ot
SET field_value = '$' || ph.monthly_cleaning_fee::text
FROM onboarding_projects op
JOIN properties p ON p.id = op.property_id
JOIN property_pricing_history ph ON p.id = ph.property_id AND ph.is_current = true
WHERE ot.project_id = op.id
AND p.property_type = 'Company-Owned'
AND ot.title = 'Monthly Cleaning Fee'
AND (ot.field_value IS NULL OR ot.field_value = '');

-- Pet & Lease Policies
UPDATE onboarding_tasks ot
SET field_value = CASE WHEN pp.pets_allowed THEN 'Yes' ELSE 'No' END
FROM onboarding_projects op
JOIN properties p ON p.id = op.property_id
JOIN property_policies pp ON p.id = pp.property_id
WHERE ot.project_id = op.id
AND p.property_type = 'Company-Owned'
AND ot.title = 'Pets Allowed'
AND (ot.field_value IS NULL OR ot.field_value = '');

UPDATE onboarding_tasks ot
SET field_value = pp.pet_rules
FROM onboarding_projects op
JOIN properties p ON p.id = op.property_id
JOIN property_policies pp ON p.id = pp.property_id
WHERE ot.project_id = op.id
AND p.property_type = 'Company-Owned'
AND ot.title = 'Pet Rules'
AND (ot.field_value IS NULL OR ot.field_value = '');

UPDATE onboarding_tasks ot
SET field_value = pp.max_pets::text
FROM onboarding_projects op
JOIN properties p ON p.id = op.property_id
JOIN property_policies pp ON p.id = pp.property_id
WHERE ot.project_id = op.id
AND p.property_type = 'Company-Owned'
AND ot.title = 'Maximum Number of Pets'
AND (ot.field_value IS NULL OR ot.field_value = '');

UPDATE onboarding_tasks ot
SET field_value = pp.max_pet_weight::text || ' lbs'
FROM onboarding_projects op
JOIN properties p ON p.id = op.property_id
JOIN property_policies pp ON p.id = pp.property_id
WHERE ot.project_id = op.id
AND p.property_type = 'Company-Owned'
AND ot.title = 'Maximum Pet Weight (lbs)'
AND (ot.field_value IS NULL OR ot.field_value = '');

UPDATE onboarding_tasks ot
SET field_value = pp.lease_term
FROM onboarding_projects op
JOIN properties p ON p.id = op.property_id
JOIN property_policies pp ON p.id = pp.property_id
WHERE ot.project_id = op.id
AND p.property_type = 'Company-Owned'
AND ot.title = 'Lease Term'
AND (ot.field_value IS NULL OR ot.field_value = '');

UPDATE onboarding_tasks ot
SET field_value = pp.notice_to_vacate
FROM onboarding_projects op
JOIN properties p ON p.id = op.property_id
JOIN property_policies pp ON p.id = pp.property_id
WHERE ot.project_id = op.id
AND p.property_type = 'Company-Owned'
AND ot.title = 'Notice to Vacate'
AND (ot.field_value IS NULL OR ot.field_value = '');

-- Schools
UPDATE onboarding_tasks ot
SET field_value = ps.school_district
FROM onboarding_projects op
JOIN properties p ON p.id = op.property_id
JOIN property_schools ps ON p.id = ps.property_id
WHERE ot.project_id = op.id
AND p.property_type = 'Company-Owned'
AND ot.title = 'School District'
AND (ot.field_value IS NULL OR ot.field_value = '');

UPDATE onboarding_tasks ot
SET field_value = ps.elementary_school
FROM onboarding_projects op
JOIN properties p ON p.id = op.property_id
JOIN property_schools ps ON p.id = ps.property_id
WHERE ot.project_id = op.id
AND p.property_type = 'Company-Owned'
AND ot.title = 'Elementary School'
AND (ot.field_value IS NULL OR ot.field_value = '');

UPDATE onboarding_tasks ot
SET field_value = ps.middle_school
FROM onboarding_projects op
JOIN properties p ON p.id = op.property_id
JOIN property_schools ps ON p.id = ps.property_id
WHERE ot.project_id = op.id
AND p.property_type = 'Company-Owned'
AND ot.title = 'Middle School'
AND (ot.field_value IS NULL OR ot.field_value = '');

UPDATE onboarding_tasks ot
SET field_value = ps.high_school
FROM onboarding_projects op
JOIN properties p ON p.id = op.property_id
JOIN property_schools ps ON p.id = ps.property_id
WHERE ot.project_id = op.id
AND p.property_type = 'Company-Owned'
AND ot.title = 'High School'
AND (ot.field_value IS NULL OR ot.field_value = '');

-- Contact Info
UPDATE onboarding_tasks ot
SET field_value = pc.contact_email
FROM onboarding_projects op
JOIN properties p ON p.id = op.property_id
JOIN property_contact_info pc ON p.id = pc.property_id
WHERE ot.project_id = op.id
AND p.property_type = 'Company-Owned'
AND ot.title = 'Contact Email'
AND (ot.field_value IS NULL OR ot.field_value = '');

UPDATE onboarding_tasks ot
SET field_value = pc.contact_phone
FROM onboarding_projects op
JOIN properties p ON p.id = op.property_id
JOIN property_contact_info pc ON p.id = pc.property_id
WHERE ot.project_id = op.id
AND p.property_type = 'Company-Owned'
AND ot.title = 'Contact Phone'
AND (ot.field_value IS NULL OR ot.field_value = '');

UPDATE onboarding_tasks ot
SET field_value = pc.website_url
FROM onboarding_projects op
JOIN properties p ON p.id = op.property_id
JOIN property_contact_info pc ON p.id = pc.property_id
WHERE ot.project_id = op.id
AND p.property_type = 'Company-Owned'
AND ot.title = 'Direct Booking Website'
AND (ot.field_value IS NULL OR ot.field_value = '');