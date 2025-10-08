-- Add receipt_path column to monthly_charges table for uploading charge receipts
ALTER TABLE public.monthly_charges
ADD COLUMN IF NOT EXISTS receipt_path text;