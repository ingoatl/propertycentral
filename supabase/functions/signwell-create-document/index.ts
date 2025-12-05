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
      documentId 
    } = await req.json();

    console.log('Creating SignWell document for booking:', bookingId);

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

    // Create document with SignWell API
    const signwellResponse = await fetch('https://www.signwell.com/api/v1/documents', {
      method: 'POST',
      headers: {
        'X-Api-Key': signwellApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `${template.name} - ${guestName}`,
        embedded_signing: true,
        reminders: true,
        apply_signing_order: true,
        recipients: [
          {
            id: '1',
            name: guestName,
            email: guestEmail,
            placeholder_name: 'Guest',
            signing_order: 1,
          },
          {
            id: '2',
            name: hostName,
            email: hostEmail,
            placeholder_name: 'Host',
            signing_order: 2,
          },
        ],
        files: [
          {
            name: template.name,
            file_url: template.file_path,
          },
        ],
        fields: fieldValues || [],
      }),
    });

    if (!signwellResponse.ok) {
      const errorText = await signwellResponse.text();
      console.error('SignWell API error:', errorText);
      throw new Error(`SignWell API error: ${errorText}`);
    }

    const signwellData = await signwellResponse.json();
    console.log('SignWell document created:', signwellData.id);

    // Update booking document record
    const { error: updateError } = await supabase
      .from('booking_documents')
      .update({
        signwell_document_id: signwellData.id,
        status: 'pending_guest',
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
        guest_email: guestEmail,
      },
    });

    // Get embedded signing URL for guest
    const guestRecipient = signwellData.recipients?.find((r: any) => r.placeholder_name === 'Guest');
    
    return new Response(JSON.stringify({
      success: true,
      signwellDocumentId: signwellData.id,
      guestSigningUrl: guestRecipient?.embedded_signing_url,
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
