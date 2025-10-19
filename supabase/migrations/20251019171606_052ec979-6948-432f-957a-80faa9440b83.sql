-- Create faq_questions table
CREATE TABLE faq_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id),
  project_id UUID REFERENCES onboarding_projects(id),
  asked_by UUID NOT NULL,
  question TEXT NOT NULL,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  answer TEXT,
  answered_by UUID,
  answered_at TIMESTAMP WITH TIME ZONE,
  email_sent_to_admin BOOLEAN DEFAULT FALSE,
  email_sent_to_user BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'answered', 'archived'))
);

-- Enable RLS
ALTER TABLE faq_questions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Approved users can insert questions"
ON faq_questions FOR INSERT
TO authenticated
WITH CHECK (
  asked_by = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND status = 'approved'
  )
);

CREATE POLICY "Users can view their own questions"
ON faq_questions FOR SELECT
TO authenticated
USING (asked_by = auth.uid());

CREATE POLICY "Admins can view all questions"
ON faq_questions FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update questions"
ON faq_questions FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete questions"
ON faq_questions FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Create indexes for faster queries
CREATE INDEX idx_faq_questions_status ON faq_questions(status);
CREATE INDEX idx_faq_questions_asked_by ON faq_questions(asked_by);
CREATE INDEX idx_faq_questions_property ON faq_questions(property_id);