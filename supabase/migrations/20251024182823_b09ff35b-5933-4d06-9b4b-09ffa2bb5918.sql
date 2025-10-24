-- Remove duplicate onboarding project for Villa 15

-- Delete the older project with fewer tasks (created first, less complete)
DELETE FROM onboarding_tasks WHERE project_id = 'c2235f3c-e40a-4478-90e4-1152c597d2bf';
DELETE FROM onboarding_projects WHERE id = 'c2235f3c-e40a-4478-90e4-1152c597d2bf';

-- The correct project to keep is: 7476e31d-9ceb-4c91-ad1a-4a77f70d90a9 (has 99 tasks, 82% progress)