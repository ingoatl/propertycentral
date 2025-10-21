-- Drop the old check constraint that's blocking global SOPs
ALTER TABLE onboarding_sops 
DROP CONSTRAINT IF EXISTS sop_scope_check;

-- Add a new check constraint that allows global SOPs (project_id can be null)
-- An SOP must have EITHER a phase_number OR a task_title (or both for task-level SOPs)
ALTER TABLE onboarding_sops
ADD CONSTRAINT sop_scope_check CHECK (
  phase_number IS NOT NULL OR task_title IS NOT NULL
);