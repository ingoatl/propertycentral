-- Add task_id to frequently_asked_questions table
ALTER TABLE frequently_asked_questions
ADD COLUMN task_id uuid REFERENCES onboarding_tasks(id) ON DELETE SET NULL;

-- Add task_id to faq_questions table
ALTER TABLE faq_questions
ADD COLUMN task_id uuid REFERENCES onboarding_tasks(id) ON DELETE SET NULL;