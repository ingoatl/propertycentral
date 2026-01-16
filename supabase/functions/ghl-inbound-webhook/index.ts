import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

// Google Reviews GHL phone number
const GOOGLE_REVIEWS_PHONE = "+14049247251";

// Format phone number to E.164 for matching - strips ALL non-digit characters including Unicode
function normalizePhone(phone: string): string {
  // Remove ALL non-digit characters including Unicode formatting characters
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return phone.startsWith("+") ? phone : `+${digits}`;
}

// Look up which user owns a phone number for SMS routing
// Returns user_id, phone_assignment_id, and the actual phone_number for proper routing
async function findPhoneOwner(supabase: any, phoneNumber: string): Promise<{ userId: string | null; assignmentId: string | null; displayName: string | null; phoneType: string | null; phoneNumber: string | null }> {
  const normalizedPhone = normalizePhone(phoneNumber);
  const last10 = normalizedPhone.replace(/\D/g, "").slice(-10);
  
  console.log("Finding phone owner for:", phoneNumber, "normalized:", normalizedPhone, "last10:", last10);
  
  // Query ALL active phone assignments
  const { data } = await supabase
    .from("user_phone_assignments")
    .select("user_id, id, display_name, phone_number, phone_type")
    .eq("is_active", true);
  
  if (data && data.length > 0) {
    // Find exact match first
    const exactMatch = data.find((a: any) => a.phone_number === normalizedPhone);
    if (exactMatch) {
      console.log("Found exact match:", exactMatch);
      return { userId: exactMatch.user_id, assignmentId: exactMatch.id, displayName: exactMatch.display_name, phoneType: exactMatch.phone_type, phoneNumber: exactMatch.phone_number };
    }
    
    // Try last 10 digits match
    const digitMatch = data.find((a: any) => {
      const phoneDigits = a.phone_number?.replace(/\D/g, "").slice(-10);
      return phoneDigits === last10;
    });
    if (digitMatch) {
      console.log("Found digit match:", digitMatch);
      return { userId: digitMatch.user_id, assignmentId: digitMatch.id, displayName: digitMatch.display_name, phoneType: digitMatch.phone_type, phoneNumber: digitMatch.phone_number };
    }
  }
  
  console.log("No phone owner found");
  return { userId: null, assignmentId: null, displayName: null, phoneType: null, phoneNumber: null };
}

