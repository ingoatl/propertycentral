import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const googleReviewUrl = Deno.env.get("GOOGLE_REVIEW_URL") || "https://g.page/r/YOUR_REVIEW_LINK";
    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const twilioAuth = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse form data from Twilio webhook
    const formData = await req.formData();
    const from = formData.get("From") as string;
    const body = formData.get("Body") as string;
    const messageSid = formData.get("MessageSid") as string;

    console.log(`Received SMS from ${from}: ${body}`);

    if (!from) {
      throw new Error("No 'From' number in webhook");
    }

    // Normalize phone number (remove any formatting)
    const normalizedPhone = from.replace(/[^\d+]/g, "");

    // Find the most recent pending request for this phone
    const { data: request, error: findError } = await supabase
      .from("google_review_requests")
      .select("*, ownerrez_reviews(*)")
      .eq("guest_phone", normalizedPhone)
      .in("workflow_status", ["permission_asked"])
      .order("permission_asked_at", { ascending: false })
      .limit(1)
      .single();

    if (findError || !request) {
      // Try alternative phone format
      const altPhone = normalizedPhone.startsWith("+1") 
        ? normalizedPhone.slice(2) 
        : `+1${normalizedPhone}`;
      
      const { data: altRequest } = await supabase
        .from("google_review_requests")
        .select("*, ownerrez_reviews(*)")
        .eq("guest_phone", altPhone)
        .in("workflow_status", ["permission_asked"])
        .order("permission_asked_at", { ascending: false })
        .limit(1)
        .single();

      if (!altRequest) {
        console.log(`No pending request found for ${from}`);
        return new Response(
          '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
          { headers: { "Content-Type": "text/xml" } }
        );
      }

      // Use altRequest
      await processReply(supabase, altRequest, body, googleReviewUrl, twilioSid, twilioAuth, twilioPhone);
    } else {
      await processReply(supabase, request, body, googleReviewUrl, twilioSid, twilioAuth, twilioPhone);
    }

    // Return TwiML response (empty, no auto-reply needed - we send manually)
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { "Content-Type": "text/xml" } }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { "Content-Type": "text/xml" } }
    );
  }
});

async function processReply(
  supabase: any,
  request: any,
  replyBody: string,
  googleReviewUrl: string,
  twilioSid: string,
  twilioAuth: string,
  twilioPhone: string
) {
  const review = request.ownerrez_reviews;
  const source = review?.review_source || "Airbnb";
  const reviewText = review?.review_text || "";

  console.log(`Processing reply for request ${request.id}`);

  // Mark as permission granted
  await supabase
    .from("google_review_requests")
    .update({
      workflow_status: "permission_granted",
      permission_granted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", request.id);

  // Log the inbound message
  await supabase.from("sms_log").insert({
    request_id: request.id,
    phone_number: request.guest_phone,
    message_type: "inbound_reply",
    message_body: replyBody,
    status: "received",
  });

  // Send the Google link
  const linkMessage = `Amazing — thank you! Here's the direct link to leave the Google review: ${googleReviewUrl}`;
  await sendSms(twilioSid, twilioAuth, twilioPhone, request.guest_phone, linkMessage);

  await supabase.from("sms_log").insert({
    request_id: request.id,
    phone_number: request.guest_phone,
    message_type: "link_delivery",
    message_body: linkMessage,
    status: "sent",
  });

  // Send review text if available
  if (reviewText) {
    const reviewMessage = `And here's the text of your ${source} review so you can copy/paste:\n\n"${reviewText}"`;
    await sendSms(twilioSid, twilioAuth, twilioPhone, request.guest_phone, reviewMessage);

    await supabase.from("sms_log").insert({
      request_id: request.id,
      phone_number: request.guest_phone,
      message_type: "review_text",
      message_body: reviewMessage,
      status: "sent",
    });
  }

  // Update to link_sent status
  await supabase
    .from("google_review_requests")
    .update({
      workflow_status: "link_sent",
      link_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", request.id);

  console.log(`Link sent to ${request.guest_phone} after permission granted`);
}

async function sendSms(
  twilioSid: string,
  twilioAuth: string,
  twilioPhone: string,
  to: string,
  body: string
) {
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;

  const response = await fetch(twilioUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${twilioSid}:${twilioAuth}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      To: to,
      From: twilioPhone,
      Body: body,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Twilio send error:", errorText);
  }
}
