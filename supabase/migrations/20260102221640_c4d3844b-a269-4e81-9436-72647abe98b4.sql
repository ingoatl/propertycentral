-- Update the expense trigger with proper error handling
CREATE OR REPLACE FUNCTION public.auto_add_expense_to_reconciliation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rec_id uuid;
  month_start date;
BEGIN
  -- Calculate the month start for this expense
  month_start := date_trunc('month', NEW.date)::date;
  
  -- Find active reconciliation for this property/month
  SELECT id INTO rec_id
  FROM public.monthly_reconciliations
  WHERE property_id = NEW.property_id
    AND reconciliation_month = month_start
    AND status IN ('draft', 'pending', 'preview');
  
  -- If reconciliation exists, add line item (not verified, needs approval)
  IF rec_id IS NOT NULL THEN
    BEGIN
      INSERT INTO public.reconciliation_line_items (
        reconciliation_id, item_type, item_id, description, amount, date, category, verified, excluded
      ) VALUES (
        rec_id, 'expense', NEW.id,
        COALESCE(NEW.items_detail, NEW.purpose, NEW.category, 'Expense'),
        -(NEW.amount), NEW.date, COALESCE(NEW.category, 'Other'), false, false
      )
      ON CONFLICT (reconciliation_id, item_type, item_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      -- Log but don't fail the main operation
      RAISE NOTICE 'Could not auto-add expense to reconciliation: %', SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Update the visit trigger with proper error handling
CREATE OR REPLACE FUNCTION public.auto_add_visit_to_reconciliation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rec_id uuid;
  month_start date;
BEGIN
  -- Calculate the month start for this visit
  month_start := date_trunc('month', NEW.date)::date;
  
  -- Find active reconciliation for this property/month
  SELECT id INTO rec_id
  FROM public.monthly_reconciliations
  WHERE property_id = NEW.property_id
    AND reconciliation_month = month_start
    AND status IN ('draft', 'pending', 'preview');
  
  -- If reconciliation exists, add line item (not verified, needs approval)
  IF rec_id IS NOT NULL THEN
    BEGIN
      INSERT INTO public.reconciliation_line_items (
        reconciliation_id, item_type, item_id, description, amount, date, category, verified, excluded
      ) VALUES (
        rec_id, 'visit', NEW.id, 
        'Property visit' || COALESCE(' - ' || NEW.visited_by, ''),
        -(NEW.price), NEW.date, 'Visit Fee', false, false
      )
      ON CONFLICT (reconciliation_id, item_type, item_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      -- Log but don't fail the main operation
      RAISE NOTICE 'Could not auto-add visit to reconciliation: %', SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$function$;