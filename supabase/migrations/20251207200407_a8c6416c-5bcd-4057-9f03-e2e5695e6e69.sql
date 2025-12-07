-- Add revenue_override column for manual adjustment cases (e.g., tenant didn't pay)
ALTER TABLE public.monthly_reconciliations 
ADD COLUMN IF NOT EXISTS revenue_override numeric DEFAULT NULL;

-- Add comment explaining the column's purpose
COMMENT ON COLUMN public.monthly_reconciliations.revenue_override IS 'Manual override for booking revenue when tenant has not paid or paid partially. When set, this value is used instead of calculated booking revenue for management fee calculations.';