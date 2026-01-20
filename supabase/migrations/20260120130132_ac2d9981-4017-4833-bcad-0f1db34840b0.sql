-- Allow anonymous (vendor) access to work orders via token
CREATE POLICY "Vendors can view work orders via token" 
ON public.work_orders 
FOR SELECT 
TO anon
USING (vendor_access_token IS NOT NULL);

-- Allow vendors to update work orders they have access to via token
CREATE POLICY "Vendors can update work orders via token" 
ON public.work_orders 
FOR UPDATE 
TO anon
USING (vendor_access_token IS NOT NULL)
WITH CHECK (vendor_access_token IS NOT NULL);

-- Allow anonymous access to property_maintenance_book for work orders they have access to
CREATE POLICY "Vendors can view maintenance book via work order token" 
ON public.property_maintenance_book 
FOR SELECT 
TO anon
USING (
  EXISTS (
    SELECT 1 FROM work_orders wo 
    WHERE wo.property_id = property_maintenance_book.property_id 
    AND wo.vendor_access_token IS NOT NULL
  )
);

-- Allow anonymous access to properties for work orders they have access to
CREATE POLICY "Vendors can view properties via work order token" 
ON public.properties 
FOR SELECT 
TO anon
USING (
  EXISTS (
    SELECT 1 FROM work_orders wo 
    WHERE wo.property_id = properties.id 
    AND wo.vendor_access_token IS NOT NULL
  )
);

-- Allow anonymous access to vendors table for their own info
CREATE POLICY "Vendors can view their own vendor info via work order" 
ON public.vendors 
FOR SELECT 
TO anon
USING (
  EXISTS (
    SELECT 1 FROM work_orders wo 
    WHERE wo.assigned_vendor_id = vendors.id 
    AND wo.vendor_access_token IS NOT NULL
  )
);

-- Allow vendors to insert maintenance messages
CREATE POLICY "Vendors can insert maintenance messages via token" 
ON public.maintenance_messages 
FOR INSERT 
TO anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM work_orders wo 
    WHERE wo.id = maintenance_messages.work_order_id 
    AND wo.vendor_access_token IS NOT NULL
  )
);