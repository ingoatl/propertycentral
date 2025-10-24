
-- Import listing data for Client-Managed properties from CSV

-- The Boho Lux (14 Villa Ct SE, Smyrna, GA 30080) - Line 54 of CSV
UPDATE onboarding_tasks 
SET field_value = 'The Boho Lux', status = 'completed'
WHERE project_id = 'bfd7314b-2bee-4717-b782-5dee2a102467' AND title = 'Brand Name';

UPDATE onboarding_tasks 
SET field_value = 'MTR', status = 'completed'
WHERE project_id = 'bfd7314b-2bee-4717-b782-5dee2a102467' AND title = 'Property Type Detail (STR/MTR/Hybrid)';

UPDATE onboarding_tasks 
SET field_value = 'Townhouse', status = 'completed'
WHERE project_id = 'bfd7314b-2bee-4717-b782-5dee2a102467' AND title = 'House Type';

UPDATE onboarding_tasks 
SET field_value = '2', status = 'completed'
WHERE project_id = 'bfd7314b-2bee-4717-b782-5dee2a102467' AND title = 'Stories';

UPDATE onboarding_tasks 
SET field_value = '2 assigned parking spots, guest parking', status = 'completed'
WHERE project_id = 'bfd7314b-2bee-4717-b782-5dee2a102467' AND title = 'Parking Type and Capacity';

UPDATE onboarding_tasks 
SET field_value = 'Teasley Elementary School', status = 'completed'
WHERE project_id = 'bfd7314b-2bee-4717-b782-5dee2a102467' AND title = 'School District';

UPDATE onboarding_tasks 
SET field_value = 'Campbell Middle School', status = 'completed'
WHERE project_id = 'bfd7314b-2bee-4717-b782-5dee2a102467' AND title = 'Middle School';

UPDATE onboarding_tasks 
SET field_value = 'Campbell High School', status = 'completed'
WHERE project_id = 'bfd7314b-2bee-4717-b782-5dee2a102467' AND title = 'High School';

UPDATE onboarding_tasks 
SET field_value = 'true', status = 'completed'
WHERE project_id = 'bfd7314b-2bee-4717-b782-5dee2a102467' AND title = 'ADA Compliant';

UPDATE onboarding_tasks 
SET field_value = 'false', status = 'completed'
WHERE project_id = 'bfd7314b-2bee-4717-b782-5dee2a102467' AND title = 'Basement';

UPDATE onboarding_tasks 
SET field_value = 'false', status = 'completed'
WHERE project_id = 'bfd7314b-2bee-4717-b782-5dee2a102467' AND title = 'Fenced Yard';

UPDATE onboarding_tasks 
SET field_value = '3', status = 'completed'
WHERE project_id = 'bfd7314b-2bee-4717-b782-5dee2a102467' AND title = 'Bedrooms';

UPDATE onboarding_tasks 
SET field_value = '3.5', status = 'completed'
WHERE project_id = 'bfd7314b-2bee-4717-b782-5dee2a102467' AND title = 'Bathrooms';

UPDATE onboarding_tasks 
SET field_value = '1503', status = 'completed'
WHERE project_id = 'bfd7314b-2bee-4717-b782-5dee2a102467' AND title = 'Square Footage';

UPDATE onboarding_tasks 
SET field_value = 'false', status = 'completed'
WHERE project_id = 'bfd7314b-2bee-4717-b782-5dee2a102467' AND title = 'Pets Allowed';

UPDATE onboarding_tasks 
SET field_value = '1 dog max, up to 30 lbs', status = 'completed'
WHERE project_id = 'bfd7314b-2bee-4717-b782-5dee2a102467' AND title = 'Pet Rules';

UPDATE onboarding_tasks 
SET field_value = '1', status = 'completed'
WHERE project_id = 'bfd7314b-2bee-4717-b782-5dee2a102467' AND title = 'Maximum Number of Pets';

UPDATE onboarding_tasks 
SET field_value = '30', status = 'completed'
WHERE project_id = 'bfd7314b-2bee-4717-b782-5dee2a102467' AND title = 'Maximum Pet Weight';

