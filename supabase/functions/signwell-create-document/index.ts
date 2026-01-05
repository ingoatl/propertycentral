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

    // Check if template has a SignWell template ID (preferred method)
    if (template.signwell_template_id) {
      console.log('Using SignWell template:', template.signwell_template_id);
      return await createFromSignWellTemplate(
        signwellApiKey,
        supabase,
        template,
        guestName,
        guestEmail,
        hostName,
        hostEmail,
        documentId,
        includeSecondOwner,
        secondOwnerName,
        secondOwnerEmail
      );
    }

    // Otherwise, create document from file with signature fields
    console.log('Creating document from file with signature fields');
    
    // Build recipients array with proper signing order:
    // 1. Owner signs first (receives email immediately)
    // 2. Manager signs second (receives email after owner signs)
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

    // Define signature fields for each recipient
    // These are positioned at the bottom of the document where signatures typically go
    const fields: any[] = [
      // Owner signature field
      {
        api_id: 'owner_signature',
        type: 'signature',
        required: true,
        recipient_id: '1',
        page: 1,
        x: 50,
        y: 700,
        width: 200,
        height: 50,
      },
      // Owner date field
      {
        api_id: 'owner_date',
        type: 'date',
        required: true,
        recipient_id: '1',
        page: 1,
        x: 300,
        y: 700,
        width: 100,
        height: 30,
      },
      // Manager signature field
      {
        api_id: 'manager_signature',
        type: 'signature',
        required: true,
        recipient_id: '2',
        page: 1,
        x: 50,
        y: 750,
        width: 200,
        height: 50,
      },
      // Manager date field
      {
        api_id: 'manager_date',
        type: 'date',
        required: true,
        recipient_id: '2',
        page: 1,
        x: 300,
        y: 750,
        width: 100,
        height: 30,
      },
    ];

    // Add Owner2 fields if included
    if (includeSecondOwner && secondOwnerName && secondOwnerEmail) {
      fields.push(
        {
          api_id: 'owner2_signature',
          type: 'signature',
          required: true,
          recipient_id: '3',
          page: 1,
          x: 50,
          y: 800,
          width: 200,
          height: 50,
        },
        {
          api_id: 'owner2_date',
          type: 'date',
          required: true,
          recipient_id: '3',
          page: 1,
          x: 300,
          y: 800,
          width: 100,
          height: 30,
        }
      );
    }

    // Create document with SignWell API
    // When embedded_signing is false, SignWell automatically sends emails to recipients
    const requestBody = {
      test_mode: false,  // Production mode - set to true for testing
      name: `${template.name} - ${guestName}`,
      embedded_signing: false,  // Email-based signing - recipients get emails
      reminders: true,  // Enable automatic reminders
      apply_signing_order: true,  // Enforce signing order (owner first, then manager)
      recipients,
      fields,  // Include signature fields
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
        created_from: 'file',
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

// Helper function to create document from SignWell template
async function createFromSignWellTemplate(
  signwellApiKey: string,
  supabase: any,
  template: any,
  guestName: string,
  guestEmail: string,
  hostName: string,
  hostEmail: string,
  documentId: string,
  includeSecondOwner?: boolean,
  secondOwnerName?: string,
  secondOwnerEmail?: string
) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // Build recipients array - must match placeholder names in the SignWell template
  const recipients: any[] = [
    {
      id: '1',
      placeholder_name: 'Owner',
      name: guestName,
      email: guestEmail,
    },
    {
      id: '2',
      placeholder_name: 'Manager',
      name: hostName,
      email: hostEmail,
    },
  ];

  // Add second owner if requested
  if (includeSecondOwner && secondOwnerName && secondOwnerEmail) {
    recipients.push({
      id: '3',
      placeholder_name: 'Owner2',
      name: secondOwnerName,
      email: secondOwnerEmail,
    });
  }

  console.log('Template recipients:', JSON.stringify(recipients, null, 2));

  // Create document from SignWell template
  const requestBody = {
    test_mode: false,
    template_id: template.signwell_template_id,
    embedded_signing: false,
    reminders: true,
    recipients,
  };

  console.log('SignWell template request:', JSON.stringify(requestBody, null, 2));

  const signwellResponse = await fetch('https://www.signwell.com/api/v1/document_templates/documents/', {
    method: 'POST',
    headers: {
      'X-Api-Key': signwellApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!signwellResponse.ok) {
    const errorText = await signwellResponse.text();
    console.error('SignWell Template API error:', errorText);
    throw new Error(`SignWell Template API error: ${errorText}`);
  }

  const signwellData = await signwellResponse.json();
  console.log('SignWell document created from template:', signwellData.id);

  // Update booking document record with SignWell ID
  const { error: updateError } = await supabase
    .from('booking_documents')
    .update({
      signwell_document_id: signwellData.id,
      status: 'pending_owner',
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
      signwell_template_id: template.signwell_template_id,
      manager_name: hostName,
      manager_email: hostEmail,
      owner_name: guestName,
      owner_email: guestEmail,
      include_second_owner: includeSecondOwner,
      second_owner_name: secondOwnerName,
      second_owner_email: secondOwnerEmail,
      created_from: 'template',
    },
  });

  return new Response(JSON.stringify({
    success: true,
    signwellDocumentId: signwellData.id,
    message: 'Document created from template. Owner will receive an email to sign first.',
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}