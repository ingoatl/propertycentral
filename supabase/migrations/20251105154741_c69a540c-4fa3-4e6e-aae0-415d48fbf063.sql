-- Create daily_performance_entries table
CREATE TABLE IF NOT EXISTS public.daily_performance_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  entry TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.daily_performance_entries ENABLE ROW LEVEL SECURITY;

-- Create policies - allow users to view all entries (team-based filtering handled in application)
CREATE POLICY "Authenticated users can view all entries"
ON public.daily_performance_entries
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create their own entries"
ON public.daily_performance_entries
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own entries"
ON public.daily_performance_entries
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own entries"
ON public.daily_performance_entries
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX idx_daily_performance_entries_team_date ON public.daily_performance_entries(team_id, date DESC);
CREATE INDEX idx_daily_performance_entries_user ON public.daily_performance_entries(user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_daily_performance_entries_updated_at
BEFORE UPDATE ON public.daily_performance_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();