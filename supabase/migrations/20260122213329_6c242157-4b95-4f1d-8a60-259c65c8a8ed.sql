-- Add photos_walkthrough to the lead_stage enum
ALTER TYPE lead_stage ADD VALUE IF NOT EXISTS 'photos_walkthrough' AFTER 'inspection_scheduled';