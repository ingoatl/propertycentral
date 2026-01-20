-- Drop existing SELECT policy and create a better one
DROP POLICY IF EXISTS "Users can view public channels and channels they are members of" ON public.team_channels;

-- Allow viewing public channels, channels user created, or channels they're members of
CREATE POLICY "Users can view channels" ON public.team_channels
FOR SELECT USING (
  channel_type = 'public' 
  OR created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM team_channel_members 
    WHERE team_channel_members.channel_id = team_channels.id 
    AND team_channel_members.user_id = auth.uid()
  )
);