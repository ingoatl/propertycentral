-- Add unique constraint to booking_id column in ownerrez_bookings table
ALTER TABLE public.ownerrez_bookings 
ADD CONSTRAINT ownerrez_bookings_booking_id_unique UNIQUE (booking_id);