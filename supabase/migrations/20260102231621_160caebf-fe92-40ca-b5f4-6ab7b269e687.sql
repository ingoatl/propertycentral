-- Add monthly_cost column to property_vendor_assignments
ALTER TABLE property_vendor_assignments 
ADD COLUMN IF NOT EXISTS monthly_cost numeric DEFAULT 0;

-- Update Crew Support Team vendor specialty to valet_trash
UPDATE vendors SET specialty = ARRAY['valet_trash'] 
WHERE id = 'fb65bd2c-6228-4c84-8c03-345f41f2df15';

-- Insert 8 active Valet Trash service assignments
INSERT INTO property_vendor_assignments 
(property_id, vendor_id, specialty, monthly_cost, notes)
VALUES
  ('9904f14f-4cf0-44d7-bc3e-1207bcc28a34', 'fb65bd2c-6228-4c84-8c03-345f41f2df15', 'valet_trash', 30, 'Active Valet Trash service - bins rolled out/in for trash pickup'),
  ('96e2819b-c0e8-4281-b535-5c99c39973b3', 'fb65bd2c-6228-4c84-8c03-345f41f2df15', 'valet_trash', 30, 'Active Valet Trash service - bins rolled out/in for trash pickup'),
  ('fa81c7ec-7e9b-48ab-aa8c-d2ddf41eea9b', 'fb65bd2c-6228-4c84-8c03-345f41f2df15', 'valet_trash', 30, 'Active Valet Trash service - bins rolled out/in for trash pickup'),
  ('9f7f6d4d-9873-46be-926f-c5a48863a946', 'fb65bd2c-6228-4c84-8c03-345f41f2df15', 'valet_trash', 30, 'Active Valet Trash service - bins rolled out/in for trash pickup'),
  ('695bfc2a-4187-4377-8e25-18aa2fcd0454', 'fb65bd2c-6228-4c84-8c03-345f41f2df15', 'valet_trash', 30, 'Active Valet Trash service - bins rolled out/in for trash pickup'),
  ('6c80c23b-997a-45af-8702-aeb7a7cf3e81', 'fb65bd2c-6228-4c84-8c03-345f41f2df15', 'valet_trash', 30, 'Active Valet Trash service - bins rolled out/in for trash pickup'),
  ('54536b8d-9b6f-41f8-855f-3c4eb78aaf00', 'fb65bd2c-6228-4c84-8c03-345f41f2df15', 'valet_trash', 30, 'Active Valet Trash service - bins rolled out/in for trash pickup'),
  ('6ffe191b-d85c-44f3-b91b-f8d38bee16b4', 'fb65bd2c-6228-4c84-8c03-345f41f2df15', 'valet_trash', 30, 'Active Valet Trash service - bins rolled out/in for trash pickup')
ON CONFLICT DO NOTHING;