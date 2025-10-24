-- Step 1: Delete all existing Kopa and Anyplace tasks
DELETE FROM onboarding_tasks 
WHERE title IN ('Kopa', 'Anyplace');

-- Step 2: Update ADA Compliant field type to radio for all existing tasks
UPDATE onboarding_tasks 
SET field_type = 'radio'
WHERE title = 'ADA Compliant';

-- Step 3: Set ADA Compliant to 'Yes' for Woodland Lane property
UPDATE onboarding_tasks 
SET field_value = 'Yes'
WHERE title = 'ADA Compliant' 
AND project_id = 'fec8f75a-3df8-433c-99ad-27db366a755d';