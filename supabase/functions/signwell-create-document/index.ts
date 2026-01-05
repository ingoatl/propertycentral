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
    // 1. Owner signs first (receives email immediately)
    // 2. Manager (You) signs second (receives email after owner signs)
    // 3. Owner 2 (optional) signs between owner1 and manager
    const recipients: any[] = [
      {
        id: '1',
        name: guestName,
        email: guestEmail,
        placeholder_name: 'Owner',
        signing_order: 1,
      },
      {
        id: '2',
        name: hostName,
        email: hostEmail,
        placeholder_name: 'Manager',
        signing_order: 2,
      },
    ];

    // Add second owner if requested (signs after first owner, before manager)
    if (includeSecondOwner && secondOwnerName && secondOwnerEmail) {
      // Adjust manager to signing_order 3
      recipients[1].signing_order = 3;
      recipients.splice(1, 0, {
        id: '3',
        name: secondOwnerName,
        email: secondOwnerEmail,
        placeholder_name: 'Owner2',
        signing_order: 2,
      });
    }

    console.log('Recipients:', JSON.stringify(recipients, null, 2));
    console.log('File URL:', template.file_path);

    // Create document with SignWell API
    // When embedded_signing is false, SignWell automatically sends emails to recipients
    const requestBody = {
      test_mode: false,  // Production mode - set to true for testing
      name: `${template.name} - ${guestName}`,
      embedded_signing: false,  // Email-based signing - recipients get emails
      reminders: true,  // Enable automatic reminders
      apply_signing_order: true,  // Enforce signing order (owner first, then manager)
      recipients,
      files: [
        {
          name: template.name,
          file_url: template.file_path,
        },
      ],
    };

    console.log('SignWell request body:', JSON.stringify(requestBody, null, 2));

    const signwellResponse = await fetch('https://www.signwell.com/api/v1/documents', {
      method: 'POST',
      headers: {
        'X-Api-Key': signwellApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
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
        status: 'pending_owner',  // Owner signs first
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
      message: 'Document created. Owner will receive an email to sign first, then you will receive yours.',
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
