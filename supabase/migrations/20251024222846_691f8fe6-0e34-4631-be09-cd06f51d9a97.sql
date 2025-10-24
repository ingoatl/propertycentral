-- Clear all task-level role assignments in Phase 1 and Phase 2
-- so they inherit from the phase-level assignment (Access Manager)
UPDATE onboarding_tasks 
SET assigned_role_id = NULL
WHERE phase_number IN (1, 2)
AND assigned_role_id IS NOT NULL;

-- Also clear any task templates for these phases
UPDATE task_templates
SET default_role_id = NULL
WHERE phase_number IN (1, 2)
AND default_role_id IS NOT NULL;