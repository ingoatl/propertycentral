-- Add guest_phone and guest_email to ownerrez_bookings for guest contact info
ALTER TABLE public.ownerrez_bookings ADD COLUMN IF NOT EXISTS guest_phone TEXT;
ALTER TABLE public.ownerrez_bookings ADD COLUMN IF NOT EXISTS guest_email TEXT;