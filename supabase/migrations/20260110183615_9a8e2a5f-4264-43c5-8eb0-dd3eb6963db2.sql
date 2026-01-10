-- Add unique constraint on owner_id for upsert operations
ALTER TABLE public.payment_setup_requests 
ADD CONSTRAINT payment_setup_requests_owner_id_key UNIQUE (owner_id);