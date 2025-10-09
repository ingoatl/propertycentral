
-- Delete all screenshot upload tasks from phase 7
DELETE FROM onboarding_tasks
WHERE phase_number = 7
  AND title LIKE '%Upload%Screenshot%';
