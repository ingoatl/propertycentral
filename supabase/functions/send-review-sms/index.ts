import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Google Reviews dedicated phone number (GHL)
const GOOGLE_REVIEWS_PHONE = "+14046090955";

// Format phone number to E.164 format
function formatPhoneE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length > 10) {
    return `+${digits}`;
  }
  return phone;
}

// Helper to check if current time is within send window (6pm-8pm EST)
const isWithinSendWindow = (): boolean => {
  const now = new Date();
  const estOffset = -5 * 60;
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const estMinutes = utcMinutes + estOffset;
  const estHour = Math.floor(((estMinutes % 1440) + 1440) % 1440 / 60);
  // 6pm-8pm EST = hours 18, 19
  return estHour >= 18 && estHour < 20;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reviewId, action, requestId, forceTime, to, body, testPhone } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ghlApiKey = Deno.env.get("GHL_API_KEY")!;
    const ghlLocationId = Deno.env.get("GHL_LOCATION_ID")!;
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

    // Helper function to send SMS via GHL
    const sendSms = async (toNumber: string, messageBody: string, contactId?: string): Promise<{ success: boolean; messageId?: string; error?: string; optedOut?: boolean }> => {
      try {
        const formattedTo = formatPhoneE164(toNumber);
        
        console.log(`Sending SMS via GHL from ${GOOGLE_REVIEWS_PHONE} to ${formattedTo}`);
        
        // Step 1: Find or create contact in GHL
        const searchResponse = await fetch(
          `https://services.leadconnectorhq.com/contacts/search/duplicate?locationId=${ghlLocationId}&phone=${encodeURIComponent(formattedTo)}`,
          {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${ghlApiKey}`,
              "Version": "2021-07-28",
              "Content-Type": "application/json",
            },
          }
        );

        let ghlContactId = null;

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          if (searchData.contact?.id) {
            ghlContactId = searchData.contact.id;
            console.log(`Found existing GHL contact: ${ghlContactId}`);
          }
        }

        // If no contact found, create one
        if (!ghlContactId) {
          const createContactResponse = await fetch(
            `https://services.leadconnectorhq.com/contacts/`,
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${ghlApiKey}`,
                "Version": "2021-07-28",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                locationId: ghlLocationId,
                phone: formattedTo,
                name: "Guest",
                source: "GoogleReviews",
              }),
            }
          );

          if (!createContactResponse.ok) {
            const errorText = await createContactResponse.text();
            console.error("Error creating GHL contact:", errorText);
            return { success: false, error: `Failed to create GHL contact: ${createContactResponse.status}` };
          }

          const createData = await createContactResponse.json();
          ghlContactId = createData.contact?.id;
          console.log(`Created new GHL contact: ${ghlContactId}`);
        }

        if (!ghlContactId) {
          return { success: false, error: "Failed to find or create GHL contact" };
        }

        // Step 2: Send SMS message via GHL
        const sendResponse = await fetch(
          `https://services.leadconnectorhq.com/conversations/messages`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${ghlApiKey}`,
              "Version": "2021-04-15",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              type: "SMS",
              contactId: ghlContactId,
              message: messageBody,
              fromNumber: GOOGLE_REVIEWS_PHONE,
            }),
          }
        );

        if (!sendResponse.ok) {
          const errorData = await sendResponse.text();
          console.error("GHL SMS error:", errorData);
          
          // Check for opt-out/blocked errors
          if (errorData.includes("unsubscribed") || errorData.includes("blocked") || errorData.includes("DND")) {
            console.log(`Contact ${toNumber} may be opted out in GHL`);
            
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
          
          return { success: false, error: errorData };
        }

        const data = await sendResponse.json();
        console.log(`SMS sent successfully via GHL, Message ID: ${data.messageId}`);
        return { success: true, messageId: data.messageId || data.conversationId };
      } catch (error) {
        console.error("GHL exception:", error);
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
      const guestName = review.guest_name || "there";
      const message = `Hi ${guestName}! This is Anja & Ingo, your hosts with PeachHaus Group. Thanks again for the wonderful ${source} review — it truly means a lot! Google reviews help future guests trust us when booking directly. If you're open to it, I can send you a link plus a copy of your original review so you can paste it in seconds. Would that be okay?`;

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
        ghl_message_id: result.messageId,
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

      console.log(`Permission SMS sent to ${review.guest_phone} via GHL`);

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
      const guestName = review?.guest_name || "there";

      const linkMessage = `Hi ${guestName}! It's Anja & Ingo from PeachHaus Group — amazing, thank you! Here's the direct link to leave your Google review: ${googleReviewUrl}`;
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
        ghl_message_id: linkResult.messageId,
        status: "sent",
      });

      if (reviewText) {
        const reviewMessage = `Here's the text of your ${source} review so you can easily copy/paste it:\n\n"${reviewText}"\n\nThanks so much! — Anja & Ingo, PeachHaus Group`;
        const reviewResult = await sendSms(request.guest_phone, reviewMessage, request.id);

        await supabase.from("sms_log").insert({
          request_id: request.id,
          phone_number: request.guest_phone,
          message_type: "review_text",
          message_body: reviewMessage,
          ghl_message_id: reviewResult.messageId,
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

      console.log(`Link sent to ${request.guest_phone} via GHL`);

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
        ? `Hi! It's Anja & Ingo from PeachHaus Group — just checking in real quick, no pressure at all. Happy to send the Google link + your review text if you'd like. Just reply and I'll send it over!`
        : `Hi! It's Anja & Ingo from PeachHaus Group — just a friendly bump in case life got busy. If you're still open to it, here's the Google link again: ${googleReviewUrl}. We appreciate you!`;

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
        ghl_message_id: nudgeResult.messageId,
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

      console.log(`Nudge sent to ${request.guest_phone} via GHL`);

      return new Response(
        JSON.stringify({ success: true, action: "nudge" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle thank_you action - sends thank you message when guest confirms they posted review
    if (action === "thank_you") {
      const { data: request, error: requestError } = await supabase
        .from("google_review_requests")
        .select("*, ownerrez_reviews(*)")
        .eq("id", requestId)
        .single();

      if (requestError || !request) {
        throw new Error("Request not found");
      }

      const review = request.ownerrez_reviews;
      const guestName = review?.guest_name || "there";

      const thankYouMessage = `Hi ${guestName}! It's Anja & Ingo from PeachHaus Group. 🙏 THANK YOU so much for taking the time to leave us a Google review! It means the world to us and helps other travelers find our homes. We hope to host you again someday! ❤️`;
      
      const thankYouResult = await sendSms(request.guest_phone, thankYouMessage, request.id);

      await supabase.from("sms_log").insert({
        request_id: request.id,
        phone_number: request.guest_phone,
        message_type: "thank_you",
        message_body: thankYouMessage,
        ghl_message_id: thankYouResult.messageId,
        status: thankYouResult.success ? "sent" : "failed",
        error_message: thankYouResult.error,
      });

      if (thankYouResult.success) {
        // Mark as completed
        await supabase
          .from("google_review_requests")
          .update({
            workflow_status: "completed",
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", request.id);
      }

      if (!thankYouResult.success) {
        throw new Error(thankYouResult.error || "Failed to send thank you SMS");
      }

      console.log(`Thank you SMS sent to ${request.guest_phone} via GHL`);

      return new Response(
        JSON.stringify({ success: true, action: "thank_you" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // AI-powered smart follow-up action
    if (action === "ai_followup") {
      const { data: request, error: requestError } = await supabase
        .from("google_review_requests")
        .select("*, ownerrez_reviews(*)")
        .eq("id", requestId)
        .single();

      if (requestError || !request) {
        throw new Error("Request not found");
      }

      if (request.opted_out) {
        console.log(`Guest ${request.guest_phone} has opted out, skipping AI follow-up`);
        return new Response(
          JSON.stringify({ success: false, error: "Guest has opted out of SMS", optedOut: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if already completed - don't send follow-ups to completed reviews
      if (request.workflow_status === "completed") {
        console.log(`Guest ${request.guest_phone} already completed review, skipping follow-up`);
        return new Response(
          JSON.stringify({ success: false, error: "Guest already completed their review - no follow-up needed" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const review = request.ownerrez_reviews;
      const guestName = review?.guest_name || "there";
      const propertyName = review?.property_name || "our property";
      const reviewSource = review?.review_source || "Airbnb";
      
      // Determine the right follow-up message based on workflow status
      let followUpMessage: string;
      
      if (request.workflow_status === "permission_asked" && !request.permission_granted_at) {
        // They haven't responded yet - gentle check-in
        followUpMessage = `Hi ${guestName}! It's Anja & Ingo from PeachHaus Group — your hosts from when you stayed with us. Just checking in, no pressure at all! We'd love it if you could share your experience on Google to help other travelers discover us. Would you like me to send over a link? 😊`;
      } else if (request.workflow_status === "permission_granted" && !request.link_sent_at) {
        // They said yes but never got the link
        followUpMessage = `Hi ${guestName}! It's Anja & Ingo from PeachHaus Group. Thank you so much for agreeing to leave us a Google review! Here's the link: ${googleReviewUrl}. And here's your original ${reviewSource} review text if you'd like to paste it: "${review?.review_text || ''}"`;
      } else if (request.workflow_status === "link_sent" && request.nudge_count < 2) {
        // Link was sent, gentle nudge
        const daysSinceLinkSent = request.link_sent_at 
          ? Math.floor((Date.now() - new Date(request.link_sent_at).getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        
        if (daysSinceLinkSent > 3) {
          followUpMessage = `Hi ${guestName}! It's Anja & Ingo from PeachHaus Group — hope you're doing great! Just a friendly reminder about the Google review. We know life gets busy! Here's the link again if you have a moment: ${googleReviewUrl}. Thanks so much for considering it! 🙏`;
        } else {
          return new Response(
            JSON.stringify({ success: false, error: "Link sent recently - waiting before next follow-up" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        // Max nudges reached or unknown state
        return new Response(
          JSON.stringify({ success: false, error: "Maximum follow-ups sent or guest completed - no action needed" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const followUpResult = await sendSms(request.guest_phone, followUpMessage, request.id);

      await supabase.from("sms_log").insert({
        request_id: request.id,
        phone_number: request.guest_phone,
        message_type: "ai_followup",
        message_body: followUpMessage,
        ghl_message_id: followUpResult.messageId,
        status: followUpResult.success ? "sent" : "failed",
        error_message: followUpResult.error,
      });

      if (!followUpResult.success) {
        if (followUpResult.optedOut) {
          return new Response(
            JSON.stringify({ success: false, error: "Contact has opted out at carrier level", optedOut: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        throw new Error(followUpResult.error || "Failed to send AI follow-up SMS");
      }

      // Update nudge count
      await supabase
        .from("google_review_requests")
        .update({
          nudge_count: (request.nudge_count || 0) + 1,
          last_nudge_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", request.id);

      console.log(`AI Follow-up SMS sent to ${request.guest_phone} via GHL`);

      return new Response(
        JSON.stringify({ success: true, action: "ai_followup" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "test") {
      // Send test to specified phone or default to Ingo's phone
      const adminPhone = testPhone ? formatPhoneE164(testPhone) : "+17709065022";
      
      // Look up which user owns this phone number for proper inbox routing
      const { data: phoneAssignment } = await supabase
        .from("user_phone_assignments")
        .select("user_id, phone_assignment_id:id")
        .eq("phone_number", adminPhone)
        .eq("is_active", true)
        .maybeSingle();
      
      // Get the most recent review with review_text to link with this test
      const { data: recentReview } = await supabase
        .from("ownerrez_reviews")
        .select("id, review_text, review_source")
        .not("review_text", "is", null)
        .order("review_date", { ascending: false })
        .limit(1)
        .single();
      
      const reviewText = recentReview?.review_text || "This was an amazing place with everything included! My family loved it.";
      const source = recentReview?.review_source || "Airbnb";
      
      const testMessage = `Thanks again for the wonderful ${source} review — it truly means a lot. Google reviews help future guests trust us when booking directly. If you're open to it, I can send you a link plus a copy of your original review so you can paste it in seconds. Would that be okay?`;
      
      console.log(`Sending test SMS to ${adminPhone} from ${GOOGLE_REVIEWS_PHONE} via GHL`);
      
      // Create a test review request linked to a real review for full automation testing
      const { data: testRequest, error: testRequestError } = await supabase
        .from("google_review_requests")
        .insert({
          review_id: recentReview?.id || null,
          guest_phone: adminPhone,
          workflow_status: "permission_asked",
          permission_asked_at: new Date().toISOString(),
          opted_out: false,
        })
        .select()
        .single();
      
      if (testRequestError) {
        console.log("Note: Could not create test request record:", testRequestError.message);
      }
      
      const testResult = await sendSms(adminPhone, testMessage);
      
      await supabase.from("sms_log").insert({
        request_id: testRequest?.id,
        phone_number: adminPhone,
        message_type: "permission_ask",
        message_body: testMessage,
        ghl_message_id: testResult.messageId,
        status: testResult.success ? "sent" : "failed",
        error_message: testResult.error,
      });
      
      // Also store in user_phone_messages if we found a user assignment
      // This ensures it shows up in the right team member's inbox
      if (phoneAssignment?.user_id) {
        await supabase.from("user_phone_messages").insert({
          user_id: phoneAssignment.user_id,
          phone_assignment_id: phoneAssignment.phone_assignment_id,
          from_number: GOOGLE_REVIEWS_PHONE,
          to_number: adminPhone,
          body: testMessage,
          direction: "outbound",
          status: testResult.success ? "sent" : "failed",
          external_id: testResult.messageId,
        });
      }

      if (!testResult.success) {
        console.error(`Test SMS failed: ${testResult.error}`);
        throw new Error(testResult.error || "Failed to send test SMS");
      }

      console.log(`Test SMS sent successfully via GHL, message ID: ${testResult.messageId}`);

      return new Response(
        JSON.stringify({ success: true, action: "test", messageId: testResult.messageId, requestId: testRequest?.id }),
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
