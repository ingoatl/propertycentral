-- Add unique constraint on owner_marketing_activities for external_id + source_project
-- This enables proper upsert behavior

-- First drop the existing partial unique index
DROP INDEX IF EXISTS idx_marketing_activities_external;

-- Create a proper unique constraint (not partial, to support all upserts)
ALTER TABLE public.owner_marketing_activities 
ADD CONSTRAINT owner_marketing_activities_external_unique 
UNIQUE (external_id, source_project);