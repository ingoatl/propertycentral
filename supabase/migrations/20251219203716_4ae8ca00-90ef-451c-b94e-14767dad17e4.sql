-- Create property_intel_items table to store all extracted intel from owner conversations
CREATE TABLE public.property_intel_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL DEFAULT 'conversation', -- 'conversation', 'document', 'excel'
  source_id UUID, -- reference to owner_conversation_id if applicable
  category TEXT NOT NULL, -- 'Cleaning', 'Parking', 'Access', 'Trash', 'Pets', 'Checkout', 'Safety', 'Utilities', 'Amenities', 'Other'
  title TEXT NOT NULL,
  description TEXT,
  content JSONB DEFAULT '{}'::jsonb, -- structured data (e.g., bullet points, key-value pairs)
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create property_credentials table for secure storage of logins
CREATE TABLE public.property_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL, -- e.g., 'HOA Portal', 'Mortgage Portal', 'Security System'
  username TEXT,
  password TEXT,
  url TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create property_appliances table for tracking equipment
CREATE TABLE public.property_appliances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  appliance_type TEXT NOT NULL, -- e.g., 'Washer', 'Dryer', 'HVAC', 'Water Heater'
  brand TEXT,
  model TEXT,
  serial_number TEXT,
  year INTEGER,
  warranty_info TEXT,
  location TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.property_intel_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_appliances ENABLE ROW LEVEL SECURITY;

-- RLS Policies for property_intel_items
CREATE POLICY "Admins can manage property intel items" ON public.property_intel_items
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Approved users can view property intel items" ON public.property_intel_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status
    )
  );

-- RLS Policies for property_credentials (admin only for full access)
CREATE POLICY "Admins can manage property credentials" ON public.property_credentials
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Approved users can view property credentials" ON public.property_credentials
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status
    )
  );

-- RLS Policies for property_appliances
CREATE POLICY "Admins can manage property appliances" ON public.property_appliances
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Approved users can view property appliances" ON public.property_appliances
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status
    )
  );

-- Create indexes for performance
CREATE INDEX idx_property_intel_items_property_id ON public.property_intel_items(property_id);
CREATE INDEX idx_property_intel_items_category ON public.property_intel_items(category);
CREATE INDEX idx_property_credentials_property_id ON public.property_credentials(property_id);
CREATE INDEX idx_property_appliances_property_id ON public.property_appliances(property_id);

-- Add trigger for updated_at
CREATE TRIGGER update_property_intel_items_updated_at
  BEFORE UPDATE ON public.property_intel_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_property_credentials_updated_at
  BEFORE UPDATE ON public.property_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_property_appliances_updated_at
  BEFORE UPDATE ON public.property_appliances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();