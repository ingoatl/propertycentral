-- Create property_financial_data table to store owner-submitted financial information
CREATE TABLE public.property_financial_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  
  -- Revenue metrics
  last_year_revenue NUMERIC,
  average_daily_rate NUMERIC,
  occupancy_rate NUMERIC,
  average_booking_window INTEGER,
  average_monthly_revenue NUMERIC,
  peak_season TEXT,
  peak_season_adr NUMERIC,
  
  -- Document URLs
  revenue_statement_url TEXT,
  expense_report_url TEXT,
  airbnb_revenue_export_url TEXT,
  vrbo_revenue_export_url TEXT,
  ownerrez_revenue_export_url TEXT,
  
  -- Pricing goals
  pricing_revenue_goals TEXT,
  competitor_insights TEXT,
  
  -- Metadata
  submission_id UUID REFERENCES public.owner_onboarding_submissions(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.property_financial_data ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage property financial data"
ON public.property_financial_data
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Approved users can view property financial data"
ON public.property_financial_data
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid()
  AND profiles.status = 'approved'::account_status
));

-- Create unique constraint on property_id
CREATE UNIQUE INDEX idx_property_financial_data_property_id ON public.property_financial_data(property_id);

-- Create trigger for updated_at
CREATE TRIGGER update_property_financial_data_updated_at
BEFORE UPDATE ON public.property_financial_data
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();