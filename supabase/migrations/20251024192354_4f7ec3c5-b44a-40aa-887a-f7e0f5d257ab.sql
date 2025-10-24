
-- Insert listing data tasks for Client-Managed properties
-- These tasks are in phases 10-14 but don't exist yet, so we need to create them

-- The Boho Lux (14 Villa Ct SE, Smyrna, GA 30080)
INSERT INTO onboarding_tasks (project_id, phase_number, phase_title, title, field_type, field_value, status, created_at, updated_at)
VALUES 
('bfd7314b-2bee-4717-b782-5dee2a102467', 10, 'Property Specifications', 'Brand Name', 'text', 'The Boho Lux', 'completed', now(), now()),
('bfd7314b-2bee-4717-b782-5dee2a102467', 10, 'Property Specifications', 'Property Type Detail', 'text', 'MTR', 'completed', now(), now()),
('bfd7314b-2bee-4717-b782-5dee2a102467', 10, 'Property Specifications', 'House Type', 'text', 'Townhouse', 'completed', now(), now()),
('bfd7314b-2bee-4717-b782-5dee2a102467', 10, 'Property Specifications', 'Stories', 'text', '2', 'completed', now(), now()),
('bfd7314b-2bee-4717-b782-5dee2a102467', 10, 'Property Specifications', 'Parking Type', 'text', '2 assigned parking spots, guest parking', 'completed', now(), now()),
('bfd7314b-2bee-4717-b782-5dee2a102467', 10, 'Property Specifications', 'School District', 'text', 'Teasley Elementary School', 'completed', now(), now()),
('bfd7314b-2bee-4717-b782-5dee2a102467', 10, 'Property Specifications', 'Middle School', 'text', 'Campbell Middle School', 'completed', now(), now()),
('bfd7314b-2bee-4717-b782-5dee2a102467', 10, 'Property Specifications', 'High School', 'text', 'Campbell High School', 'completed', now(), now()),
('bfd7314b-2bee-4717-b782-5dee2a102467', 10, 'Property Specifications', 'ADA Compliant', 'text', 'true', 'completed', now(), now()),
('bfd7314b-2bee-4717-b782-5dee2a102467', 10, 'Property Specifications', 'Fenced Yard', 'text', 'false', 'completed', now(), now()),
('bfd7314b-2bee-4717-b782-5dee2a102467', 10, 'Property Specifications', 'Bedrooms', 'text', '3', 'completed', now(), now()),
('bfd7314b-2bee-4717-b782-5dee2a102467', 10, 'Property Specifications', 'Bathrooms', 'text', '3.5', 'completed', now(), now()),
('bfd7314b-2bee-4717-b782-5dee2a102467', 10, 'Property Specifications', 'Square Footage', 'text', '1503', 'completed', now(), now()),
('bfd7314b-2bee-4717-b782-5dee2a102467', 11, 'Financial Terms', 'Monthly Rent', 'currency', '4200', 'completed', now(), now()),
('bfd7314b-2bee-4717-b782-5dee2a102467', 11, 'Financial Terms', 'Nightly Rate', 'currency', '140', 'completed', now(), now()),
('bfd7314b-2bee-4717-b782-5dee2a102467', 11, 'Financial Terms', 'Security Deposit', 'currency', '1000', 'completed', now(), now()),
('bfd7314b-2bee-4717-b782-5dee2a102467', 11, 'Financial Terms', 'Utility Cap', 'currency', '400', 'completed', now(), now()),
('bfd7314b-2bee-4717-b782-5dee2a102467', 11, 'Financial Terms', 'Cleaning Fee', 'currency', '300', 'completed', now(), now()),
('bfd7314b-2bee-4717-b782-5dee2a102467', 11, 'Financial Terms', 'Admin Fee', 'currency', '350', 'completed', now(), now()),
('bfd7314b-2bee-4717-b782-5dee2a102467', 11, 'Financial Terms', 'Pet Fee', 'currency', '300', 'completed', now(), now()),
('bfd7314b-2bee-4717-b782-5dee2a102467', 11, 'Financial Terms', 'Monthly Pet Rent', 'currency', '150', 'completed', now(), now()),
('bfd7314b-2bee-4717-b782-5dee2a102467', 11, 'Financial Terms', 'Monthly Cleaning Fee', 'currency', '150', 'completed', now(), now()),
('bfd7314b-2bee-4717-b782-5dee2a102467', 12, 'Pet Policies & Lease Terms', 'Pets Allowed', 'text', 'false', 'completed', now(), now()),
('bfd7314b-2bee-4717-b782-5dee2a102467', 12, 'Pet Policies & Lease Terms', 'Pet Rules', 'text', '1 dog max, up to 30 lbs', 'completed', now(), now()),
('bfd7314b-2bee-4717-b782-5dee2a102467', 12, 'Pet Policies & Lease Terms', 'Maximum Number of Pets', 'text', '1', 'completed', now(), now()),
('bfd7314b-2bee-4717-b782-5dee2a102467', 12, 'Pet Policies & Lease Terms', 'Maximum Pet Weight (lbs)', 'text', '30', 'completed', now(), now()),
('bfd7314b-2bee-4717-b782-5dee2a102467', 12, 'Pet Policies & Lease Terms', 'Lease Term', 'text', 'month to month', 'completed', now(), now()),
('bfd7314b-2bee-4717-b782-5dee2a102467', 12, 'Pet Policies & Lease Terms', 'Notice to Vacate', 'text', '30 days', 'completed', now(), now()),
('bfd7314b-2bee-4717-b782-5dee2a102467', 13, 'Contact Information', 'Contact Email', 'text', 'anja@peachhausgroup.com', 'completed', now(), now()),
('bfd7314b-2bee-4717-b782-5dee2a102467', 13, 'Contact Information', 'Direct Booking Website', 'text', 'www.boholuxeatlanta.com', 'completed', now(), now())
ON CONFLICT DO NOTHING;

