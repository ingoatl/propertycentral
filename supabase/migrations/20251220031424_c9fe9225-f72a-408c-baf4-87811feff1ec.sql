-- Create holiday email queue table for scheduled emails
CREATE TABLE public.holiday_email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public.property_owners(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.holiday_email_templates(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  scheduled_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  generated_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(owner_id, template_id, recipient_email, scheduled_date)
);

-- Enable RLS
ALTER TABLE public.holiday_email_queue ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view queue
CREATE POLICY "Authenticated users can view holiday email queue"
  ON public.holiday_email_queue FOR SELECT
  TO authenticated USING (true);

-- Allow service role full access
CREATE POLICY "Service role can manage holiday email queue"
  ON public.holiday_email_queue FOR ALL
  TO service_role USING (true);

-- Function to schedule holiday emails for an owner
CREATE OR REPLACE FUNCTION public.schedule_holiday_emails_for_owner()
RETURNS TRIGGER AS $$
DECLARE
  template RECORD;
  prop RECORD;
  schedule_date DATE;
  owner_record RECORD;
BEGIN
  -- Get owner info
  SELECT * INTO owner_record FROM property_owners WHERE id = NEW.owner_id;
  
  IF owner_record IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get all active holiday templates
  FOR template IN 
    SELECT * FROM holiday_email_templates WHERE is_active = true
  LOOP
    -- Calculate next occurrence date
    IF template.recurring THEN
      -- For recurring, use this year or next year
      schedule_date := make_date(
        EXTRACT(YEAR FROM CURRENT_DATE)::int,
        EXTRACT(MONTH FROM template.holiday_date)::int,
        EXTRACT(DAY FROM template.holiday_date)::int
      );
      -- If date has passed this year, schedule for next year
      IF schedule_date < CURRENT_DATE THEN
        schedule_date := schedule_date + INTERVAL '1 year';
      END IF;
    ELSE
      schedule_date := template.holiday_date;
      -- Skip if date has passed
      IF schedule_date < CURRENT_DATE THEN
        CONTINUE;
      END IF;
    END IF;

    -- Schedule for primary owner email
    INSERT INTO holiday_email_queue (owner_id, property_id, template_id, recipient_email, recipient_name, scheduled_date)
    VALUES (owner_record.id, NEW.id, template.id, owner_record.email, owner_record.name, schedule_date)
    ON CONFLICT (owner_id, template_id, recipient_email, scheduled_date) DO NOTHING;

    -- Schedule for second owner if exists
    IF owner_record.second_owner_email IS NOT NULL AND owner_record.second_owner_email != '' THEN
      INSERT INTO holiday_email_queue (owner_id, property_id, template_id, recipient_email, recipient_name, scheduled_date)
      VALUES (owner_record.id, NEW.id, template.id, owner_record.second_owner_email, COALESCE(owner_record.second_owner_name, owner_record.name), schedule_date)
      ON CONFLICT (owner_id, template_id, recipient_email, scheduled_date) DO NOTHING;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on new property (which has owner_id)
CREATE TRIGGER schedule_holiday_emails_on_property_insert
  AFTER INSERT ON public.properties
  FOR EACH ROW
  WHEN (NEW.owner_id IS NOT NULL AND NEW.offboarded_at IS NULL)
  EXECUTE FUNCTION public.schedule_holiday_emails_for_owner();

-- Function to schedule emails for all owners when new template is created
CREATE OR REPLACE FUNCTION public.schedule_emails_for_new_template()
RETURNS TRIGGER AS $$
DECLARE
  prop RECORD;
  owner_record RECORD;
  schedule_date DATE;
BEGIN
  IF NOT NEW.is_active THEN
    RETURN NEW;
  END IF;

  -- Calculate schedule date
  IF NEW.recurring THEN
    schedule_date := make_date(
      EXTRACT(YEAR FROM CURRENT_DATE)::int,
      EXTRACT(MONTH FROM NEW.holiday_date)::int,
      EXTRACT(DAY FROM NEW.holiday_date)::int
    );
    IF schedule_date < CURRENT_DATE THEN
      schedule_date := schedule_date + INTERVAL '1 year';
    END IF;
  ELSE
    schedule_date := NEW.holiday_date;
    IF schedule_date < CURRENT_DATE THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Schedule for all active properties with owners
  FOR prop IN 
    SELECT p.id as property_id, p.owner_id, po.name, po.email, po.second_owner_name, po.second_owner_email
    FROM properties p
    JOIN property_owners po ON p.owner_id = po.id
    WHERE p.offboarded_at IS NULL AND p.owner_id IS NOT NULL
  LOOP
    -- Primary owner
    INSERT INTO holiday_email_queue (owner_id, property_id, template_id, recipient_email, recipient_name, scheduled_date)
    VALUES (prop.owner_id, prop.property_id, NEW.id, prop.email, prop.name, schedule_date)
    ON CONFLICT (owner_id, template_id, recipient_email, scheduled_date) DO NOTHING;

    -- Second owner
    IF prop.second_owner_email IS NOT NULL AND prop.second_owner_email != '' THEN
      INSERT INTO holiday_email_queue (owner_id, property_id, template_id, recipient_email, recipient_name, scheduled_date)
      VALUES (prop.owner_id, prop.property_id, NEW.id, prop.second_owner_email, COALESCE(prop.second_owner_name, prop.name), schedule_date)
      ON CONFLICT (owner_id, template_id, recipient_email, scheduled_date) DO NOTHING;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on new template
CREATE TRIGGER schedule_emails_on_template_insert
  AFTER INSERT ON public.holiday_email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.schedule_emails_for_new_template();

-- Index for efficient queries
CREATE INDEX idx_holiday_email_queue_scheduled ON public.holiday_email_queue(scheduled_date, status);
CREATE INDEX idx_holiday_email_queue_status ON public.holiday_email_queue(status);