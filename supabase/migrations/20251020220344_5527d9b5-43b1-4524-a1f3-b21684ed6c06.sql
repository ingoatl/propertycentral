-- Update due dates for existing tasks based on phase number
-- Phase 1 & 2: 1 week out
UPDATE onboarding_tasks 
SET 
  due_date = (CURRENT_DATE + INTERVAL '1 week')::date,
  original_due_date = (CURRENT_DATE + INTERVAL '1 week')::date
WHERE phase_number IN (1, 2)
  AND status != 'completed';

-- Phase 3 & 4: 3 weeks out
UPDATE onboarding_tasks 
SET 
  due_date = (CURRENT_DATE + INTERVAL '3 weeks')::date,
  original_due_date = (CURRENT_DATE + INTERVAL '3 weeks')::date
WHERE phase_number IN (3, 4)
  AND status != 'completed';

-- Phase 5-9: 2 weeks out
UPDATE onboarding_tasks 
SET 
  due_date = (CURRENT_DATE + INTERVAL '2 weeks')::date,
  original_due_date = (CURRENT_DATE + INTERVAL '2 weeks')::date
WHERE phase_number IN (5, 6, 7, 8, 9)
  AND status != 'completed';