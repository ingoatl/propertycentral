-- Create owner statement archive table for GREC audit compliance (3-year retention)
CREATE TABLE public.owner_statement_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id UUID REFERENCES public.monthly_reconciliations(id),
  property_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  statement_number TEXT NOT NULL UNIQUE,
  statement_date DATE NOT NULL,
  statement_month DATE NOT NULL,
  recipient_emails TEXT[] NOT NULL,
  statement_html TEXT NOT NULL,
  statement_pdf_path TEXT,
  net_owner_result NUMERIC NOT NULL,
  total_revenue NUMERIC NOT NULL,
  total_expenses NUMERIC NOT NULL,
  management_fee NUMERIC NOT NULL,
  line_items_snapshot JSONB NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  sent_by UUID,
  is_revision BOOLEAN DEFAULT false,
  revision_number INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast audit lookups
CREATE INDEX idx_statement_archive_property ON public.owner_statement_archive(property_id);
CREATE INDEX idx_statement_archive_month ON public.owner_statement_archive(statement_month);
CREATE INDEX idx_statement_archive_number ON public.owner_statement_archive(statement_number);
CREATE INDEX idx_statement_archive_owner ON public.owner_statement_archive(owner_id);
CREATE INDEX idx_statement_archive_sent_at ON public.owner_statement_archive(sent_at);

-- Enable RLS
ALTER TABLE public.owner_statement_archive ENABLE ROW LEVEL SECURITY;

-- Admin-only access for sensitive financial records
CREATE POLICY "Admins can manage statement archive"
ON public.owner_statement_archive
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Approved users can view (read-only for audit purposes)
CREATE POLICY "Approved users can view statement archive"
ON public.owner_statement_archive
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid()
  AND profiles.status = 'approved'::account_status
));

-- Add comment for documentation
COMMENT ON TABLE public.owner_statement_archive IS 'Stores complete copies of all owner statements sent for GREC audit compliance. Retain for minimum 3 years.';