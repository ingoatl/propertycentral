-- Add GHL contact ID to leads table for tracking synced contacts
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ghl_contact_id text;

-- Add Google Drive URL columns for agreement backup
ALTER TABLE booking_documents ADD COLUMN IF NOT EXISTS google_drive_url text;
ALTER TABLE management_agreements ADD COLUMN IF NOT EXISTS google_drive_url text;

-- Delete test property_owners (verified no dependent records)
DELETE FROM property_owners 
WHERE id IN (
  'fc05a9a6-0f74-423f-b2a4-b64f107599ff',
  '3acea4ce-56b3-4821-817b-a4d091e7b102',
  '00b32bdc-b032-4747-8a80-d057b8e17d2f',
  'b659b658-2683-43b7-8bcf-93a06f7becfe',
  '1937f266-749d-4811-8caf-605e58236f34'
);

-- Delete test lead
DELETE FROM leads WHERE id = '26dd9d3b-6075-4a76-999a-d05dae9d472c';