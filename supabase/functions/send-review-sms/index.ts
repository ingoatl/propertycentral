import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to check if current time is within send window (11am-3pm EST)
const isWithinSendWindow = (): boolean => {
  const now = new Date();
  // Convert to EST (UTC-5, or UTC-4 during DST)
  const estOffset = -5 * 60; // EST in minutes
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const estMinutes = utcMinutes + estOffset;
  const estHour = Math.floor(((estMinutes % 1440) + 1440) % 1440 / 60);
  
  // Send window: 11am (11) to 3pm (15) EST
  return estHour >= 11 && estHour < 15;
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reviewId, action, requestId, forceTime } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const twilioAuth = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER")!;
    const googleReviewUrl = Deno.env.get("GOOGLE_REVIEW_URL") || "https://g.page/r/YOUR_REVIEW_LINK";

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Processing SMS action: ${action} for review: ${reviewId || requestId}`);

    // Check time window for non-test messages (skip if forceTime is true)
    if (action !== "test" && !forceTime && !isWithinSendWindow()) {
      console.log("Outside send window (11am-3pm EST), SMS queued");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Outside send window (11am-3pm EST). Use 'Force Send' to override or try again later.",
          outsideWindow: true 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Helper function to send SMS via Twilio with error handling
    const sendSms = async (to: string, body: string, contactId?: string): Promise<{ success: boolean; sid?: string; error?: string; optedOut?: boolean }> => {
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
          console.error("Twilio error:", errorText);
          
          // Parse error to check for specific codes
          try {
            const errorData = JSON.parse(errorText);
            
            // Handle carrier-level unsubscribe (error 21610)
            if (errorData.code === 21610) {
              console.log(`Contact ${to} has unsubscribed at carrier level`);
              
              // Clean phone for matching
              const cleanPhone = to.replace(/[\s\-\(\)\+]/g, "");
              const phoneDigits = cleanPhone.slice(-10);
              
              // Update opt-out status
              await supabase
                .from("google_review_requests")
                .update({
                  opted_out: true,
                  opted_out_at: new Date().toISOString(),
                  workflow_status: "ignored",
                  updated_at: new Date().toISOString(),
                })
                .ilike("guest_phone", `%${phoneDigits}`);
              
              return { success: false, error: "Contact has unsubscribed at carrier level", optedOut: true };
            }
          } catch (parseError) {
            // Continue with generic error
          }
          
          return { success: false, error: errorText };
        }

        const data = await response.json();
        console.log(`SMS sent successfully, SID: ${data.sid}`);
        return { success: true, sid: data.sid };
      } catch (error) {
        console.error("Twilio exception:", error);
        return { success: false, error: String(error) };
      }
    };

    // Handle different actions
    if (action === "permission_ask") {
      // Get review details
      const { data: review, error: reviewError } = await supabase
        .from("ownerrez_reviews")
        .select("*")
        .eq("id", reviewId)
        .single();

      if (reviewError || !review) {
        throw new Error("Review not found");
      }

      if (!review.guest_phone) {
        throw new Error("Guest phone number not available");
      }

      // Check if request already exists
      let { data: request } = await supabase
        .from("google_review_requests")
        .select("*")
        .eq("review_id", reviewId)
        .single();

      // CRITICAL: Check opt-out status before sending
      if (request?.opted_out) {
        console.log(`Guest ${review.guest_phone} has opted out, skipping SMS`);
        return new Response(
          JSON.stringify({ success: false, error: "Guest has opted out of SMS", optedOut: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!request) {
        // Create new request
        const { data: newRequest, error: createError } = await supabase
          .from("google_review_requests")
          .insert({
            review_id: reviewId,
            guest_phone: review.guest_phone,
            workflow_status: "pending",
            opted_out: false,
          })
          .select()
          .single();

        if (createError) throw createError;
        request = newRequest;
      }

      // Compose permission ask message
      const source = review.review_source || "Airbnb";
      const message = `Thanks again for the wonderful ${source} review — it truly means a lot. Google reviews help future guests trust us when booking directly. If you're open to it, I can send you a link plus a copy of your original review so you can paste it in seconds. Would that be okay?`;

      // Send SMS
      const result = await sendSms(review.guest_phone, message, request.id);

      if (!result.success) {
        // Log failed attempt
        await supabase.from("sms_log").insert({
          request_id: request.id,
          phone_number: review.guest_phone,
          message_type: "permission_ask",
          message_body: message,
          status: "failed",
          error_message: result.error,
        });

        if (result.optedOut) {
          return new Response(
            JSON.stringify({ success: false, error: "Contact has opted out at carrier level", optedOut: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        throw new Error(result.error || "Failed to send SMS");
      }

      // Log the SMS with Twilio SID
      await supabase.from("sms_log").insert({
        request_id: request.id,
        phone_number: review.guest_phone,
        message_type: "permission_ask",
        message_body: message,
        twilio_message_sid: result.sid,
        status: "sent",
      });

      // Update request status
      await supabase
        .from("google_review_requests")
        .update({
          workflow_status: "permission_asked",
          permission_asked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", request.id);

      console.log(`Permission SMS sent to ${review.guest_phone}`);

      return new Response(
        JSON.stringify({ success: true, action: "permission_ask", requestId: request.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "send_link") {
      // Get request and review
      const { data: request, error: requestError } = await supabase
        .from("google_review_requests")
        .select("*, ownerrez_reviews(*)")
        .eq("id", requestId)
        .single();

      if (requestError || !request) {
        throw new Error("Request not found");
      }

      // CRITICAL: Check opt-out status
      if (request.opted_out) {
        console.log(`Guest ${request.guest_phone} has opted out, skipping link send`);
        return new Response(
          JSON.stringify({ success: false, error: "Guest has opted out of SMS", optedOut: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const review = request.ownerrez_reviews;
      const source = review?.review_source || "Airbnb";
      const reviewText = review?.review_text || "";

      // Send Google link message
      const linkMessage = `Amazing — thank you! Here's the direct link to leave the Google review: ${googleReviewUrl}`;
      const linkResult = await sendSms(request.guest_phone, linkMessage, request.id);

      if (!linkResult.success) {
        await supabase.from("sms_log").insert({
          request_id: request.id,
          phone_number: request.guest_phone,
          message_type: "link_delivery",
          message_body: linkMessage,
          status: "failed",
          error_message: linkResult.error,
        });

        if (linkResult.optedOut) {
          return new Response(
            JSON.stringify({ success: false, error: "Contact has opted out at carrier level", optedOut: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        throw new Error(linkResult.error || "Failed to send link SMS");
      }

      // Log the SMS with Twilio SID
      await supabase.from("sms_log").insert({
        request_id: request.id,
        phone_number: request.guest_phone,
        message_type: "link_delivery",
        message_body: linkMessage,
        twilio_message_sid: linkResult.sid,
        status: "sent",
      });

      // Send review text if available
      if (reviewText) {
        const reviewMessage = `And here's the text of your ${source} review so you can copy/paste:\n\n"${reviewText}"`;
        const reviewResult = await sendSms(request.guest_phone, reviewMessage, request.id);

        await supabase.from("sms_log").insert({
          request_id: request.id,
          phone_number: request.guest_phone,
          message_type: "review_text",
          message_body: reviewMessage,
          twilio_message_sid: reviewResult.sid,
          status: reviewResult.success ? "sent" : "failed",
          error_message: reviewResult.error,
        });
      }

      // Update status
      await supabase
        .from("google_review_requests")
        .update({
          workflow_status: "link_sent",
          link_sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", request.id);

      console.log(`Link sent to ${request.guest_phone}`);

      return new Response(
        JSON.stringify({ success: true, action: "send_link" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "nudge") {
      const { data: request, error: requestError } = await supabase
        .from("google_review_requests")
        .select("*")
        .eq("id", requestId)
        .single();

      if (requestError || !request) {
        throw new Error("Request not found");
      }

      // CRITICAL: Check opt-out status
      if (request.opted_out) {
        console.log(`Guest ${request.guest_phone} has opted out, skipping nudge`);
        return new Response(
          JSON.stringify({ success: false, error: "Guest has opted out of SMS", optedOut: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const nudgeMessage = request.nudge_count === 0
        ? `Just checking in real quick — no pressure at all. Happy to send the Google link + your review text if you'd like. Just reply and I'll send it over.`
        : `Just a friendly bump in case life got busy — if you're still open to it, here's the Google link again: ${googleReviewUrl}. We appreciate you!`;

      const nudgeResult = await sendSms(request.guest_phone, nudgeMessage, request.id);

      if (!nudgeResult.success) {
        await supabase.from("sms_log").insert({
          request_id: request.id,
          phone_number: request.guest_phone,
          message_type: request.nudge_count === 0 ? "nudge" : "final_reminder",
          message_body: nudgeMessage,
          status: "failed",
          error_message: nudgeResult.error,
        });

        if (nudgeResult.optedOut) {
          return new Response(
            JSON.stringify({ success: false, error: "Contact has opted out at carrier level", optedOut: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        throw new Error(nudgeResult.error || "Failed to send nudge SMS");
      }

      await supabase.from("sms_log").insert({
        request_id: request.id,
        phone_number: request.guest_phone,
        message_type: request.nudge_count === 0 ? "nudge" : "final_reminder",
        message_body: nudgeMessage,
        twilio_message_sid: nudgeResult.sid,
        status: "sent",
      });

      await supabase
        .from("google_review_requests")
        .update({
          nudge_count: request.nudge_count + 1,
          last_nudge_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", request.id);

      console.log(`Nudge sent to ${request.guest_phone}`);

      return new Response(
        JSON.stringify({ success: true, action: "nudge" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "test") {
      // Send test SMS to admin phone
      const adminPhone = "+17709065022";
      const testMessage = "Test SMS from PeachHaus Google Review system. If you received this, the SMS integration is working correctly!";
      
      const testResult = await sendSms(adminPhone, testMessage);
      
      await supabase.from("sms_log").insert({
        phone_number: adminPhone,
        message_type: "test",
        message_body: testMessage,
        twilio_message_sid: testResult.sid,
        status: testResult.success ? "sent" : "failed",
        error_message: testResult.error,
      });

      if (!testResult.success) {
        throw new Error(testResult.error || "Failed to send test SMS");
      }

      console.log(`Test SMS sent to admin`);

      return new Response(
        JSON.stringify({ success: true, action: "test" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error: unknown) {
    console.error("SMS error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
