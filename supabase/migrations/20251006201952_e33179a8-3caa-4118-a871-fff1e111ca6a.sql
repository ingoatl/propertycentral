-- Create property owners table
CREATE TABLE public.property_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('card', 'ach')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.property_owners ENABLE ROW LEVEL SECURITY;

-- Admins can view all owners
CREATE POLICY "Admins can view all owners"
ON public.property_owners
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Admins can insert owners
CREATE POLICY "Admins can insert owners"
ON public.property_owners
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Admins can update owners
CREATE POLICY "Admins can update owners"
ON public.property_owners
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Admins can delete owners
CREATE POLICY "Admins can delete owners"
ON public.property_owners
FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Add owner_id to properties table
ALTER TABLE public.properties ADD COLUMN owner_id UUID REFERENCES public.property_owners(id);

-- Create monthly charges table
CREATE TABLE public.monthly_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.property_owners(id) ON DELETE CASCADE,
  charge_month DATE NOT NULL,
  total_management_fees NUMERIC NOT NULL DEFAULT 0,
  stripe_payment_intent_id TEXT,
  stripe_invoice_id TEXT,
  charge_status TEXT NOT NULL DEFAULT 'pending' CHECK (charge_status IN ('pending', 'processing', 'succeeded', 'failed', 'refunded')),
  charged_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(owner_id, charge_month)
);

-- Enable RLS
ALTER TABLE public.monthly_charges ENABLE ROW LEVEL SECURITY;

-- Admins can view all charges
CREATE POLICY "Admins can view all charges"
ON public.monthly_charges
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Admins can insert charges
CREATE POLICY "Admins can insert charges"
ON public.monthly_charges
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Admins can update charges
CREATE POLICY "Admins can update charges"
ON public.monthly_charges
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Insert property owners based on your information
INSERT INTO public.property_owners (name, email, payment_method) VALUES
  ('Smoke Hollow Owner', 'smokehollow@example.com', 'ach'),
  ('Villa Owner', 'villa@example.com', 'card'),
  ('Canadian Way Owner', 'canadianway@example.com', 'card'),
  ('Woodland Lane Owner', 'woodlandlane@example.com', 'card');