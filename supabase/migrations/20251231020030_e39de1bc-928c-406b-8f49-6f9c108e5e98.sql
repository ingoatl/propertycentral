
-- Create table to track tenant payments for mid-term rentals
CREATE TABLE public.tenant_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.mid_term_bookings(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  payment_date DATE NOT NULL,
  payment_method TEXT, -- 'zelle', 'venmo', 'check', 'cash', 'manual'
  reference_number TEXT,
  email_insight_id UUID REFERENCES public.email_insights(id) ON DELETE SET NULL,
  notes TEXT,
  entered_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tenant_payments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Admins can manage tenant payments" 
  ON public.tenant_payments 
  FOR ALL 
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Approved users can view tenant payments" 
  ON public.tenant_payments 
  FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.status = 'approved'::account_status
  ));

CREATE POLICY "Approved users can insert tenant payments" 
  ON public.tenant_payments 
  FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.status = 'approved'::account_status
  ));

-- Create index for faster lookups
CREATE INDEX idx_tenant_payments_property_date ON public.tenant_payments(property_id, payment_date);
CREATE INDEX idx_tenant_payments_booking ON public.tenant_payments(booking_id);

-- Add trigger for updated_at
CREATE TRIGGER update_tenant_payments_updated_at
  BEFORE UPDATE ON public.tenant_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
