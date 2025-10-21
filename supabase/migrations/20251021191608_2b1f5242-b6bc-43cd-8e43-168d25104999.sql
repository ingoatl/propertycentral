-- Add Lawncare task to all existing projects in phase 4
INSERT INTO onboarding_tasks (
  project_id,
  phase_number,
  phase_title,
  title,
  description,
  field_type,
  status,
  due_date,
  original_due_date
)
SELECT 
  p.id as project_id,
  4 as phase_number,
  'Cleaners & Maintenance' as phase_title,
  'Lawncare' as title,
  'Provider name and contact' as description,
  'text' as field_type,
  'pending' as status,
  CURRENT_DATE + INTERVAL '3 weeks' as due_date,
  CURRENT_DATE + INTERVAL '3 weeks' as original_due_date
FROM onboarding_projects p
WHERE p.status = 'in-progress'
AND NOT EXISTS (
  SELECT 1 FROM onboarding_tasks t
  WHERE t.project_id = p.id
  AND t.phase_number = 4
  AND t.title = 'Lawncare'
);