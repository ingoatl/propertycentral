-- Create onboarding_sops table for both phase and task level SOPs
CREATE TABLE public.onboarding_sops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES onboarding_projects(id) ON DELETE CASCADE,
  phase_number INTEGER,
  task_id UUID REFERENCES onboarding_tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  loom_video_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sop_scope_check CHECK (
    (phase_number IS NOT NULL AND task_id IS NULL) OR 
    (phase_number IS NULL AND task_id IS NOT NULL)
  )
);

-- Add indexes for performance
CREATE INDEX idx_sops_project ON onboarding_sops(project_id);
CREATE INDEX idx_sops_phase ON onboarding_sops(phase_number);
CREATE INDEX idx_sops_task ON onboarding_sops(task_id);

-- Enable RLS
ALTER TABLE onboarding_sops ENABLE ROW LEVEL SECURITY;

-- Approved users can view SOPs
CREATE POLICY "Approved users can view SOPs"
ON onboarding_sops FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() 
    AND status = 'approved'
  )
);

-- Only admins can insert SOPs
CREATE POLICY "Admins can insert SOPs"
ON onboarding_sops FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Only admins can update SOPs
CREATE POLICY "Admins can update SOPs"
ON onboarding_sops FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Only admins can delete SOPs
CREATE POLICY "Admins can delete SOPs"
ON onboarding_sops FOR DELETE
USING (has_role(auth.uid(), 'admin'));