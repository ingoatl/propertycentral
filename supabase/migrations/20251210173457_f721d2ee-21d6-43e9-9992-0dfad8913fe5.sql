-- Create table for utility provider recommendations
CREATE TABLE IF NOT EXISTS public.utility_provider_recommendations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  utility_type TEXT NOT NULL,
  current_provider TEXT,
  current_avg_cost NUMERIC,
  recommended_provider TEXT NOT NULL,
  estimated_savings NUMERIC NOT NULL,
  savings_percentage NUMERIC,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  actioned_at TIMESTAMP WITH TIME ZONE,
  actioned_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(property_id, utility_type)
);

-- Enable RLS
ALTER TABLE public.utility_provider_recommendations ENABLE ROW LEVEL SECURITY;

-- Admins can manage recommendations
CREATE POLICY "Admins can manage utility recommendations"
ON public.utility_provider_recommendations
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Approved users can view recommendations
CREATE POLICY "Approved users can view utility recommendations"
ON public.utility_provider_recommendations
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid()
  AND profiles.status = 'approved'::account_status
));

-- Create index
CREATE INDEX idx_utility_recommendations_property ON public.utility_provider_recommendations(property_id);
CREATE INDEX idx_utility_recommendations_status ON public.utility_provider_recommendations(status);