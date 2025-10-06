-- Update rental_type to include long_term
ALTER TABLE public.properties
DROP CONSTRAINT IF EXISTS properties_rental_type_check;

ALTER TABLE public.properties
ADD CONSTRAINT properties_rental_type_check 
CHECK (rental_type IN ('short_term', 'mid_term', 'long_term'));

-- Create mid_term_bookings table for tracking mid-term rental agreements
CREATE TABLE IF NOT EXISTS public.mid_term_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  tenant_name TEXT NOT NULL,
  tenant_email TEXT,
  tenant_phone TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  monthly_rent NUMERIC NOT NULL CHECK (monthly_rent > 0),
  deposit_amount NUMERIC DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID REFERENCES auth.users(id)
);

-- Enable RLS on mid_term_bookings
ALTER TABLE public.mid_term_bookings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for mid_term_bookings
CREATE POLICY "Approved users can view all mid-term bookings"
ON public.mid_term_bookings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'::account_status
  )
);

CREATE POLICY "Approved users can insert their own mid-term bookings"
ON public.mid_term_bookings
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'::account_status
  )
);

CREATE POLICY "Approved users can update their own mid-term bookings"
ON public.mid_term_bookings
FOR UPDATE
USING (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'::account_status
  )
);

CREATE POLICY "Approved users can delete their own mid-term bookings"
ON public.mid_term_bookings
FOR DELETE
USING (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'::account_status
  )
);

-- Create index for better performance
CREATE INDEX idx_mid_term_bookings_property_id ON public.mid_term_bookings(property_id);
CREATE INDEX idx_mid_term_bookings_dates ON public.mid_term_bookings(start_date, end_date);