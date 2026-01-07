-- Add 'inspection_scheduled' to lead_stage enum (before ops_handoff)
ALTER TYPE lead_stage ADD VALUE IF NOT EXISTS 'inspection_scheduled' BEFORE 'ops_handoff';

-- Add inspection tracking fields to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS inspection_date timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS inspection_calendar_event_id text;