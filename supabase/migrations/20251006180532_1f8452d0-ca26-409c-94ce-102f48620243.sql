-- Create ownerrez_bookings table to store booking and revenue data
CREATE TABLE public.ownerrez_bookings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE,
  ownerrez_listing_id text NOT NULL,
  ownerrez_listing_name text NOT NULL,
  booking_id text,
  guest_name text,
  check_in date,
  check_out date,
  total_amount numeric NOT NULL DEFAULT 0,
  management_fee numeric NOT NULL DEFAULT 0,
  booking_status text,
  sync_date timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ownerrez_bookings ENABLE ROW LEVEL SECURITY;

-- Approved users can view all bookings
CREATE POLICY "Approved users can view all bookings"
ON public.ownerrez_bookings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'::account_status
  )
);

-- Admins can insert bookings (via edge function)
CREATE POLICY "Admins can insert bookings"
ON public.ownerrez_bookings
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
);

-- Admins can update bookings
CREATE POLICY "Admins can update bookings"
ON public.ownerrez_bookings
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
);

-- Admins can delete bookings
CREATE POLICY "Admins can delete bookings"
ON public.ownerrez_bookings
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role)
);

-- Create index for faster queries
CREATE INDEX idx_ownerrez_bookings_property_id ON public.ownerrez_bookings(property_id);
CREATE INDEX idx_ownerrez_bookings_sync_date ON public.ownerrez_bookings(sync_date);
CREATE INDEX idx_ownerrez_bookings_check_in ON public.ownerrez_bookings(check_in);