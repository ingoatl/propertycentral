-- Fix foreign key constraint to allow task deletion
-- When a task is deleted, set the task_id in bug_reports to NULL instead of blocking the deletion
ALTER TABLE bug_reports 
DROP CONSTRAINT IF EXISTS bug_reports_task_id_fkey;

ALTER TABLE bug_reports
ADD CONSTRAINT bug_reports_task_id_fkey 
FOREIGN KEY (task_id) 
REFERENCES onboarding_tasks(id) 
ON DELETE SET NULL;