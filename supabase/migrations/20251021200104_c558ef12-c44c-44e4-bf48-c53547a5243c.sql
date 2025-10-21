-- Delete individual lawncare tasks and restore single Lawncare checkbox task
DELETE FROM onboarding_tasks 
WHERE phase_number = 4 
  AND title IN ('Lawncare Company Name', 'Lawncare Phone Number', 'Lawncare Schedule', 'Lawncare Negotiated Payment');

-- Insert single Lawncare checkbox task for all projects with phase 4 tasks
INSERT INTO onboarding_tasks (project_id, phase_number, phase_title, title, field_type, status)
SELECT DISTINCT 
  project_id,
  4,
  'Cleaners & Maintenance',
  'Lawncare',
  'checkbox',
  'pending'
FROM onboarding_tasks
WHERE phase_number = 4
  AND NOT EXISTS (
    SELECT 1 FROM onboarding_tasks ot2
    WHERE ot2.project_id = onboarding_tasks.project_id
      AND ot2.phase_number = 4
      AND ot2.title = 'Lawncare'
  );

-- Insert global SOP for Lawncare task
INSERT INTO onboarding_sops (phase_number, task_title, title, description, loom_video_url)
VALUES (
  4,
  'Lawncare',
  'Lawncare Setup Guide',
  'Step 1: Contact the lawncare company and negotiate pricing
  
Step 2: Confirm the schedule (semi-weekly or weekly)

Step 3: Enter all details in the Lawncare task fields

Headline: Important Notes
- Ensure pricing includes all services (mowing, edging, trimming)
- Confirm backup contact if primary provider is unavailable
- Schedule should align with property presentation needs',
  'https://www.loom.com/share/example'
)
ON CONFLICT DO NOTHING;