UPDATE onboarding_tasks 
SET field_value = '4200', status = 'completed'
WHERE project_id = 'bfd7314b-2bee-4717-b782-5dee2a102467' AND title = 'Monthly Rent';

UPDATE onboarding_tasks 
SET field_value = '140', status = 'completed'
WHERE project_id = 'bfd7314b-2bee-4717-b782-5dee2a102467' AND title = 'Nightly Rate';

UPDATE onboarding_tasks 
SET field_value = '1000', status = 'completed'
WHERE project_id = 'bfd7314b-2bee-4717-b782-5dee2a102467' AND title = 'Security Deposit';

UPDATE onboarding_tasks 
SET field_value = '400', status = 'completed'
WHERE project_id = 'bfd7314b-2bee-4717-b782-5dee2a102467' AND title = 'Utility Cap';

UPDATE onboarding_tasks 
SET field_value = '300', status = 'completed'
WHERE project_id = 'bfd7314b-2bee-4717-b782-5dee2a102467' AND title = 'Cleaning Fee (Move-out)';

UPDATE onboarding_tasks 
SET field_value = '350', status = 'completed'
WHERE project_id = 'bfd7314b-2bee-4717-b782-5dee2a102467' AND title = 'Admin Fee (One-time)';

UPDATE onboarding_tasks 
SET field_value = '300', status = 'completed'
WHERE project_id = 'bfd7314b-2bee-4717-b782-5dee2a102467' AND title = 'Pet Fee (Per Pet)';

UPDATE onboarding_tasks 
SET field_value = '150', status = 'completed'
WHERE project_id = 'bfd7314b-2bee-4717-b782-5dee2a102467' AND title = 'Monthly Pet Rent (Per Pet)';

UPDATE onboarding_tasks 
SET field_value = '150', status = 'completed'
WHERE project_id = 'bfd7314b-2bee-4717-b782-5dee2a102467' AND title = 'Monthly Cleaning Fee';

UPDATE onboarding_tasks 
SET field_value = 'month to month', status = 'completed'
WHERE project_id = 'bfd7314b-2bee-4717-b782-5dee2a102467' AND title = 'Lease Term';

UPDATE onboarding_tasks 
SET field_value = '30 days', status = 'completed'
WHERE project_id = 'bfd7314b-2bee-4717-b782-5dee2a102467' AND title = 'Notice to Vacate';

UPDATE onboarding_tasks 
SET field_value = 'anja@peachhausgroup.com', status = 'completed'
WHERE project_id = 'bfd7314b-2bee-4717-b782-5dee2a102467' AND title = 'Contact Email';

UPDATE onboarding_tasks 
SET field_value = '470-863-8087', status = 'completed'
WHERE project_id = 'bfd7314b-2bee-4717-b782-5dee2a102467' AND title = 'Contact Phone';

UPDATE onboarding_tasks 
SET field_value = 'www.boholuxeatlanta.com', status = 'completed'
WHERE project_id = 'bfd7314b-2bee-4717-b782-5dee2a102467' AND title = 'Direct Booking Website';

-- Mableton Meadows (184 Woodland Ln SW, Mableton GA 30126) - Line 44
UPDATE onboarding_tasks 
SET field_value = 'Mableton Meadows', status = 'completed'
WHERE project_id = 'fec8f75a-3df8-433c-99ad-27db366a755d' AND title = 'Brand Name';

UPDATE onboarding_tasks 
SET field_value = 'Hybrid', status = 'completed'
WHERE project_id = 'fec8f75a-3df8-433c-99ad-27db366a755d' AND title = 'Property Type Detail (STR/MTR/Hybrid)';

UPDATE onboarding_tasks 
SET field_value = 'SFH', status = 'completed'
WHERE project_id = 'fec8f75a-3df8-433c-99ad-27db366a755d' AND title = 'House Type';

UPDATE onboarding_tasks 
SET field_value = '2', status = 'completed'
WHERE project_id = 'fec8f75a-3df8-433c-99ad-27db366a755d' AND title = 'Stories';

