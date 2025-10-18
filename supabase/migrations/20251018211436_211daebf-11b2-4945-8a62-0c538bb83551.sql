-- Create frequently_asked_questions table
CREATE TABLE public.frequently_asked_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  project_id UUID REFERENCES onboarding_projects(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  asked_by UUID REFERENCES auth.users(id),
  answered_by UUID REFERENCES auth.users(id),
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_faqs_property ON frequently_asked_questions(property_id);
CREATE INDEX idx_faqs_project ON frequently_asked_questions(project_id);
CREATE INDEX idx_faqs_category ON frequently_asked_questions(category);

-- Enable RLS
ALTER TABLE frequently_asked_questions ENABLE ROW LEVEL SECURITY;

-- Approved users can view FAQs
CREATE POLICY "Approved users can view FAQs"
ON frequently_asked_questions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() 
    AND status = 'approved'
  )
);

-- Approved users can insert FAQs
CREATE POLICY "Approved users can insert FAQs"
ON frequently_asked_questions FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() 
    AND status = 'approved'
  )
);

-- Approved users can update FAQs
CREATE POLICY "Approved users can update FAQs"
ON frequently_asked_questions FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() 
    AND status = 'approved'
  )
);

-- Approved users can delete FAQs
CREATE POLICY "Approved users can delete FAQs"
ON frequently_asked_questions FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() 
    AND status = 'approved'
  )
);