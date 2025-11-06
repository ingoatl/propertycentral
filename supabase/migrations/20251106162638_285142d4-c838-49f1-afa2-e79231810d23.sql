-- Enable realtime for financial tables to support automatic summary updates
-- This ensures the dashboard stays synchronized when reconciliations are approved

-- Set replica identity to full for complete row data during updates
ALTER TABLE public.monthly_reconciliations REPLICA IDENTITY FULL;
ALTER TABLE public.visits REPLICA IDENTITY FULL;
ALTER TABLE public.expenses REPLICA IDENTITY FULL;
ALTER TABLE public.reconciliation_line_items REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.monthly_reconciliations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.visits;
ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reconciliation_line_items;