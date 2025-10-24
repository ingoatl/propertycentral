-- Import CSV data into onboarding tasks for matching properties
-- This maps the CSV fields to existing onboarding task fields

DO $$
DECLARE
  v_project_id UUID;
  v_task_id UUID;
BEGIN
  
  -- Property 1: 169 Willow Stream Ct (Villa 14)
  SELECT op.id INTO v_project_id
  FROM onboarding_projects op
  JOIN properties p ON op.property_address ILIKE '%169 Willow Stream%'
  WHERE op.status != 'completed'
  LIMIT 1;
  
  IF v_project_id IS NOT NULL THEN
    -- Phase 7: Airbnb Link
    UPDATE onboarding_tasks SET field_value = 'https://www.airbnb.com/rooms/37773037?source_impression_id=p3_1754931120_P3d__KQbpUEVinXG', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 7 AND title = 'Airbnb' AND (field_value IS NULL OR field_value = '');
    
    -- Phase 7: VRBO Link
    UPDATE onboarding_tasks SET field_value = 'https://www.vrbo.com/en-au/holiday-rental/p1738420vb', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 7 AND title = 'VRBO' AND (field_value IS NULL OR field_value = '');
    
    -- Phase 10: Property Type Detail
    UPDATE onboarding_tasks SET field_value = 'Townhome', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Property Type Detail' AND (field_value IS NULL OR field_value = '');
    
    -- Phase 10: Stories
    UPDATE onboarding_tasks SET field_value = '2', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Stories' AND (field_value IS NULL OR field_value = '');
    
    -- Phase 10: Square Footage
    UPDATE onboarding_tasks SET field_value = '1,280', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Square Footage' AND (field_value IS NULL OR field_value = '');
    
    -- Phase 10: Bedrooms
    UPDATE onboarding_tasks SET field_value = '2', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Bedrooms' AND (field_value IS NULL OR field_value = '');
    
    -- Phase 10: Bathrooms
    UPDATE onboarding_tasks SET field_value = '2.5', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Bathrooms' AND (field_value IS NULL OR field_value = '');
    
    -- Phase 10: Parking Type
    UPDATE onboarding_tasks SET field_value = 'parking pad in front of home', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Parking Type' AND (field_value IS NULL OR field_value = '');
    
    -- Phase 10: Parking Capacity
    UPDATE onboarding_tasks SET field_value = '2', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Parking Capacity' AND (field_value IS NULL OR field_value = '');
    
    -- Phase 10: Bedroom on Main
    UPDATE onboarding_tasks SET field_value = 'No', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Bedroom on Main' AND (field_value IS NULL OR field_value = '');
    
    -- Phase 10: Walk-in Shower
    UPDATE onboarding_tasks SET field_value = 'Yes', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Walk-in Shower' AND (field_value IS NULL OR field_value = '');
    
    -- Phase 10: Furnished
    UPDATE onboarding_tasks SET field_value = 'Yes', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Furnished' AND (field_value IS NULL OR field_value = '');
    
    -- Phase 10: Pool
    UPDATE onboarding_tasks SET field_value = 'No', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Pool' AND (field_value IS NULL OR field_value = '');
    
    -- Phase 10: Fenced Yard
    UPDATE onboarding_tasks SET field_value = 'Yes', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Fenced Yard' AND (field_value IS NULL OR field_value = '');
    
    -- Phase 11: Monthly Rent
    UPDATE onboarding_tasks SET field_value = '4950', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 11 AND title = 'Monthly Rent' AND (field_value IS NULL OR field_value = '');
    
    -- Phase 11: Security Deposit
    UPDATE onboarding_tasks SET field_value = '1500', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 11 AND title = 'Security Deposit' AND (field_value IS NULL OR field_value = '');
    
    -- Phase 12: Pets Allowed
    UPDATE onboarding_tasks SET field_value = 'Yes', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 12 AND title = 'Pets Allowed' AND (field_value IS NULL OR field_value = '');
    
    -- Phase 12: Pet Rules
    UPDATE onboarding_tasks SET field_value = 'Yes (fenced in backyard)', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 12 AND title = 'Pet Rules' AND (field_value IS NULL OR field_value = '');
    
    -- Phase 12: Lease Term
    UPDATE onboarding_tasks SET field_value = '1 month', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 12 AND title = 'Lease Term' AND (field_value IS NULL OR field_value = '');
    
    -- Phase 12: Notice to Vacate
    UPDATE onboarding_tasks SET field_value = '30 days', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 12 AND title = 'Notice to Vacate' AND (field_value IS NULL OR field_value = '');
    
    -- Phase 14: Direct Booking Website
    UPDATE onboarding_tasks SET field_value = 'https://peachhausfurnishedrentals.com/listing/modern-cozy-townhome-minutes-to-avalon-w-king/', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 14 AND title = 'Direct Booking Website' AND (field_value IS NULL OR field_value = '');
    
    -- Phase 14: Contact Email
    UPDATE onboarding_tasks SET field_value = 'anja@peachhausgroup.com', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 14 AND title = 'Contact Email' AND (field_value IS NULL OR field_value = '');
    
    -- Phase 14: Contact Phone
    UPDATE onboarding_tasks SET field_value = '470-863-8087', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 14 AND title = 'Contact Phone' AND (field_value IS NULL OR field_value = '');
  END IF;

  -- Property 2: 3155 Duvall Pl (Villa 15)
  SELECT op.id INTO v_project_id
  FROM onboarding_projects op
  JOIN properties p ON op.property_address ILIKE '%3155 Duvall%'
  WHERE op.status != 'completed'
  LIMIT 1;
  
  IF v_project_id IS NOT NULL THEN
    UPDATE onboarding_tasks SET field_value = 'https://www.airbnb.com/rooms/50104697?source_impression_id=p3_1754931120_P3UpGvPCfQCQvARE', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 7 AND title = 'Airbnb' AND (field_value IS NULL OR field_value = '');
    
    UPDATE onboarding_tasks SET field_value = 'https://www.vrbo.com/en-au/holiday-rental/p2334877vb', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 7 AND title = 'VRBO' AND (field_value IS NULL OR field_value = '');
    
    UPDATE onboarding_tasks SET field_value = 'Townhome/ end unit', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Property Type Detail' AND (field_value IS NULL OR field_value = '');
    
    UPDATE onboarding_tasks SET field_value = '2', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Stories' AND (field_value IS NULL OR field_value = '');
    
    UPDATE onboarding_tasks SET field_value = '1,600', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Square Footage' AND (field_value IS NULL OR field_value = '');
    
    UPDATE onboarding_tasks SET field_value = '2', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Bedrooms' AND (field_value IS NULL OR field_value = '');
    
    UPDATE onboarding_tasks SET field_value = '2', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Bathrooms' AND (field_value IS NULL OR field_value = '');
    
    UPDATE onboarding_tasks SET field_value = 'parking pad in front of home', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Parking Type' AND (field_value IS NULL OR field_value = '');
    
    UPDATE onboarding_tasks SET field_value = '4', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Parking Capacity' AND (field_value IS NULL OR field_value = '');
    
    UPDATE onboarding_tasks SET field_value = 'Yes', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Bedroom on Main' AND (field_value IS NULL OR field_value = '');
    
    UPDATE onboarding_tasks SET field_value = 'Yes', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Walk-in Shower' AND (field_value IS NULL OR field_value = '');
    
    UPDATE onboarding_tasks SET field_value = 'Yes', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Furnished' AND (field_value IS NULL OR field_value = '');
    
    UPDATE onboarding_tasks SET field_value = 'No', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Pool' AND (field_value IS NULL OR field_value = '');
    
    UPDATE onboarding_tasks SET field_value = 'No', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Fenced Yard' AND (field_value IS NULL OR field_value = '');
    
    UPDATE onboarding_tasks SET field_value = '5520', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 11 AND title = 'Monthly Rent' AND (field_value IS NULL OR field_value = '');
    
    UPDATE onboarding_tasks SET field_value = '1500', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 11 AND title = 'Security Deposit' AND (field_value IS NULL OR field_value = '');
    
    UPDATE onboarding_tasks SET field_value = 'Yes', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 12 AND title = 'Pets Allowed' AND (field_value IS NULL OR field_value = '');
    
    UPDATE onboarding_tasks SET field_value = 'Yes (no fenced in backyard)', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 12 AND title = 'Pet Rules' AND (field_value IS NULL OR field_value = '');
    
    UPDATE onboarding_tasks SET field_value = '1 month', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 12 AND title = 'Lease Term' AND (field_value IS NULL OR field_value = '');
    
    UPDATE onboarding_tasks SET field_value = '30 days', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 12 AND title = 'Notice to Vacate' AND (field_value IS NULL OR field_value = '');
    
    UPDATE onboarding_tasks SET field_value = 'https://peachhausfurnishedrentals.com/listing/%e2%9d%a4%ef%b8%8f-scandi-chic-retreat-mins-to-ksu-w-king-2/', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 14 AND title = 'Direct Booking Website' AND (field_value IS NULL OR field_value = '');
    
    UPDATE onboarding_tasks SET field_value = 'anja@peachhausgroup.com', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 14 AND title = 'Contact Email' AND (field_value IS NULL OR field_value = '');
    
    UPDATE onboarding_tasks SET field_value = '470-863-8087', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 14 AND title = 'Contact Phone' AND (field_value IS NULL OR field_value = '');
  END IF;

  -- Property 3: 4241 Osburn Ct (Villa 1)
  SELECT op.id INTO v_project_id
  FROM onboarding_projects op
  JOIN properties p ON op.property_address ILIKE '%4241 Osburn%'
  WHERE op.status != 'completed'
  LIMIT 1;
  
  IF v_project_id IS NOT NULL THEN
    UPDATE onboarding_tasks SET field_value = 'https://www.airbnb.com/rooms/894861867040611368?source_impression_id=p3_1754931120_P3i1zplZJvRc1Oos', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 7 AND title = 'Airbnb' AND (field_value IS NULL OR field_value = '');
    
    UPDATE onboarding_tasks SET field_value = 'https://www.vrbo.com/3432335', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 7 AND title = 'VRBO' AND (field_value IS NULL OR field_value = '');
    
    UPDATE onboarding_tasks SET field_value = 'SFH', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Property Type Detail' AND (field_value IS NULL OR field_value = '');
    
    UPDATE onboarding_tasks SET field_value = '2', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Stories' AND (field_value IS NULL OR field_value = '');
    
    UPDATE onboarding_tasks SET field_value = '2,000', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Square Footage' AND (field_value IS NULL OR field_value = '');
    
    UPDATE onboarding_tasks SET field_value = '3', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Bedrooms' AND (field_value IS NULL OR field_value = '');
    
    UPDATE onboarding_tasks SET field_value = '3', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Bathrooms' AND (field_value IS NULL OR field_value = '');
    
    UPDATE onboarding_tasks SET field_value = '1 car Garage, driveway/parking pad', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Parking Type' AND (field_value IS NULL OR field_value = '');
    
    UPDATE onboarding_tasks SET field_value = '4', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Parking Capacity' AND (field_value IS NULL OR field_value = '');
    
    UPDATE onboarding_tasks SET field_value = 'Yes', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Bedroom on Main' AND (field_value IS NULL OR field_value = '');
    
    UPDATE onboarding_tasks SET field_value = 'Yes', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Walk-in Shower' AND (field_value IS NULL OR field_value = '');
    
    UPDATE onboarding_tasks SET field_value = 'Yes', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Furnished' AND (field_value IS NULL OR field_value = '');
    
    UPDATE onboarding_tasks SET field_value = 'inflatable hot tub', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Pool' AND (field_value IS NULL OR field_value = '');
    
    UPDATE onboarding_tasks SET field_value = 'Yes', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Fenced Yard' AND (field_value IS NULL OR field_value = '');
    
    UPDATE onboarding_tasks SET field_value = '7050', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 11 AND title = 'Monthly Rent' AND (field_value IS NULL OR field_value = '');
    
    UPDATE onboarding_tasks SET field_value = '1500', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 11 AND title = 'Security Deposit' AND (field_value IS NULL OR field_value = '');
    
    UPDATE onboarding_tasks SET field_value = 'Yes', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 12 AND title = 'Pets Allowed' AND (field_value IS NULL OR field_value = '');
    
    UPDATE onboarding_tasks SET field_value = 'Yes (fenced in backyard)', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 12 AND title = 'Pet Rules' AND (field_value IS NULL OR field_value = '');
    
    UPDATE onboarding_tasks SET field_value = '2 month', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 12 AND title = 'Lease Term' AND (field_value IS NULL OR field_value = '');
    
    UPDATE onboarding_tasks SET field_value = '30 days', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 12 AND title = 'Notice to Vacate' AND (field_value IS NULL OR field_value = '');
    
    UPDATE onboarding_tasks SET field_value = 'https://peachhausfurnishedrentals.com/listing/welcome-to-the-alpine-luxury-cabin-in-the-city-2/', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 14 AND title = 'Direct Booking Website' AND (field_value IS NULL OR field_value = '');
    
    UPDATE onboarding_tasks SET field_value = 'anja@peachhausgroup.com', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 14 AND title = 'Contact Email' AND (field_value IS NULL OR field_value = '');
    
    UPDATE onboarding_tasks SET field_value = '470-863-8087', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 14 AND title = 'Contact Phone' AND (field_value IS NULL OR field_value = '');
  END IF;

  -- Continue with remaining properties in next part...
  
END $$;