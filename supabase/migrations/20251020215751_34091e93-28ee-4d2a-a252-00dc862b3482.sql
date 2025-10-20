-- Disable the old "Villa Owner" project by marking it as completed
UPDATE onboarding_projects 
SET status = 'completed' 
WHERE id = 'c2235f3c-e40a-4478-90e4-1152c597d2bf';