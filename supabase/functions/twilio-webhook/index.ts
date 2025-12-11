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

    // CRITICAL: Parse form data using URLSearchParams, NOT req.formData()
    const formDataText = await req.text();
    const formData = new URLSearchParams(formDataText);
    
    const from = formData.get("From") as string;
    const body = formData.get("Body") as string;
    const messageSid = formData.get("MessageSid") as string;

    console.log(`Received SMS from ${from}: ${body}`);

    if (!from) {
      throw new Error("No 'From' number in webhook");
    }

    // CRITICAL: Clean phone number and match on last 10 digits only
    const cleanPhone = from.replace(/[\s\-\(\)\+]/g, "");
    const phoneDigits = cleanPhone.slice(-10);

    console.log(`Matching phone digits: ${phoneDigits}`);

    // Check for opt-out keywords FIRST
    const optOutKeywords = ["stop", "unsubscribe", "opt out", "opt-out", "cancel", "quit", "end"];
    const isOptOut = optOutKeywords.some(kw => body.toLowerCase().trim() === kw || body.toLowerCase().includes(kw));

    if (isOptOut) {
      console.log(`Opt-out detected from ${from}`);
      
      // Update any matching requests to opted_out
      await supabase
        .from("google_review_requests")
        .update({
          opted_out: true,
          opted_out_at: new Date().toISOString(),
          workflow_status: "ignored",
          updated_at: new Date().toISOString(),
        })
        .ilike("guest_phone", `%${phoneDigits}`);

      // Log the opt-out message
      await supabase.from("sms_log").insert({
        phone_number: from,
        message_type: "inbound_opt_out",
        message_body: body,
        status: "received",
      });

      // Send opt-out confirmation
      await sendSms(twilioSid, twilioAuth, twilioPhone, from, 
        "You've been unsubscribed from PeachHaus review requests. Reply START to resubscribe.");

      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    // Check for re-subscribe keywords
    const resubKeywords = ["start", "yes", "unstop"];
    const isResubscribe = resubKeywords.some(kw => body.toLowerCase().trim() === kw);

    if (isResubscribe) {
      console.log(`Re-subscribe detected from ${from}`);
      
      await supabase
        .from("google_review_requests")
        .update({
          opted_out: false,
          opted_out_at: null,
          updated_at: new Date().toISOString(),
        })
        .ilike("guest_phone", `%${phoneDigits}`);

      await supabase.from("sms_log").insert({
        phone_number: from,
        message_type: "inbound_resubscribe",
        message_body: body,
        status: "received",
      });

      await sendSms(twilioSid, twilioAuth, twilioPhone, from,
        "You've been re-subscribed to PeachHaus messages. Thank you!");

      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    // Find the most recent pending request for this phone using last 10 digits
    const { data: request, error: findError } = await supabase
      .from("google_review_requests")
      .select("*, ownerrez_reviews(*)")
      .ilike("guest_phone", `%${phoneDigits}`)
      .in("workflow_status", ["permission_asked"])
      .eq("opted_out", false)
      .order("permission_asked_at", { ascending: false })
      .limit(1)
      .single();

    if (findError || !request) {
      console.log(`No pending request found for phone digits ${phoneDigits}`);
      
      // Log unmatched inbound message
      await supabase.from("sms_log").insert({
        phone_number: from,
        message_type: "inbound_unmatched",
        message_body: body,
        status: "received",
      });

      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    // Process the reply - any reply counts as permission granted
    await processReply(supabase, request, body, googleReviewUrl, twilioSid, twilioAuth, twilioPhone);

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
  const linkResult = await sendSms(twilioSid, twilioAuth, twilioPhone, request.guest_phone, linkMessage);

  await supabase.from("sms_log").insert({
    request_id: request.id,
    phone_number: request.guest_phone,
    message_type: "link_delivery",
    message_body: linkMessage,
    status: linkResult.success ? "sent" : "failed",
    twilio_message_sid: linkResult.sid,
  });

  // Send review text if available
  if (reviewText) {
    const reviewMessage = `And here's the text of your ${source} review so you can copy/paste:\n\n"${reviewText}"`;
    const reviewResult = await sendSms(twilioSid, twilioAuth, twilioPhone, request.guest_phone, reviewMessage);

    await supabase.from("sms_log").insert({
      request_id: request.id,
      phone_number: request.guest_phone,
      message_type: "review_text",
      message_body: reviewMessage,
      status: reviewResult.success ? "sent" : "failed",
      twilio_message_sid: reviewResult.sid,
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
): Promise<{ success: boolean; sid?: string; error?: string }> {
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;

  try {
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
      return { success: false, error: errorText };
    }

    const data = await response.json();
    console.log(`SMS sent successfully, SID: ${data.sid}`);
    return { success: true, sid: data.sid };
  } catch (error) {
    console.error("Twilio send exception:", error);
    return { success: false, error: String(error) };
  }
}
