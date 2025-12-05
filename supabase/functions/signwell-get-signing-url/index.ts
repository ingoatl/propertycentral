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

    const { signwellDocumentId, recipientType } = await req.json();

    console.log('Getting signing URL for document:', signwellDocumentId, 'recipient:', recipientType);

    // Get document details from SignWell
    const response = await fetch(`https://www.signwell.com/api/v1/documents/${signwellDocumentId}`, {
      method: 'GET',
      headers: {
        'X-Api-Key': signwellApiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('SignWell API error:', errorText);
      throw new Error(`SignWell API error: ${errorText}`);
    }

    const documentData = await response.json();
    
    // Find the appropriate recipient
    const placeholderName = recipientType === 'guest' ? 'Guest' : 'Host';
    const recipient = documentData.recipients?.find((r: any) => r.placeholder_name === placeholderName);
    
    if (!recipient) {
      throw new Error(`Recipient ${placeholderName} not found`);
    }

    return new Response(JSON.stringify({
      success: true,
      signingUrl: recipient.embedded_signing_url,
      status: recipient.status,
      documentStatus: documentData.status,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in signwell-get-signing-url:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
