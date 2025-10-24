
-- Clean up duplicate NULL tasks for Villa 15 and add missing data for both properties

-- Delete NULL duplicate tasks for Villa 15
DELETE FROM onboarding_tasks
WHERE project_id = '7476e31d-9ceb-4c91-ad1a-4a77f70d90a9'
AND field_value IS NULL
AND phase_number BETWEEN 10 AND 14;

-- Delete NULL tasks for Timberlake
DELETE FROM onboarding_tasks
WHERE project_id = '124cbeb2-9fc6-40dd-9b40-6f78a4ef5449'
AND field_value IS NULL
AND phase_number BETWEEN 10 AND 14;

-- Now insert complete data for Timberlake (3384 Timber Lake Rd) - Line 69
INSERT INTO onboarding_tasks (project_id, phase_number, phase_title, title, field_type, field_value, status, created_at, updated_at)
VALUES 
('124cbeb2-9fc6-40dd-9b40-6f78a4ef5449', 10, 'Property Specifications', 'Property Type Detail', 'text', 'Hybrid', 'completed', now(), now()),
('124cbeb2-9fc6-40dd-9b40-6f78a4ef5449', 10, 'Property Specifications', 'House Type', 'text', 'SFH', 'completed', now(), now()),
('124cbeb2-9fc6-40dd-9b40-6f78a4ef5449', 10, 'Property Specifications', 'Stories', 'text', '1', 'completed', now(), now()),
('124cbeb2-9fc6-40dd-9b40-6f78a4ef5449', 10, 'Property Specifications', 'Parking Type', 'text', 'carport for 2 cars, driveway parking for 2 cars', 'completed', now(), now()),
('124cbeb2-9fc6-40dd-9b40-6f78a4ef5449', 10, 'Property Specifications', 'ADA Compliant', 'text', 'false', 'completed', now(), now()),
('124cbeb2-9fc6-40dd-9b40-6f78a4ef5449', 10, 'Property Specifications', 'Fenced Yard', 'text', 'partially fenced in', 'completed', now(), now()),
('124cbeb2-9fc6-40dd-9b40-6f78a4ef5449', 11, 'Financial Terms', 'Security Deposit', 'currency', '1500', 'completed', now(), now()),
('124cbeb2-9fc6-40dd-9b40-6f78a4ef5449', 11, 'Financial Terms', 'Utility Cap', 'currency', '500', 'completed', now(), now()),
('124cbeb2-9fc6-40dd-9b40-6f78a4ef5449', 11, 'Financial Terms', 'Cleaning Fee', 'currency', '450', 'completed', now(), now()),
('124cbeb2-9fc6-40dd-9b40-6f78a4ef5449', 11, 'Financial Terms', 'Admin Fee', 'currency', '350', 'completed', now(), now()),
('124cbeb2-9fc6-40dd-9b40-6f78a4ef5449', 12, 'Pet Policies & Lease Terms', 'Lease Term', 'text', 'month to month', 'completed', now(), now()),
('124cbeb2-9fc6-40dd-9b40-6f78a4ef5449', 12, 'Pet Policies & Lease Terms', 'Notice to Vacate', 'text', '30 days', 'completed', now(), now()),
('124cbeb2-9fc6-40dd-9b40-6f78a4ef5449', 13, 'Contact Information', 'Contact Email', 'text', 'anja@peachhausgroup.com', 'completed', now(), now()),
('124cbeb2-9fc6-40dd-9b40-6f78a4ef5449', 13, 'Contact Information', 'Contact Phone', 'text', '470-863-8087', 'completed', now(), now())
ON CONFLICT DO NOTHING;
