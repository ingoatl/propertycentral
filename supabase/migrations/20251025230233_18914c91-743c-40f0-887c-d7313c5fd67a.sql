-- Delete "Final review completed" task from all existing projects
DELETE FROM public.onboarding_tasks
WHERE title = 'Final review completed' AND phase_number = 6;

-- Delete "Final review completed" from task_templates
DELETE FROM public.task_templates
WHERE task_title = 'Final review completed' AND phase_number = 6;

-- Delete the photo upload link tasks we just added
DELETE FROM public.onboarding_tasks
WHERE phase_number = 6 AND title IN (
  'Photo 1: Exterior Arrival Shot',
  'Photo 2: Main Living Area (Hero Room)',
  'Photo 3: Signature / Selling Feature',
  'Photo 4: Primary Bedroom (Master)',
  'Photo 5: Kitchen (Wide Angle)'
);

-- Delete from task_templates
DELETE FROM public.task_templates
WHERE phase_number = 6 AND task_title IN (
  'Photo 1: Exterior Arrival Shot',
  'Photo 2: Main Living Area (Hero Room)',
  'Photo 3: Signature / Selling Feature',
  'Photo 4: Primary Bedroom (Master)',
  'Photo 5: Kitchen (Wide Angle)'
);