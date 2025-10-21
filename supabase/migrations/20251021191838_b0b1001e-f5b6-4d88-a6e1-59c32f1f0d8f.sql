-- Make SOPs global by making project_id nullable
ALTER TABLE onboarding_sops 
ALTER COLUMN project_id DROP NOT NULL;

-- Add a unique constraint to prevent duplicate SOPs for the same phase/task
-- (either phase-level or task-level, but not both)
CREATE UNIQUE INDEX unique_phase_sop 
ON onboarding_sops (phase_number) 
WHERE task_id IS NULL AND phase_number IS NOT NULL;

CREATE UNIQUE INDEX unique_task_sop 
ON onboarding_sops (task_id) 
WHERE task_id IS NOT NULL;