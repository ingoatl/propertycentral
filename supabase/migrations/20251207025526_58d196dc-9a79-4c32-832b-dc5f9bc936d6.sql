-- Add billed column to expenses table to track which expenses have been included in owner statements
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS billed boolean DEFAULT false;

-- Add reconciliation_id to expenses for tracking which reconciliation included this expense
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS reconciliation_id uuid REFERENCES public.monthly_reconciliations(id);

-- Create index for faster queries on unbilled expenses
CREATE INDEX IF NOT EXISTS idx_expenses_billed ON public.expenses(billed) WHERE billed = false;
CREATE INDEX IF NOT EXISTS idx_visits_billed ON public.visits(billed) WHERE billed = false;