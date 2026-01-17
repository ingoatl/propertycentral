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

    // Ensure file name has .pdf extension - SignWell requires it
    const fileUrl = template.file_path as string;
    const urlPath = fileUrl.split('/').pop() || '';
    const fileExtension = urlPath.includes('.') ? urlPath.split('.').pop() : 'pdf';
    const templateNameWithExt = template.name.endsWith(`.${fileExtension}`) 
      ? template.name 
      : `${template.name}.${fileExtension}`;

    // Use SignWell's auto-generated signature page at the end of the document
    // This eliminates the need for manual field placement on page 1
    // Create and SEND document with auto signature page
    const requestBody = {
      test_mode: false,
      draft: false,
      name: `${template.name} - ${guestName}`,
      embedded_signing: false,
      reminders: true,
      apply_signing_order: true,
      with_signature_page: true, // Auto-generate signature page at END of document
      recipients,
      files: [
        {
          name: templateNameWithExt,
          file_url: fileUrl,
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
    console.log('SignWell document created and sent:', signwellData.id);
    console.log('SignWell response:', JSON.stringify(signwellData, null, 2));

    // Update booking document record with SignWell ID
    const { error: updateError } = await supabase
      .from('booking_documents')
      .update({
        signwell_document_id: signwellData.id,
        status: 'pending_owner',
        is_draft: false,
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
      action: 'sent',
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
      message: 'Contract sent! Owner will receive an email to sign first.',
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