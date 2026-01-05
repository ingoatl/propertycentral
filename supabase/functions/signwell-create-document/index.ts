import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const signwellApiKey = Deno.env.get('SIGNWELL_API_KEY');
    if (!signwellApiKey) {
      throw new Error('SIGNWELL_API_KEY not configured');
    }

    const { 
      bookingId, 
      templateId, 
      guestName, 
      guestEmail, 
      hostName, 
      hostEmail,
      fieldValues,
      documentId,
      includeSecondOwner,
      secondOwnerName,
      secondOwnerEmail,
    } = await req.json();

    console.log('Creating SignWell document for booking:', bookingId, 'document:', documentId);
    console.log('Manager (Host):', hostName, hostEmail);
    console.log('Owner 1 (Guest):', guestName, guestEmail);
    console.log('Include Second Owner:', includeSecondOwner, secondOwnerName, secondOwnerEmail);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get template info
    const { data: template, error: templateError } = await supabase
      .from('document_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (templateError || !template) {
      throw new Error('Template not found');
    }

    // Build field values - only pre-fill effective date and owner contact info
    // Owner fills: address, property address, package selection during signing
    const today = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const prefilledFields = [
      {
        api_id: 'effective_date',
        value: today,
      },
      {
        api_id: 'owner_name',
        value: guestName,
      },
      {
        api_id: 'owner_email',
        value: guestEmail,
      },
      {
        api_id: 'manager_name',
        value: hostName,
      },
    ];

    // Merge with any additional field values passed in
    const allFields = [...prefilledFields, ...(fieldValues || [])];

    // Build recipients array with proper signing order:
    // 1. Manager (You) signs first
    // 2. Owner 1 signs second
    // 3. Owner 2 (optional) signs third
    const recipients: any[] = [
      {
        id: '1',
        name: hostName,
        email: hostEmail,
        placeholder_name: 'Manager',
        signing_order: 1,
        send_email: true,  // Send email to manager
      },
      {
        id: '2',
        name: guestName,
        email: guestEmail,
        placeholder_name: 'Owner',
        signing_order: 2,
        send_email: true,  // Send email to owner after manager signs
      },
    ];

    // Add second owner if requested
    if (includeSecondOwner && secondOwnerName && secondOwnerEmail) {
      recipients.push({
        id: '3',
        name: secondOwnerName,
        email: secondOwnerEmail,
        placeholder_name: 'Owner2',
        signing_order: 3,
        send_email: true,
      });
    }

    console.log('Recipients:', JSON.stringify(recipients, null, 2));

    // Create document with SignWell API
    // embedded_signing: false so SignWell sends emails to each party in order
    const signwellResponse = await fetch('https://www.signwell.com/api/v1/documents', {
      method: 'POST',
      headers: {
        'X-Api-Key': signwellApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `${template.name} - ${guestName}`,
        embedded_signing: false,  // Use email-based signing so parties receive emails
        reminders: true,  // Enable reminders
        apply_signing_order: true,  // Enforce signing order
        recipients,
        files: [
          {
            name: template.name,
            file_url: template.file_path,
          },
        ],
        fields: allFields,
      }),
    });

    if (!signwellResponse.ok) {
      const errorText = await signwellResponse.text();
      console.error('SignWell API error:', errorText);
      throw new Error(`SignWell API error: ${errorText}`);
    }

    const signwellData = await signwellResponse.json();
    console.log('SignWell document created:', signwellData.id);

    // Update booking document record with SignWell ID
    const { error: updateError } = await supabase
      .from('booking_documents')
      .update({
        signwell_document_id: signwellData.id,
        status: 'pending_manager',
        sent_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    if (updateError) {
      console.error('Error updating booking document:', updateError);
      throw updateError;
    }

    // Create audit log entry
    await supabase.from('document_audit_log').insert({
      document_id: documentId,
      action: 'created',
      performed_by: hostEmail,
      metadata: {
        signwell_document_id: signwellData.id,
        manager_name: hostName,
        manager_email: hostEmail,
        owner_name: guestName,
        owner_email: guestEmail,
        include_second_owner: includeSecondOwner,
        second_owner_name: secondOwnerName,
        second_owner_email: secondOwnerEmail,
        prefilled_fields: ['effective_date', 'owner_name', 'owner_email', 'manager_name'],
      },
    });

    return new Response(JSON.stringify({
      success: true,
      signwellDocumentId: signwellData.id,
      message: 'Document created. You will receive an email to sign first.',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in signwell-create-document:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
