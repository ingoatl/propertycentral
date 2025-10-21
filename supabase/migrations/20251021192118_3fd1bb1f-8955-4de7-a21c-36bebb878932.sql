-- Add task_title column to make SOPs match by title instead of ID
ALTER TABLE onboarding_sops 
ADD COLUMN task_title TEXT;

-- Drop the old unique constraint for task SOPs
DROP INDEX IF EXISTS unique_task_sop;

-- Create new unique constraint based on task title
CREATE UNIQUE INDEX unique_task_title_sop 
ON onboarding_sops (task_title) 
WHERE task_title IS NOT NULL AND phase_number IS NOT NULL;

-- Update existing task SOPs to use task title instead of task_id
-- (Get the title from the first matching task)
UPDATE onboarding_sops
SET task_title = (
  SELECT title 
  FROM onboarding_tasks 
  WHERE onboarding_tasks.id = onboarding_sops.task_id
  LIMIT 1
)
WHERE task_id IS NOT NULL;