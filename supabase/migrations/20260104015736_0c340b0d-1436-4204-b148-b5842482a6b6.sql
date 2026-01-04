-- Add auth_user_id to property_owners for owner portal authentication
ALTER TABLE public.property_owners
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_property_owners_auth_user_id ON public.property_owners(auth_user_id);

-- Create owner portal sessions table for magic link authentication
CREATE TABLE IF NOT EXISTS public.owner_portal_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES public.property_owners(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  ip_address TEXT,
  user_agent TEXT
);

-- Create index for token lookups
CREATE INDEX IF NOT EXISTS idx_owner_portal_sessions_token ON public.owner_portal_sessions(token);
CREATE INDEX IF NOT EXISTS idx_owner_portal_sessions_owner_id ON public.owner_portal_sessions(owner_id);

-- Enable RLS
ALTER TABLE public.owner_portal_sessions ENABLE ROW LEVEL SECURITY;

-- Allow inserts from edge functions (service role)
CREATE POLICY "Service role can manage sessions" ON public.owner_portal_sessions
  FOR ALL USING (true) WITH CHECK (true);

-- RLS policy for property_owners to allow owners to see their own data
CREATE POLICY "Owners can view their own data" ON public.property_owners
  FOR SELECT USING (auth.uid() = auth_user_id);

-- RLS for expenses - owners can view expenses for their properties
CREATE POLICY "Owners can view their property expenses" ON public.expenses
  FOR SELECT USING (
    property_id IN (
      SELECT p.id FROM public.properties p
      JOIN public.property_owners po ON p.owner_id = po.id
      WHERE po.auth_user_id = auth.uid()
    )
  );

-- RLS for visits - owners can view visits for their properties
CREATE POLICY "Owners can view their property visits" ON public.visits
  FOR SELECT USING (
    property_id IN (
      SELECT p.id FROM public.properties p
      JOIN public.property_owners po ON p.owner_id = po.id
      WHERE po.auth_user_id = auth.uid()
    )
  );

-- RLS for monthly_reconciliations - owners can view their reconciliations
CREATE POLICY "Owners can view their reconciliations" ON public.monthly_reconciliations
  FOR SELECT USING (
    property_id IN (
      SELECT p.id FROM public.properties p
      JOIN public.property_owners po ON p.owner_id = po.id
      WHERE po.auth_user_id = auth.uid()
    )
  );

-- RLS for ownerrez_bookings - owners can view bookings for their properties
CREATE POLICY "Owners can view their property bookings" ON public.ownerrez_bookings
  FOR SELECT USING (
    property_id IN (
      SELECT p.id FROM public.properties p
      JOIN public.property_owners po ON p.owner_id = po.id
      WHERE po.auth_user_id = auth.uid()
    )
  );

-- RLS for mid_term_bookings - owners can view mid-term bookings for their properties
CREATE POLICY "Owners can view their mid-term bookings" ON public.mid_term_bookings
  FOR SELECT USING (
    property_id IN (
      SELECT p.id FROM public.properties p
      JOIN public.property_owners po ON p.owner_id = po.id
      WHERE po.auth_user_id = auth.uid()
    )
  );