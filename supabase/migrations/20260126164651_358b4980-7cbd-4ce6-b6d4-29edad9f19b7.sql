-- Create user_presence table for real-time availability tracking
CREATE TABLE public.user_presence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_available BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'away', 'busy', 'dnd', 'offline')),
  last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  device_info JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT user_presence_user_id_key UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all presence (for availability checks)
CREATE POLICY "Anyone can view user presence" 
ON public.user_presence 
FOR SELECT 
TO authenticated
USING (true);

-- Users can only update their own presence
CREATE POLICY "Users can update own presence" 
ON public.user_presence 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own presence
CREATE POLICY "Users can insert own presence" 
ON public.user_presence 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_user_presence_updated_at
  BEFORE UPDATE ON public.user_presence
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for efficient lookups
CREATE INDEX idx_user_presence_user_id ON public.user_presence(user_id);
CREATE INDEX idx_user_presence_status ON public.user_presence(status) WHERE is_available = true;

-- Enable realtime for presence updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;

-- Add missing columns to team_routing if they don't exist
DO $$ 
BEGIN
  -- Add forward_to_browser_client column for browser-based routing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'team_routing' AND column_name = 'mobile_number') THEN
    ALTER TABLE public.team_routing ADD COLUMN mobile_number TEXT;
  END IF;
  
  -- Add department/specialty for intelligent routing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'team_routing' AND column_name = 'department') THEN
    ALTER TABLE public.team_routing ADD COLUMN department TEXT;
  END IF;
  
  -- Add skills/specialties for AI routing decisions
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'team_routing' AND column_name = 'skills') THEN
    ALTER TABLE public.team_routing ADD COLUMN skills TEXT[];
  END IF;
END $$;