UPDATE onboarding_tasks 
SET field_value = 'driveway, up to 4 cars', status = 'completed'
WHERE project_id = 'fec8f75a-3df8-433c-99ad-27db366a755d' AND title = 'Parking Type and Capacity';

UPDATE onboarding_tasks 
SET field_value = 'Clay-Harmony Leland Elementary School', status = 'completed'
WHERE project_id = 'fec8f75a-3df8-433c-99ad-27db366a755d' AND title = 'School District';

UPDATE onboarding_tasks 
SET field_value = 'Lindley MS', status = 'completed'
WHERE project_id = 'fec8f75a-3df8-433c-99ad-27db366a755d' AND title = 'Middle School';

UPDATE onboarding_tasks 
SET field_value = 'South Cobb HS', status = 'completed'
WHERE project_id = 'fec8f75a-3df8-433c-99ad-27db366a755d' AND title = 'High School';

UPDATE onboarding_tasks 
SET field_value = 'true', status = 'completed'
WHERE project_id = 'fec8f75a-3df8-433c-99ad-27db366a755d' AND title = 'ADA Compliant';

UPDATE onboarding_tasks 
SET field_value = 'false', status = 'completed'
WHERE project_id = 'fec8f75a-3df8-433c-99ad-27db366a755d' AND title = 'Basement';

UPDATE onboarding_tasks 
SET field_value = 'false', status = 'completed'
WHERE project_id = 'fec8f75a-3df8-433c-99ad-27db366a755d' AND title = 'Fenced Yard';

UPDATE onboarding_tasks 
SET field_value = '5', status = 'completed'
WHERE project_id = 'fec8f75a-3df8-433c-99ad-27db366a755d' AND title = 'Bedrooms';

UPDATE onboarding_tasks 
SET field_value = '3', status = 'completed'
WHERE project_id = 'fec8f75a-3df8-433c-99ad-27db366a755d' AND title = 'Bathrooms';

UPDATE onboarding_tasks 
SET field_value = '3020', status = 'completed'
WHERE project_id = 'fec8f75a-3df8-433c-99ad-27db366a755d' AND title = 'Square Footage';

UPDATE onboarding_tasks 
SET field_value = 'true', status = 'completed'
WHERE project_id = 'fec8f75a-3df8-433c-99ad-27db366a755d' AND title = 'Pets Allowed';

UPDATE onboarding_tasks 
SET field_value = '2 dogs max, up to 40 lbs', status = 'completed'
WHERE project_id = 'fec8f75a-3df8-433c-99ad-27db366a755d' AND title = 'Pet Rules';

UPDATE onboarding_tasks 
SET field_value = '2', status = 'completed'
WHERE project_id = 'fec8f75a-3df8-433c-99ad-27db366a755d' AND title = 'Maximum Number of Pets';

UPDATE onboarding_tasks 
SET field_value = '40', status = 'completed'
WHERE project_id = 'fec8f75a-3df8-433c-99ad-27db366a755d' AND title = 'Maximum Pet Weight';

UPDATE onboarding_tasks 
SET field_value = '8850', status = 'completed'
WHERE project_id = 'fec8f75a-3df8-433c-99ad-27db366a755d' AND title = 'Monthly Rent';

UPDATE onboarding_tasks 
SET field_value = '295', status = 'completed'
WHERE project_id = 'fec8f75a-3df8-433c-99ad-27db366a755d' AND title = 'Nightly Rate';

UPDATE onboarding_tasks 
SET field_value = '2000', status = 'completed'
WHERE project_id = 'fec8f75a-3df8-433c-99ad-27db366a755d' AND title = 'Security Deposit';

UPDATE onboarding_tasks 
SET field_value = '500', status = 'completed'
WHERE project_id = 'fec8f75a-3df8-433c-99ad-27db366a755d' AND title = 'Utility Cap';

UPDATE onboarding_tasks 
SET field_value = '450', status = 'completed'
WHERE project_id = 'fec8f75a-3df8-433c-99ad-27db366a755d' AND title = 'Cleaning Fee (Move-out)';

UPDATE onboarding_tasks 
SET field_value = '350', status = 'completed'
WHERE project_id = 'fec8f75a-3df8-433c-99ad-27db366a755d' AND title = 'Admin Fee (One-time)';

