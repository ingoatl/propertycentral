-- Import CSV data for remaining 6 properties (Part 2 of 2)

DO $$
DECLARE
  v_project_id UUID;
BEGIN
  
  -- Property 3: 4241 Osburn Ct (Villa 1)
  SELECT op.id INTO v_project_id FROM onboarding_projects op JOIN properties p ON op.property_address ILIKE '%4241 Osburn%' WHERE op.status != 'completed' LIMIT 1;
  IF v_project_id IS NOT NULL THEN
    UPDATE onboarding_tasks SET field_value = 'https://www.airbnb.com/rooms/894861867040611368?source_impression_id=p3_1754931120_P3i1zplZJvRc1Oos', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 7 AND title = 'Airbnb';
    UPDATE onboarding_tasks SET field_value = 'https://www.vrbo.com/3432335', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 7 AND title = 'VRBO';
    UPDATE onboarding_tasks SET field_value = 'SFH', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Property Type Detail';
    UPDATE onboarding_tasks SET field_value = '2', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Stories';
    UPDATE onboarding_tasks SET field_value = '2,000', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Square Footage';
    UPDATE onboarding_tasks SET field_value = '3', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Bedrooms';
    UPDATE onboarding_tasks SET field_value = '3', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Bathrooms';
    UPDATE onboarding_tasks SET field_value = '1 car Garage, driveway/parking pad', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Parking Type';
    UPDATE onboarding_tasks SET field_value = '4', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Parking Capacity';
    UPDATE onboarding_tasks SET field_value = 'Yes', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Bedroom on Main';
    UPDATE onboarding_tasks SET field_value = 'Yes', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Walk-in Shower';
    UPDATE onboarding_tasks SET field_value = 'Yes', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Furnished';
    UPDATE onboarding_tasks SET field_value = 'inflatable hot tub', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Pool';
    UPDATE onboarding_tasks SET field_value = 'Yes', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Fenced Yard';
    UPDATE onboarding_tasks SET field_value = '7050', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 11 AND title = 'Monthly Rent';
    UPDATE onboarding_tasks SET field_value = '1500', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 11 AND title = 'Security Deposit';
    UPDATE onboarding_tasks SET field_value = 'Yes', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 12 AND title = 'Pets Allowed';
    UPDATE onboarding_tasks SET field_value = 'Yes (fenced in backyard)', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 12 AND title = 'Pet Rules';
    UPDATE onboarding_tasks SET field_value = '2 month', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 12 AND title = 'Lease Term';
    UPDATE onboarding_tasks SET field_value = '30 days', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 12 AND title = 'Notice to Vacate';
    UPDATE onboarding_tasks SET field_value = 'https://peachhausfurnishedrentals.com/listing/welcome-to-the-alpine-luxury-cabin-in-the-city-2/', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 14 AND title = 'Direct Booking Website';
    UPDATE onboarding_tasks SET field_value = 'anja@peachhausgroup.com', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 14 AND title = 'Contact Email';
    UPDATE onboarding_tasks SET field_value = '470-863-8087', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 14 AND title = 'Contact Phone';
  END IF;

  -- Property 4: 5360 Durham Ridge
  SELECT op.id INTO v_project_id FROM onboarding_projects op JOIN properties p ON op.property_address ILIKE '%5360 Durham%' WHERE op.status != 'completed' LIMIT 1;
  IF v_project_id IS NOT NULL THEN
    UPDATE onboarding_tasks SET field_value = 'https://www.airbnb.com/rooms/707411807049153074', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 7 AND title = 'Airbnb';
    UPDATE onboarding_tasks SET field_value = 'https://www.vrbo.com/3004492', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 7 AND title = 'VRBO';
    UPDATE onboarding_tasks SET field_value = 'SFH', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Property Type Detail';
    UPDATE onboarding_tasks SET field_value = '2', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Stories';
    UPDATE onboarding_tasks SET field_value = '2,170', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Square Footage';
    UPDATE onboarding_tasks SET field_value = '3', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Bedrooms';
    UPDATE onboarding_tasks SET field_value = '2.5', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Bathrooms';
    UPDATE onboarding_tasks SET field_value = 'driveway, street parking', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Parking Type';
    UPDATE onboarding_tasks SET field_value = '2', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Parking Capacity';
    UPDATE onboarding_tasks SET field_value = 'No', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Bedroom on Main';
    UPDATE onboarding_tasks SET field_value = 'Yes', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Walk-in Shower';
    UPDATE onboarding_tasks SET field_value = 'Yes', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Furnished';
    UPDATE onboarding_tasks SET field_value = 'No', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Pool';
    UPDATE onboarding_tasks SET field_value = 'Partially', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Fenced Yard';
    UPDATE onboarding_tasks SET field_value = '6420', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 11 AND title = 'Monthly Rent';
    UPDATE onboarding_tasks SET field_value = '1500', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 11 AND title = 'Security Deposit';
    UPDATE onboarding_tasks SET field_value = 'Yes', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 12 AND title = 'Pets Allowed';
    UPDATE onboarding_tasks SET field_value = 'Yes (partially fenced)', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 12 AND title = 'Pet Rules';
    UPDATE onboarding_tasks SET field_value = '1 month', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 12 AND title = 'Lease Term';
    UPDATE onboarding_tasks SET field_value = '30 days', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 12 AND title = 'Notice to Vacate';
    UPDATE onboarding_tasks SET field_value = 'https://peachhausfurnishedrentals.com/listing/new-family-retreat-w-fire-pit-patio-game-room-2/', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 14 AND title = 'Direct Booking Website';
    UPDATE onboarding_tasks SET field_value = 'anja@peachhausgroup.com', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 14 AND title = 'Contact Email';
    UPDATE onboarding_tasks SET field_value = '470-863-8087', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 14 AND title = 'Contact Phone';
  END IF;

  -- Property 5: 3069 Rita Way
  SELECT op.id INTO v_project_id FROM onboarding_projects op JOIN properties p ON op.property_address ILIKE '%3069 Rita%' WHERE op.status != 'completed' LIMIT 1;
  IF v_project_id IS NOT NULL THEN
    UPDATE onboarding_tasks SET field_value = 'https://www.airbnb.com/rooms/39178226', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 7 AND title = 'Airbnb';
    UPDATE onboarding_tasks SET field_value = 'https://www.vrbo.com/2708824', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 7 AND title = 'VRBO';
    UPDATE onboarding_tasks SET field_value = 'SFH', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Property Type Detail';
    UPDATE onboarding_tasks SET field_value = '1', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Stories';
    UPDATE onboarding_tasks SET field_value = '1,050', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Square Footage';
    UPDATE onboarding_tasks SET field_value = '3', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Bedrooms';
    UPDATE onboarding_tasks SET field_value = '2', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Bathrooms';
    UPDATE onboarding_tasks SET field_value = '1 carport, driveway, street', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Parking Type';
    UPDATE onboarding_tasks SET field_value = '1', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Parking Capacity';
    UPDATE onboarding_tasks SET field_value = 'Yes', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Bedroom on Main';
    UPDATE onboarding_tasks SET field_value = 'Yes', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Walk-in Shower';
    UPDATE onboarding_tasks SET field_value = 'Yes', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Furnished';
    UPDATE onboarding_tasks SET field_value = 'No', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Pool';
    UPDATE onboarding_tasks SET field_value = 'Yes', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Fenced Yard';
    UPDATE onboarding_tasks SET field_value = '6270', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 11 AND title = 'Monthly Rent';
    UPDATE onboarding_tasks SET field_value = '1500', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 11 AND title = 'Security Deposit';
    UPDATE onboarding_tasks SET field_value = 'Yes', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 12 AND title = 'Pets Allowed';
    UPDATE onboarding_tasks SET field_value = 'Yes (fenced in backyard)', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 12 AND title = 'Pet Rules';
    UPDATE onboarding_tasks SET field_value = '1 month', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 12 AND title = 'Lease Term';
    UPDATE onboarding_tasks SET field_value = '30 days', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 12 AND title = 'Notice to Vacate';
    UPDATE onboarding_tasks SET field_value = 'https://peachhausfurnishedrentals.com/listing/lavish-living-8-mins-from-braves-stadium-w-king/', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 14 AND title = 'Direct Booking Website';
    UPDATE onboarding_tasks SET field_value = 'anja@peachhausgroup.com', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 14 AND title = 'Contact Email';
    UPDATE onboarding_tasks SET field_value = '470-863-8087', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 14 AND title = 'Contact Phone';
  END IF;

  -- Property 6: 2580 Old Roswell
  SELECT op.id INTO v_project_id FROM onboarding_projects op JOIN properties p ON op.property_address ILIKE '%2580 Old Roswell%' WHERE op.status != 'completed' LIMIT 1;
  IF v_project_id IS NOT NULL THEN
    UPDATE onboarding_tasks SET field_value = 'https://www.airbnb.com/rooms/581294085844536405', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 7 AND title = 'Airbnb';
    UPDATE onboarding_tasks SET field_value = 'https://www.vrbo.com/2708824', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 7 AND title = 'VRBO';
    UPDATE onboarding_tasks SET field_value = 'Townhome/ end unit', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Property Type Detail';
    UPDATE onboarding_tasks SET field_value = '2', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Stories';
    UPDATE onboarding_tasks SET field_value = '1,372', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Square Footage';
    UPDATE onboarding_tasks SET field_value = '2', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Bedrooms';
    UPDATE onboarding_tasks SET field_value = '2.5', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Bathrooms';
    UPDATE onboarding_tasks SET field_value = 'parking pad, street parking', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Parking Type';
    UPDATE onboarding_tasks SET field_value = '2', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Parking Capacity';
    UPDATE onboarding_tasks SET field_value = 'No', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Bedroom on Main';
    UPDATE onboarding_tasks SET field_value = 'Yes', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Walk-in Shower';
    UPDATE onboarding_tasks SET field_value = 'Yes', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Furnished';
    UPDATE onboarding_tasks SET field_value = 'No', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Pool';
    UPDATE onboarding_tasks SET field_value = 'Yes', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Fenced Yard';
    UPDATE onboarding_tasks SET field_value = '5640', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 11 AND title = 'Monthly Rent';
    UPDATE onboarding_tasks SET field_value = '1500', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 11 AND title = 'Security Deposit';
    UPDATE onboarding_tasks SET field_value = 'Yes', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 12 AND title = 'Pets Allowed';
    UPDATE onboarding_tasks SET field_value = 'Yes (fenced in backyard)', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 12 AND title = 'Pet Rules';
    UPDATE onboarding_tasks SET field_value = '1 month', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 12 AND title = 'Lease Term';
    UPDATE onboarding_tasks SET field_value = '30 days', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 12 AND title = 'Notice to Vacate';
    UPDATE onboarding_tasks SET field_value = 'https://peachhausfurnishedrentals.com/listing/luxurious-spacious-apartment-close-to-truist-ball-park/', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 14 AND title = 'Direct Booking Website';
    UPDATE onboarding_tasks SET field_value = 'anja@peachhausgroup.com', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 14 AND title = 'Contact Email';
    UPDATE onboarding_tasks SET field_value = '470-863-8087', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 14 AND title = 'Contact Phone';
  END IF;

  -- Property 7: 5198 Laurel Bridge
  SELECT op.id INTO v_project_id FROM onboarding_projects op JOIN properties p ON op.property_address ILIKE '%5198 Laurel%' WHERE op.status != 'completed' LIMIT 1;
  IF v_project_id IS NOT NULL THEN
    UPDATE onboarding_tasks SET field_value = 'https://www.airbnb.com/rooms/43339882', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 7 AND title = 'Airbnb';
    UPDATE onboarding_tasks SET field_value = 'https://www.vrbo.com/en-au/holiday-rental/p1976841vb', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 7 AND title = 'VRBO';
    UPDATE onboarding_tasks SET field_value = 'townhome/ end unit', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Property Type Detail';
    UPDATE onboarding_tasks SET field_value = '2', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Stories';
    UPDATE onboarding_tasks SET field_value = '1,248', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Square Footage';
    UPDATE onboarding_tasks SET field_value = '2', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Bedrooms';
    UPDATE onboarding_tasks SET field_value = '2.5', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Bathrooms';
    UPDATE onboarding_tasks SET field_value = 'parking pad in front', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Parking Type';
    UPDATE onboarding_tasks SET field_value = '2', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Parking Capacity';
    UPDATE onboarding_tasks SET field_value = 'No', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Bedroom on Main';
    UPDATE onboarding_tasks SET field_value = 'Yes', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Walk-in Shower';
    UPDATE onboarding_tasks SET field_value = 'Yes', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Furnished';
    UPDATE onboarding_tasks SET field_value = 'No', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Pool';
    UPDATE onboarding_tasks SET field_value = 'No', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Fenced Yard';
    UPDATE onboarding_tasks SET field_value = '4770', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 11 AND title = 'Monthly Rent';
    UPDATE onboarding_tasks SET field_value = '1500', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 11 AND title = 'Security Deposit';
    UPDATE onboarding_tasks SET field_value = 'Yes', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 12 AND title = 'Pets Allowed';
    UPDATE onboarding_tasks SET field_value = 'Yes (no fenced backyard)', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 12 AND title = 'Pet Rules';
    UPDATE onboarding_tasks SET field_value = '1 month', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 12 AND title = 'Lease Term';
    UPDATE onboarding_tasks SET field_value = '30 days', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 12 AND title = 'Notice to Vacate';
    UPDATE onboarding_tasks SET field_value = 'https://peachhausfurnishedrentals.com/listing/%e2%9d%a4%ef%b8%8f-scandinavian-retreat-mins-to-battery-w-king/', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 14 AND title = 'Direct Booking Website';
    UPDATE onboarding_tasks SET field_value = 'anja@peachhausgroup.com', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 14 AND title = 'Contact Email';
    UPDATE onboarding_tasks SET field_value = '470-863-8087', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 14 AND title = 'Contact Phone';
  END IF;

  -- Property 8: 184 Woodland
  SELECT op.id INTO v_project_id FROM onboarding_projects op JOIN properties p ON op.property_address ILIKE '%184 Woodland%' WHERE op.status != 'completed' LIMIT 1;
  IF v_project_id IS NOT NULL THEN
    UPDATE onboarding_tasks SET field_value = 'https://www.airbnb.com/rooms/1324567699805540986', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 7 AND title = 'Airbnb';
    UPDATE onboarding_tasks SET field_value = 'https://www.vrbo.com/4722192', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 7 AND title = 'VRBO';
    UPDATE onboarding_tasks SET field_value = 'SFH', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Property Type Detail';
    UPDATE onboarding_tasks SET field_value = '2', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Stories';
    UPDATE onboarding_tasks SET field_value = '3020', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Square Footage';
    UPDATE onboarding_tasks SET field_value = '5', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Bedrooms';
    UPDATE onboarding_tasks SET field_value = '3', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Bathrooms';
    UPDATE onboarding_tasks SET field_value = 'driveway in front of home', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Parking Type';
    UPDATE onboarding_tasks SET field_value = '4', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Parking Capacity';
    UPDATE onboarding_tasks SET field_value = 'Yes', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Bedroom on Main';
    UPDATE onboarding_tasks SET field_value = 'Yes', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Walk-in Shower';
    UPDATE onboarding_tasks SET field_value = 'Yes', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Furnished';
    UPDATE onboarding_tasks SET field_value = 'No', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Pool';
    UPDATE onboarding_tasks SET field_value = 'No', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 10 AND title = 'Fenced Yard';
    UPDATE onboarding_tasks SET field_value = '8850', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 11 AND title = 'Monthly Rent';
    UPDATE onboarding_tasks SET field_value = '2000', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 11 AND title = 'Security Deposit';
    UPDATE onboarding_tasks SET field_value = 'Yes', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 12 AND title = 'Pets Allowed';
    UPDATE onboarding_tasks SET field_value = 'Yes (no fenced backyard)', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 12 AND title = 'Pet Rules';
    UPDATE onboarding_tasks SET field_value = '2 month', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 12 AND title = 'Lease Term';
    UPDATE onboarding_tasks SET field_value = '30 days', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 12 AND title = 'Notice to Vacate';
    UPDATE onboarding_tasks SET field_value = 'https://peachhausfurnishedrentals.com/listing/mableton-meadows/', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 14 AND title = 'Direct Booking Website';
    UPDATE onboarding_tasks SET field_value = 'anja@peachhausgroup.com', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 14 AND title = 'Contact Email';
    UPDATE onboarding_tasks SET field_value = '470-863-8087', status = 'completed', completed_date = now() WHERE project_id = v_project_id AND phase_number = 14 AND title = 'Contact Phone';
  END IF;

END $$;