-- Create saved_communications table for archiving important messages
CREATE TABLE public.saved_communications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Message reference fields
  message_id TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('email', 'sms', 'call', 'personal_sms', 'personal_call')),
  thread_id TEXT,
  
  -- Message content
  message_content TEXT NOT NULL,
  message_subject TEXT,
  message_snippet TEXT,
  sender_name TEXT NOT NULL,
  sender_email TEXT,
  sender_phone TEXT,
  message_date TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- User categorization
  save_reason TEXT NOT NULL CHECK (save_reason IN (
    'important_decision', 
    'client_request', 
    'action_item', 
    'price_quote', 
    'contract', 
    'follow_up_needed', 
    'legal_compliance',
    'other'
  )),
  user_comment TEXT,
  
  -- AI-generated fields
  ai_summary TEXT,
  ai_category TEXT CHECK (ai_category IN (
    'deal_contract',
    'action_item',
    'client_decision',
    'support_problem',
    'price_quote',
    'communication_record'
  )),
  ai_extracted_dates JSONB,
  ai_extracted_amounts JSONB,
  ai_extracted_contacts JSONB,
  
  -- Tags and metadata
  tags TEXT[] DEFAULT '{}',
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  
  -- Tracking
  saved_by UUID NOT NULL,
  saved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Related entities
  property_id UUID REFERENCES public.properties(id),
  lead_id UUID REFERENCES public.leads(id),
  owner_id UUID REFERENCES public.property_owners(id),
  
  -- Create unique constraint on message_id + saved_by to prevent duplicates
  UNIQUE(message_id, saved_by)
);

-- Enable RLS
ALTER TABLE public.saved_communications ENABLE ROW LEVEL SECURITY;

-- Create policies for access control
CREATE POLICY "Users can view their own saved communications" 
ON public.saved_communications 
FOR SELECT 
USING (auth.uid() = saved_by);

CREATE POLICY "Users can create their own saved communications" 
ON public.saved_communications 
FOR INSERT 
WITH CHECK (auth.uid() = saved_by);

CREATE POLICY "Users can update their own saved communications" 
ON public.saved_communications 
FOR UPDATE 
USING (auth.uid() = saved_by);

CREATE POLICY "Users can delete their own saved communications" 
ON public.saved_communications 
FOR DELETE 
USING (auth.uid() = saved_by);

-- Admins can view all saved communications (using is_admin column)
CREATE POLICY "Admins can view all saved communications" 
ON public.saved_communications 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  )
);

-- Create indexes for performance
CREATE INDEX idx_saved_communications_saved_by ON public.saved_communications(saved_by);
CREATE INDEX idx_saved_communications_saved_at ON public.saved_communications(saved_at DESC);
CREATE INDEX idx_saved_communications_save_reason ON public.saved_communications(save_reason);
CREATE INDEX idx_saved_communications_ai_category ON public.saved_communications(ai_category);
CREATE INDEX idx_saved_communications_tags ON public.saved_communications USING GIN(tags);
CREATE INDEX idx_saved_communications_is_pinned ON public.saved_communications(is_pinned) WHERE is_pinned = true;

-- Create trigger for updated_at
CREATE TRIGGER update_saved_communications_updated_at
BEFORE UPDATE ON public.saved_communications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create audit log table for saved communications
CREATE TABLE public.saved_communications_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  saved_communication_id UUID NOT NULL REFERENCES public.saved_communications(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted', 'pinned', 'unpinned', 'tag_added', 'tag_removed')),
  action_by UUID NOT NULL,
  action_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  previous_values JSONB,
  new_values JSONB
);

-- Enable RLS on audit table
ALTER TABLE public.saved_communications_audit ENABLE ROW LEVEL SECURITY;

-- Audit table policies
CREATE POLICY "Users can view audit logs for their saved communications" 
ON public.saved_communications_audit 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.saved_communications 
    WHERE saved_communications.id = saved_communications_audit.saved_communication_id 
    AND saved_communications.saved_by = auth.uid()
  )
);

-- Admins can view all audit logs
CREATE POLICY "Admins can view all audit logs" 
ON public.saved_communications_audit 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.is_admin = true
  )
);