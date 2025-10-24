
-- Insert complete listing data for ALL Client-Managed properties

-- Canadian Way (3708 Canadian Way, Tucker, GA) - Line 64 "The Maple Leaf"
INSERT INTO onboarding_tasks (project_id, phase_number, phase_title, title, field_type, field_value, status, created_at, updated_at)
VALUES 
('b0e7e046-4119-4846-a927-878729098f28', 10, 'Property Specifications', 'Brand Name', 'text', 'The Maple Leaf', 'completed', now(), now()),
('b0e7e046-4119-4846-a927-878729098f28', 10, 'Property Specifications', 'Property Type Detail', 'text', 'Hybrid', 'completed', now(), now()),
('b0e7e046-4119-4846-a927-878729098f28', 10, 'Property Specifications', 'House Type', 'text', 'SFH', 'completed', now(), now()),
('b0e7e046-4119-4846-a927-878729098f28', 10, 'Property Specifications', 'Stories', 'text', '1', 'completed', now(), now()),
('b0e7e046-4119-4846-a927-878729098f28', 10, 'Property Specifications', 'Parking Type', 'text', '2 car garage, driveway parking for 2 cars', 'completed', now(), now()),
('b0e7e046-4119-4846-a927-878729098f28', 10, 'Property Specifications', 'ADA Compliant', 'text', 'false', 'completed', now(), now()),
('b0e7e046-4119-4846-a927-878729098f28', 10, 'Property Specifications', 'Fenced Yard', 'text', 'true', 'completed', now(), now()),
('b0e7e046-4119-4846-a927-878729098f28', 10, 'Property Specifications', 'Bedrooms', 'text', '5', 'completed', now(), now()),
('b0e7e046-4119-4846-a927-878729098f28', 10, 'Property Specifications', 'Bathrooms', 'text', '2.5', 'completed', now(), now()),
('b0e7e046-4119-4846-a927-878729098f28', 10, 'Property Specifications', 'Square Footage', 'text', '2400', 'completed', now(), now()),
('b0e7e046-4119-4846-a927-878729098f28', 11, 'Financial Terms', 'Security Deposit', 'currency', '1500', 'completed', now(), now()),
('b0e7e046-4119-4846-a927-878729098f28', 11, 'Financial Terms', 'Utility Cap', 'currency', '500', 'completed', now(), now()),
('b0e7e046-4119-4846-a927-878729098f28', 11, 'Financial Terms', 'Cleaning Fee', 'currency', '450', 'completed', now(), now()),
('b0e7e046-4119-4846-a927-878729098f28', 11, 'Financial Terms', 'Admin Fee', 'currency', '350', 'completed', now(), now()),
('b0e7e046-4119-4846-a927-878729098f28', 11, 'Financial Terms', 'Pet Fee', 'currency', '300', 'completed', now(), now()),
('b0e7e046-4119-4846-a927-878729098f28', 11, 'Financial Terms', 'Monthly Pet Rent', 'currency', '150', 'completed', now(), now()),
('b0e7e046-4119-4846-a927-878729098f28', 11, 'Financial Terms', 'Monthly Cleaning Fee', 'currency', '150', 'completed', now(), now()),
('b0e7e046-4119-4846-a927-878729098f28', 12, 'Pet Policies & Lease Terms', 'Pets Allowed', 'text', 'true', 'completed', now(), now()),
('b0e7e046-4119-4846-a927-878729098f28', 12, 'Pet Policies & Lease Terms', 'Pet Rules', 'text', '1 dog, up to 35 lbs', 'completed', now(), now()),
('b0e7e046-4119-4846-a927-878729098f28', 12, 'Pet Policies & Lease Terms', 'Maximum Number of Pets', 'text', '1', 'completed', now(), now()),
('b0e7e046-4119-4846-a927-878729098f28', 12, 'Pet Policies & Lease Terms', 'Maximum Pet Weight (lbs)', 'text', '35', 'completed', now(), now()),
('b0e7e046-4119-4846-a927-878729098f28', 12, 'Pet Policies & Lease Terms', 'Lease Term', 'text', 'month to month', 'completed', now(), now()),
('b0e7e046-4119-4846-a927-878729098f28', 12, 'Pet Policies & Lease Terms', 'Notice to Vacate', 'text', '30 days', 'completed', now(), now()),
('b0e7e046-4119-4846-a927-878729098f28', 13, 'Contact Information', 'Contact Email', 'text', 'anja@peachhausgroup.com', 'completed', now(), now()),
('b0e7e046-4119-4846-a927-878729098f28', 13, 'Contact Information', 'Contact Phone', 'text', '470-863-8087', 'completed', now(), now())
ON CONFLICT DO NOTHING;

