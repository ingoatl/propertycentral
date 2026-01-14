-- Add visibility tracking columns to lead_communications
ALTER TABLE lead_communications 
ADD COLUMN IF NOT EXISTS visibility_users UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS recipient_user_id UUID,
ADD COLUMN IF NOT EXISTS cc_user_ids UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS work_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS labels TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT now();

-- Add check constraint for work_status
ALTER TABLE lead_communications 
ADD CONSTRAINT lead_communications_work_status_check 
CHECK (work_status IN ('pending', 'in_progress', 'resolved', 'archived'));

-- Create index for visibility filtering
CREATE INDEX IF NOT EXISTS idx_lead_comm_visibility_users ON lead_communications USING GIN (visibility_users);
CREATE INDEX IF NOT EXISTS idx_lead_comm_recipient_user ON lead_communications (recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_lead_comm_work_status ON lead_communications (work_status);
CREATE INDEX IF NOT EXISTS idx_lead_comm_labels ON lead_communications USING GIN (labels);

-- Create user Gmail labels mapping table
CREATE TABLE IF NOT EXISTS user_gmail_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  label_name TEXT NOT NULL,
  gmail_label_id TEXT,
  email_address TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, label_name)
);

-- Enable RLS on user_gmail_labels
ALTER TABLE user_gmail_labels ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_gmail_labels
CREATE POLICY "Users can view all gmail labels" ON user_gmail_labels
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage gmail labels" ON user_gmail_labels
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Create communication recipients table for tracking to/cc/assigned
CREATE TABLE IF NOT EXISTS communication_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id UUID NOT NULL REFERENCES lead_communications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('to', 'cc', 'assigned', 'mentioned')),
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(communication_id, user_id, recipient_type)
);

-- Enable RLS on communication_recipients
ALTER TABLE communication_recipients ENABLE ROW LEVEL SECURITY;

-- RLS policies for communication_recipients
CREATE POLICY "Users can view their recipient records" ON communication_recipients
  FOR SELECT USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Users can update their own read status" ON communication_recipients
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "System can insert recipient records" ON communication_recipients
  FOR INSERT WITH CHECK (true);

-- Create indexes for communication_recipients
CREATE INDEX IF NOT EXISTS idx_comm_recipients_user ON communication_recipients(user_id);
CREATE INDEX IF NOT EXISTS idx_comm_recipients_comm ON communication_recipients(communication_id);
CREATE INDEX IF NOT EXISTS idx_comm_recipients_unread ON communication_recipients(user_id, is_read) WHERE is_read = false;

-- Insert initial Gmail label mappings for existing team members
INSERT INTO user_gmail_labels (user_id, label_name, email_address) VALUES
  ('8f7c8f43-536f-4587-99dc-5086c144a045', 'ingo', 'ingo@peachhausgroup.com'),
  ('b2f495ac-2062-446e-bfa0-2197a82114c1', 'anja', 'anja@peachhausgroup.com'),
  ('fbd13e57-3a59-4c53-bb3b-14ab354b3420', 'alex', 'alex@peachhausgroup.com')
ON CONFLICT (user_id, label_name) DO NOTHING;

-- Create function to update last_activity_at
CREATE OR REPLACE FUNCTION update_communication_last_activity()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_activity_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for last_activity_at
DROP TRIGGER IF EXISTS update_lead_comm_activity ON lead_communications;
CREATE TRIGGER update_lead_comm_activity
  BEFORE UPDATE ON lead_communications
  FOR EACH ROW
  EXECUTE FUNCTION update_communication_last_activity();

-- Create function to auto-populate visibility_users
CREATE OR REPLACE FUNCTION populate_communication_visibility()
RETURNS TRIGGER AS $$
BEGIN
  -- Combine recipient_user_id, cc_user_ids, and assigned_to into visibility_users
  NEW.visibility_users = ARRAY(
    SELECT DISTINCT unnest(
      ARRAY[NEW.recipient_user_id] || 
      COALESCE(NEW.cc_user_ids, '{}') || 
      ARRAY[NEW.assigned_to]
    )
  );
  -- Remove nulls
  NEW.visibility_users = array_remove(NEW.visibility_users, NULL);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-populate visibility_users
DROP TRIGGER IF EXISTS populate_visibility_users ON lead_communications;
CREATE TRIGGER populate_visibility_users
  BEFORE INSERT OR UPDATE OF recipient_user_id, cc_user_ids, assigned_to ON lead_communications
  FOR EACH ROW
  EXECUTE FUNCTION populate_communication_visibility();