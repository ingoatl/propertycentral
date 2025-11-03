-- Add visit_fees column to monthly_reconciliations table
ALTER TABLE public.monthly_reconciliations 
ADD COLUMN visit_fees NUMERIC DEFAULT 0 NOT NULL;