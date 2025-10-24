-- Add new property feature tasks to existing Phase 10 in all onboarding projects
-- This adds: Bedroom on Main, Walk-in Shower, Furnished, Pool

DO $$
DECLARE
  project_record RECORD;
BEGIN
  -- Loop through all onboarding projects
  FOR project_record IN 
    SELECT id FROM onboarding_projects
  LOOP
    -- Add the 4 new tasks to Phase 10 for each project
    
    -- Bedroom on Main
    INSERT INTO onboarding_tasks (
      project_id,
      phase_number,
      phase_title,
      title,
      field_type,
      status,
      created_at,
      updated_at
    ) VALUES (
      project_record.id,
      10,
      'Property Specifications',
      'Bedroom on Main',
      'radio',
      'pending',
      now(),
      now()
    );
    
    -- Walk-in Shower
    INSERT INTO onboarding_tasks (
      project_id,
      phase_number,
      phase_title,
      title,
      field_type,
      status,
      created_at,
      updated_at
    ) VALUES (
      project_record.id,
      10,
      'Property Specifications',
      'Walk-in Shower',
      'radio',
      'pending',
      now(),
      now()
    );
    
    -- Furnished
    INSERT INTO onboarding_tasks (
      project_id,
      phase_number,
      phase_title,
      title,
      field_type,
      status,
      created_at,
      updated_at
    ) VALUES (
      project_record.id,
      10,
      'Property Specifications',
      'Furnished',
      'radio',
      'pending',
      now(),
      now()
    );
    
    -- Pool
    INSERT INTO onboarding_tasks (
      project_id,
      phase_number,
      phase_title,
      title,
      field_type,
      status,
      created_at,
      updated_at
    ) VALUES (
      project_record.id,
      10,
      'Property Specifications',
      'Pool',
      'text',
      'pending',
      now(),
      now()
    );
    
  END LOOP;
END $$;