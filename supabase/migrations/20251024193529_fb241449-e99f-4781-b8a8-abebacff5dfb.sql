
-- Add Elementary School data for all properties from CSV

-- Villa Ct SE - Unit 15 (House of Blues) - needs Elementary
INSERT INTO onboarding_tasks (project_id, phase_number, phase_title, title, field_type, field_value, status, created_at, updated_at)
VALUES 
('7476e31d-9ceb-4c91-ad1a-4a77f70d90a9', 10, 'Property Specifications', 'Elementary School', 'text', 'Teasley Elementary School', 'completed', now(), now())
ON CONFLICT DO NOTHING;

-- Mableton Meadows - needs Elementary
INSERT INTO onboarding_tasks (project_id, phase_number, phase_title, title, field_type, field_value, status, created_at, updated_at)
VALUES 
('fec8f75a-3df8-433c-99ad-27db366a755d', 10, 'Property Specifications', 'Elementary School', 'text', 'Clay-Harmony Leland Elementary School', 'completed', now(), now())
ON CONFLICT DO NOTHING;

-- Villa Ct SE - Unit 14 (The Boho Lux) - add Elementary to match Middle/High
INSERT INTO onboarding_tasks (project_id, phase_number, phase_title, title, field_type, field_value, status, created_at, updated_at)
VALUES 
('bfd7314b-2bee-4717-b782-5dee2a102467', 10, 'Property Specifications', 'Elementary School', 'text', 'Teasley Elementary School', 'completed', now(), now())
ON CONFLICT DO NOTHING;

-- Smoke Hollow (The Berkley) - needs all 3 schools (no school district in CSV)
-- No schools listed in CSV for this property

-- Canadian Way (The Maple Leaf) - no schools in CSV

-- Muirfield - no schools in CSV

-- Timberlake - no schools in CSV
