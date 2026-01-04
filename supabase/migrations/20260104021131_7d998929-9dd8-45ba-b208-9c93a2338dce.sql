-- Add receipt_path column to visits table for storing generated receipt PDFs
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS receipt_path TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.visits.receipt_path IS 'Path to auto-generated PDF receipt stored in expense-documents bucket';