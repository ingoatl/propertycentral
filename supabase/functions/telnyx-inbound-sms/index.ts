import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Google Reviews dedicated phone number
const GOOGLE_REVIEWS_PHONE = '+14049247251';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse Telnyx webhook payload
    const payload = await req.json();
    console.log('Telnyx inbound SMS webhook:', JSON.stringify(payload, null, 2));

    const eventType = payload.data?.event_type;
    
    if (eventType !== 'message.received') {
      console.log('Ignoring non-message event:', eventType);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const message = payload.data?.payload;
    const fromNumber = message?.from?.phone_number;
    const toNumber = message?.to?.[0]?.phone_number;
    const body = message?.text || '';
    const externalId = message?.id;
    const mediaUrls = message?.media?.map((m: any) => m.url) || [];

    console.log(`SMS received: from=${fromNumber}, to=${toNumber}, body=${body?.substring(0, 50)}`);

    // Check if this is a Google Reviews message
    const isGoogleReviewsMessage = toNumber === GOOGLE_REVIEWS_PHONE;
    
    if (isGoogleReviewsMessage) {
      console.log('Processing Google Reviews inbound SMS');
      await handleGoogleReviewsInbound(supabase, fromNumber, body, externalId);
    }

    // Find which user owns this phone number (for general inbox)
    const { data: phoneAssignment, error: assignmentError } = await supabase
      .from('user_phone_assignments')
      .select('id, user_id, phone_number')
      .eq('phone_number', toNumber)
      .eq('is_active', true)
      .single();

    if (assignmentError || !phoneAssignment) {
      console.log('No user assignment found for number:', toNumber);
      // Still return success since we may have handled Google Reviews above
      return new Response(JSON.stringify({ 
        success: true, 
        message: isGoogleReviewsMessage ? 'Google Reviews message processed' : 'No assignment found' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Found phone assignment for user:', phoneAssignment.user_id);

    // Store the message in user's inbox
    const { data: insertedMessage, error: insertError } = await supabase
      .from('user_phone_messages')
      .insert({
        user_id: phoneAssignment.user_id,
        phone_assignment_id: phoneAssignment.id,
        direction: 'inbound',
        from_number: fromNumber,
        to_number: toNumber,
        body: body,
        media_urls: mediaUrls,
        status: 'received',
        external_id: externalId,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to store message:', insertError);
      throw insertError;
    }

    console.log('Message stored successfully:', insertedMessage.id);

    return new Response(JSON.stringify({ 
      success: true, 
      message_id: insertedMessage.id,
      google_reviews_handled: isGoogleReviewsMessage
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('Telnyx SMS webhook error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

/**
 * Handle inbound SMS for Google Reviews workflow
 */
async function handleGoogleReviewsInbound(
  supabase: any,
  fromNumber: string,
  body: string,
  externalId: string
) {
  const normalizedBody = body.trim().toLowerCase();
  console.log(`Google Reviews inbound from ${fromNumber}: "${body}"`);
  
  // Check for opt-out keywords
  const optOutKeywords = ['stop', 'unsubscribe', 'cancel', 'quit', 'end'];
  const isOptOut = optOutKeywords.some(kw => normalizedBody === kw || normalizedBody.startsWith(kw + ' '));
  
  // Check for resubscribe keywords
  const resubscribeKeywords = ['start', 'subscribe', 'yes', 'resume'];
  const isResubscribe = resubscribeKeywords.some(kw => normalizedBody === kw);

  // Find the google_review_request for this phone number
  const { data: request, error: requestError } = await supabase
    .from('google_review_requests')
    .select('*')
    .eq('guest_phone', fromNumber)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  let messageType = 'inbound_unmatched';
  let requestId = null;

  if (request) {
    requestId = request.id;
    
    if (isOptOut) {
      messageType = 'inbound_opt_out';
      // Update the request to opted out
      await supabase
        .from('google_review_requests')
        .update({ 
          opted_out: true, 
          opted_out_at: new Date().toISOString() 
        })
        .eq('id', request.id);
      console.log(`Guest ${fromNumber} opted out`);
      
      // Send opt-out confirmation
      await sendOptOutConfirmation(supabase, fromNumber);
      
    } else if (isResubscribe && request.opted_out) {
      messageType = 'inbound_resubscribe';
      // Resubscribe the guest
      await supabase
        .from('google_review_requests')
        .update({ 
          opted_out: false, 
          opted_out_at: null,
          workflow_status: 'pending'
        })
        .eq('id', request.id);
      console.log(`Guest ${fromNumber} resubscribed`);
      
    } else {
      messageType = 'inbound_reply';
      
      // Any reply to permission_asked = permission granted
      if (request.workflow_status === 'permission_asked') {
        await supabase
          .from('google_review_requests')
          .update({ 
            workflow_status: 'permission_granted',
            permission_granted_at: new Date().toISOString()
          })
          .eq('id', request.id);
        console.log(`Permission granted by ${fromNumber}, triggering link send`);
        
        // Trigger the send_link action
        try {
          await supabase.functions.invoke('send-review-sms', {
            body: { 
              reviewId: request.review_id, 
              action: 'send_link',
              requestId: request.id,
              forceTime: true // Allow sending immediately on reply
            }
          });
        } catch (err) {
          console.error('Failed to trigger send_link:', err);
        }
      }
    }
  }

  // Log to sms_log table for Google Reviews tracking
  const { error: logError } = await supabase
    .from('sms_log')
    .insert({
      request_id: requestId,
      phone_number: fromNumber,
      message_type: messageType,
      message_body: body,
      status: 'received',
      external_id: externalId
    });

  if (logError) {
    console.error('Failed to log SMS:', logError);
  } else {
    console.log(`SMS logged: type=${messageType}, from=${fromNumber}`);
  }
}

/**
 * Send opt-out confirmation SMS
 */
async function sendOptOutConfirmation(supabase: any, toNumber: string) {
  const apiKey = Deno.env.get('TELNYX_API_KEY');
  if (!apiKey) {
    console.error('TELNYX_API_KEY not configured');
    return;
  }

  const message = "You've been unsubscribed from PeachHaus review requests. Reply START to resubscribe.";
  
  try {
    const response = await fetch('https://api.telnyx.com/v2/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: GOOGLE_REVIEWS_PHONE,
        to: toNumber,
        text: message,
      }),
    });

    const data = await response.json();
    console.log('Opt-out confirmation sent:', data);
    
    // Log the outbound confirmation
    await supabase
      .from('sms_log')
      .insert({
        phone_number: toNumber,
        message_type: 'opt_out_confirmation',
        message_body: message,
        status: response.ok ? 'sent' : 'failed',
      });
  } catch (err) {
    console.error('Failed to send opt-out confirmation:', err);
  }
}
