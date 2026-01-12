-- Add inspection checklist responses to leads table
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS inspection_checklist_responses jsonb;

-- Create property initial setup tasks table
CREATE TABLE IF NOT EXISTS public.property_setup_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'pending',
  category TEXT DEFAULT 'setup',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID,
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.property_setup_tasks ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view property setup tasks"
ON public.property_setup_tasks
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert property setup tasks"
ON public.property_setup_tasks
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update property setup tasks"
ON public.property_setup_tasks
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete property setup tasks"
ON public.property_setup_tasks
FOR DELETE
TO authenticated
USING (true);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_property_setup_tasks_property_id ON public.property_setup_tasks(property_id);
CREATE INDEX IF NOT EXISTS idx_property_setup_tasks_lead_id ON public.property_setup_tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_property_setup_tasks_status ON public.property_setup_tasks(status);