// Reverse lookup: Find who last messaged this contact when toNumber is not provided
// This is CRITICAL for routing inbound SMS to the correct user's inbox
// Now also returns the phoneNumber so we can populate to_number in user_phone_messages
async function findLastOutboundSender(supabase: any, contactPhone: string): Promise<{ userId: string | null; assignmentId: string | null; displayName: string | null; phoneNumber: string | null }> {
  const normalizedPhone = normalizePhone(contactPhone);
  const last10 = normalizedPhone.replace(/\D/g, "").slice(-10);
  
  console.log("Reverse lookup for contact phone:", contactPhone, "last10:", last10);
  
  // Strategy 1: Check user_phone_messages for recent outbound to this contact
  const { data: recentOutbound } = await supabase
    .from("user_phone_messages")
    .select("user_id, phone_assignment_id")
    .eq("direction", "outbound")
    .or(`to_number.ilike.%${last10}`)
    .order("created_at", { ascending: false })
    .limit(1);
    
  if (recentOutbound && recentOutbound.length > 0) {
    const match = recentOutbound[0];
    console.log("Found recent outbound in user_phone_messages:", match);
    
    // If we have a phone_assignment_id, verify it's personal and get the phone number
    if (match.phone_assignment_id) {
      const { data: assignment } = await supabase
        .from("user_phone_assignments")
        .select("id, user_id, display_name, phone_type, phone_number")
        .eq("id", match.phone_assignment_id)
        .eq("is_active", true)
        .single();
        
      if (assignment && assignment.phone_type === "personal") {
        console.log("Reverse lookup SUCCESS - found personal assignment:", assignment);
        return { userId: assignment.user_id, assignmentId: assignment.id, displayName: assignment.display_name, phoneNumber: assignment.phone_number };
      }
    }
    
    // Even if no phone_assignment_id, we have a user_id - try to find their personal phone
    if (match.user_id) {
      const { data: userAssignment } = await supabase
        .from("user_phone_assignments")
        .select("id, user_id, display_name, phone_type, phone_number")
        .eq("user_id", match.user_id)
        .eq("phone_type", "personal")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
        
      if (userAssignment) {
        console.log("Reverse lookup SUCCESS - found user's personal assignment:", userAssignment);
        return { userId: userAssignment.user_id, assignmentId: userAssignment.id, displayName: userAssignment.display_name, phoneNumber: userAssignment.phone_number };
      }
      
      // Last resort: return user_id without assignment (for assigned_user_id routing only)
      console.log("Reverse lookup - found user_id but no personal assignment, routing to user anyway:", match.user_id);
      return { userId: match.user_id, assignmentId: null, displayName: null, phoneNumber: null };
    }
  }
  
  // Strategy 2: Check lead_communications for recent outbound SMS with sent_from_number
  const { data: recentLeadComm } = await supabase
    .from("lead_communications")
    .select("sent_by_user_id, sent_from_number, contact_phone")
    .eq("communication_type", "sms")
    .eq("direction", "outbound")
    .or(`contact_phone.ilike.%${last10}`)
    .order("created_at", { ascending: false })
    .limit(1);
    
  if (recentLeadComm && recentLeadComm.length > 0) {
    const comm = recentLeadComm[0];
    console.log("Found recent outbound in lead_communications:", comm);
    
    if (comm.sent_by_user_id && comm.sent_from_number) {
      // Find the assignment for this sender's phone number
      const senderPhone = await findPhoneOwner(supabase, comm.sent_from_number);
      if (senderPhone.userId === comm.sent_by_user_id && senderPhone.phoneType === "personal") {
        console.log("Reverse lookup SUCCESS via lead_communications:", senderPhone);
        return { userId: senderPhone.userId, assignmentId: senderPhone.assignmentId, displayName: senderPhone.displayName, phoneNumber: senderPhone.phoneNumber };
      }
    }
  }
  
  console.log("Reverse lookup - no outbound sender found");
  return { userId: null, assignmentId: null, displayName: null, phoneNumber: null };
}

// Check if phone number matches the Google Reviews number
function isGoogleReviewsNumber(phoneNumber: string): boolean {
  if (!phoneNumber) return false;
  const digits = phoneNumber.replace(/\D/g, "").slice(-10);
  const googleDigits = GOOGLE_REVIEWS_PHONE.replace(/\D/g, "").slice(-10);
  return digits === googleDigits;
}

// Send SMS via GHL
async function sendSmsViaGhl(
  ghlApiKey: string,
  ghlLocationId: string,
  ghlContactId: string,
  message: string,
  fromNumber: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
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
          message: message,
          fromNumber: fromNumber,
        }),
      }
    );

    if (!sendResponse.ok) {
      const errorText = await sendResponse.text();
      console.error("GHL SMS send error:", errorText);
      return { success: false, error: errorText };
    }

    const data = await sendResponse.json();
    return { success: true, messageId: data.messageId || data.conversationId };
  } catch (error) {
    console.error("GHL SMS exception:", error);
    return { success: false, error: String(error) };
  }
}

