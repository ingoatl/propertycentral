-- Function to auto-add visit to reconciliation when created
CREATE OR REPLACE FUNCTION public.auto_add_visit_to_reconciliation()
RETURNS TRIGGER AS $$
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
    INSERT INTO public.reconciliation_line_items (
      reconciliation_id, item_type, item_id, description, amount, date, category, verified, excluded
    ) VALUES (
      rec_id, 'visit', NEW.id, 
      'Property visit' || COALESCE(' - ' || NEW.visited_by, ''),
      -(NEW.price), NEW.date, 'Visit Fee', false, false
    )
    ON CONFLICT (reconciliation_id, item_type, item_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for visits
DROP TRIGGER IF EXISTS visit_auto_add_to_reconciliation ON public.visits;
CREATE TRIGGER visit_auto_add_to_reconciliation
AFTER INSERT ON public.visits
FOR EACH ROW
EXECUTE FUNCTION public.auto_add_visit_to_reconciliation();

-- Function to auto-add expense to reconciliation when created
CREATE OR REPLACE FUNCTION public.auto_add_expense_to_reconciliation()
RETURNS TRIGGER AS $$
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
    INSERT INTO public.reconciliation_line_items (
      reconciliation_id, item_type, item_id, description, amount, date, category, verified, excluded
    ) VALUES (
      rec_id, 'expense', NEW.id,
      COALESCE(NEW.items_detail, NEW.purpose, NEW.category, 'Expense'),
      -(NEW.amount), NEW.date, COALESCE(NEW.category, 'Other'), false, false
    )
    ON CONFLICT (reconciliation_id, item_type, item_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for expenses
DROP TRIGGER IF EXISTS expense_auto_add_to_reconciliation ON public.expenses;
CREATE TRIGGER expense_auto_add_to_reconciliation
AFTER INSERT ON public.expenses
FOR EACH ROW
EXECUTE FUNCTION public.auto_add_expense_to_reconciliation();