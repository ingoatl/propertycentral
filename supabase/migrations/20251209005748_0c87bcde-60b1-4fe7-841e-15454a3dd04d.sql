-- Create charge_line_items table for multi-line charges
CREATE TABLE public.charge_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_id uuid REFERENCES public.monthly_charges(id) ON DELETE CASCADE,
  category text NOT NULL,
  description text,
  amount numeric NOT NULL,
  qbo_account_code text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.charge_line_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for charge_line_items
CREATE POLICY "Admins can manage charge line items"
ON public.charge_line_items
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add columns to monthly_charges for multi-line and refundable tracking
ALTER TABLE public.monthly_charges 
  ADD COLUMN IF NOT EXISTS is_multi_line boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS statement_notes text,
  ADD COLUMN IF NOT EXISTS statement_date date DEFAULT CURRENT_DATE;

-- Create security_deposit_returns table for tracking refunds
CREATE TABLE public.security_deposit_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_charge_id uuid REFERENCES public.monthly_charges(id),
  owner_id uuid REFERENCES public.property_owners(id) NOT NULL,
  amount numeric NOT NULL,
  return_date date NOT NULL DEFAULT CURRENT_DATE,
  return_method text, -- 'check', 'ach', 'stripe'
  notes text,
  returned_by uuid,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.security_deposit_returns ENABLE ROW LEVEL SECURITY;

-- RLS policies for security_deposit_returns
CREATE POLICY "Admins can manage security deposit returns"
ON public.security_deposit_returns
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));