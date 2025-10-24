-- Add missing core fields to Company-Owned properties that we imported data for

-- Alpine (4241 Osburn Ct, Duluth, GA 30096) - project id: 824cfc71-d343-4b1f-96f0-6feb62ef5b9a  
UPDATE onboarding_tasks SET field_value = 'The Alpine' WHERE project_id = '824cfc71-d343-4b1f-96f0-6feb62ef5b9a' AND title = 'Brand Name';
UPDATE onboarding_tasks SET field_value = 'SFH' WHERE project_id = '824cfc71-d343-4b1f-96f0-6feb62ef5b9a' AND title = 'Property Type Detail';
UPDATE onboarding_tasks SET field_value = '2' WHERE project_id = '824cfc71-d343-4b1f-96f0-6feb62ef5b9a' AND title = 'Stories';
UPDATE onboarding_tasks SET field_value = '1 car garage plus driveway parking for 4 cars' WHERE project_id = '824cfc71-d343-4b1f-96f0-6feb62ef5b9a' AND title = 'Parking Type';
UPDATE onboarding_tasks SET field_value = '5' WHERE project_id = '824cfc71-d343-4b1f-96f0-6feb62ef5b9a' AND title = 'Parking Capacity';
UPDATE onboarding_tasks SET field_value = 'YES' WHERE project_id = '824cfc71-d343-4b1f-96f0-6feb62ef5b9a' AND title = 'Fenced Yard';
UPDATE onboarding_tasks SET field_value = '3' WHERE project_id = '824cfc71-d343-4b1f-96f0-6feb62ef5b9a' AND title = 'Bedrooms';
UPDATE onboarding_tasks SET field_value = '3' WHERE project_id = '824cfc71-d343-4b1f-96f0-6feb62ef5b9a' AND title = 'Bathrooms';
UPDATE onboarding_tasks SET field_value = '2000' WHERE project_id = '824cfc71-d343-4b1f-96f0-6feb62ef5b9a' AND title = 'Square Footage';

-- Family Retreat (Durham) - project id: 93b510f1-3f2f-43b6-9704-f0247dd5c494
UPDATE onboarding_tasks SET field_value = 'The Durham Retreat' WHERE project_id = '93b510f1-3f2f-43b6-9704-f0247dd5c494' AND title = 'Brand Name';
UPDATE onboarding_tasks SET field_value = 'SFH' WHERE project_id = '93b510f1-3f2f-43b6-9704-f0247dd5c494' AND title = 'Property Type Detail';
UPDATE onboarding_tasks SET field_value = '2' WHERE project_id = '93b510f1-3f2f-43b6-9704-f0247dd5c494' AND title = 'Stories';
UPDATE onboarding_tasks SET field_value = 'driveway parking 2 cars' WHERE project_id = '93b510f1-3f2f-43b6-9704-f0247dd5c494' AND title = 'Parking Type';
UPDATE onboarding_tasks SET field_value = '2' WHERE project_id = '93b510f1-3f2f-43b6-9704-f0247dd5c494' AND title = 'Parking Capacity';
UPDATE onboarding_tasks SET field_value = 'partially fenced in' WHERE project_id = '93b510f1-3f2f-43b6-9704-f0247dd5c494' AND title = 'Fenced Yard';
UPDATE onboarding_tasks SET field_value = '3' WHERE project_id = '93b510f1-3f2f-43b6-9704-f0247dd5c494' AND title = 'Bedrooms';
UPDATE onboarding_tasks SET field_value = '2.5' WHERE project_id = '93b510f1-3f2f-43b6-9704-f0247dd5c494' AND title = 'Bathrooms';
UPDATE onboarding_tasks SET field_value = '2,170' WHERE project_id = '93b510f1-3f2f-43b6-9704-f0247dd5c494' AND title = 'Square Footage';

-- Scandinavian Retreat (5198 Laurel Bridge) - project id: 5dc1cc1b-ebc2-4c27-876b-d4b844d290e5
UPDATE onboarding_tasks SET field_value = 'The Scandinavian Retreat' WHERE project_id = '5dc1cc1b-ebc2-4c27-876b-d4b844d290e5' AND title = 'Brand Name';
UPDATE onboarding_tasks SET field_value = 'Townhome' WHERE project_id = '5dc1cc1b-ebc2-4c27-876b-d4b844d290e5' AND title = 'Property Type Detail';
UPDATE onboarding_tasks SET field_value = '2' WHERE project_id = '5dc1cc1b-ebc2-4c27-876b-d4b844d290e5' AND title = 'Stories';
UPDATE onboarding_tasks SET field_value = 'driveway parking 2 cars' WHERE project_id = '5dc1cc1b-ebc2-4c27-876b-d4b844d290e5' AND title = 'Parking Type';
UPDATE onboarding_tasks SET field_value = '2' WHERE project_id = '5dc1cc1b-ebc2-4c27-876b-d4b844d290e5' AND title = 'Parking Capacity';
UPDATE onboarding_tasks SET field_value = 'NO' WHERE project_id = '5dc1cc1b-ebc2-4c27-876b-d4b844d290e5' AND title = 'Fenced Yard';
UPDATE onboarding_tasks SET field_value = '2' WHERE project_id = '5dc1cc1b-ebc2-4c27-876b-d4b844d290e5' AND title = 'Bedrooms';
UPDATE onboarding_tasks SET field_value = '2.5' WHERE project_id = '5dc1cc1b-ebc2-4c27-876b-d4b844d290e5' AND title = 'Bathrooms';
UPDATE onboarding_tasks SET field_value = '1248' WHERE project_id = '5dc1cc1b-ebc2-4c27-876b-d4b844d290e5' AND title = 'Square Footage';

