-- Add property_id to user_phone_messages for smart property matching
ALTER TABLE public.user_phone_messages 
ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES public.properties(id),
ADD COLUMN IF NOT EXISTS notes text,
ADD COLUMN IF NOT EXISTS is_resolved boolean DEFAULT false;

-- Add property_id to user_phone_calls
ALTER TABLE public.user_phone_calls 
ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES public.properties(id);

-- Create conversation_notes table for storing notes per conversation
CREATE TABLE IF NOT EXISTS public.conversation_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  contact_phone text,
  contact_email text,
  contact_name text,
  note text NOT NULL,
  property_id uuid REFERENCES public.properties(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on conversation_notes
ALTER TABLE public.conversation_notes ENABLE ROW LEVEL SECURITY;

-- RLS policies for conversation_notes
CREATE POLICY "Users can view their own conversation notes"
ON public.conversation_notes FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own conversation notes"
ON public.conversation_notes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversation notes"
ON public.conversation_notes FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversation notes"
ON public.conversation_notes FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all conversation notes"
ON public.conversation_notes FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_conversation_notes_contact ON public.conversation_notes(contact_phone, contact_email);
CREATE INDEX IF NOT EXISTS idx_user_phone_messages_property ON public.user_phone_messages(property_id);
CREATE INDEX IF NOT EXISTS idx_user_phone_calls_property ON public.user_phone_calls(property_id);