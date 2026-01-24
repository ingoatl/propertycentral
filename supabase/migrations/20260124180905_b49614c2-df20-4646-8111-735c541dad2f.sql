-- Add tracking column to property_owners
ALTER TABLE property_owners 
ADD COLUMN IF NOT EXISTS last_feature_email_sent TIMESTAMPTZ DEFAULT NULL;

-- Create feature changelog table
CREATE TABLE IF NOT EXISTS feature_changelog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version VARCHAR(20) NOT NULL,
  feature_key VARCHAR(100) NOT NULL UNIQUE,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  screenshot_url TEXT,
  relevant_for_onboarding BOOLEAN DEFAULT TRUE,
  relevant_for_active BOOLEAN DEFAULT TRUE,
  relevant_for_hybrid BOOLEAN DEFAULT TRUE,
  relevant_for_mid_term BOOLEAN DEFAULT TRUE,
  category VARCHAR(50) DEFAULT 'general',
  released_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE feature_changelog ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read features
CREATE POLICY "Authenticated users can read features"
ON feature_changelog FOR SELECT
TO authenticated
USING (true);

-- Seed with current new features
INSERT INTO feature_changelog (version, feature_key, title, description, screenshot_url, category, relevant_for_onboarding, relevant_for_active) VALUES
('2.0', 'messages_tab', 'New Messages Tab', 'View all communications between you and PeachHaus in one place—emails, SMS, voicemails, and video messages. Never miss an update about your property.', 'https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/screenshots/messages-tab.png', 'communication', true, true),
('2.0', 'maintenance_tab', 'Real-Time Maintenance Tracking', 'See every work order for your property with before/during/after photos. Approve repairs directly from your phone with one tap.', 'https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/screenshots/maintenance-tab.png', 'maintenance', false, true),
('2.0', 'guest_screenings', 'Guest Verification Dashboard', 'Every guest is professionally screened before arrival. View ID verification status, background check results, and risk scores for complete peace of mind.', 'https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/screenshots/screenings-tab.png', 'security', false, true),
('2.0', 'marketing_tab', 'Marketing Activity Visibility', 'See exactly how we market your property—social media posts, corporate outreach calls, and listing optimizations. Track reach and engagement metrics.', 'https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/screenshots/marketing-tab.png', 'marketing', true, true),
('2.0', 'voice_recap', 'Monthly Voice Recaps', 'Listen to personalized audio summaries of your property performance. Get updates via text message with a link to your audio recap.', 'https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/screenshots/voice-recap.png', 'communication', true, true),
('2.0', 'onboarding_timeline', 'Visual Onboarding Progress', 'Track your property onboarding journey step-by-step. See what is complete, what is in progress, and what is coming next.', 'https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/screenshots/onboarding-timeline.png', 'onboarding', true, false),
('2.0', 'schedule_calls', 'Schedule Owner Calls', 'Book a call with your property manager directly from the portal. Choose your preferred time and meeting format (video or phone).', 'https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/screenshots/schedule-call.png', 'communication', true, true),
('2.0', 'pdf_reports', 'Downloadable PDF Reports', 'Generate beautiful PDF reports of your property performance. Perfect for tax records, partners, or your own records.', 'https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/screenshots/pdf-report.png', 'reporting', false, true)
ON CONFLICT (feature_key) DO NOTHING;