-- Villa Ct SE - Unit 15 (House of Blues) - Line 49
INSERT INTO onboarding_tasks (project_id, phase_number, phase_title, title, field_type, field_value, status, created_at, updated_at)
VALUES 
('7476e31d-9ceb-4c91-ad1a-4a77f70d90a9', 10, 'Property Specifications', 'Brand Name', 'text', 'House of Blues', 'completed', now(), now()),
('7476e31d-9ceb-4c91-ad1a-4a77f70d90a9', 10, 'Property Specifications', 'Property Type Detail', 'text', 'MTR', 'completed', now(), now()),
('7476e31d-9ceb-4c91-ad1a-4a77f70d90a9', 10, 'Property Specifications', 'House Type', 'text', 'Townhouse', 'completed', now(), now()),
('7476e31d-9ceb-4c91-ad1a-4a77f70d90a9', 10, 'Property Specifications', 'Stories', 'text', '2', 'completed', now(), now()),
('7476e31d-9ceb-4c91-ad1a-4a77f70d90a9', 10, 'Property Specifications', 'Parking Type', 'text', '2 assigned parking spots, guest parking', 'completed', now(), now()),
('7476e31d-9ceb-4c91-ad1a-4a77f70d90a9', 10, 'Property Specifications', 'School District', 'text', 'Teasley Elementary School', 'completed', now(), now()),
('7476e31d-9ceb-4c91-ad1a-4a77f70d90a9', 10, 'Property Specifications', 'Middle School', 'text', 'Campbell Middle School', 'completed', now(), now()),
('7476e31d-9ceb-4c91-ad1a-4a77f70d90a9', 10, 'Property Specifications', 'High School', 'text', 'Campbell High School', 'completed', now(), now()),
('7476e31d-9ceb-4c91-ad1a-4a77f70d90a9', 10, 'Property Specifications', 'ADA Compliant', 'text', 'false', 'completed', now(), now()),
('7476e31d-9ceb-4c91-ad1a-4a77f70d90a9', 10, 'Property Specifications', 'Basement', 'text', 'true', 'completed', now(), now()),
('7476e31d-9ceb-4c91-ad1a-4a77f70d90a9', 10, 'Property Specifications', 'Fenced Yard', 'text', 'false', 'completed', now(), now()),
('7476e31d-9ceb-4c91-ad1a-4a77f70d90a9', 10, 'Property Specifications', 'Bedrooms', 'text', '2', 'completed', now(), now()),
('7476e31d-9ceb-4c91-ad1a-4a77f70d90a9', 10, 'Property Specifications', 'Bathrooms', 'text', '2.5', 'completed', now(), now()),
('7476e31d-9ceb-4c91-ad1a-4a77f70d90a9', 10, 'Property Specifications', 'Square Footage', 'text', '1516', 'completed', now(), now()),
('7476e31d-9ceb-4c91-ad1a-4a77f70d90a9', 11, 'Financial Terms', 'Monthly Rent', 'currency', '3840', 'completed', now(), now()),
('7476e31d-9ceb-4c91-ad1a-4a77f70d90a9', 11, 'Financial Terms', 'Nightly Rate', 'currency', '128', 'completed', now(), now()),
('7476e31d-9ceb-4c91-ad1a-4a77f70d90a9', 11, 'Financial Terms', 'Security Deposit', 'currency', '1000', 'completed', now(), now()),
('7476e31d-9ceb-4c91-ad1a-4a77f70d90a9', 11, 'Financial Terms', 'Utility Cap', 'currency', '400', 'completed', now(), now()),
('7476e31d-9ceb-4c91-ad1a-4a77f70d90a9', 11, 'Financial Terms', 'Cleaning Fee', 'currency', '300', 'completed', now(), now()),
('7476e31d-9ceb-4c91-ad1a-4a77f70d90a9', 11, 'Financial Terms', 'Admin Fee', 'currency', '350', 'completed', now(), now()),
('7476e31d-9ceb-4c91-ad1a-4a77f70d90a9', 11, 'Financial Terms', 'Pet Fee', 'currency', '300', 'completed', now(), now()),
('7476e31d-9ceb-4c91-ad1a-4a77f70d90a9', 11, 'Financial Terms', 'Monthly Pet Rent', 'currency', '150', 'completed', now(), now()),
('7476e31d-9ceb-4c91-ad1a-4a77f70d90a9', 11, 'Financial Terms', 'Monthly Cleaning Fee', 'currency', '140', 'completed', now(), now()),
('7476e31d-9ceb-4c91-ad1a-4a77f70d90a9', 12, 'Pet Policies & Lease Terms', 'Pets Allowed', 'text', 'false', 'completed', now(), now()),
('7476e31d-9ceb-4c91-ad1a-4a77f70d90a9', 12, 'Pet Policies & Lease Terms', 'Pet Rules', 'text', '1 dog max, up to 30 lbs', 'completed', now(), now()),
('7476e31d-9ceb-4c91-ad1a-4a77f70d90a9', 12, 'Pet Policies & Lease Terms', 'Maximum Number of Pets', 'text', '1', 'completed', now(), now()),
('7476e31d-9ceb-4c91-ad1a-4a77f70d90a9', 12, 'Pet Policies & Lease Terms', 'Maximum Pet Weight (lbs)', 'text', '30', 'completed', now(), now()),
('7476e31d-9ceb-4c91-ad1a-4a77f70d90a9', 12, 'Pet Policies & Lease Terms', 'Lease Term', 'text', 'month to month', 'completed', now(), now()),
('7476e31d-9ceb-4c91-ad1a-4a77f70d90a9', 12, 'Pet Policies & Lease Terms', 'Notice to Vacate', 'text', '30 days', 'completed', now(), now()),
('7476e31d-9ceb-4c91-ad1a-4a77f70d90a9', 13, 'Contact Information', 'Contact Email', 'text', 'anja@peachhausgroup.com', 'completed', now(), now()),
('7476e31d-9ceb-4c91-ad1a-4a77f70d90a9', 13, 'Contact Information', 'Contact Phone', 'text', '470-863-8087', 'completed', now(), now()),
('7476e31d-9ceb-4c91-ad1a-4a77f70d90a9', 13, 'Contact Information', 'Direct Booking Website', 'text', 'www.houseofbluesatlanta.com', 'completed', now(), now())
ON CONFLICT DO NOTHING;

