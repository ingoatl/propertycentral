-- Clean up Phase 7: Remove section headers and duplicates

-- Delete all section header tasks (they should be UI elements, not DB tasks)
DELETE FROM onboarding_tasks 
WHERE phase_number = 7 
AND (
  field_type = 'section_header' 
  OR title LIKE '🌐%' 
  OR title LIKE '🏡%' 
  OR title LIKE '💼%' 
  OR title LIKE '🏥%' 
  OR title LIKE '🌍%' 
  OR title LIKE '📱%'
  OR title LIKE '🏢%'
);

-- Delete duplicate/legacy Airbnb tasks (keep only "Airbnb")
DELETE FROM onboarding_tasks 
WHERE phase_number = 7 
AND (
  title = 'Airbnb - 1 year Listing' 
  OR title = 'Airbnb – 1-Year Listing'
);

-- Delete duplicate booking tasks (keep only "Booking.com")
DELETE FROM onboarding_tasks 
WHERE phase_number = 7 
AND title = 'Booking';

-- Delete duplicate corporate housing (keep "UCH" instead of "United Corporate Housing")
DELETE FROM onboarding_tasks 
WHERE phase_number = 7 
AND title = 'United Corporate Housing';

-- Delete "Direct booking website setup" (duplicate of "Direct Booking Page")
DELETE FROM onboarding_tasks 
WHERE phase_number = 7 
AND title = 'Direct booking website setup';

-- Delete "Mobile" (removed per user request)
DELETE FROM onboarding_tasks 
WHERE phase_number = 7 
AND title = 'Mobile';

-- Delete "Upload platform listing screenshots" (not a platform task)
DELETE FROM onboarding_tasks 
WHERE phase_number = 7 
AND title = 'Upload platform listing screenshots';

-- Delete niche platforms that aren't used: Anyplace, Kopa
DELETE FROM onboarding_tasks 
WHERE phase_number = 7 
AND title IN ('Anyplace', 'Kopa');