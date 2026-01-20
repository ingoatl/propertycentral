-- Performance indexes for work orders
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_vendor_status ON work_orders(assigned_vendor_id, status);
CREATE INDEX IF NOT EXISTS idx_work_orders_urgency ON work_orders(urgency) WHERE status NOT IN ('completed', 'cancelled');
CREATE INDEX IF NOT EXISTS idx_work_orders_property_status ON work_orders(property_id, status);
CREATE INDEX IF NOT EXISTS idx_work_orders_created ON work_orders(created_at DESC);