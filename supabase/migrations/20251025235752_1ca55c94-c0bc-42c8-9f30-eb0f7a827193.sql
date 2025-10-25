-- Update the "Upload professional photos" task to use file field type
UPDATE public.onboarding_tasks
SET 
  description = 'Upload these 5 photos in exact order:
1. Exterior Arrival Shot
2. Main Living Area (Hero Room)
3. Signature/Selling Feature (game room, view, pool, deck, kitchen island, fireplace, or Dining+Living combined)
4. Primary Bedroom (Master)
5. Kitchen (Wide Angle)',
  field_type = 'file'
WHERE title = 'Upload professional photos' AND phase_number = 6;

-- Update the task template as well
UPDATE public.task_templates
SET field_type = 'file'
WHERE task_title = 'Upload professional photos' AND phase_number = 6;