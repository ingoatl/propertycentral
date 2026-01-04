-- Trust account reconciliation records for GREC compliance
CREATE TABLE public.trust_account_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_date DATE NOT NULL,
  bank_statement_date DATE NOT NULL,
  statement_balance NUMERIC NOT NULL,
  ledger_balance NUMERIC NOT NULL,
  difference NUMERIC DEFAULT 0,
  is_reconciled BOOLEAN DEFAULT false,
  reconciled_by UUID REFERENCES public.profiles(id),
  notes TEXT,
  document_path TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Owner distribution tracking for 1099 preparation
CREATE TABLE public.owner_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public.property_owners(id),
  property_id UUID REFERENCES public.properties(id),
  reconciliation_id UUID REFERENCES public.monthly_reconciliations(id),
  amount NUMERIC NOT NULL,
  distribution_date DATE NOT NULL,
  payment_method TEXT, -- 'ach', 'check', 'wire'
  reference_number TEXT, -- check number or ACH confirmation
  status TEXT DEFAULT 'pending', -- pending, sent, confirmed
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Lease documents archive
CREATE TABLE public.lease_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties(id),
  tenant_name TEXT NOT NULL,
  document_type TEXT NOT NULL, -- lease, addendum, inspection, amendment
  document_path TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  notes TEXT,
  uploaded_by UUID REFERENCES public.profiles(id),
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- Insurance certificates tracking
CREATE TABLE public.insurance_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties(id),
  insurance_type TEXT NOT NULL, -- liability, property, flood
  provider TEXT NOT NULL,
  policy_number TEXT,
  coverage_amount NUMERIC,
  effective_date DATE NOT NULL,
  expiration_date DATE NOT NULL,
  document_path TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trust_account_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lease_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_certificates ENABLE ROW LEVEL SECURITY;

-- RLS policies for authenticated users
CREATE POLICY "Authenticated users can manage trust reconciliations" ON public.trust_account_reconciliations FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage owner distributions" ON public.owner_distributions FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage lease documents" ON public.lease_documents FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage insurance certificates" ON public.insurance_certificates FOR ALL USING (auth.uid() IS NOT NULL);