-- Delete the separate lawncare tasks created by previous migration
DELETE FROM onboarding_tasks 
WHERE title IN (
  'Lawncare Company Name',
  'Lawncare Phone Number', 
  'Lawncare Schedule',
  'Lawncare Negotiated Payment'
);

-- Add the original "Lawncare" checkbox task to all existing projects
-- Get all projects that have tasks in phase 4 (Cleaners & Maintenance)
INSERT INTO onboarding_tasks (
  project_id,
  phase_number,
  phase_title,
  title,
  field_type,
  status,
  due_date,
  original_due_date,
  max_reschedule_weeks
)
SELECT DISTINCT 
  project_id,
  4 as phase_number,
  'Cleaners & Maintenance' as phase_title,
  'Lawncare' as title,
  'checkbox' as field_type,
  'pending' as status,
  due_date,
  original_due_date,
  4 as max_reschedule_weeks
FROM onboarding_tasks
WHERE phase_number = 4
  AND project_id NOT IN (
    SELECT project_id 
    FROM onboarding_tasks 
    WHERE title = 'Lawncare' AND phase_number = 4
  )
GROUP BY project_id, due_date, original_due_date
LIMIT 1;