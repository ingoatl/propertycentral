-- Update the "Upload professional photos" task for all existing projects to include the 5 photo upload requirements
UPDATE public.onboarding_tasks
SET 
  description = 'Upload these 5 photos in exact order:
1. Exterior Arrival Shot
2. Main Living Area (Hero Room)
3. Signature/Selling Feature (game room, view, pool, deck, kitchen island, fireplace, or Dining+Living combined)
4. Primary Bedroom (Master)
5. Kitchen (Wide Angle)',
  field_type = 'textarea'
WHERE title = 'Upload professional photos' AND phase_number = 6;

-- Update the task template as well
UPDATE public.task_templates
SET field_type = 'textarea'
WHERE task_title = 'Upload professional photos' AND phase_number = 6;

-- Also update task template description if it exists
INSERT INTO public.task_templates (task_title, phase_number, field_type)
VALUES ('Upload professional photos', 6, 'textarea')
ON CONFLICT DO NOTHING;