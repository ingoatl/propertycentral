import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Google Reviews dedicated phone number (Twilio)
const GOOGLE_REVIEWS_PHONE = "+17709885286";

// Helper to check if current time is within send window (11am-3pm EST)
const isWithinSendWindow = (): boolean => {
  const now = new Date();
  const estOffset = -5 * 60;
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const estMinutes = utcMinutes + estOffset;
  const estHour = Math.floor(((estMinutes % 1440) + 1440) % 1440 / 60);
  return estHour >= 11 && estHour < 15;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reviewId, action, requestId, forceTime, to, body } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const googleReviewUrl = Deno.env.get("GOOGLE_REVIEW_URL") || "https://g.page/r/YOUR_REVIEW_LINK";

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Processing SMS action: ${action} for review: ${reviewId || requestId}`);

    // Check time window for non-test messages
    if (action !== "test" && action !== "direct" && !forceTime && !isWithinSendWindow()) {
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

    // Helper function to send SMS via Twilio
    const sendSms = async (toNumber: string, messageBody: string, contactId?: string): Promise<{ success: boolean; messageId?: string; error?: string; optedOut?: boolean }> => {
      try {
        // Format phone number for Twilio (needs + prefix)
        let formattedTo = toNumber.replace(/\D/g, '');
        if (!formattedTo.startsWith('1') && formattedTo.length === 10) {
          formattedTo = '1' + formattedTo;
        }
        formattedTo = '+' + formattedTo;
        
        console.log(`Sending SMS via Twilio from ${GOOGLE_REVIEWS_PHONE} to ${formattedTo}`);
        
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
        const authHeader = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
        
        const formData = new URLSearchParams();
        formData.append('From', GOOGLE_REVIEWS_PHONE);
        formData.append('To', formattedTo);
        formData.append('Body', messageBody);
        
        const response = await fetch(twilioUrl, {
          method: "POST",
          headers: {
            "Authorization": `Basic ${authHeader}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: formData.toString(),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error("Twilio error:", errorData);
          
          // Check for opt-out/blocked errors
          if (errorData.code === 21610 || errorData.message?.includes("unsubscribed")) {
            console.log(`Contact ${toNumber} has unsubscribed`);
            
            const cleanPhone = toNumber.replace(/[\s\-\(\)\+]/g, "");
            const phoneDigits = cleanPhone.slice(-10);
            
            await supabase
              .from("google_review_requests")
              .update({
                opted_out: true,
                opted_out_at: new Date().toISOString(),
                workflow_status: "ignored",
                updated_at: new Date().toISOString(),
              })
              .ilike("guest_phone", `%${phoneDigits}`);
            
            return { success: false, error: "Contact has unsubscribed", optedOut: true };
          }
          
          return { success: false, error: errorData.message || JSON.stringify(errorData) };
        }

        const data = await response.json();
        console.log(`SMS sent successfully via Twilio, SID: ${data.sid}`);
        return { success: true, messageId: data.sid };
      } catch (error) {
        console.error("Twilio exception:", error);
        return { success: false, error: String(error) };
      }
    };

    // Handle direct SMS (from VoiceDialer or other components)
    if (action === "direct" && to && body) {
      const result = await sendSms(to, body);
      
      if (!result.success) {
        throw new Error(result.error || "Failed to send SMS");
      }
      
      return new Response(
        JSON.stringify({ success: true, messageId: result.messageId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle different actions
    if (action === "permission_ask") {
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

      let { data: request } = await supabase
        .from("google_review_requests")
        .select("*")
        .eq("review_id", reviewId)
        .single();

      if (request?.opted_out) {
        console.log(`Guest ${review.guest_phone} has opted out, skipping SMS`);
        return new Response(
          JSON.stringify({ success: false, error: "Guest has opted out of SMS", optedOut: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!request) {
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

      const source = review.review_source || "Airbnb";
      const message = `Thanks again for the wonderful ${source} review — it truly means a lot. Google reviews help future guests trust us when booking directly. If you're open to it, I can send you a link plus a copy of your original review so you can paste it in seconds. Would that be okay?`;

      const result = await sendSms(review.guest_phone, message, request.id);

      if (!result.success) {
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

      await supabase.from("sms_log").insert({
        request_id: request.id,
        phone_number: review.guest_phone,
        message_type: "permission_ask",
        message_body: message,
        twilio_message_id: result.messageId,
        status: "sent",
      });

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
      const { data: request, error: requestError } = await supabase
        .from("google_review_requests")
        .select("*, ownerrez_reviews(*)")
        .eq("id", requestId)
        .single();

      if (requestError || !request) {
        throw new Error("Request not found");
      }

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

      await supabase.from("sms_log").insert({
        request_id: request.id,
        phone_number: request.guest_phone,
        message_type: "link_delivery",
        message_body: linkMessage,
        twilio_message_id: linkResult.messageId,
        status: "sent",
      });

      if (reviewText) {
        const reviewMessage = `And here's the text of your ${source} review so you can copy/paste:\n\n"${reviewText}"`;
        const reviewResult = await sendSms(request.guest_phone, reviewMessage, request.id);

        await supabase.from("sms_log").insert({
          request_id: request.id,
          phone_number: request.guest_phone,
          message_type: "review_text",
          message_body: reviewMessage,
          twilio_message_id: reviewResult.messageId,
          status: reviewResult.success ? "sent" : "failed",
          error_message: reviewResult.error,
        });
      }

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
        twilio_message_id: nudgeResult.messageId,
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
      // Send test to Ingo's phone
      const adminPhone = "+17709065022";
      const testMessage = `🧪 Test SMS from PeachHaus Google Review system (via Twilio from ${GOOGLE_REVIEWS_PHONE}). If you received this, the SMS integration is working! Reply to test inbound handling.`;
      
      console.log(`Sending test SMS to ${adminPhone} from ${GOOGLE_REVIEWS_PHONE}`);
      
      const testResult = await sendSms(adminPhone, testMessage);
      
      await supabase.from("sms_log").insert({
        phone_number: adminPhone,
        message_type: "test",
        message_body: testMessage,
        twilio_message_id: testResult.messageId,
        status: testResult.success ? "sent" : "failed",
        error_message: testResult.error,
      });

      if (!testResult.success) {
        console.error(`Test SMS failed: ${testResult.error}`);
        throw new Error(testResult.error || "Failed to send test SMS");
      }

      console.log(`Test SMS sent successfully via Twilio, message SID: ${testResult.messageId}`);

      return new Response(
        JSON.stringify({ success: true, action: "test", messageId: testResult.messageId }),
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
