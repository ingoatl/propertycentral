-- Add audit and approval columns to reconciliation_line_items
ALTER TABLE public.reconciliation_line_items
ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS notes text,
ADD COLUMN IF NOT EXISTS added_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS source text;

-- Create reconciliation_audit_log table
CREATE TABLE IF NOT EXISTS public.reconciliation_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id uuid NOT NULL REFERENCES public.monthly_reconciliations(id) ON DELETE CASCADE,
  action text NOT NULL, -- 'item_approved', 'item_rejected', 'total_recalculated', 'item_added', 'item_removed'
  user_id uuid REFERENCES auth.users(id),
  item_id uuid, -- references reconciliation_line_items.id
  previous_values jsonb,
  new_values jsonb,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.reconciliation_audit_log ENABLE ROW LEVEL SECURITY;

-- Admins can manage audit logs
CREATE POLICY "Admins can manage audit logs"
ON public.reconciliation_audit_log
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Approved users can view audit logs
CREATE POLICY "Approved users can view audit logs"
ON public.reconciliation_audit_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'::account_status
  )
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_audit_log_reconciliation_id 
ON public.reconciliation_audit_log(reconciliation_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at 
ON public.reconciliation_audit_log(created_at DESC);

-- Update reconciliation_line_items to default verified to false
ALTER TABLE public.reconciliation_line_items
ALTER COLUMN verified SET DEFAULT false;