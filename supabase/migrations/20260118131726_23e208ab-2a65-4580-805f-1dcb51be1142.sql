-- Contact Intelligence Table - stores deep insights about each contact
CREATE TABLE public.contact_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_type TEXT NOT NULL CHECK (contact_type IN ('lead', 'owner')),
  contact_id UUID NOT NULL,
  relationship_stage TEXT DEFAULT 'initial' CHECK (relationship_stage IN ('initial', 'qualified', 'negotiating', 'contract_sent', 'onboarding', 'active', 'vip')),
  avg_response_time_hours NUMERIC,
  preferred_channel TEXT CHECK (preferred_channel IN ('sms', 'email', 'call', 'unknown')),
  communication_style TEXT CHECK (communication_style IN ('formal', 'casual', 'brief', 'detailed', 'unknown')),
  emotional_baseline TEXT DEFAULT 'neutral' CHECK (emotional_baseline IN ('positive', 'neutral', 'cautious', 'demanding')),
  decision_making_speed TEXT DEFAULT 'unknown' CHECK (decision_making_speed IN ('fast', 'deliberate', 'unknown')),
  pain_points JSONB DEFAULT '[]'::jsonb,
  interests JSONB DEFAULT '[]'::jsonb,
  topic_threads JSONB DEFAULT '[]'::jsonb,
  unanswered_questions JSONB DEFAULT '[]'::jsonb,
  our_promises JSONB DEFAULT '[]'::jsonb,
  sentiment_trajectory TEXT DEFAULT 'stable' CHECK (sentiment_trajectory IN ('improving', 'stable', 'declining')),
  total_messages_sent INTEGER DEFAULT 0,
  total_messages_received INTEGER DEFAULT 0,
  last_sentiment TEXT,
  last_analyzed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contact_type, contact_id)
);

-- AI Response Quality Tracking - for learning and improvement
CREATE TABLE public.ai_response_quality (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id UUID REFERENCES lead_communications(id) ON DELETE SET NULL,
  contact_type TEXT NOT NULL,
  contact_id UUID,
  message_type TEXT NOT NULL CHECK (message_type IN ('sms', 'email')),
  incoming_message TEXT,
  generated_response TEXT NOT NULL,
  final_response TEXT,
  was_sent_as_is BOOLEAN DEFAULT false,
  edit_distance INTEGER,
  quality_score INTEGER CHECK (quality_score >= 0 AND quality_score <= 100),
  validation_issues JSONB DEFAULT '[]'::jsonb,
  questions_detected JSONB DEFAULT '[]'::jsonb,
  questions_answered JSONB DEFAULT '[]'::jsonb,
  knowledge_entries_used JSONB DEFAULT '[]'::jsonb,
  sentiment_detected TEXT,
  tone_profile_used JSONB,
  context_summary JSONB,
  model_used TEXT,
  generation_time_ms INTEGER,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.contact_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_response_quality ENABLE ROW LEVEL SECURITY;

-- RLS Policies for contact_intelligence
CREATE POLICY "Authenticated users can view contact intelligence"
ON public.contact_intelligence FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert contact intelligence"
ON public.contact_intelligence FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update contact intelligence"
ON public.contact_intelligence FOR UPDATE
TO authenticated
USING (true);

-- RLS Policies for ai_response_quality
CREATE POLICY "Authenticated users can view AI response quality"
ON public.ai_response_quality FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert AI response quality"
ON public.ai_response_quality FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update AI response quality"
ON public.ai_response_quality FOR UPDATE
TO authenticated
USING (true);

-- Indexes for performance
CREATE INDEX idx_contact_intelligence_contact ON public.contact_intelligence(contact_type, contact_id);
CREATE INDEX idx_contact_intelligence_stage ON public.contact_intelligence(relationship_stage);
CREATE INDEX idx_ai_response_quality_contact ON public.ai_response_quality(contact_type, contact_id);
CREATE INDEX idx_ai_response_quality_created ON public.ai_response_quality(created_at DESC);
CREATE INDEX idx_ai_response_quality_quality ON public.ai_response_quality(quality_score);

-- Update trigger for contact_intelligence
CREATE TRIGGER update_contact_intelligence_updated_at
BEFORE UPDATE ON public.contact_intelligence
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();