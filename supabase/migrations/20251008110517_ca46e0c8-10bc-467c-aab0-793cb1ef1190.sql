-- Add category and exported fields to expenses table
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS category text,
ADD COLUMN IF NOT EXISTS exported boolean DEFAULT false;

-- Add category and exported fields to monthly_charges table
ALTER TABLE public.monthly_charges 
ADD COLUMN IF NOT EXISTS category text DEFAULT 'Management Fee',
ADD COLUMN IF NOT EXISTS exported boolean DEFAULT false;