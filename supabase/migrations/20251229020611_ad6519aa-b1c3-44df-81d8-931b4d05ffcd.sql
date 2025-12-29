-- Create function to refresh all holiday email queues for existing properties
CREATE OR REPLACE FUNCTION public.refresh_all_holiday_email_queues()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  template RECORD;
  prop RECORD;
  schedule_date DATE;
BEGIN
  -- Loop through all active templates
  FOR template IN 
    SELECT * FROM public.holiday_email_templates WHERE is_active = true
  LOOP
    -- Calculate the next occurrence date
    IF template.recurring THEN
      schedule_date := make_date(
        EXTRACT(YEAR FROM CURRENT_DATE)::int,
        EXTRACT(MONTH FROM template.holiday_date)::int,
        EXTRACT(DAY FROM template.holiday_date)::int
      );
      IF schedule_date < CURRENT_DATE THEN
        schedule_date := schedule_date + INTERVAL '1 year';
      END IF;
    ELSE
      schedule_date := template.holiday_date;
      IF schedule_date < CURRENT_DATE THEN
        CONTINUE;
      END IF;
    END IF;

    -- Loop through all active properties with owners
    FOR prop IN 
      SELECT p.id as property_id, p.owner_id, po.name, po.email, po.second_owner_name, po.second_owner_email
      FROM public.properties p
      JOIN public.property_owners po ON p.owner_id = po.id
      WHERE p.offboarded_at IS NULL AND p.owner_id IS NOT NULL
    LOOP
      -- Insert or update primary owner email
      INSERT INTO public.holiday_email_queue (owner_id, property_id, template_id, recipient_email, recipient_name, scheduled_date, status)
      VALUES (prop.owner_id, prop.property_id, template.id, prop.email, prop.name, schedule_date, 'pending')
      ON CONFLICT (owner_id, template_id, recipient_email, scheduled_date) 
      DO UPDATE SET 
        property_id = EXCLUDED.property_id,
        recipient_name = EXCLUDED.recipient_name,
        updated_at = now()
      WHERE holiday_email_queue.status = 'pending';

      -- Insert or update second owner if exists
      IF prop.second_owner_email IS NOT NULL AND prop.second_owner_email != '' THEN
        INSERT INTO public.holiday_email_queue (owner_id, property_id, template_id, recipient_email, recipient_name, scheduled_date, status)
        VALUES (prop.owner_id, prop.property_id, template.id, prop.second_owner_email, COALESCE(prop.second_owner_name, prop.name), schedule_date, 'pending')
        ON CONFLICT (owner_id, template_id, recipient_email, scheduled_date) 
        DO UPDATE SET 
          property_id = EXCLUDED.property_id,
          recipient_name = EXCLUDED.recipient_name,
          updated_at = now()
        WHERE holiday_email_queue.status = 'pending';
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- Run it now to update all existing emails
SELECT public.refresh_all_holiday_email_queues();