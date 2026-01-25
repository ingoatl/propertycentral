-- Create "Leadership" role if not exists
INSERT INTO public.team_roles (role_name, description)
VALUES ('Leadership', 'Strategic oversight, owner relationships, and business development')
ON CONFLICT (role_name) DO NOTHING;

-- Create role inbox preferences table for category-based filtering
CREATE TABLE IF NOT EXISTS public.role_inbox_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID REFERENCES public.team_roles(id) ON DELETE CASCADE NOT NULL,
  excluded_categories TEXT[] DEFAULT '{}',
  excluded_phone_purposes TEXT[] DEFAULT '{}',
  priority_categories TEXT[] DEFAULT '{}',
  focus_description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(role_id)
);

-- Enable RLS
ALTER TABLE public.role_inbox_preferences ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage role preferences"
  ON public.role_inbox_preferences
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view role preferences"
  ON public.role_inbox_preferences
  FOR SELECT
  TO authenticated
  USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_role_inbox_preferences_updated_at
  BEFORE UPDATE ON public.role_inbox_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default preferences for Leadership role (exclude guest-related content)
INSERT INTO public.role_inbox_preferences (role_id, excluded_categories, excluded_phone_purposes, priority_categories, focus_description)
SELECT 
  id,
  ARRAY['booking', 'guest_communication', 'guest_request', 'guest_screening', 'tenant_communication', 'guest']::TEXT[],
  ARRAY['guest_sms', 'booking_notification']::TEXT[],
  ARRAY['owner_communication', 'business_inquiry', 'onboarding', 'contract']::TEXT[],
  'Strategic decisions, owner relationships, discovery calls, and business development'
FROM public.team_roles 
WHERE role_name = 'Leadership';

-- Insert preferences for Ops Manager (focus on operations, guests)
INSERT INTO public.role_inbox_preferences (role_id, excluded_categories, priority_categories, focus_description)
SELECT 
  id,
  ARRAY[]::TEXT[],
  ARRAY['maintenance', 'guest_communication', 'cleaning', 'access', 'work_order']::TEXT[],
  'Property operations, maintenance, guest issues, and cleaning coordination'
FROM public.team_roles 
WHERE role_name = 'Ops Manager'
ON CONFLICT (role_id) DO NOTHING;

-- Insert preferences for Bookkeeper (focus on finance)
INSERT INTO public.role_inbox_preferences (role_id, excluded_categories, priority_categories, focus_description)
SELECT 
  id,
  ARRAY['guest_communication', 'maintenance']::TEXT[],
  ARRAY['payment', 'expense', 'invoice', 'financial', 'insurance', 'tax']::TEXT[],
  'Financial operations, expense verification, reconciliation, and owner statements'
FROM public.team_roles 
WHERE role_name = 'Bookkeeper'
ON CONFLICT (role_id) DO NOTHING;

-- Create a helper function to get user's excluded categories based on their roles
CREATE OR REPLACE FUNCTION public.get_user_inbox_exclusions(p_user_id UUID)
RETURNS TABLE (
  excluded_categories TEXT[],
  excluded_phone_purposes TEXT[],
  priority_categories TEXT[],
  focus_description TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COALESCE(
      (SELECT array_agg(DISTINCT cat) FROM (
        SELECT unnest(rip.excluded_categories) as cat
        FROM user_team_roles utr
        JOIN team_roles tr ON tr.id = utr.role_id
        JOIN role_inbox_preferences rip ON rip.role_id = tr.id
        WHERE utr.user_id = p_user_id
      ) sub),
      ARRAY[]::TEXT[]
    ) as excluded_categories,
    COALESCE(
      (SELECT array_agg(DISTINCT purp) FROM (
        SELECT unnest(rip.excluded_phone_purposes) as purp
        FROM user_team_roles utr
        JOIN team_roles tr ON tr.id = utr.role_id
        JOIN role_inbox_preferences rip ON rip.role_id = tr.id
        WHERE utr.user_id = p_user_id
      ) sub),
      ARRAY[]::TEXT[]
    ) as excluded_phone_purposes,
    COALESCE(
      (SELECT array_agg(DISTINCT pcat) FROM (
        SELECT unnest(rip.priority_categories) as pcat
        FROM user_team_roles utr
        JOIN team_roles tr ON tr.id = utr.role_id
        JOIN role_inbox_preferences rip ON rip.role_id = tr.id
        WHERE utr.user_id = p_user_id
      ) sub),
      ARRAY[]::TEXT[]
    ) as priority_categories,
    (SELECT string_agg(rip.focus_description, '; ')
     FROM user_team_roles utr
     JOIN team_roles tr ON tr.id = utr.role_id
     JOIN role_inbox_preferences rip ON rip.role_id = tr.id
     WHERE utr.user_id = p_user_id
    ) as focus_description
$$;