-- Drop the partial index that doesn't work with ON CONFLICT
DROP INDEX IF EXISTS idx_reconciliation_line_items_unique_item;

-- Create a proper unique constraint that works with ON CONFLICT
-- First, handle any existing duplicates by keeping only the first entry
DELETE FROM public.reconciliation_line_items a
USING public.reconciliation_line_items b
WHERE a.id > b.id
  AND a.reconciliation_id = b.reconciliation_id
  AND a.item_type = b.item_type
  AND a.item_id = b.item_id
  AND a.item_id IS NOT NULL;

-- Create regular unique index (not partial) for non-null item_ids
-- Use a COALESCE to handle the constraint properly
ALTER TABLE public.reconciliation_line_items 
ADD CONSTRAINT reconciliation_line_items_unique_item 
UNIQUE (reconciliation_id, item_type, item_id);