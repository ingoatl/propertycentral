-- Import school district data from CSV for all properties

DO $$
DECLARE
  v_project_id UUID;
BEGIN
  
  -- 4241 Osburn Ct (Villa 1) - Duluth schools
  SELECT op.id INTO v_project_id FROM onboarding_projects op JOIN properties p ON op.property_address ILIKE '%4241 Osburn%' WHERE op.status != 'completed' LIMIT 1;
  IF v_project_id IS NOT NULL THEN
    UPDATE onboarding_tasks SET field_value = 'Chesney Elementary', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 13 AND title = 'Elementary School';
    UPDATE onboarding_tasks SET field_value = 'Duluth MS', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 13 AND title = 'Middle School';
    UPDATE onboarding_tasks SET field_value = 'Duluth HS', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 13 AND title = 'High School';
    UPDATE onboarding_tasks SET field_value = 'Duluth', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 13 AND title = 'School District';
  END IF;

  -- 5360 Durham Ridge Ct (Villa 3) - Berkmar schools
  SELECT op.id INTO v_project_id FROM onboarding_projects op JOIN properties p ON op.property_address ILIKE '%5360 Durham%' WHERE op.status != 'completed' LIMIT 1;
  IF v_project_id IS NOT NULL THEN
    UPDATE onboarding_tasks SET field_value = 'Hopkins Elementary', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 13 AND title = 'Elementary School';
    UPDATE onboarding_tasks SET field_value = 'Berkmar Middle', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 13 AND title = 'Middle School';
    UPDATE onboarding_tasks SET field_value = 'Berkmar High', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 13 AND title = 'High School';
    UPDATE onboarding_tasks SET field_value = 'Berkmar', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 13 AND title = 'School District';
  END IF;

  -- 5198 Laurel Bridge Dr (Villa 8) - Campbell schools
  SELECT op.id INTO v_project_id FROM onboarding_projects op JOIN properties p ON op.property_address ILIKE '%5198 Laurel%' WHERE op.status != 'completed' LIMIT 1;
  IF v_project_id IS NOT NULL THEN
    UPDATE onboarding_tasks SET field_value = 'Nickajack Elem', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 13 AND title = 'Elementary School';
    UPDATE onboarding_tasks SET field_value = 'Griffin MS', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 13 AND title = 'Middle School';
    UPDATE onboarding_tasks SET field_value = 'Campbell HS', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 13 AND title = 'High School';
    UPDATE onboarding_tasks SET field_value = 'Campbell', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 13 AND title = 'School District';
  END IF;

  -- 2580 Old Roswell Rd (Villa 5) - Campbell schools
  SELECT op.id INTO v_project_id FROM onboarding_projects op JOIN properties p ON op.property_address ILIKE '%2580 Old Roswell%' WHERE op.status != 'completed' LIMIT 1;
  IF v_project_id IS NOT NULL THEN
    UPDATE onboarding_tasks SET field_value = 'Smyrna Elementary', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 13 AND title = 'Elementary School';
    UPDATE onboarding_tasks SET field_value = 'Campbell Middle', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 13 AND title = 'Middle School';
    UPDATE onboarding_tasks SET field_value = 'Campbell HS', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 13 AND title = 'High School';
    UPDATE onboarding_tasks SET field_value = 'Campbell', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 13 AND title = 'School District';
  END IF;

  -- 3069 Rita Way (Villa 4) - Campbell schools
  SELECT op.id INTO v_project_id FROM onboarding_projects op JOIN properties p ON op.property_address ILIKE '%3069 Rita%' WHERE op.status != 'completed' LIMIT 1;
  IF v_project_id IS NOT NULL THEN
    UPDATE onboarding_tasks SET field_value = 'Smyrna Elementary', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 13 AND title = 'Elementary School';
    UPDATE onboarding_tasks SET field_value = 'Campbell Middle', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 13 AND title = 'Middle School';
    UPDATE onboarding_tasks SET field_value = 'Campbell HS', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 13 AND title = 'High School';
    UPDATE onboarding_tasks SET field_value = 'Campbell', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 13 AND title = 'School District';
  END IF;

  -- 3155 Duvall Pl (Villa 15) - North Cobb schools
  SELECT op.id INTO v_project_id FROM onboarding_projects op JOIN properties p ON op.property_address ILIKE '%3155 Duvall%' WHERE op.status != 'completed' LIMIT 1;
  IF v_project_id IS NOT NULL THEN
    UPDATE onboarding_tasks SET field_value = 'Big Shanty Elementary', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 13 AND title = 'Elementary School';
    UPDATE onboarding_tasks SET field_value = 'Palmer Middle School', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 13 AND title = 'Middle School';
    UPDATE onboarding_tasks SET field_value = 'North Cobb HS', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 13 AND title = 'High School';
    UPDATE onboarding_tasks SET field_value = 'North Cobb', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 13 AND title = 'School District';
  END IF;

  -- 169 Willow Stream Ct (Villa 14) - Roswell schools
  SELECT op.id INTO v_project_id FROM onboarding_projects op JOIN properties p ON op.property_address ILIKE '%169 Willow Stream%' WHERE op.status != 'completed' LIMIT 1;
  IF v_project_id IS NOT NULL THEN
    UPDATE onboarding_tasks SET field_value = 'Mimosa Elementary', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 13 AND title = 'Elementary School';
    UPDATE onboarding_tasks SET field_value = 'Elkins Pointe Middle', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 13 AND title = 'Middle School';
    UPDATE onboarding_tasks SET field_value = 'Roswell HS', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 13 AND title = 'High School';
    UPDATE onboarding_tasks SET field_value = 'Roswell', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 13 AND title = 'School District';
  END IF;

  -- 184 Woodland Ln (Villa 10) - South Cobb schools
  SELECT op.id INTO v_project_id FROM onboarding_projects op JOIN properties p ON op.property_address ILIKE '%184 Woodland%' WHERE op.status != 'completed' LIMIT 1;
  IF v_project_id IS NOT NULL THEN
    UPDATE onboarding_tasks SET field_value = 'Clay-Harmony Leland Elementary School', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 13 AND title = 'Elementary School';
    UPDATE onboarding_tasks SET field_value = 'Lindley MS', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 13 AND title = 'Middle School';
    UPDATE onboarding_tasks SET field_value = 'South Cobb HS', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 13 AND title = 'High School';
    UPDATE onboarding_tasks SET field_value = 'South Cobb', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 13 AND title = 'School District';
  END IF;

END $$;