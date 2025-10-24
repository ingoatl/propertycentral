
-- Drop the old check constraint that limits phase numbers to 1-9
ALTER TABLE phase_role_assignments
DROP CONSTRAINT phase_role_assignments_phase_number_check;

-- Add new check constraint that allows phases 1-14
ALTER TABLE phase_role_assignments
ADD CONSTRAINT phase_role_assignments_phase_number_check 
CHECK (phase_number >= 1 AND phase_number <= 14);
