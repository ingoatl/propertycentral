
-- Add match_method column to track how readings were matched
ALTER TABLE utility_readings ADD COLUMN IF NOT EXISTS match_method text;

-- Update existing SCANA readings to have correct provider
UPDATE utility_readings SET provider = 'SCANA Energy' WHERE provider = 'SCANA';
