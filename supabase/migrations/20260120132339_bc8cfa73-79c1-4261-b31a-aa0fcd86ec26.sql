-- Add enhanced access and site information fields to work_orders
ALTER TABLE public.work_orders
ADD COLUMN IF NOT EXISTS tenant_contact_name text,
ADD COLUMN IF NOT EXISTS tenant_contact_phone text,
ADD COLUMN IF NOT EXISTS pets_on_property text,
ADD COLUMN IF NOT EXISTS parking_instructions text,
ADD COLUMN IF NOT EXISTS utility_shutoff_notes text,
ADD COLUMN IF NOT EXISTS safety_notes text;

-- Add comments for documentation
COMMENT ON COLUMN public.work_orders.tenant_contact_name IS 'Name of tenant/resident on-site if vendor needs access';
COMMENT ON COLUMN public.work_orders.tenant_contact_phone IS 'Phone number of on-site contact';
COMMENT ON COLUMN public.work_orders.pets_on_property IS 'Pet warnings and instructions';
COMMENT ON COLUMN public.work_orders.parking_instructions IS 'Where vendor should park';
COMMENT ON COLUMN public.work_orders.utility_shutoff_notes IS 'Location of water/electrical shutoffs';
COMMENT ON COLUMN public.work_orders.safety_notes IS 'Any hazards or safety concerns';