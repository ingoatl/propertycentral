-- Clear task-level role assignment for "Signed Management Agreement Link" 
-- so it inherits from phase assignment (Access Manager)
UPDATE onboarding_tasks 
SET assigned_role_id = NULL
WHERE title = 'Signed Management Agreement Link' 
AND phase_number = 1;

-- Also update task template if it exists
UPDATE task_templates
SET default_role_id = NULL
WHERE task_title = 'Signed Management Agreement Link'
AND phase_number = 1;