UPDATE onboarding_tasks 
SET field_value = '300', status = 'completed'
WHERE project_id = 'fec8f75a-3df8-433c-99ad-27db366a755d' AND title = 'Pet Fee (Per Pet)';

UPDATE onboarding_tasks 
SET field_value = '150', status = 'completed'
WHERE project_id = 'fec8f75a-3df8-433c-99ad-27db366a755d' AND title = 'Monthly Pet Rent (Per Pet)';

UPDATE onboarding_tasks 
SET field_value = '200', status = 'completed'
WHERE project_id = 'fec8f75a-3df8-433c-99ad-27db366a755d' AND title = 'Monthly Cleaning Fee';

UPDATE onboarding_tasks 
SET field_value = '2 months min.', status = 'completed'
WHERE project_id = 'fec8f75a-3df8-433c-99ad-27db366a755d' AND title = 'Lease Term';

UPDATE onboarding_tasks 
SET field_value = '30 days', status = 'completed'
WHERE project_id = 'fec8f75a-3df8-433c-99ad-27db366a755d' AND title = 'Notice to Vacate';

UPDATE onboarding_tasks 
SET field_value = 'anja@peachhausgroup.com', status = 'completed'
WHERE project_id = 'fec8f75a-3df8-433c-99ad-27db366a755d' AND title = 'Contact Email';

UPDATE onboarding_tasks 
SET field_value = '470-863-8087', status = 'completed'
WHERE project_id = 'fec8f75a-3df8-433c-99ad-27db366a755d' AND title = 'Contact Phone';

UPDATE onboarding_tasks 
SET field_value = 'https://www.mabletonmeadows.com', status = 'completed'
WHERE project_id = 'fec8f75a-3df8-433c-99ad-27db366a755d' AND title = 'Direct Booking Website';

-- Muirfield (2430 Muirfield Pl, College Park, GA 30337) - Line 74
UPDATE onboarding_tasks 
SET field_value = 'MTR', status = 'completed'
WHERE project_id = '19864230-ca7f-4270-9620-1b7fad236d16' AND title = 'Property Type Detail (STR/MTR/Hybrid)';

UPDATE onboarding_tasks 
SET field_value = 'Townhome', status = 'completed'
WHERE project_id = '19864230-ca7f-4270-9620-1b7fad236d16' AND title = 'House Type';

UPDATE onboarding_tasks 
SET field_value = '2', status = 'completed'
WHERE project_id = '19864230-ca7f-4270-9620-1b7fad236d16' AND title = 'Stories';

UPDATE onboarding_tasks 
SET field_value = '2 car garage, 2 cars in driveway', status = 'completed'
WHERE project_id = '19864230-ca7f-4270-9620-1b7fad236d16' AND title = 'Parking Type and Capacity';

UPDATE onboarding_tasks 
SET field_value = 'false', status = 'completed'
WHERE project_id = '19864230-ca7f-4270-9620-1b7fad236d16' AND title = 'ADA Compliant';

UPDATE onboarding_tasks 
SET field_value = 'false', status = 'completed'
WHERE project_id = '19864230-ca7f-4270-9620-1b7fad236d16' AND title = 'Basement';

UPDATE onboarding_tasks 
SET field_value = 'true', status = 'completed'
WHERE project_id = '19864230-ca7f-4270-9620-1b7fad236d16' AND title = 'Fenced Yard';

UPDATE onboarding_tasks 
SET field_value = '3', status = 'completed'
WHERE project_id = '19864230-ca7f-4270-9620-1b7fad236d16' AND title = 'Bedrooms';

UPDATE onboarding_tasks 
SET field_value = '3.5', status = 'completed'
WHERE project_id = '19864230-ca7f-4270-9620-1b7fad236d16' AND title = 'Bathrooms';

UPDATE onboarding_tasks 
SET field_value = 'true', status = 'completed'
WHERE project_id = '19864230-ca7f-4270-9620-1b7fad236d16' AND title = 'Pets Allowed';

