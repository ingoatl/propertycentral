-- =====================================================
-- PHASE 1: VENDOR & MAINTENANCE MANAGEMENT SCHEMA
-- =====================================================

-- Create enum for work order status
CREATE TYPE work_order_status AS ENUM (
  'new', 'triaging', 'awaiting_approval', 'approved', 
  'dispatched', 'scheduled', 'in_progress', 'pending_verification',
  'completed', 'cancelled', 'on_hold'
);

-- Create enum for work order urgency
CREATE TYPE work_order_urgency AS ENUM ('low', 'normal', 'high', 'emergency');

-- Create enum for vendor status
CREATE TYPE vendor_status AS ENUM ('active', 'inactive', 'preferred', 'blocked');

-- Create enum for message sender type
CREATE TYPE message_sender_type AS ENUM ('owner', 'pm', 'vendor', 'guest', 'ai', 'system');

-- Create enum for approval status
CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'declined', 'auto_approved', 'expired');

-- =====================================================
-- 1. VENDORS TABLE
-- =====================================================
CREATE TABLE public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company_name text,
  email text,
  phone text NOT NULL,
  specialty text[] NOT NULL DEFAULT '{}',
  service_area text[] DEFAULT '{}',
  hourly_rate numeric,
  emergency_rate numeric,
  emergency_available boolean DEFAULT false,
  average_rating numeric DEFAULT 0,
  total_jobs_completed integer DEFAULT 0,
  average_response_time_hours numeric,
  license_number text,
  insurance_verified boolean DEFAULT false,
  insurance_expiration date,
  w9_on_file boolean DEFAULT false,
  preferred_payment_method text,
  notes text,
  status vendor_status DEFAULT 'active',
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage vendors"
  ON public.vendors FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Approved users can view vendors"
  ON public.vendors FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.status = 'approved'
  ));

-- =====================================================
-- 2. PROPERTY VENDOR ASSIGNMENTS TABLE
-- =====================================================
CREATE TABLE public.property_vendor_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE CASCADE NOT NULL,
  specialty text NOT NULL,
  is_primary boolean DEFAULT false,
  spend_limit numeric,
  notes text,
  assigned_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(property_id, vendor_id, specialty)
);

ALTER TABLE public.property_vendor_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage vendor assignments"
  ON public.property_vendor_assignments FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Approved users can view vendor assignments"
  ON public.property_vendor_assignments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.status = 'approved'
  ));

-- =====================================================
-- 3. PROPERTY MAINTENANCE BOOK TABLE
-- =====================================================
CREATE TABLE public.property_maintenance_book (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- Spend limits by category
  hvac_spend_limit numeric DEFAULT 500,
  plumbing_spend_limit numeric DEFAULT 300,
  electrical_spend_limit numeric DEFAULT 300,
  appliance_spend_limit numeric DEFAULT 250,
  general_spend_limit numeric DEFAULT 200,
  exterior_spend_limit numeric DEFAULT 300,
  cleaning_spend_limit numeric DEFAULT 150,
  emergency_authorization_limit numeric DEFAULT 1000,
  
  -- Owner preferences
  require_owner_approval_above numeric DEFAULT 500,
  auto_approve_preferred_vendors boolean DEFAULT true,
  preferred_contact_method text DEFAULT 'email',
  owner_prefers_lowest_bid boolean DEFAULT false,
  require_multiple_quotes_above numeric DEFAULT 1000,
  
  -- Maintenance notes
  maintenance_notes text,
  special_instructions text,
  access_instructions text,
  lockbox_code text,
  gate_code text,
  alarm_code text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.property_maintenance_book ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage maintenance book"
  ON public.property_maintenance_book FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Approved users can view maintenance book"
  ON public.property_maintenance_book FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.status = 'approved'
  ));

-- =====================================================
-- 4. APPLIANCE WARRANTIES TABLE
-- =====================================================
CREATE TABLE public.appliance_warranties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  appliance_type text NOT NULL,
  brand text,
  model_number text,
  serial_number text,
  purchase_date date,
  installation_date date,
  warranty_start_date date,
  warranty_expiration date,
  warranty_type text,
  warranty_provider text,
  warranty_phone text,
  warranty_email text,
  policy_number text,
  coverage_details text,
  deductible numeric,
  max_coverage numeric,
  photo_path text,
  receipt_path text,
  notes text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.appliance_warranties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage warranties"
  ON public.appliance_warranties FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Approved users can view warranties"
  ON public.appliance_warranties FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.status = 'approved'
  ));

