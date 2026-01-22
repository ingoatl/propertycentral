-- Add is_archived column to property_owners for former clients
ALTER TABLE public.property_owners 
ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false;

-- Add index for filtering
CREATE INDEX IF NOT EXISTS idx_property_owners_archived ON public.property_owners(is_archived);

-- Add comment
COMMENT ON COLUMN public.property_owners.is_archived IS 'If true, owner is a former client but records are kept for tax purposes';