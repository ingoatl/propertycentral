-- Import CSV data - OVERRIDE existing values to ensure all CSV data is imported

DO $$
DECLARE
  v_project_id UUID;
BEGIN
  
  -- Property 1: 169 Willow Stream Ct (Villa 14)
  SELECT op.id INTO v_project_id
  FROM onboarding_projects op
  JOIN properties p ON op.property_address ILIKE '%169 Willow Stream%'
  WHERE op.status != 'completed'
  LIMIT 1;
  
  IF v_project_id IS NOT NULL THEN
    UPDATE onboarding_tasks SET field_value = 'https://www.airbnb.com/rooms/37773037?source_impression_id=p3_1754931120_P3d__KQbpUEVinXG', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 7 AND title = 'Airbnb';
    
    UPDATE onboarding_tasks SET field_value = 'https://www.vrbo.com/en-au/holiday-rental/p1738420vb', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 7 AND title = 'VRBO';
    
    UPDATE onboarding_tasks SET field_value = 'Townhome', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Property Type Detail';
    
    UPDATE onboarding_tasks SET field_value = '2', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Stories';
    
    UPDATE onboarding_tasks SET field_value = '1,280', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Square Footage';
    
    UPDATE onboarding_tasks SET field_value = '2', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Bedrooms';
    
    UPDATE onboarding_tasks SET field_value = '2.5', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Bathrooms';
    
    UPDATE onboarding_tasks SET field_value = 'parking pad in front of home', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Parking Type';
    
    UPDATE onboarding_tasks SET field_value = '2', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Parking Capacity';
    
    UPDATE onboarding_tasks SET field_value = 'No', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Bedroom on Main';
    
    UPDATE onboarding_tasks SET field_value = 'Yes', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Walk-in Shower';
    
    UPDATE onboarding_tasks SET field_value = 'Yes', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Furnished';
    
    UPDATE onboarding_tasks SET field_value = 'No', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Pool';
    
    UPDATE onboarding_tasks SET field_value = 'Yes', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Fenced Yard';
    
    UPDATE onboarding_tasks SET field_value = '4950', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 11 AND title = 'Monthly Rent';
    
    UPDATE onboarding_tasks SET field_value = '1500', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 11 AND title = 'Security Deposit';
    
    UPDATE onboarding_tasks SET field_value = 'Yes', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 12 AND title = 'Pets Allowed';
    
    UPDATE onboarding_tasks SET field_value = 'Yes (fenced in backyard)', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 12 AND title = 'Pet Rules';
    
    UPDATE onboarding_tasks SET field_value = '1 month', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 12 AND title = 'Lease Term';
    
    UPDATE onboarding_tasks SET field_value = '30 days', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 12 AND title = 'Notice to Vacate';
    
    UPDATE onboarding_tasks SET field_value = 'https://peachhausfurnishedrentals.com/listing/modern-cozy-townhome-minutes-to-avalon-w-king/', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 14 AND title = 'Direct Booking Website';
    
    UPDATE onboarding_tasks SET field_value = 'anja@peachhausgroup.com', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 14 AND title = 'Contact Email';
    
    UPDATE onboarding_tasks SET field_value = '470-863-8087', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 14 AND title = 'Contact Phone';
  END IF;

  -- Property 2: 3155 Duvall Pl (Villa 15)
  SELECT op.id INTO v_project_id
  FROM onboarding_projects op
  JOIN properties p ON op.property_address ILIKE '%3155 Duvall%'
  WHERE op.status != 'completed'
  LIMIT 1;
  
  IF v_project_id IS NOT NULL THEN
    UPDATE onboarding_tasks SET field_value = 'https://www.airbnb.com/rooms/50104697?source_impression_id=p3_1754931120_P3UpGvPCfQCQvARE', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 7 AND title = 'Airbnb';
    
    UPDATE onboarding_tasks SET field_value = 'https://www.vrbo.com/en-au/holiday-rental/p2334877vb', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 7 AND title = 'VRBO';
    
    UPDATE onboarding_tasks SET field_value = 'Townhome/ end unit', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Property Type Detail';
    
    UPDATE onboarding_tasks SET field_value = '2', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Stories';
    
    UPDATE onboarding_tasks SET field_value = '1,600', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Square Footage';
    
    UPDATE onboarding_tasks SET field_value = '2', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Bedrooms';
    
    UPDATE onboarding_tasks SET field_value = '2', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Bathrooms';
    
    UPDATE onboarding_tasks SET field_value = 'parking pad in front of home', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Parking Type';
    
    UPDATE onboarding_tasks SET field_value = '4', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Parking Capacity';
    
    UPDATE onboarding_tasks SET field_value = 'Yes', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Bedroom on Main';
    
    UPDATE onboarding_tasks SET field_value = 'Yes', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Walk-in Shower';
    
    UPDATE onboarding_tasks SET field_value = 'Yes', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Furnished';
    
    UPDATE onboarding_tasks SET field_value = 'No', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Pool';
    
    UPDATE onboarding_tasks SET field_value = 'No', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Fenced Yard';
    
    UPDATE onboarding_tasks SET field_value = '5520', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 11 AND title = 'Monthly Rent';
    
    UPDATE onboarding_tasks SET field_value = '1500', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 11 AND title = 'Security Deposit';
    
    UPDATE onboarding_tasks SET field_value = 'Yes', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 12 AND title = 'Pets Allowed';
    
    UPDATE onboarding_tasks SET field_value = 'Yes (no fenced in backyard)', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 12 AND title = 'Pet Rules';
    
    UPDATE onboarding_tasks SET field_value = '1 month', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 12 AND title = 'Lease Term';
    
    UPDATE onboarding_tasks SET field_value = '30 days', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 12 AND title = 'Notice to Vacate';
    
    UPDATE onboarding_tasks SET field_value = 'https://peachhausfurnishedrentals.com/listing/%e2%9d%a4%ef%b8%8f-scandi-chic-retreat-mins-to-ksu-w-king-2/', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 14 AND title = 'Direct Booking Website';
    
    UPDATE onboarding_tasks SET field_value = 'anja@peachhausgroup.com', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 14 AND title = 'Contact Email';
    
    UPDATE onboarding_tasks SET field_value = '470-863-8087', status = 'completed', completed_date = now()
    WHERE project_id = v_project_id AND phase_number = 14 AND title = 'Contact Phone';
  END IF;

  -- Continue with remaining 6 properties in next migration...
  
END $$;