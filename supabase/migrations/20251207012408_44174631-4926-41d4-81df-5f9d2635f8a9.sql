-- Create expense verification tracking table
CREATE TABLE public.expense_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id UUID REFERENCES public.expenses(id) ON DELETE CASCADE,
  email_insight_id UUID REFERENCES public.email_insights(id) ON DELETE SET NULL,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  order_number TEXT,
  extracted_amount NUMERIC,
  verified_amount NUMERIC,
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'flagged', 'corrected')),
  discrepancy_reason TEXT,
  verified_by UUID,
  verified_at TIMESTAMP WITH TIME ZONE,
  raw_email_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.expense_verifications ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage expense verifications" 
ON public.expense_verifications 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Approved users can view expense verifications" 
ON public.expense_verifications 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = auth.uid() 
  AND profiles.status = 'approved'::account_status
));

-- Create index for faster lookups
CREATE INDEX idx_expense_verifications_status ON public.expense_verifications(verification_status);
CREATE INDEX idx_expense_verifications_property ON public.expense_verifications(property_id);
CREATE INDEX idx_expense_verifications_order_number ON public.expense_verifications(order_number);

-- Add trigger for updated_at
CREATE TRIGGER update_expense_verifications_updated_at
BEFORE UPDATE ON public.expense_verifications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();