-- Luxurious & Spacious Apartment (Old Roswell) - project id: a5db3e43-25cb-46a2-a748-0d4cde1ca0c4
UPDATE onboarding_tasks SET field_value = 'Old Rowsell' WHERE project_id = 'a5db3e43-25cb-46a2-a748-0d4cde1ca0c4' AND title = 'Brand Name';
UPDATE onboarding_tasks SET field_value = 'Townhouse' WHERE project_id = 'a5db3e43-25cb-46a2-a748-0d4cde1ca0c4' AND title = 'Property Type Detail';
UPDATE onboarding_tasks SET field_value = '2' WHERE project_id = 'a5db3e43-25cb-46a2-a748-0d4cde1ca0c4' AND title = 'Stories';
UPDATE onboarding_tasks SET field_value = 'driveway parking 2 cars' WHERE project_id = 'a5db3e43-25cb-46a2-a748-0d4cde1ca0c4' AND title = 'Parking Type';
UPDATE onboarding_tasks SET field_value = '2' WHERE project_id = 'a5db3e43-25cb-46a2-a748-0d4cde1ca0c4' AND title = 'Parking Capacity';
UPDATE onboarding_tasks SET field_value = 'YES' WHERE project_id = 'a5db3e43-25cb-46a2-a748-0d4cde1ca0c4' AND title = 'Fenced Yard';
UPDATE onboarding_tasks SET field_value = '2' WHERE project_id = 'a5db3e43-25cb-46a2-a748-0d4cde1ca0c4' AND title = 'Bedrooms';
UPDATE onboarding_tasks SET field_value = '2.5' WHERE project_id = 'a5db3e43-25cb-46a2-a748-0d4cde1ca0c4' AND title = 'Bathrooms';
UPDATE onboarding_tasks SET field_value = '1372' WHERE project_id = 'a5db3e43-25cb-46a2-a748-0d4cde1ca0c4' AND title = 'Square Footage';

-- Lavish Living (Rita Way) - project id: 0186fae9-13a2-4e5c-b15a-8200a394462e
UPDATE onboarding_tasks SET field_value = 'The Homerun Hideaway' WHERE project_id = '0186fae9-13a2-4e5c-b15a-8200a394462e' AND title = 'Brand Name';
UPDATE onboarding_tasks SET field_value = 'SFH' WHERE project_id = '0186fae9-13a2-4e5c-b15a-8200a394462e' AND title = 'Property Type Detail';
UPDATE onboarding_tasks SET field_value = '1 (ranch style)' WHERE project_id = '0186fae9-13a2-4e5c-b15a-8200a394462e' AND title = 'Stories';
UPDATE onboarding_tasks SET field_value = '1 carport, driveway 2 cars' WHERE project_id = '0186fae9-13a2-4e5c-b15a-8200a394462e' AND title = 'Parking Type';
UPDATE onboarding_tasks SET field_value = '2' WHERE project_id = '0186fae9-13a2-4e5c-b15a-8200a394462e' AND title = 'Parking Capacity';
UPDATE onboarding_tasks SET field_value = 'YES' WHERE project_id = '0186fae9-13a2-4e5c-b15a-8200a394462e' AND title = 'Fenced Yard';
UPDATE onboarding_tasks SET field_value = '3' WHERE project_id = '0186fae9-13a2-4e5c-b15a-8200a394462e' AND title = 'Bedrooms';
UPDATE onboarding_tasks SET field_value = '2' WHERE project_id = '0186fae9-13a2-4e5c-b15a-8200a394462e' AND title = 'Bathrooms';
UPDATE onboarding_tasks SET field_value = '1050' WHERE project_id = '0186fae9-13a2-4e5c-b15a-8200a394462e' AND title = 'Square Footage';

-- Scandi Chic (Duvall) - project id: 8cadda17-1759-4a69-853a-33c25264846d
UPDATE onboarding_tasks SET field_value = 'Scandi Chic' WHERE project_id = '8cadda17-1759-4a69-853a-33c25264846d' AND title = 'Brand Name';
UPDATE onboarding_tasks SET field_value = 'Townhouse' WHERE project_id = '8cadda17-1759-4a69-853a-33c25264846d' AND title = 'Property Type Detail';
UPDATE onboarding_tasks SET field_value = '2' WHERE project_id = '8cadda17-1759-4a69-853a-33c25264846d' AND title = 'Stories';
UPDATE onboarding_tasks SET field_value = 'driveway 3 cars' WHERE project_id = '8cadda17-1759-4a69-853a-33c25264846d' AND title = 'Parking Type';
UPDATE onboarding_tasks SET field_value = '3' WHERE project_id = '8cadda17-1759-4a69-853a-33c25264846d' AND title = 'Parking Capacity';
UPDATE onboarding_tasks SET field_value = 'NO' WHERE project_id = '8cadda17-1759-4a69-853a-33c25264846d' AND title = 'Fenced Yard';
UPDATE onboarding_tasks SET field_value = '2' WHERE project_id = '8cadda17-1759-4a69-853a-33c25264846d' AND title = 'Bedrooms';
UPDATE onboarding_tasks SET field_value = '2' WHERE project_id = '8cadda17-1759-4a69-853a-33c25264846d' AND title = 'Bathrooms';
UPDATE onboarding_tasks SET field_value = '1600' WHERE project_id = '8cadda17-1759-4a69-853a-33c25264846d' AND title = 'Square Footage';