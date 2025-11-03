-- Add billing tracking columns to visits table
ALTER TABLE visits 
ADD COLUMN IF NOT EXISTS billed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reconciliation_id UUID REFERENCES monthly_reconciliations(id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_visits_billed ON visits(billed);
CREATE INDEX IF NOT EXISTS idx_visits_reconciliation_id ON visits(reconciliation_id);

-- Backfill billed status from existing reconciliation line items
UPDATE visits v
SET billed = true,
    reconciliation_id = rli.reconciliation_id
FROM reconciliation_line_items rli
WHERE rli.item_id = v.id 
AND rli.item_type = 'visit'
AND v.billed = false;