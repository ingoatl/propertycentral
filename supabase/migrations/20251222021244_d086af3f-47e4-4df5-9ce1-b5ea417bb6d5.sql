-- Add Bill.com integration fields to vendors table
ALTER TABLE public.vendors 
ADD COLUMN IF NOT EXISTS billcom_vendor_id text,
ADD COLUMN IF NOT EXISTS billcom_synced_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS billcom_invite_sent_at timestamp with time zone;

-- Add Bill.com integration fields to work_orders table
ALTER TABLE public.work_orders 
ADD COLUMN IF NOT EXISTS billcom_bill_id text,
ADD COLUMN IF NOT EXISTS billcom_invoice_url text,
ADD COLUMN IF NOT EXISTS billcom_payment_status text;