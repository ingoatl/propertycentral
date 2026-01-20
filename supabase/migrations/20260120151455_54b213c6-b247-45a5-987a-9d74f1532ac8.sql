-- Add avatar_url and job_title to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS job_title TEXT;

-- Add file attachments support to team_messages
ALTER TABLE public.team_messages ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]';
ALTER TABLE public.team_messages ADD COLUMN IF NOT EXISTS mentions TEXT[] DEFAULT '{}';

-- Create profile-avatars bucket for team member photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-avatars', 'profile-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Create team-files bucket for message attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('team-files', 'team-files', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for profile-avatars bucket
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-avatars');

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'profile-avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'profile-avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'profile-avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS policies for team-files bucket
CREATE POLICY "Anyone authenticated can view team files"
ON storage.objects FOR SELECT
USING (bucket_id = 'team-files' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can upload team files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'team-files' AND auth.role() = 'authenticated');

-- Create full-text search index on team_messages for search
CREATE INDEX IF NOT EXISTS team_messages_content_search_idx 
ON public.team_messages USING gin(to_tsvector('english', content));

-- Update job titles for team members
UPDATE public.profiles SET job_title = 'Owner / CEO' WHERE email = 'ingo@peachhausgroup.com';
UPDATE public.profiles SET job_title = 'Operations Manager' WHERE email = 'anja@peachhausgroup.com';
UPDATE public.profiles SET job_title = 'Property Manager' WHERE email = 'alex@peachhausgroup.com';
UPDATE public.profiles SET job_title = 'Guest Relations' WHERE email = 'catherine@peachhausgroup.com';
UPDATE public.profiles SET job_title = 'Maintenance Coordinator' WHERE email = 'chris@peachhausgroup.com';