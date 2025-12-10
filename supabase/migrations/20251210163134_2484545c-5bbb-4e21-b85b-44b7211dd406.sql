-- Create utility_readings table for tracking utility consumption
CREATE TABLE public.utility_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  email_insight_id UUID REFERENCES public.email_insights(id) ON DELETE SET NULL,
  
  -- Utility type and provider
  utility_type TEXT NOT NULL, -- 'electric', 'gas', 'water', 'sewer', 'trash', 'internet'
  provider TEXT,
  account_number TEXT,
  
  -- Billing period
  bill_date DATE NOT NULL,
  service_period_start DATE,
  service_period_end DATE,
  due_date DATE,
  
  -- Consumption data
  usage_amount NUMERIC,
  usage_unit TEXT, -- 'kWh', 'therms', 'CCF', 'gallons'
  previous_usage NUMERIC,
  
  -- Cost data
  amount_due NUMERIC NOT NULL,
  previous_amount NUMERIC,
  
  -- Anomaly detection
  is_anomaly BOOLEAN DEFAULT FALSE,
  anomaly_reason TEXT,
  anomaly_percentage NUMERIC,
  
  -- Metadata
  raw_email_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create utility_accounts table to track which utilities each property has
CREATE TABLE public.utility_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  utility_type TEXT NOT NULL,
  provider TEXT,
  account_number TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(property_id, utility_type, account_number)
);

-- Create utility_anomaly_alerts table
CREATE TABLE public.utility_anomaly_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  utility_reading_id UUID REFERENCES public.utility_readings(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL, -- 'usage_spike', 'cost_spike', 'zero_usage', 'vacancy_usage', 'missing_bill'
  severity TEXT DEFAULT 'warning', -- 'info', 'warning', 'critical'
  message TEXT NOT NULL,
  percentage_change NUMERIC,
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  email_sent BOOLEAN DEFAULT FALSE,
  email_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.utility_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.utility_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.utility_anomaly_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for utility_readings
CREATE POLICY "Approved users can view utility readings"
ON public.utility_readings FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status
));

CREATE POLICY "Admins can manage utility readings"
ON public.utility_readings FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for utility_accounts
CREATE POLICY "Approved users can view utility accounts"
ON public.utility_accounts FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status
));

CREATE POLICY "Admins can manage utility accounts"
ON public.utility_accounts FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for utility_anomaly_alerts
CREATE POLICY "Approved users can view utility alerts"
ON public.utility_anomaly_alerts FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status
));

CREATE POLICY "Admins can manage utility alerts"
ON public.utility_anomaly_alerts FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes for performance
CREATE INDEX idx_utility_readings_property_id ON public.utility_readings(property_id);
CREATE INDEX idx_utility_readings_bill_date ON public.utility_readings(bill_date);
CREATE INDEX idx_utility_readings_utility_type ON public.utility_readings(utility_type);
CREATE INDEX idx_utility_anomaly_alerts_property_id ON public.utility_anomaly_alerts(property_id);
CREATE INDEX idx_utility_anomaly_alerts_is_resolved ON public.utility_anomaly_alerts(is_resolved);

-- Trigger for updated_at
CREATE TRIGGER update_utility_readings_updated_at
BEFORE UPDATE ON public.utility_readings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_utility_accounts_updated_at
BEFORE UPDATE ON public.utility_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();