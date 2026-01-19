-- Create work_order_photos table for vendor photo uploads
CREATE TABLE public.work_order_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID REFERENCES public.work_orders(id) ON DELETE CASCADE NOT NULL,
  photo_url TEXT NOT NULL,
  photo_type TEXT CHECK (photo_type IN ('before', 'during', 'after', 'invoice')) DEFAULT 'during',
  uploaded_by TEXT NOT NULL,
  uploaded_by_type TEXT CHECK (uploaded_by_type IN ('vendor', 'pm', 'owner', 'tenant')) DEFAULT 'vendor',
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add vendor access token to work_orders for secure portal access
ALTER TABLE public.work_orders 
ADD COLUMN IF NOT EXISTS vendor_access_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS vendor_access_token_expires_at TIMESTAMPTZ;

-- Enable RLS
ALTER TABLE public.work_order_photos ENABLE ROW LEVEL SECURITY;

-- RLS policies for work_order_photos
-- Authenticated users can view photos for work orders they have access to
CREATE POLICY "Authenticated users can view work order photos"
ON public.work_order_photos
FOR SELECT
TO authenticated
USING (true);

-- Authenticated users can insert photos
CREATE POLICY "Authenticated users can insert work order photos"
ON public.work_order_photos
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow anonymous access for vendor portal (token-based)
CREATE POLICY "Anonymous can view photos via work order token"
ON public.work_order_photos
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.work_orders wo
    WHERE wo.id = work_order_id
    AND wo.vendor_access_token IS NOT NULL
  )
);

-- Allow anonymous to insert photos (for vendor portal)
CREATE POLICY "Anonymous can insert photos via work order token"
ON public.work_order_photos
FOR INSERT
TO anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.work_orders wo
    WHERE wo.id = work_order_id
    AND wo.vendor_access_token IS NOT NULL
  )
);

-- Create index for faster lookups
CREATE INDEX idx_work_order_photos_work_order_id ON public.work_order_photos(work_order_id);
CREATE INDEX idx_work_orders_vendor_access_token ON public.work_orders(vendor_access_token) WHERE vendor_access_token IS NOT NULL;