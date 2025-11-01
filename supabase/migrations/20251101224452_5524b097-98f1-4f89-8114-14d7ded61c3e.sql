-- Add return tracking columns to expenses table
ALTER TABLE expenses ADD COLUMN is_return BOOLEAN DEFAULT false;
ALTER TABLE expenses ADD COLUMN parent_expense_id UUID REFERENCES expenses(id);
ALTER TABLE expenses ADD COLUMN return_reason TEXT;
ALTER TABLE expenses ADD COLUMN refund_amount NUMERIC;

-- Add index for parent expense lookups
CREATE INDEX idx_expenses_parent_expense_id ON expenses(parent_expense_id);

-- Add comments for documentation
COMMENT ON COLUMN expenses.is_return IS 'Indicates if this expense record represents a return/refund';
COMMENT ON COLUMN expenses.parent_expense_id IS 'References the original expense if this is a return';
COMMENT ON COLUMN expenses.return_reason IS 'Reason for the return (e.g., Damaged, Wrong item, No longer needed)';
COMMENT ON COLUMN expenses.refund_amount IS 'Amount refunded (positive value, even though expense amount is negative)';