-- Archive deprecated utility account number and booking window tasks
UPDATE onboarding_tasks 
SET status = 'archived',
    updated_at = NOW(),
    notes = COALESCE(notes, '') || ' | Deprecated: Field removed from onboarding form'
WHERE title IN (
  'Electric Account Number',
  'Gas Account Number', 
  'Water Account Number',
  'Internet Account Number',
  'Trash Account Number',
  'Average Booking Window'
)
AND status IN ('pending', 'in_progress');