UPDATE onboarding_tasks 
SET field_value = '1 dog max, up to 35 lbs', status = 'completed'
WHERE project_id = '19864230-ca7f-4270-9620-1b7fad236d16' AND title = 'Pet Rules';

UPDATE onboarding_tasks 
SET field_value = '1', status = 'completed'
WHERE project_id = '19864230-ca7f-4270-9620-1b7fad236d16' AND title = 'Maximum Number of Pets';

UPDATE onboarding_tasks 
SET field_value = '35', status = 'completed'
WHERE project_id = '19864230-ca7f-4270-9620-1b7fad236d16' AND title = 'Maximum Pet Weight';

-- Timberlake (3384 Timber Lake Rd NW, Kennesaw, GA 30144) - Line 69
UPDATE onboarding_tasks 
SET field_value = 'Hybrid', status = 'completed'
WHERE project_id = '124cbeb2-9fc6-40dd-9b40-6f78a4ef5449' AND title = 'Property Type Detail (STR/MTR/Hybrid)';

UPDATE onboarding_tasks 
SET field_value = 'SFH', status = 'completed'
WHERE project_id = '124cbeb2-9fc6-40dd-9b40-6f78a4ef5449' AND title = 'House Type';

UPDATE onboarding_tasks 
SET field_value = '1', status = 'completed'
WHERE project_id = '124cbeb2-9fc6-40dd-9b40-6f78a4ef5449' AND title = 'Stories';

UPDATE onboarding_tasks 
SET field_value = 'carport for 2 cars, driveway parking for 2 cars', status = 'completed'
WHERE project_id = '124cbeb2-9fc6-40dd-9b40-6f78a4ef5449' AND title = 'Parking Type and Capacity';

UPDATE onboarding_tasks 
SET field_value = 'false', status = 'completed'
WHERE project_id = '124cbeb2-9fc6-40dd-9b40-6f78a4ef5449' AND title = 'ADA Compliant';

UPDATE onboarding_tasks 
SET field_value = 'false', status = 'completed'
WHERE project_id = '124cbeb2-9fc6-40dd-9b40-6f78a4ef5449' AND title = 'Basement';

UPDATE onboarding_tasks 
SET field_value = 'true', status = 'completed'
WHERE project_id = '124cbeb2-9fc6-40dd-9b40-6f78a4ef5449' AND title = 'Fenced Yard';

UPDATE onboarding_tasks 
SET field_value = '1500', status = 'completed'
WHERE project_id = '124cbeb2-9fc6-40dd-9b40-6f78a4ef5449' AND title = 'Security Deposit';

UPDATE onboarding_tasks 
SET field_value = '500', status = 'completed'
WHERE project_id = '124cbeb2-9fc6-40dd-9b40-6f78a4ef5449' AND title = 'Utility Cap';

UPDATE onboarding_tasks 
SET field_value = '450', status = 'completed'
WHERE project_id = '124cbeb2-9fc6-40dd-9b40-6f78a4ef5449' AND title = 'Cleaning Fee (Move-out)';

UPDATE onboarding_tasks 
SET field_value = '350', status = 'completed'
WHERE project_id = '124cbeb2-9fc6-40dd-9b40-6f78a4ef5449' AND title = 'Admin Fee (One-time)';

UPDATE onboarding_tasks 
SET field_value = 'month to month', status = 'completed'
WHERE project_id = '124cbeb2-9fc6-40dd-9b40-6f78a4ef5449' AND title = 'Lease Term';

UPDATE onboarding_tasks 
SET field_value = '30 days', status = 'completed'
WHERE project_id = '124cbeb2-9fc6-40dd-9b40-6f78a4ef5449' AND title = 'Notice to Vacate';

UPDATE onboarding_tasks 
SET field_value = 'anja@peachhausgroup.com', status = 'completed'
WHERE project_id = '124cbeb2-9fc6-40dd-9b40-6f78a4ef5449' AND title = 'Contact Email';

UPDATE onboarding_tasks 
SET field_value = '470-863-8087', status = 'completed'
WHERE project_id = '124cbeb2-9fc6-40dd-9b40-6f78a4ef5449' AND title = 'Contact Phone';
