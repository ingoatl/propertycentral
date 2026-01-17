-- Create tone profiles table to store analyzed writing patterns
CREATE TABLE public.user_tone_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  channel TEXT NOT NULL DEFAULT 'all', -- 'email', 'sms', 'all'
  
  -- Core writing patterns
  formality_level TEXT CHECK (formality_level IN ('casual', 'professional', 'formal')) DEFAULT 'professional',
  avg_sentence_length INTEGER,
  uses_contractions BOOLEAN DEFAULT true,
  punctuation_style TEXT, -- e.g. "frequent exclamation marks", "oxford commas"
  
  -- Common phrases and patterns
  common_greetings JSONB DEFAULT '[]'::jsonb, -- ["Hey", "Hi there", "Good morning"]
  common_closings JSONB DEFAULT '[]'::jsonb, -- ["Best", "Thanks!", "Talk soon"]
  signature_phrases JSONB DEFAULT '[]'::jsonb, -- unique phrases that appear often
  avoided_phrases JSONB DEFAULT '[]'::jsonb, -- phrases never used
  
  -- Style characteristics
  typical_email_length INTEGER, -- average word count
  typical_sms_length INTEGER,
  paragraph_style TEXT, -- "short_punchy", "longer_detailed"
  question_frequency TEXT, -- "low", "medium", "high"
  exclamation_frequency TEXT, -- "low", "medium", "high"
  emoji_usage TEXT DEFAULT 'none', -- "none", "occasional", "frequent"
  
  -- Full tone analysis from AI
  tone_summary TEXT, -- AI-generated summary of writing style
  writing_dna JSONB DEFAULT '{}'::jsonb, -- detailed patterns
  
  -- Sample messages for context
  sample_messages JSONB DEFAULT '[]'::jsonb, -- best examples of their voice
  
  -- Metadata
  analyzed_email_count INTEGER DEFAULT 0,
  analyzed_sms_count INTEGER DEFAULT 0,
  last_analyzed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create email snippets table for quick-insert templates
CREATE TABLE public.email_snippets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  shortcut TEXT NOT NULL, -- e.g. "/intro" or "/sig"
  content TEXT NOT NULL,
  category TEXT DEFAULT 'general', -- 'greeting', 'closing', 'body', 'cta'
  variables JSONB DEFAULT '[]'::jsonb, -- ["recipient_name", "property_address"]
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create follow-up reminders table
CREATE TABLE public.follow_up_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  lead_id UUID REFERENCES leads(id),
  owner_id UUID REFERENCES property_owners(id),
  contact_email TEXT,
  contact_phone TEXT,
  contact_name TEXT,
  original_message_id UUID,
  original_sent_at TIMESTAMP WITH TIME ZONE,
  remind_at TIMESTAMP WITH TIME ZONE NOT NULL,
  reminder_type TEXT DEFAULT 'no_response', -- 'no_response', 'scheduled', 'custom'
  status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'dismissed', 'snoozed'
  suggested_draft TEXT,
  ai_generated_followup TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  dismissed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create email/conversation summaries table
CREATE TABLE public.conversation_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES leads(id),
  owner_id UUID REFERENCES property_owners(id),
  contact_email TEXT,
  contact_phone TEXT,
  one_liner TEXT NOT NULL, -- "Discussed property management for 3BR in Buckhead"
  full_summary TEXT,
  key_points JSONB DEFAULT '[]'::jsonb,
  action_items JSONB DEFAULT '[]'::jsonb,
  sentiment TEXT, -- 'positive', 'neutral', 'negative', 'urgent'
  last_message_at TIMESTAMP WITH TIME ZONE,
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_tone_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_snippets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_up_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_summaries ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_tone_profiles
CREATE POLICY "Users can view their own tone profile" 
ON public.user_tone_profiles FOR SELECT 
USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can create tone profiles" 
ON public.user_tone_profiles FOR INSERT 
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update their tone profiles" 
ON public.user_tone_profiles FOR UPDATE 
USING (auth.uid() = user_id OR user_id IS NULL);

-- RLS policies for email_snippets
CREATE POLICY "Users can view their snippets or shared" 
ON public.email_snippets FOR SELECT 
USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can create snippets" 
ON public.email_snippets FOR INSERT 
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update their snippets" 
ON public.email_snippets FOR UPDATE 
USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can delete their snippets" 
ON public.email_snippets FOR DELETE 
USING (auth.uid() = user_id OR user_id IS NULL);

-- RLS policies for follow_up_reminders
CREATE POLICY "Users can view their reminders" 
ON public.follow_up_reminders FOR SELECT 
USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can create reminders" 
ON public.follow_up_reminders FOR INSERT 
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update their reminders" 
ON public.follow_up_reminders FOR UPDATE 
USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can delete their reminders" 
ON public.follow_up_reminders FOR DELETE 
USING (auth.uid() = user_id OR user_id IS NULL);

-- RLS policies for conversation_summaries
CREATE POLICY "All authenticated users can view summaries" 
ON public.conversation_summaries FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "All authenticated users can create summaries" 
ON public.conversation_summaries FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "All authenticated users can update summaries" 
ON public.conversation_summaries FOR UPDATE 
USING (auth.role() = 'authenticated');

-- Indexes for performance
CREATE INDEX idx_tone_profiles_user ON public.user_tone_profiles(user_id);
CREATE INDEX idx_snippets_user ON public.email_snippets(user_id);
CREATE INDEX idx_snippets_shortcut ON public.email_snippets(shortcut);
CREATE INDEX idx_follow_up_remind_at ON public.follow_up_reminders(remind_at) WHERE status = 'pending';
CREATE INDEX idx_follow_up_user ON public.follow_up_reminders(user_id);
CREATE INDEX idx_summaries_lead ON public.conversation_summaries(lead_id);
CREATE INDEX idx_summaries_owner ON public.conversation_summaries(owner_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_tone_profiles_updated_at
BEFORE UPDATE ON public.user_tone_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_snippets_updated_at
BEFORE UPDATE ON public.email_snippets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_follow_up_reminders_updated_at
BEFORE UPDATE ON public.follow_up_reminders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_conversation_summaries_updated_at
BEFORE UPDATE ON public.conversation_summaries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();