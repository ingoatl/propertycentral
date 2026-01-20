-- Add quote detail fields to work_orders
ALTER TABLE work_orders 
  ADD COLUMN IF NOT EXISTS quote_scope text,
  ADD COLUMN IF NOT EXISTS quote_materials text,
  ADD COLUMN IF NOT EXISTS quote_labor_hours numeric;