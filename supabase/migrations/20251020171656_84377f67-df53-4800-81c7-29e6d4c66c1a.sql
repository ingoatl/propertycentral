-- Create task_reschedule_logs table for tracking all reschedule events
CREATE TABLE task_reschedule_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES onboarding_tasks(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES onboarding_projects(id) ON DELETE CASCADE NOT NULL,
  previous_due_date DATE NOT NULL,
  new_due_date DATE NOT NULL,
  reason TEXT NOT NULL,
  rescheduled_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  rescheduled_by_name TEXT NOT NULL,
  rescheduled_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  days_delayed INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create indexes for performance
CREATE INDEX idx_task_reschedule_logs_task_id ON task_reschedule_logs(task_id);
CREATE INDEX idx_task_reschedule_logs_project_id ON task_reschedule_logs(project_id);
CREATE INDEX idx_task_reschedule_logs_rescheduled_by ON task_reschedule_logs(rescheduled_by);
CREATE INDEX idx_task_reschedule_logs_rescheduled_at ON task_reschedule_logs(rescheduled_at DESC);

-- Enable RLS
ALTER TABLE task_reschedule_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Approved users can view all reschedule logs"
ON task_reschedule_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'
  )
);

CREATE POLICY "Approved users can insert reschedule logs"
ON task_reschedule_logs
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'
  )
);