-- =====================================================
-- 5. WORK ORDERS TABLE
-- =====================================================
CREATE TABLE public.work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  work_order_number serial,
  
  -- Request Details
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  urgency work_order_urgency DEFAULT 'normal',
  source text DEFAULT 'internal',
  
  -- AI Triage
  ai_triage_summary text,
  ai_troubleshooting_steps jsonb DEFAULT '[]',
  ai_suggested_category text,
  ai_suggested_vendor_id uuid REFERENCES public.vendors(id),
  ai_estimated_cost_low numeric,
  ai_estimated_cost_high numeric,
  ai_confidence_score numeric,
  requires_vendor boolean DEFAULT true,
  troubleshooting_resolved boolean DEFAULT false,
  
  -- Assignment
  assigned_vendor_id uuid REFERENCES public.vendors(id),
  assigned_by uuid,
  assigned_at timestamptz,
  vendor_accepted boolean,
  vendor_accepted_at timestamptz,
  vendor_declined_reason text,
  
  -- Scheduling
  scheduled_date date,
  scheduled_time_start time,
  scheduled_time_end time,
  scheduled_time_window text,
  access_instructions text,
  guest_notified boolean DEFAULT false,
  guest_notified_at timestamptz,
  owner_notified boolean DEFAULT false,
  owner_notified_at timestamptz,
  
  -- Financial
  estimated_cost numeric,
  quoted_cost numeric,
  actual_cost numeric,
  owner_approved boolean,
  owner_approved_at timestamptz,
  owner_approved_by uuid,
  expense_id uuid REFERENCES public.expenses(id),
  invoice_path text,
  
  -- Status
  status work_order_status DEFAULT 'new',
  
  -- Verification
  before_photos text[] DEFAULT '{}',
  after_photos text[] DEFAULT '{}',
  vendor_notes text,
  completion_verified boolean DEFAULT false,
  verified_by uuid,
  verified_at timestamptz,
  verification_notes text,
  
  -- Linking
  inspection_issue_id uuid REFERENCES public.inspection_issues(id),
  parent_work_order_id uuid REFERENCES public.work_orders(id),
  warranty_id uuid REFERENCES public.appliance_warranties(id),
  
  -- Reporter
  reported_by text,
  reported_by_user_id uuid,
  reported_by_email text,
  reported_by_phone text,
  
  -- Metadata
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_reason text
);

ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all work orders"
  ON public.work_orders FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Approved users can view all work orders"
  ON public.work_orders FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.status = 'approved'
  ));

CREATE POLICY "Approved users can create work orders"
  ON public.work_orders FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.status = 'approved'
  ));

CREATE POLICY "Approved users can update work orders"
  ON public.work_orders FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.status = 'approved'
  ));

-- =====================================================
-- 6. WORK ORDER TIMELINE TABLE
-- =====================================================
CREATE TABLE public.work_order_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE CASCADE NOT NULL,
  action text NOT NULL,
  performed_by_type message_sender_type DEFAULT 'system',
  performed_by_name text,
  performed_by_user_id uuid,
  previous_status work_order_status,
  new_status work_order_status,
  details jsonb DEFAULT '{}',
  is_internal boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.work_order_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage timeline"
  ON public.work_order_timeline FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Approved users can view timeline"
  ON public.work_order_timeline FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.status = 'approved'
  ));

CREATE POLICY "Approved users can insert timeline"
  ON public.work_order_timeline FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.status = 'approved'
  ));

-- =====================================================
-- 7. OWNER PORTAL ACCESS TABLE
-- =====================================================
CREATE TABLE public.owner_portal_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES public.property_owners(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email text NOT NULL,
  magic_link_token uuid DEFAULT gen_random_uuid(),
  magic_link_expires_at timestamptz,
  last_login_at timestamptz,
  login_count integer DEFAULT 0,
  
  -- Notification preferences
  notification_level text DEFAULT 'important',
  notify_work_requested boolean DEFAULT true,
  notify_work_scheduled boolean DEFAULT true,
  notify_work_completed boolean DEFAULT true,
  notify_approval_needed boolean DEFAULT true,
  notify_monthly_report boolean DEFAULT true,
  prefer_sms boolean DEFAULT false,
  sms_phone text,
  
  -- Portal preferences
  default_view text DEFAULT 'dashboard',
  timezone text DEFAULT 'America/New_York',
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.owner_portal_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage owner portal access"
  ON public.owner_portal_access FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Approved users can view owner portal access"
  ON public.owner_portal_access FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.status = 'approved'
  ));

-- =====================================================
-- 8. OWNER APPROVALS TABLE
-- =====================================================
CREATE TABLE public.owner_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE CASCADE NOT NULL,
  owner_id uuid REFERENCES public.property_owners(id) ON DELETE CASCADE NOT NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  
  -- Approval details
  amount_requiring_approval numeric NOT NULL,
  approval_threshold numeric NOT NULL,
  reason_for_approval text,
  
  -- Request tracking
  requested_at timestamptz DEFAULT now(),
  requested_by uuid,
  expires_at timestamptz,
  reminder_sent_at timestamptz,
  reminder_count integer DEFAULT 0,
  
  -- Response
  status approval_status DEFAULT 'pending',
  responded_at timestamptz,
  owner_notes text,
  approved_amount numeric,
  
  -- Auto-approval tracking
  auto_approved_reason text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.owner_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage approvals"
  ON public.owner_approvals FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Approved users can view approvals"
  ON public.owner_approvals FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.status = 'approved'
  ));

CREATE POLICY "Approved users can create approvals"
  ON public.owner_approvals FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.status = 'approved'
  ));

