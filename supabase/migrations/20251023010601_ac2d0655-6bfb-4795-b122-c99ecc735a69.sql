-- Create task attachments bucket for storing task files
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Create task_attachments table to track uploaded files
CREATE TABLE IF NOT EXISTS public.task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.onboarding_tasks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  CONSTRAINT unique_task_file UNIQUE(task_id, file_path)
);

-- Enable RLS on task_attachments
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

-- RLS policies for task_attachments table
CREATE POLICY "Users can view task attachments"
  ON public.task_attachments
  FOR SELECT
  USING (true);

CREATE POLICY "Users can upload task attachments"
  ON public.task_attachments
  FOR INSERT
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can delete their own task attachments"
  ON public.task_attachments
  FOR DELETE
  USING (auth.uid() = uploaded_by);

-- Storage policies for task-attachments bucket
CREATE POLICY "Users can view task attachments in storage"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'task-attachments');

CREATE POLICY "Authenticated users can upload task attachments"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'task-attachments' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can delete their own task attachment files"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'task-attachments' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON public.task_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_created_at ON public.task_attachments(created_at DESC);