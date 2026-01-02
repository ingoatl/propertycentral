-- Add unique constraint for the ON CONFLICT clause used in auto_add triggers
CREATE UNIQUE INDEX IF NOT EXISTS idx_reconciliation_line_items_unique_item
ON public.reconciliation_line_items (reconciliation_id, item_type, item_id)
WHERE item_id IS NOT NULL;