-- Mableton Meadows (184 Woodland Ln SW, Mableton GA 30126)
INSERT INTO onboarding_tasks (project_id, phase_number, phase_title, title, field_type, field_value, status, created_at, updated_at)
VALUES 
('fec8f75a-3df8-433c-99ad-27db366a755d', 10, 'Property Specifications', 'Brand Name', 'text', 'Mableton Meadows', 'completed', now(), now()),
('fec8f75a-3df8-433c-99ad-27db366a755d', 10, 'Property Specifications', 'Property Type Detail', 'text', 'Hybrid', 'completed', now(), now()),
('fec8f75a-3df8-433c-99ad-27db366a755d', 10, 'Property Specifications', 'House Type', 'text', 'SFH', 'completed', now(), now()),
('fec8f75a-3df8-433c-99ad-27db366a755d', 10, 'Property Specifications', 'Stories', 'text', '2', 'completed', now(), now()),
('fec8f75a-3df8-433c-99ad-27db366a755d', 10, 'Property Specifications', 'Parking Type', 'text', 'driveway, up to 4 cars', 'completed', now(), now()),
('fec8f75a-3df8-433c-99ad-27db366a755d', 10, 'Property Specifications', 'School District', 'text', 'Clay-Harmony Leland Elementary School', 'completed', now(), now()),
('fec8f75a-3df8-433c-99ad-27db366a755d', 10, 'Property Specifications', 'Middle School', 'text', 'Lindley MS', 'completed', now(), now()),
('fec8f75a-3df8-433c-99ad-27db366a755d', 10, 'Property Specifications', 'High School', 'text', 'South Cobb HS', 'completed', now(), now()),
('fec8f75a-3df8-433c-99ad-27db366a755d', 10, 'Property Specifications', 'ADA Compliant', 'text', 'true', 'completed', now(), now()),
('fec8f75a-3df8-433c-99ad-27db366a755d', 10, 'Property Specifications', 'Fenced Yard', 'text', 'false', 'completed', now(), now()),
('fec8f75a-3df8-433c-99ad-27db366a755d', 10, 'Property Specifications', 'Bedrooms', 'text', '5', 'completed', now(), now()),
('fec8f75a-3df8-433c-99ad-27db366a755d', 10, 'Property Specifications', 'Bathrooms', 'text', '3', 'completed', now(), now()),
('fec8f75a-3df8-433c-99ad-27db366a755d', 10, 'Property Specifications', 'Square Footage', 'text', '3020', 'completed', now(), now()),
('fec8f75a-3df8-433c-99ad-27db366a755d', 11, 'Financial Terms', 'Monthly Rent', 'currency', '8850', 'completed', now(), now()),
('fec8f75a-3df8-433c-99ad-27db366a755d', 11, 'Financial Terms', 'Nightly Rate', 'currency', '295', 'completed', now(), now()),
('fec8f75a-3df8-433c-99ad-27db366a755d', 11, 'Financial Terms', 'Security Deposit', 'currency', '2000', 'completed', now(), now()),
('fec8f75a-3df8-433c-99ad-27db366a755d', 11, 'Financial Terms', 'Utility Cap', 'currency', '500', 'completed', now(), now()),
('fec8f75a-3df8-433c-99ad-27db366a755d', 11, 'Financial Terms', 'Cleaning Fee', 'currency', '450', 'completed', now(), now()),
('fec8f75a-3df8-433c-99ad-27db366a755d', 11, 'Financial Terms', 'Admin Fee', 'currency', '350', 'completed', now(), now()),
('fec8f75a-3df8-433c-99ad-27db366a755d', 11, 'Financial Terms', 'Pet Fee', 'currency', '300', 'completed', now(), now()),
('fec8f75a-3df8-433c-99ad-27db366a755d', 11, 'Financial Terms', 'Monthly Pet Rent', 'currency', '150', 'completed', now(), now()),
('fec8f75a-3df8-433c-99ad-27db366a755d', 11, 'Financial Terms', 'Monthly Cleaning Fee', 'currency', '200', 'completed', now(), now()),
('fec8f75a-3df8-433c-99ad-27db366a755d', 12, 'Pet Policies & Lease Terms', 'Pets Allowed', 'text', 'true', 'completed', now(), now()),
('fec8f75a-3df8-433c-99ad-27db366a755d', 12, 'Pet Policies & Lease Terms', 'Pet Rules', 'text', '2 dogs max, up to 40 lbs', 'completed', now(), now()),
('fec8f75a-3df8-433c-99ad-27db366a755d', 12, 'Pet Policies & Lease Terms', 'Maximum Number of Pets', 'text', '2', 'completed', now(), now()),
('fec8f75a-3df8-433c-99ad-27db366a755d', 12, 'Pet Policies & Lease Terms', 'Maximum Pet Weight (lbs)', 'text', '40', 'completed', now(), now()),
('fec8f75a-3df8-433c-99ad-27db366a755d', 12, 'Pet Policies & Lease Terms', 'Lease Term', 'text', '2 months min.', 'completed', now(), now()),
('fec8f75a-3df8-433c-99ad-27db366a755d', 12, 'Pet Policies & Lease Terms', 'Notice to Vacate', 'text', '30 days', 'completed', now(), now()),
('fec8f75a-3df8-433c-99ad-27db366a755d', 13, 'Contact Information', 'Contact Email', 'text', 'anja@peachhausgroup.com', 'completed', now(), now()),
('fec8f75a-3df8-433c-99ad-27db366a755d', 13, 'Contact Information', 'Direct Booking Website', 'text', 'https://www.mabletonmeadows.com', 'completed', now(), now())
ON CONFLICT DO NOTHING;
