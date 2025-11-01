-- Create monthly_reconciliations table
CREATE TABLE monthly_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES property_owners(id) ON DELETE CASCADE,
  reconciliation_month DATE NOT NULL,
  
  -- Financial Data (snapshot at time of reconciliation)
  total_revenue NUMERIC NOT NULL DEFAULT 0,
  short_term_revenue NUMERIC DEFAULT 0,
  mid_term_revenue NUMERIC DEFAULT 0,
  total_expenses NUMERIC NOT NULL DEFAULT 0,
  management_fee NUMERIC NOT NULL DEFAULT 0,
  net_to_owner NUMERIC NOT NULL DEFAULT 0,
  
  -- Workflow Status
  status TEXT NOT NULL DEFAULT 'draft',
  
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  
  statement_sent_at TIMESTAMP WITH TIME ZONE,
  owner_response_deadline DATE,
  
  charged_at TIMESTAMP WITH TIME ZONE,
  charge_id UUID REFERENCES monthly_charges(id),
  
  -- Owner Communication Tracking
  owner_acknowledged BOOLEAN DEFAULT false,
  owner_disputed BOOLEAN DEFAULT false,
  dispute_reason TEXT,
  dispute_detected_at TIMESTAMP WITH TIME ZONE,
  
  -- Audit Trail
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_property_month UNIQUE(property_id, reconciliation_month)
);

-- Create reconciliation_line_items table
CREATE TABLE reconciliation_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id UUID NOT NULL REFERENCES monthly_reconciliations(id) ON DELETE CASCADE,
  
  -- Link to original transaction
  item_type TEXT NOT NULL,
  item_id UUID NOT NULL,
  
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  date DATE NOT NULL,
  category TEXT,
  
  -- Verification flags
  verified BOOLEAN DEFAULT false,
  excluded BOOLEAN DEFAULT false,
  exclusion_reason TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX idx_monthly_reconciliations_property_id ON monthly_reconciliations(property_id);
CREATE INDEX idx_monthly_reconciliations_owner_id ON monthly_reconciliations(owner_id);
CREATE INDEX idx_monthly_reconciliations_status ON monthly_reconciliations(status);
CREATE INDEX idx_monthly_reconciliations_month ON monthly_reconciliations(reconciliation_month);
CREATE INDEX idx_reconciliation_line_items_reconciliation_id ON reconciliation_line_items(reconciliation_id);
CREATE INDEX idx_reconciliation_line_items_type ON reconciliation_line_items(item_type);

-- Enable RLS
ALTER TABLE monthly_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_line_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for monthly_reconciliations
CREATE POLICY "Admins can manage all reconciliations"
  ON monthly_reconciliations
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Approved users can view reconciliations"
  ON monthly_reconciliations
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'::account_status
  ));

-- RLS Policies for reconciliation_line_items
CREATE POLICY "Admins can manage all line items"
  ON reconciliation_line_items
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Approved users can view line items"
  ON reconciliation_line_items
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'::account_status
  ));

-- Add trigger for updated_at
CREATE TRIGGER update_monthly_reconciliations_updated_at
  BEFORE UPDATE ON monthly_reconciliations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();