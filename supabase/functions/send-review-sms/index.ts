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
    const { reviewId, action, requestId } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const twilioAuth = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER")!;
    const googleReviewUrl = Deno.env.get("GOOGLE_REVIEW_URL") || "https://g.page/r/YOUR_REVIEW_LINK";

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Processing SMS action: ${action} for review: ${reviewId || requestId}`);

    // Helper function to send SMS via Twilio
    const sendSms = async (to: string, body: string): Promise<string | null> => {
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
        console.error("Twilio error:", errorText);
        throw new Error(`Twilio error: ${response.status}`);
      }

      const data = await response.json();
      return data.sid;
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

      if (!request) {
        // Create new request
        const { data: newRequest, error: createError } = await supabase
          .from("google_review_requests")
          .insert({
            review_id: reviewId,
            guest_phone: review.guest_phone,
            workflow_status: "pending",
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
      const twilioSid = await sendSms(review.guest_phone, message);

      // Log the SMS
      await supabase.from("sms_log").insert({
        request_id: request.id,
        phone_number: review.guest_phone,
        message_type: "permission_ask",
        message_body: message,
        twilio_sid: twilioSid,
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

      const review = request.ownerrez_reviews;
      const source = review?.review_source || "Airbnb";
      const reviewText = review?.review_text || "";

      // Send Google link message
      const linkMessage = `Amazing — thank you! Here's the direct link to leave the Google review: ${googleReviewUrl}`;
      await sendSms(request.guest_phone, linkMessage);

      // Log the SMS
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
        await sendSms(request.guest_phone, reviewMessage);

        await supabase.from("sms_log").insert({
          request_id: request.id,
          phone_number: request.guest_phone,
          message_type: "review_text",
          message_body: reviewMessage,
          status: "sent",
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

      const nudgeMessage = request.nudge_count === 0
        ? `Just checking in real quick — no pressure at all. Happy to send the Google link + your review text if you'd like. Just reply and I'll send it over.`
        : `Just a friendly bump in case life got busy — if you're still open to it, here's the Google link again: ${googleReviewUrl}. We appreciate you!`;

      await sendSms(request.guest_phone, nudgeMessage);

      await supabase.from("sms_log").insert({
        request_id: request.id,
        phone_number: request.guest_phone,
        message_type: request.nudge_count === 0 ? "nudge" : "final_reminder",
        message_body: nudgeMessage,
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
