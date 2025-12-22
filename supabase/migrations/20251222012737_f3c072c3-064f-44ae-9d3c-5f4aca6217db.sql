-- Make phone column nullable since many vendor emails don't contain phone numbers
ALTER TABLE public.vendors ALTER COLUMN phone DROP NOT NULL;