-- Smoke Hollow (The Berkley at Chimney Lakes) - Line 59
INSERT INTO onboarding_tasks (project_id, phase_number, phase_title, title, field_type, field_value, status, created_at, updated_at)
VALUES 
('5a61e899-41c7-456c-a7ac-065abd87b294', 10, 'Property Specifications', 'Brand Name', 'text', 'The Berkley at Chimney Lakes', 'completed', now(), now()),
('5a61e899-41c7-456c-a7ac-065abd87b294', 10, 'Property Specifications', 'Property Type Detail', 'text', 'MTR', 'completed', now(), now()),
('5a61e899-41c7-456c-a7ac-065abd87b294', 10, 'Property Specifications', 'House Type', 'text', 'SFH', 'completed', now(), now()),
('5a61e899-41c7-456c-a7ac-065abd87b294', 10, 'Property Specifications', 'Stories', 'text', '2', 'completed', now(), now()),
('5a61e899-41c7-456c-a7ac-065abd87b294', 10, 'Property Specifications', 'Parking Type', 'text', '2 car garage, driveway parking for up to 4 cars', 'completed', now(), now()),
('5a61e899-41c7-456c-a7ac-065abd87b294', 10, 'Property Specifications', 'ADA Compliant', 'text', 'true', 'completed', now(), now()),
('5a61e899-41c7-456c-a7ac-065abd87b294', 10, 'Property Specifications', 'Basement', 'text', 'true', 'completed', now(), now()),
('5a61e899-41c7-456c-a7ac-065abd87b294', 10, 'Property Specifications', 'Fenced Yard', 'text', 'false', 'completed', now(), now()),
('5a61e899-41c7-456c-a7ac-065abd87b294', 10, 'Property Specifications', 'Bedrooms', 'text', '5', 'completed', now(), now()),
('5a61e899-41c7-456c-a7ac-065abd87b294', 10, 'Property Specifications', 'Bathrooms', 'text', '3.5', 'completed', now(), now()),
('5a61e899-41c7-456c-a7ac-065abd87b294', 10, 'Property Specifications', 'Square Footage', 'text', '3900', 'completed', now(), now()),
('5a61e899-41c7-456c-a7ac-065abd87b294', 11, 'Financial Terms', 'Monthly Rent', 'currency', '9420', 'completed', now(), now()),
('5a61e899-41c7-456c-a7ac-065abd87b294', 11, 'Financial Terms', 'Nightly Rate', 'currency', '314', 'completed', now(), now()),
('5a61e899-41c7-456c-a7ac-065abd87b294', 11, 'Financial Terms', 'Security Deposit', 'currency', '1500', 'completed', now(), now()),
('5a61e899-41c7-456c-a7ac-065abd87b294', 11, 'Financial Terms', 'Utility Cap', 'currency', '600', 'completed', now(), now()),
('5a61e899-41c7-456c-a7ac-065abd87b294', 11, 'Financial Terms', 'Cleaning Fee', 'currency', '500', 'completed', now(), now()),
('5a61e899-41c7-456c-a7ac-065abd87b294', 11, 'Financial Terms', 'Admin Fee', 'currency', '450', 'completed', now(), now()),
('5a61e899-41c7-456c-a7ac-065abd87b294', 11, 'Financial Terms', 'Pet Fee', 'currency', '300', 'completed', now(), now()),
('5a61e899-41c7-456c-a7ac-065abd87b294', 11, 'Financial Terms', 'Monthly Pet Rent', 'currency', '150', 'completed', now(), now()),
('5a61e899-41c7-456c-a7ac-065abd87b294', 11, 'Financial Terms', 'Monthly Cleaning Fee', 'currency', '200', 'completed', now(), now()),
('5a61e899-41c7-456c-a7ac-065abd87b294', 12, 'Pet Policies & Lease Terms', 'Pets Allowed', 'text', 'true', 'completed', now(), now()),
('5a61e899-41c7-456c-a7ac-065abd87b294', 12, 'Pet Policies & Lease Terms', 'Pet Rules', 'text', '1 dog max, up to 40 lbs', 'completed', now(), now()),
('5a61e899-41c7-456c-a7ac-065abd87b294', 12, 'Pet Policies & Lease Terms', 'Maximum Number of Pets', 'text', '1', 'completed', now(), now()),
('5a61e899-41c7-456c-a7ac-065abd87b294', 12, 'Pet Policies & Lease Terms', 'Maximum Pet Weight (lbs)', 'text', '40', 'completed', now(), now()),
('5a61e899-41c7-456c-a7ac-065abd87b294', 12, 'Pet Policies & Lease Terms', 'Lease Term', 'text', '2 months min.', 'completed', now(), now()),
('5a61e899-41c7-456c-a7ac-065abd87b294', 12, 'Pet Policies & Lease Terms', 'Notice to Vacate', 'text', '30 days', 'completed', now(), now()),
('5a61e899-41c7-456c-a7ac-065abd87b294', 13, 'Contact Information', 'Contact Email', 'text', 'anja@peachhausgroup.com', 'completed', now(), now()),
('5a61e899-41c7-456c-a7ac-065abd87b294', 13, 'Contact Information', 'Contact Phone', 'text', '470-863-8087', 'completed', now(), now())
ON CONFLICT DO NOTHING;
