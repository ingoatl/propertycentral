-- Fix function search paths for security
CREATE OR REPLACE FUNCTION public.schedule_holiday_emails_for_owner()
RETURNS TRIGGER AS $$
DECLARE
  template RECORD;
  prop RECORD;
  schedule_date DATE;
  owner_record RECORD;
BEGIN
  SELECT * INTO owner_record FROM public.property_owners WHERE id = NEW.owner_id;
  
  IF owner_record IS NULL THEN
    RETURN NEW;
  END IF;

  FOR template IN 
    SELECT * FROM public.holiday_email_templates WHERE is_active = true
  LOOP
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

    INSERT INTO public.holiday_email_queue (owner_id, property_id, template_id, recipient_email, recipient_name, scheduled_date)
    VALUES (owner_record.id, NEW.id, template.id, owner_record.email, owner_record.name, schedule_date)
    ON CONFLICT (owner_id, template_id, recipient_email, scheduled_date) DO NOTHING;

    IF owner_record.second_owner_email IS NOT NULL AND owner_record.second_owner_email != '' THEN
      INSERT INTO public.holiday_email_queue (owner_id, property_id, template_id, recipient_email, recipient_name, scheduled_date)
      VALUES (owner_record.id, NEW.id, template.id, owner_record.second_owner_email, COALESCE(owner_record.second_owner_name, owner_record.name), schedule_date)
      ON CONFLICT (owner_id, template_id, recipient_email, scheduled_date) DO NOTHING;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.schedule_emails_for_new_template()
RETURNS TRIGGER AS $$
DECLARE
  prop RECORD;
  schedule_date DATE;
BEGIN
  IF NOT NEW.is_active THEN
    RETURN NEW;
  END IF;

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

  FOR prop IN 
    SELECT p.id as property_id, p.owner_id, po.name, po.email, po.second_owner_name, po.second_owner_email
    FROM public.properties p
    JOIN public.property_owners po ON p.owner_id = po.id
    WHERE p.offboarded_at IS NULL AND p.owner_id IS NOT NULL
  LOOP
    INSERT INTO public.holiday_email_queue (owner_id, property_id, template_id, recipient_email, recipient_name, scheduled_date)
    VALUES (prop.owner_id, prop.property_id, NEW.id, prop.email, prop.name, schedule_date)
    ON CONFLICT (owner_id, template_id, recipient_email, scheduled_date) DO NOTHING;

    IF prop.second_owner_email IS NOT NULL AND prop.second_owner_email != '' THEN
      INSERT INTO public.holiday_email_queue (owner_id, property_id, template_id, recipient_email, recipient_name, scheduled_date)
      VALUES (prop.owner_id, prop.property_id, NEW.id, prop.second_owner_email, COALESCE(prop.second_owner_name, prop.name), schedule_date)
      ON CONFLICT (owner_id, template_id, recipient_email, scheduled_date) DO NOTHING;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;