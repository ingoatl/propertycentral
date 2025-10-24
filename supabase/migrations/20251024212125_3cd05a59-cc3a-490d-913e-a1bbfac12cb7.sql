-- Delete duplicate Direct Booking Website tasks from phase 14
-- These are duplicates since the same data exists in phase 7
DELETE FROM onboarding_tasks 
WHERE title = 'Direct Booking Website' 
AND phase_number = 14;