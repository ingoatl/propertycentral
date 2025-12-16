-- Create inspections table
CREATE TABLE public.inspections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'submitted', 'completed')),
  phase TEXT NOT NULL DEFAULT 'str-ready',
  inspector_name TEXT,
  inspection_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create inspection_responses table
CREATE TABLE public.inspection_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inspection_id UUID NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  section_id TEXT NOT NULL,
  field_key TEXT NOT NULL,
  value_bool BOOLEAN,
  value_text TEXT,
  answered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(inspection_id, field_key)
);

-- Create inspection_issues table
CREATE TABLE public.inspection_issues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  inspection_id UUID REFERENCES public.inspections(id) ON DELETE SET NULL,
  field_key TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  responsible_party TEXT NOT NULL DEFAULT 'pm' CHECK (responsible_party IN ('owner', 'pm', 'cleaner')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create inspection_photos table
CREATE TABLE public.inspection_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inspection_id UUID NOT NULL REFERENCES public.inspections(id) ON DELETE CASCADE,
  issue_id UUID REFERENCES public.inspection_issues(id) ON DELETE CASCADE,
  field_key TEXT,
  photo_url TEXT NOT NULL,
  caption TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_photos ENABLE ROW LEVEL SECURITY;

-- RLS policies for inspections
CREATE POLICY "Approved users can view inspections"
ON public.inspections FOR SELECT
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status));

CREATE POLICY "Approved users can insert inspections"
ON public.inspections FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status));

CREATE POLICY "Approved users can update inspections"
ON public.inspections FOR UPDATE
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status));

CREATE POLICY "Approved users can delete inspections"
ON public.inspections FOR DELETE
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status));

-- RLS policies for inspection_responses
CREATE POLICY "Approved users can view responses"
ON public.inspection_responses FOR SELECT
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status));

CREATE POLICY "Approved users can insert responses"
ON public.inspection_responses FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status));

CREATE POLICY "Approved users can update responses"
ON public.inspection_responses FOR UPDATE
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status));

CREATE POLICY "Approved users can delete responses"
ON public.inspection_responses FOR DELETE
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status));

-- RLS policies for inspection_issues
CREATE POLICY "Approved users can view issues"
ON public.inspection_issues FOR SELECT
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status));

CREATE POLICY "Approved users can insert issues"
ON public.inspection_issues FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status));

CREATE POLICY "Approved users can update issues"
ON public.inspection_issues FOR UPDATE
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status));

CREATE POLICY "Approved users can delete issues"
ON public.inspection_issues FOR DELETE
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status));

-- RLS policies for inspection_photos
CREATE POLICY "Approved users can view photos"
ON public.inspection_photos FOR SELECT
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status));

CREATE POLICY "Approved users can insert photos"
ON public.inspection_photos FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status));

CREATE POLICY "Approved users can delete photos"
ON public.inspection_photos FOR DELETE
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status));

-- Create storage bucket for inspection photos
INSERT INTO storage.buckets (id, name, public) VALUES ('inspection-photos', 'inspection-photos', true);

-- Storage policies
CREATE POLICY "Anyone can view inspection photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'inspection-photos');

CREATE POLICY "Authenticated users can upload inspection photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'inspection-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete inspection photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'inspection-photos' AND auth.role() = 'authenticated');

-- Add updated_at trigger
CREATE TRIGGER update_inspections_updated_at
BEFORE UPDATE ON public.inspections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_inspections_property_id ON public.inspections(property_id);
CREATE INDEX idx_inspection_responses_inspection_id ON public.inspection_responses(inspection_id);
CREATE INDEX idx_inspection_issues_property_id ON public.inspection_issues(property_id);
CREATE INDEX idx_inspection_issues_inspection_id ON public.inspection_issues(inspection_id);
CREATE INDEX idx_inspection_photos_inspection_id ON public.inspection_photos(inspection_id);