-- =====================================================
-- 9. MAINTENANCE MESSAGES TABLE
-- =====================================================
CREATE TABLE public.maintenance_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE CASCADE NOT NULL,
  
  -- Sender info
  sender_type message_sender_type NOT NULL,
  sender_name text NOT NULL,
  sender_user_id uuid,
  sender_email text,
  
  -- Message content
  message_text text NOT NULL,
  attachments text[] DEFAULT '{}',
  
  -- Visibility
  is_internal boolean DEFAULT false,
  visible_to_owner boolean DEFAULT true,
  visible_to_vendor boolean DEFAULT true,
  visible_to_guest boolean DEFAULT true,
  
  -- Read tracking
  read_by_owner boolean DEFAULT false,
  read_by_owner_at timestamptz,
  read_by_vendor boolean DEFAULT false,
  read_by_vendor_at timestamptz,
  
  -- AI generated
  is_ai_generated boolean DEFAULT false,
  ai_context jsonb,
  
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.maintenance_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage messages"
  ON public.maintenance_messages FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Approved users can view messages"
  ON public.maintenance_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.status = 'approved'
  ));

CREATE POLICY "Approved users can insert messages"
  ON public.maintenance_messages FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.status = 'approved'
  ));

-- =====================================================
-- 10. MAINTENANCE TROUBLESHOOTING GUIDES TABLE
-- =====================================================
CREATE TABLE public.maintenance_troubleshooting_guides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  issue_type text NOT NULL,
  title text NOT NULL,
  description text,
  
  -- Troubleshooting steps (ordered)
  steps jsonb NOT NULL DEFAULT '[]',
  
  -- AI context
  keywords text[] DEFAULT '{}',
  common_causes text[] DEFAULT '{}',
  typical_resolution_time text,
  typical_cost_range text,
  requires_professional boolean DEFAULT false,
  urgency_indicators text[] DEFAULT '{}',
  
  -- Property-specific (null = applies to all)
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE,
  
  -- Metadata
  success_rate numeric,
  times_used integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.maintenance_troubleshooting_guides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage troubleshooting guides"
  ON public.maintenance_troubleshooting_guides FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Approved users can view troubleshooting guides"
  ON public.maintenance_troubleshooting_guides FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.status = 'approved'
  ));

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX idx_vendors_specialty ON public.vendors USING GIN (specialty);
CREATE INDEX idx_vendors_status ON public.vendors (status);
CREATE INDEX idx_vendors_service_area ON public.vendors USING GIN (service_area);

CREATE INDEX idx_property_vendor_assignments_property ON public.property_vendor_assignments (property_id);
CREATE INDEX idx_property_vendor_assignments_vendor ON public.property_vendor_assignments (vendor_id);

CREATE INDEX idx_work_orders_property ON public.work_orders (property_id);
CREATE INDEX idx_work_orders_status ON public.work_orders (status);
CREATE INDEX idx_work_orders_vendor ON public.work_orders (assigned_vendor_id);
CREATE INDEX idx_work_orders_category ON public.work_orders (category);
CREATE INDEX idx_work_orders_urgency ON public.work_orders (urgency);
CREATE INDEX idx_work_orders_created ON public.work_orders (created_at DESC);

CREATE INDEX idx_work_order_timeline_work_order ON public.work_order_timeline (work_order_id);
CREATE INDEX idx_work_order_timeline_created ON public.work_order_timeline (created_at DESC);

CREATE INDEX idx_owner_approvals_work_order ON public.owner_approvals (work_order_id);
CREATE INDEX idx_owner_approvals_owner ON public.owner_approvals (owner_id);
CREATE INDEX idx_owner_approvals_status ON public.owner_approvals (status);

CREATE INDEX idx_maintenance_messages_work_order ON public.maintenance_messages (work_order_id);
CREATE INDEX idx_maintenance_messages_created ON public.maintenance_messages (created_at DESC);

CREATE INDEX idx_appliance_warranties_property ON public.appliance_warranties (property_id);
CREATE INDEX idx_appliance_warranties_expiration ON public.appliance_warranties (warranty_expiration);

CREATE INDEX idx_troubleshooting_guides_category ON public.maintenance_troubleshooting_guides (category, issue_type);
CREATE INDEX idx_troubleshooting_guides_keywords ON public.maintenance_troubleshooting_guides USING GIN (keywords);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================
CREATE TRIGGER update_vendors_updated_at
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_property_vendor_assignments_updated_at
  BEFORE UPDATE ON public.property_vendor_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_property_maintenance_book_updated_at
  BEFORE UPDATE ON public.property_maintenance_book
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_appliance_warranties_updated_at
  BEFORE UPDATE ON public.appliance_warranties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_work_orders_updated_at
  BEFORE UPDATE ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_owner_portal_access_updated_at
  BEFORE UPDATE ON public.owner_portal_access
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_owner_approvals_updated_at
  BEFORE UPDATE ON public.owner_approvals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_troubleshooting_guides_updated_at
  BEFORE UPDATE ON public.maintenance_troubleshooting_guides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();