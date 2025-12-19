-- Create owner_conversations table
CREATE TABLE public.owner_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  conversation_date DATE DEFAULT CURRENT_DATE,
  participants TEXT,
  transcript_text TEXT,
  transcript_file_path TEXT,
  ai_summary TEXT,
  extracted_items JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'analyzing', 'analyzed', 'completed')),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create owner_conversation_documents table
CREATE TABLE public.owner_conversation_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.owner_conversations(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  ai_extracted_content TEXT,
  ai_analysis JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create owner_conversation_actions table
CREATE TABLE public.owner_conversation_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.owner_conversations(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('property_info', 'setup_note', 'faq', 'task')),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'created', 'dismissed')),
  content JSONB DEFAULT '{}'::jsonb,
  linked_task_id UUID REFERENCES public.onboarding_tasks(id) ON DELETE SET NULL,
  linked_faq_id UUID REFERENCES public.frequently_asked_questions(id) ON DELETE SET NULL,
  property_field TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.owner_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_conversation_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_conversation_actions ENABLE ROW LEVEL SECURITY;

-- RLS policies for owner_conversations
CREATE POLICY "Admins can manage all owner conversations"
  ON public.owner_conversations
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Approved users can view owner conversations"
  ON public.owner_conversations
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'::account_status
  ));

CREATE POLICY "Approved users can insert owner conversations"
  ON public.owner_conversations
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'::account_status
  ));

CREATE POLICY "Approved users can update owner conversations"
  ON public.owner_conversations
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'::account_status
  ));

-- RLS policies for owner_conversation_documents
CREATE POLICY "Admins can manage all conversation documents"
  ON public.owner_conversation_documents
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Approved users can view conversation documents"
  ON public.owner_conversation_documents
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'::account_status
  ));

CREATE POLICY "Approved users can insert conversation documents"
  ON public.owner_conversation_documents
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'::account_status
  ));

-- RLS policies for owner_conversation_actions
CREATE POLICY "Admins can manage all conversation actions"
  ON public.owner_conversation_actions
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Approved users can view conversation actions"
  ON public.owner_conversation_actions
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'::account_status
  ));

CREATE POLICY "Approved users can insert conversation actions"
  ON public.owner_conversation_actions
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'::account_status
  ));

CREATE POLICY "Approved users can update conversation actions"
  ON public.owner_conversation_actions
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'::account_status
  ));

-- Create indexes for better query performance
CREATE INDEX idx_owner_conversations_property_id ON public.owner_conversations(property_id);
CREATE INDEX idx_owner_conversations_status ON public.owner_conversations(status);
CREATE INDEX idx_owner_conversation_documents_conversation_id ON public.owner_conversation_documents(conversation_id);
CREATE INDEX idx_owner_conversation_actions_conversation_id ON public.owner_conversation_actions(conversation_id);
CREATE INDEX idx_owner_conversation_actions_action_type ON public.owner_conversation_actions(action_type);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add triggers for updated_at
CREATE TRIGGER update_owner_conversations_updated_at
  BEFORE UPDATE ON public.owner_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_owner_conversation_actions_updated_at
  BEFORE UPDATE ON public.owner_conversation_actions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();