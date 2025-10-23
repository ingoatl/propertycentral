-- Add hours column to visits table for hourly tracking
ALTER TABLE visits ADD COLUMN hours numeric DEFAULT 1;