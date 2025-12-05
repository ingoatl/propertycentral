-- Document Templates Table
CREATE TABLE document_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    file_path TEXT NOT NULL,
    signwell_template_id TEXT,
    field_mappings JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Booking Documents Table
CREATE TABLE booking_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES mid_term_bookings(id) ON DELETE CASCADE,
    template_id UUID REFERENCES document_templates(id),
    signwell_document_id TEXT,
    status TEXT DEFAULT 'draft',
    guest_signed_at TIMESTAMP WITH TIME ZONE,
    host_signed_at TIMESTAMP WITH TIME ZONE,
    host_signer_id UUID,
    signed_document_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    sent_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Document Audit Log
CREATE TABLE document_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES booking_documents(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    performed_by TEXT,
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for document_templates
CREATE POLICY "Admins can manage document templates"
ON document_templates FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Approved users can view document templates"
ON document_templates FOR SELECT
USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'::account_status
));

-- RLS Policies for booking_documents
CREATE POLICY "Approved users can view booking documents"
ON booking_documents FOR SELECT
USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'::account_status
));

CREATE POLICY "Approved users can insert booking documents"
ON booking_documents FOR INSERT
WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'::account_status
));

CREATE POLICY "Approved users can update booking documents"
ON booking_documents FOR UPDATE
USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'::account_status
));

CREATE POLICY "Approved users can delete booking documents"
ON booking_documents FOR DELETE
USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'::account_status
));

-- RLS Policies for document_audit_log
CREATE POLICY "Approved users can view audit logs"
ON document_audit_log FOR SELECT
USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'::account_status
));

CREATE POLICY "Approved users can insert audit logs"
ON document_audit_log FOR INSERT
WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'::account_status
));

-- Create storage bucket for signed documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('signed-documents', 'signed-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for signed-documents bucket
CREATE POLICY "Approved users can view signed documents"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'signed-documents' 
    AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.status = 'approved'::account_status
    )
);

CREATE POLICY "Approved users can upload signed documents"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'signed-documents'
    AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.status = 'approved'::account_status
    )
);