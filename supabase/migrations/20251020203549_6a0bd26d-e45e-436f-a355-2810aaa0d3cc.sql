-- Add completed_by column to track who marked tasks as complete
ALTER TABLE onboarding_tasks
ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES auth.users(id);