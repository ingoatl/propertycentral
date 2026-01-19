-- Create vendor_service_requests table for tracking pause/resume/cancel requests
CREATE TABLE public.vendor_service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  assignment_id UUID REFERENCES public.property_vendor_assignments(id) ON DELETE SET NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('pause', 'resume', 'cancel')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'expired')),
  pause_start_date DATE,
  pause_end_date DATE,
  reason TEXT,
  vendor_response TEXT,
  confirmed_at TIMESTAMPTZ,
  email_sent_at TIMESTAMPTZ,
  reference_number TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vendor_service_requests ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view vendor service requests"
ON public.vendor_service_requests
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create vendor service requests"
ON public.vendor_service_requests
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update vendor service requests"
ON public.vendor_service_requests
FOR UPDATE
TO authenticated
USING (true);

-- Create index for common queries
CREATE INDEX idx_vendor_service_requests_vendor ON public.vendor_service_requests(vendor_id);
CREATE INDEX idx_vendor_service_requests_property ON public.vendor_service_requests(property_id);
CREATE INDEX idx_vendor_service_requests_status ON public.vendor_service_requests(status);

-- Add updated_at trigger
CREATE TRIGGER update_vendor_service_requests_updated_at
BEFORE UPDATE ON public.vendor_service_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();