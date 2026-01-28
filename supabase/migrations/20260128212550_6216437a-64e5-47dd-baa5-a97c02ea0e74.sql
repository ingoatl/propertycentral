-- Add assignment_comment column to user_tasks for delegation notes
ALTER TABLE public.user_tasks ADD COLUMN IF NOT EXISTS assignment_comment text;

-- Add property_address column for caching (to show in task list without extra joins)
ALTER TABLE public.user_tasks ADD COLUMN IF NOT EXISTS property_address text;

-- Add owner_name column for caching
ALTER TABLE public.user_tasks ADD COLUMN IF NOT EXISTS owner_name text;