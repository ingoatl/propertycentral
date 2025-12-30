-- Add unique constraint for permit_reminders to allow ON CONFLICT
ALTER TABLE public.permit_reminders 
ADD CONSTRAINT permit_reminders_property_document_unique 
UNIQUE (property_id, document_id);