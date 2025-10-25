-- Delete all tasks from phase 14 for all properties
DELETE FROM public.onboarding_tasks
WHERE phase_number = 14;

-- Delete any phase_role_assignments for phase 14
DELETE FROM public.phase_role_assignments
WHERE phase_number = 14;

-- Delete any task_templates for phase 14
DELETE FROM public.task_templates
WHERE phase_number = 14;