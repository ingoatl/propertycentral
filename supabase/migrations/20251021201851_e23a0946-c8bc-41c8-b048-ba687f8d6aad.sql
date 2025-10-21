-- Create bug_reports table
CREATE TABLE public.bug_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  loom_video_url TEXT,
  submitted_by UUID NOT NULL REFERENCES auth.users(id),
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'medium',
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,
  property_id UUID REFERENCES public.properties(id),
  project_id UUID REFERENCES public.onboarding_projects(id),
  task_id UUID REFERENCES public.onboarding_tasks(id),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT bug_title_length CHECK (char_length(title) <= 200),
  CONSTRAINT bug_description_length CHECK (char_length(description) <= 2000),
  CONSTRAINT bug_status_values CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  CONSTRAINT bug_priority_values CHECK (priority IN ('low', 'medium', 'high', 'critical'))
);

-- Enable RLS
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Approved users can view all bug reports"
ON public.bug_reports
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'
  )
);

CREATE POLICY "Approved users can submit bug reports"
ON public.bug_reports
FOR INSERT
WITH CHECK (
  submitted_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'
  )
);

CREATE POLICY "Admins can update bug reports"
ON public.bug_reports
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete bug reports"
ON public.bug_reports
FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_bug_reports_updated_at
BEFORE UPDATE ON public.bug_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_profile_updated_at();