// Process Google Review reply - handles ALL stages of the review workflow
async function processGoogleReviewReply(
  supabase: any,
  ghlApiKey: string,
  ghlLocationId: string,
  ghlContactId: string,
  phoneDigits: string,
  messageBody: string
): Promise<{ handled: boolean }> {
  const googleReviewUrl = Deno.env.get("GOOGLE_REVIEW_URL") || "https://g.page/r/YOUR_REVIEW_LINK";
  const lowerBody = messageBody.toLowerCase().trim();

  // Check for opt-out keywords
  const optOutKeywords = ["stop", "unsubscribe", "opt out", "opt-out", "cancel", "quit", "end"];
  const isOptOut = optOutKeywords.some(kw => lowerBody === kw || lowerBody.includes(kw));

  if (isOptOut) {
    console.log(`Google Reviews opt-out detected`);
    
    await supabase
      .from("google_review_requests")
      .update({
        opted_out: true,
        opted_out_at: new Date().toISOString(),
        workflow_status: "ignored",
        updated_at: new Date().toISOString(),
      })
      .ilike("guest_phone", `%${phoneDigits}`);

    await supabase.from("sms_log").insert({
      phone_number: `+1${phoneDigits}`,
      message_type: "inbound_opt_out",
      message_body: messageBody,
      status: "received",
    });

    await sendSmsViaGhl(ghlApiKey, ghlLocationId, ghlContactId,
      "You've been unsubscribed from PeachHaus messages. Reply START to resubscribe.",
      GOOGLE_REVIEWS_PHONE);

    return { handled: true };
  }

  // Check for re-subscribe keywords (exact match only)
  const resubKeywords = ["start", "unstop"];
  const isResubscribe = resubKeywords.some(kw => lowerBody === kw);

  if (isResubscribe) {
    console.log(`Google Reviews re-subscribe detected`);
    
    await supabase
      .from("google_review_requests")
      .update({
        opted_out: false,
        opted_out_at: null,
        updated_at: new Date().toISOString(),
      })
      .ilike("guest_phone", `%${phoneDigits}`);

    await supabase.from("sms_log").insert({
      phone_number: `+1${phoneDigits}`,
      message_type: "inbound_resubscribe",
      message_body: messageBody,
      status: "received",
    });

    await sendSmsViaGhl(ghlApiKey, ghlLocationId, ghlContactId,
      "You've been re-subscribed to PeachHaus messages. Thank you!",
      GOOGLE_REVIEWS_PHONE);

    return { handled: true };
  }

  // =============================================
  // CHECK 1: Look for "review completed" confirmation from guests who got the link
  // This handles "Done!", "I left a review", "Posted", etc.
  // =============================================
  const completionKeywords = ["done", "posted", "left", "submitted", "completed", "wrote", "finished"];
  const isCompletionMessage = completionKeywords.some(kw => lowerBody.includes(kw));
  
  if (isCompletionMessage) {
    console.log(`Checking for link_sent request for completion confirmation...`);
    
    // Find request where we already sent the link
    const { data: linkSentRequest } = await supabase
      .from("google_review_requests")
      .select("*, ownerrez_reviews(*)")
      .ilike("guest_phone", `%${phoneDigits}`)
      .in("workflow_status", ["link_sent", "permission_granted"])
      .eq("opted_out", false)
      .order("link_sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (linkSentRequest) {
      console.log(`Guest confirmed review completed for request: ${linkSentRequest.id}`);
      const guestName = linkSentRequest.ownerrez_reviews?.guest_name || "there";
      
      // Log the inbound completion confirmation
      await supabase.from("sms_log").insert({
        request_id: linkSentRequest.id,
        phone_number: linkSentRequest.guest_phone,
        message_type: "inbound_completion",
        message_body: messageBody,
        status: "received",
      });
      
      // Update status to completed
      await supabase
        .from("google_review_requests")
        .update({
          workflow_status: "completed",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", linkSentRequest.id);
      
      // Send heartfelt thank you message
      const thankYouMessage = `Hi ${guestName}! It's Anja & Ingo from PeachHaus Group. 🙏 THANK YOU so much for taking the time to leave us a Google review! It means the world to us and helps other travelers find our homes. We hope to host you again someday! ❤️`;
      const thankYouResult = await sendSmsViaGhl(ghlApiKey, ghlLocationId, ghlContactId, thankYouMessage, GOOGLE_REVIEWS_PHONE);
      
      await supabase.from("sms_log").insert({
        request_id: linkSentRequest.id,
        phone_number: linkSentRequest.guest_phone,
        message_type: "thank_you",
        message_body: thankYouMessage,
        ghl_message_id: thankYouResult.messageId,
        status: thankYouResult.success ? "sent" : "failed",
        error_message: thankYouResult.error,
      });
      
      console.log(`Thank you message sent for completed review: ${linkSentRequest.id}`);
      return { handled: true };
    }
  }

  // =============================================
  // CHECK 2: Look for "yes" / affirmative response to permission request
  // Handles guests agreeing to leave a review
  // =============================================
  const affirmativeKeywords = ["yes", "sure", "ok", "okay", "fine", "absolutely", "of course", "definitely", "happy to", "glad to", "will do"];
  const isAffirmative = affirmativeKeywords.some(kw => lowerBody.includes(kw));
  
  // Find pending permission_asked request
  const { data: reviewRequest, error: findError } = await supabase
    .from("google_review_requests")
    .select("*, ownerrez_reviews(*)")
    .ilike("guest_phone", `%${phoneDigits}`)
    .in("workflow_status", ["permission_asked", "pending"])
    .eq("opted_out", false)
    .order("permission_asked_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!reviewRequest) {
    // No pending request - check if they already completed and are just saying thanks
    const { data: completedRequest } = await supabase
      .from("google_review_requests")
      .select("id, workflow_status")
      .ilike("guest_phone", `%${phoneDigits}`)
      .eq("workflow_status", "completed")
      .limit(1)
      .maybeSingle();
    
    if (completedRequest) {
      console.log(`Guest already completed review - no action needed`);
      await supabase.from("sms_log").insert({
        request_id: completedRequest.id,
        phone_number: `+1${phoneDigits}`,
        message_type: "inbound_post_completion",
        message_body: messageBody,
        status: "received",
      });
      return { handled: true };
    }
    
    console.log(`No pending review request found for phone digits ${phoneDigits}`);
    await supabase.from("sms_log").insert({
      phone_number: `+1${phoneDigits}`,
      message_type: "inbound_unmatched_reviews",
      message_body: messageBody,
      status: "received",
    });
    return { handled: false };
  }

  console.log(`Found pending Google review request: ${reviewRequest.id}, status: ${reviewRequest.workflow_status}`);

  // Log the inbound reply
  await supabase.from("sms_log").insert({
    request_id: reviewRequest.id,
    phone_number: reviewRequest.guest_phone,
    message_type: "inbound_reply",
    message_body: messageBody,
    status: "received",
  });

  // Only proceed if it looks like an affirmative response
  if (!isAffirmative) {
    console.log(`Message doesn't look like affirmative response, logged but not auto-processing`);
    return { handled: true }; // Still handled - logged for manual review
  }

  // Update request status to permission granted
  await supabase
    .from("google_review_requests")
    .update({
      workflow_status: "permission_granted",
      permission_granted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", reviewRequest.id);

  // Send the Google review link with host introduction
  const review = reviewRequest.ownerrez_reviews;
  const source = review?.review_source || "Airbnb";
  const reviewText = review?.review_text || "";
  const guestName = review?.guest_name || "there";
  const propertyName = review?.property_name || "our property";

  const linkMessage = `Hi ${guestName}! It's Anja & Ingo, your Airbnb hosts with PeachHaus Group — thank you SO much for staying with us at ${propertyName}! 🏠\n\nHere's the direct link to leave your Google review: ${googleReviewUrl}`;
  const linkResult = await sendSmsViaGhl(ghlApiKey, ghlLocationId, ghlContactId, linkMessage, GOOGLE_REVIEWS_PHONE);

  await supabase.from("sms_log").insert({
    request_id: reviewRequest.id,
    phone_number: reviewRequest.guest_phone,
    message_type: "link_delivery",
    message_body: linkMessage,
    ghl_message_id: linkResult.messageId,
    status: linkResult.success ? "sent" : "failed",
    error_message: linkResult.error,
  });

  // Send the review text if available for easy copy/paste
  if (reviewText) {
    const reviewMessage = `Here's the text of your ${source} review so you can easily copy/paste it:\n\n"${reviewText}"\n\nThanks so much! Just reply "Done" when you've posted it and we'll send you our heartfelt thanks! ❤️\n\n— Anja & Ingo, PeachHaus Group`;
    const reviewResult = await sendSmsViaGhl(ghlApiKey, ghlLocationId, ghlContactId, reviewMessage, GOOGLE_REVIEWS_PHONE);

    await supabase.from("sms_log").insert({
      request_id: reviewRequest.id,
      phone_number: reviewRequest.guest_phone,
      message_type: "review_text",
      message_body: reviewMessage,
      ghl_message_id: reviewResult.messageId,
      status: reviewResult.success ? "sent" : "failed",
      error_message: reviewResult.error,
    });
  }

  // Update status to link_sent
  await supabase
    .from("google_review_requests")
    .update({
      workflow_status: "link_sent",
      link_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", reviewRequest.id);

  console.log(`Google review link sent via GHL for request: ${reviewRequest.id}`);

  return { handled: true };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ghlApiKey = Deno.env.get("GHL_API_KEY")!;
    const ghlLocationId = Deno.env.get("GHL_LOCATION_ID")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    console.log("GHL Inbound Webhook received:", JSON.stringify(payload, null, 2));

    // GHL Workflow webhook structure (from "Customer replied" trigger)
    // The payload comes with message object and contact details directly
    const {
      message,
      contact_id: ghlContactId,
      phone: rawPhone,
      first_name: firstName,
      last_name: lastName,
      full_name: fullName,
    } = payload;

    // Check if this is a valid SMS message from the workflow
    if (!message || !message.body) {
      console.log("No message body found in payload");
      return new Response(JSON.stringify({ success: true, message: "No message body" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const messageBody = message.body;
    const contactPhone = rawPhone;
    const contactName = fullName || firstName || "Lead";
    
    // Extract the "to" number (the GHL number that received the SMS)
    // GHL workflow payloads often don't include this - we'll detect by checking for pending review requests
    const toNumber = message.to || payload.to || payload.toNumber || message.phoneNumberId || 
                     payload.phone_number_id || message.toNumber || message.from_number_id || null;
    console.log("SMS routing - To number:", toNumber);
    
    // Extract phone digits for matching
    const normalizedPhone = normalizePhone(contactPhone);
    const digits = normalizedPhone.replace(/\D/g, "");
    const last10Digits = digits.slice(-10);
    
    // ============================================
    // CHECK IF THIS IS A GOOGLE REVIEWS MESSAGE
    // ONLY route to Google Reviews if:
    // 1. The message was sent TO the Google Reviews phone number, OR
    // 2. It's explicitly flagged as a Google source (check multiple possible fields)
    // 3. The contact was created from GoogleReviews source
    // DO NOT route based solely on pending review - the guest might text other numbers!
    // ============================================
    const isGoogleReviewsToNumber = isGoogleReviewsNumber(toNumber);
    const isGoogleSource = payload.source === "GoogleReviews" || 
                           payload.contact_source === "GoogleReviews" ||
                           payload.customField?.source === "GoogleReviews" ||
                           payload.customData?.source === "GoogleReviews" ||
                           (message.source && String(message.source).includes("Google"));
    
    // Also check for pending review request to route properly
    const { data: pendingReviewRequest } = await supabase
      .from("google_review_requests")
      .select("id")
      .ilike("guest_phone", `%${last10Digits}`)
      .in("workflow_status", ["permission_asked", "pending"])
      .eq("opted_out", false)
      .limit(1)
      .maybeSingle();
    const hasPendingGoogleReview = !!pendingReviewRequest;
    
    console.log("Google Reviews routing check:", {
      isGoogleReviewsToNumber,
      isGoogleSource,
      hasPendingGoogleReview,
      contactSource: payload.contact_source,
      toNumber,
      last10Digits
    });
    
    // ONLY route to Google Reviews if the message was sent to the Google Reviews number or explicitly flagged
    if (isGoogleReviewsToNumber || isGoogleSource) {
      console.log("=== GOOGLE REVIEWS CHANNEL (GHL) ===");
      
      const reviewResult = await processGoogleReviewReply(
        supabase,
        ghlApiKey,
        ghlLocationId,
        ghlContactId,
        last10Digits,
        messageBody
      );
      
      if (reviewResult.handled) {
        return new Response(
          JSON.stringify({ success: true, message: "Google review reply processed" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Even if not handled by review flow, we still processed it - log to Google Reviews inbox
      await supabase.from("sms_log").insert({
        phone_number: normalizedPhone,
        message_type: "inbound_unmatched_reviews",
        message_body: messageBody,
        status: "received",
      });
      
      return new Response(
        JSON.stringify({ success: true, message: "Google reviews channel - logged for processing" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // ============================================
    // REGULAR SMS HANDLING (Leads/Tenants)
    // ============================================
    
    // Look up which team member owns this receiving number for routing
    // CRITICAL: Route to personal inbox if:
    // 1. We have a toNumber that matches a personal phone assignment, OR
    // 2. We can find who last messaged this contact (reverse lookup)
    let assignedUserId: string | null = null;
    let routedPhoneAssignmentId: string | null = null;
    let routedPhoneNumber: string | null = null; // The actual phone number to use as to_number
    let isPersonalPhoneMessage = false;
    
    if (toNumber) {
      // Direct routing: toNumber is provided by GHL
      const phoneOwner = await findPhoneOwner(supabase, toNumber);
      
      if (phoneOwner.userId && phoneOwner.assignmentId && phoneOwner.phoneType === "personal") {
        assignedUserId = phoneOwner.userId;
        routedPhoneAssignmentId = phoneOwner.assignmentId;
        routedPhoneNumber = phoneOwner.phoneNumber;
        isPersonalPhoneMessage = true;
        console.log("SMS routing - Direct match to personal phone:", assignedUserId);
      } else if (phoneOwner.phoneType === "company") {
        console.log("SMS routing - Company line message, goes to shared inbox");
      }
    }
    
    // REVERSE LOOKUP: If no toNumber or no match found, find who last messaged this contact
    if (!isPersonalPhoneMessage) {
      console.log("SMS routing - Attempting reverse lookup for contact:", normalizedPhone);
      const sender = await findLastOutboundSender(supabase, normalizedPhone);
      
      if (sender.userId) {
        assignedUserId = sender.userId;
        // Only set as personal phone message if we have both userId AND assignmentId
        if (sender.assignmentId) {
          routedPhoneAssignmentId = sender.assignmentId;
          routedPhoneNumber = sender.phoneNumber; // Use the phone number from the assignment
          isPersonalPhoneMessage = true;
          console.log("SMS routing - Reverse lookup SUCCESS with assignment, routing to user:", assignedUserId, "phone:", routedPhoneNumber);
        } else {
          // We have a user but no personal phone assignment - still route to their inbox via assigned_user_id
          console.log("SMS routing - Reverse lookup found user but no assignment, routing via assigned_user_id:", assignedUserId);
        }
      } else {
        console.log("SMS routing - Reverse lookup found no sender, goes to shared inbox only");
      }
    }
    
    console.log("SMS routing - Final:", { 
      assignedUserId, 
      routedPhoneAssignmentId, 
      routedPhoneNumber,
      isPersonalPhoneMessage,
      toNumber 
    });
    
    // Extract media URLs from MMS attachments - check ALL possible locations
    const mediaUrls: string[] = [];
    
    // Check message.attachments array
    if (message.attachments && Array.isArray(message.attachments)) {
      for (const attachment of message.attachments) {
        if (typeof attachment === "string") {
          mediaUrls.push(attachment);
        } else if (attachment?.url) {
          mediaUrls.push(attachment.url);
        } else if (attachment?.mediaUrl) {
          mediaUrls.push(attachment.mediaUrl);
        }
      }
    }
    
    // Check message.media array (alternative GHL format)
    if (message.media && Array.isArray(message.media)) {
      for (const media of message.media) {
        if (typeof media === "string") {
          mediaUrls.push(media);
        } else if (media?.url) {
          mediaUrls.push(media.url);
        }
      }
    }
    
    // Check payload-level attachments (some GHL workflows put them here)
    if (payload.attachments && Array.isArray(payload.attachments)) {
      for (const attachment of payload.attachments) {
        if (typeof attachment === "string" && !mediaUrls.includes(attachment)) {
          mediaUrls.push(attachment);
        } else if (attachment?.url && !mediaUrls.includes(attachment.url)) {
          mediaUrls.push(attachment.url);
        }
      }
    }
    
    // Check payload.mediaUrls array
    if (payload.mediaUrls && Array.isArray(payload.mediaUrls)) {
      for (const url of payload.mediaUrls) {
        if (typeof url === "string" && !mediaUrls.includes(url)) {
          mediaUrls.push(url);
        }
      }
    }
    
    console.log("Media URLs found:", mediaUrls);
    
    console.log("Processing inbound SMS:", { messageBody, contactPhone, contactName });

    if (!contactPhone) {
      console.log("No phone number found in payload");
      return new Response(JSON.stringify({ success: false, message: "No phone number found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const last4Digits = digits.slice(-4);
    console.log("Looking for lead with phone:", normalizedPhone, "last 10:", last10Digits, "last 4:", last4Digits);

    // Find matching lead by phone number - search by last 4 digits to handle various formats
    const { data: leads, error: leadError } = await supabase
      .from("leads")
      .select("id, name, phone, stage, active_sequence_id")
      .ilike("phone", `%${last4Digits}%`)
      .limit(20);

    if (leadError) {
      console.error("Error finding lead:", leadError);
      throw leadError;
    }

    console.log("Found potential lead matches:", leads?.length || 0, leads?.map(l => ({ id: l.id, phone: l.phone })));

    // Find the best match by comparing normalized digits (last 10)
    const lead = leads?.find(l => {
      const leadDigits = l.phone?.replace(/\D/g, "").slice(-10);
      console.log("Comparing:", leadDigits, "vs", last10Digits);
      return leadDigits === last10Digits;
    });

    // Also check mid_term_bookings (tenants) if no lead found
    let tenantMatch: { id: string; name: string; phone: string } | null = null;
    if (!lead) {
      const { data: tenants, error: tenantError } = await supabase
        .from("mid_term_bookings")
        .select("id, tenant_name, tenant_phone")
        .ilike("tenant_phone", `%${last4Digits}%`)
        .limit(20);

      if (!tenantError && tenants) {
        const tenant = tenants.find(t => {
          const tenantDigits = t.tenant_phone?.replace(/\D/g, "").slice(-10);
          return tenantDigits === last10Digits;
        });
        if (tenant) {
          tenantMatch = { id: tenant.id, name: tenant.tenant_name, phone: tenant.tenant_phone };
          console.log("Found matching tenant:", tenantMatch.id, tenantMatch.name);
        }
      }
    }

    // If neither lead nor tenant found, still store the message for later matching
    if (!lead && !tenantMatch) {
      console.log("No matching lead or tenant found for phone:", normalizedPhone);
      
      // Store in lead_communications without lead_id for manual matching later
      const { data: comm, error: commError } = await supabase
        .from("lead_communications")
        .insert({
          communication_type: "sms",
          direction: "inbound",
          body: messageBody,
          status: "received",
          ghl_contact_id: ghlContactId,
          is_read: false,
          media_urls: mediaUrls.length > 0 ? mediaUrls : null,
          assigned_user_id: assignedUserId,
          received_on_number: toNumber,
          metadata: { 
            unmatched_phone: normalizedPhone, 
            contact_name: contactName,
            ghl_data: { contactPhone: contactPhone, contactName }
          }
        })
        .select()
        .single();

      // Store in user_phone_messages ONLY if this is definitively a personal phone message
      // This prevents messages from appearing in wrong inboxes
      // CRITICAL: Use routedPhoneNumber (from assignment) when toNumber is null
      if (isPersonalPhoneMessage && assignedUserId && routedPhoneAssignmentId && routedPhoneNumber) {
        await supabase
          .from("user_phone_messages")
          .insert({
            user_id: assignedUserId,
            phone_assignment_id: routedPhoneAssignmentId,
            direction: "inbound",
            from_number: normalizedPhone,
            to_number: routedPhoneNumber, // Use the phone number from the assignment
            body: messageBody,
            media_urls: mediaUrls.length > 0 ? mediaUrls : null,
            status: "received",
            external_id: ghlContactId,
          });
        console.log("Personal message stored in user_phone_messages for user:", assignedUserId, "to_number:", routedPhoneNumber);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Message stored - no matching contact", 
          phone: normalizedPhone,
          communicationId: comm?.id
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Found matching contact:", lead ? `Lead ${lead.id}` : `Tenant ${tenantMatch?.id}`);

    // Create lead_communications record
    const { data: comm, error: commError } = await supabase
      .from("lead_communications")
      .insert({
        lead_id: lead?.id || null,
        communication_type: "sms",
        direction: "inbound",
        body: messageBody,
        status: "received",
        ghl_contact_id: ghlContactId,
        is_read: false,
        media_urls: mediaUrls.length > 0 ? mediaUrls : null,
        assigned_user_id: assignedUserId,
        received_on_number: toNumber,
        metadata: tenantMatch ? { 
          tenant_id: tenantMatch.id, 
          tenant_name: tenantMatch.name,
          tenant_phone: tenantMatch.phone
        } : null
      })
      .select()
      .single();

    if (commError) {
      console.error("Error creating communication:", commError);
      throw commError;
    }

    console.log("Communication record created:", comm.id);

    // Store in user_phone_messages ONLY if this is definitively a personal phone message
    // This prevents messages from appearing in wrong inboxes
    // CRITICAL: Use routedPhoneNumber (from assignment) when toNumber is null
    if (isPersonalPhoneMessage && assignedUserId && routedPhoneAssignmentId && routedPhoneNumber) {
      const { error: userMsgError } = await supabase
        .from("user_phone_messages")
        .insert({
          user_id: assignedUserId,
          phone_assignment_id: routedPhoneAssignmentId,
          direction: "inbound",
          from_number: normalizedPhone,
          to_number: routedPhoneNumber, // Use the phone number from the assignment
          body: messageBody,
          media_urls: mediaUrls.length > 0 ? mediaUrls : null,
          status: "received",
          external_id: ghlContactId,
        });
      
      if (userMsgError) {
        console.error("Error storing to user_phone_messages:", userMsgError);
      } else {
        console.log("Personal message stored in user_phone_messages for user:", assignedUserId, "to_number:", routedPhoneNumber);
      }
    }

    // Only update lead-specific fields if we have a lead (not tenant)
    if (lead) {
      // Update lead with last_response_at and has_unread_messages
      const { error: leadUpdateError } = await supabase
        .from("leads")
        .update({
          last_response_at: new Date().toISOString(),
          has_unread_messages: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", lead.id);

      if (leadUpdateError) {
        console.error("Error updating lead:", leadUpdateError);
      }

      // Check if we need to pause/cancel follow-up sequences
      if (lead.active_sequence_id) {
        // Check if sequence has stop_on_response enabled
        const { data: sequence } = await supabase
          .from("lead_follow_up_sequences")
          .select("stop_on_response")
          .eq("id", lead.active_sequence_id)
          .single();

        if (sequence?.stop_on_response) {
          console.log("Cancelling pending follow-ups due to lead response");
          
          // Cancel all pending follow-ups for this lead
          const { error: cancelError } = await supabase
            .from("lead_follow_up_schedules")
            .update({ status: "cancelled" })
            .eq("lead_id", lead.id)
            .eq("status", "pending");

          if (cancelError) {
            console.error("Error cancelling follow-ups:", cancelError);
          } else {
            // Log timeline entry
            await supabase.from("lead_timeline").insert({
              lead_id: lead.id,
              action: "Follow-up sequence paused due to lead response",
              performed_by_name: "System",
            });
          }
        }
      }

      // Add timeline entry for the inbound message
      const messagePreview = messageBody.length > 50 ? messageBody.slice(0, 50) + "..." : messageBody;
      await supabase.from("lead_timeline").insert({
        lead_id: lead.id,
        action: `SMS received: "${messagePreview}"`,
        performed_by_name: contactName,
      });
    }

    const contactType = lead ? "lead" : "tenant";
    const contactId = lead?.id || tenantMatch?.id;
    console.log(`GHL inbound SMS processed successfully for ${contactType}:`, contactId);

    return new Response(
      JSON.stringify({
        success: true,
        contactType,
        contactId,
        communicationId: comm.id,
        message: "Inbound SMS processed successfully",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing GHL webhook:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
