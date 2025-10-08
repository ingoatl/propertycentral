-- Create email insights table for storing parsed email data
CREATE TABLE IF NOT EXISTS public.email_insights (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE,
  owner_id uuid REFERENCES public.property_owners(id) ON DELETE CASCADE,
  email_date timestamp with time zone NOT NULL,
  sender_email text NOT NULL,
  subject text NOT NULL,
  summary text NOT NULL,
  category text NOT NULL,
  action_required boolean DEFAULT false,
  due_date date,
  priority text DEFAULT 'normal',
  status text DEFAULT 'new',
  gmail_message_id text UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create email scan log table
CREATE TABLE IF NOT EXISTS public.email_scan_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_date timestamp with time zone NOT NULL DEFAULT now(),
  emails_processed integer DEFAULT 0,
  insights_generated integer DEFAULT 0,
  scan_status text DEFAULT 'completed',
  error_message text
);

-- Create OAuth tokens table (encrypted storage)
CREATE TABLE IF NOT EXISTS public.gmail_oauth_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_scan_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmail_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_insights
CREATE POLICY "Approved users can view all email insights"
  ON public.email_insights FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.status = 'approved'
    )
  );

CREATE POLICY "Admins can insert email insights"
  ON public.email_insights FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update email insights"
  ON public.email_insights FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete email insights"
  ON public.email_insights FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for email_scan_log
CREATE POLICY "Admins can view scan logs"
  ON public.email_scan_log FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert scan logs"
  ON public.email_scan_log FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- RLS Policies for gmail_oauth_tokens
CREATE POLICY "Users can view their own tokens"
  ON public.gmail_oauth_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tokens"
  ON public.gmail_oauth_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tokens"
  ON public.gmail_oauth_tokens FOR UPDATE
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_email_insights_property ON public.email_insights(property_id);
CREATE INDEX idx_email_insights_owner ON public.email_insights(owner_id);
CREATE INDEX idx_email_insights_date ON public.email_insights(email_date DESC);
CREATE INDEX idx_email_insights_action_required ON public.email_insights(action_required) WHERE action_required = true;
CREATE INDEX idx_email_insights_status ON public.email_insights(status);
CREATE INDEX idx_gmail_oauth_user ON public.gmail_oauth_tokens(user_id);