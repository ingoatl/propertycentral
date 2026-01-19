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

  console.log("=== TWILIO WEBHOOK RECEIVED ===");
  console.log("Method:", req.method);
  console.log("URL:", req.url);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const googleReviewUrl = Deno.env.get("GOOGLE_REVIEW_URL") || "https://g.page/r/YOUR_REVIEW_LINK";
    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const twilioAuth = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    
    // TWO SEPARATE PHONE NUMBERS
    const googleReviewsPhone = Deno.env.get("TWILIO_PHONE_NUMBER")!; // 770 number for Google Reviews
    const vendorMaintenancePhone = Deno.env.get("TWILIO_VENDOR_PHONE_NUMBER") || googleReviewsPhone; // 404 number for Maintenance

    const supabase = createClient(supabaseUrl, supabaseKey);

    // CRITICAL: Parse form data using URLSearchParams, NOT req.formData()
    const formDataText = await req.text();
    console.log("Raw form data:", formDataText);
    
    const formData = new URLSearchParams(formDataText);
    
    const from = formData.get("From") as string;
    const to = formData.get("To") as string; // Which Twilio number received this
    const body = (formData.get("Body") || "").trim();
    const messageSid = formData.get("MessageSid") as string;

    console.log(`Received SMS from ${from} to ${to}: "${body}" (SID: ${messageSid})`);

    if (!from) {
      console.error("No 'From' number in webhook");
      throw new Error("No 'From' number in webhook");
    }

    // CRITICAL: Clean phone numbers and match on last 10 digits
    const cleanFromPhone = from.replace(/[\s\-\(\)\+]/g, "");
    const phoneDigits = cleanFromPhone.slice(-10);
    
    const cleanToPhone = to?.replace(/[\s\-\(\)\+]/g, "") || "";
    const toPhoneDigits = cleanToPhone.slice(-10);
    
    // Determine which channel based on receiving number
    const googleReviewsDigits = googleReviewsPhone.replace(/[\s\-\(\)\+]/g, "").slice(-10);
    const vendorMaintenanceDigits = vendorMaintenancePhone.replace(/[\s\-\(\)\+]/g, "").slice(-10);
    
    const isGoogleReviewsChannel = toPhoneDigits === googleReviewsDigits;
    const isMaintenanceChannel = toPhoneDigits === vendorMaintenanceDigits;

    console.log(`Channel Detection:`);
    console.log(`  Received on: ${to} (digits: ${toPhoneDigits})`);
    console.log(`  Google Reviews number: ${googleReviewsPhone} (digits: ${googleReviewsDigits})`);
    console.log(`  Maintenance number: ${vendorMaintenancePhone} (digits: ${vendorMaintenanceDigits})`);
    console.log(`  Is Google Reviews channel: ${isGoogleReviewsChannel}`);
    console.log(`  Is Maintenance channel: ${isMaintenanceChannel}`);
    console.log(`  From phone digits: ${phoneDigits}`);

    // ============================================
    // STEP 1: Check for opt-out keywords (global - both channels)
    // ============================================
    const optOutKeywords = ["stop", "unsubscribe", "opt out", "opt-out", "cancel", "quit", "end"];
    const isOptOut = optOutKeywords.some(kw => body.toLowerCase() === kw || body.toLowerCase().includes(kw));

    if (isOptOut) {
      console.log(`Opt-out detected from ${from}`);
      
      // Determine which phone to respond from based on channel
      const responsePhone = isMaintenanceChannel ? vendorMaintenancePhone : googleReviewsPhone;
      
      // Update Google review requests if on that channel
      if (isGoogleReviewsChannel) {
        await supabase
          .from("google_review_requests")
          .update({
            opted_out: true,
            opted_out_at: new Date().toISOString(),
            workflow_status: "ignored",
            updated_at: new Date().toISOString(),
          })
          .ilike("guest_phone", `%${phoneDigits}`);
      }

      await supabase.from("sms_log").insert({
        phone_number: from,
        message_type: "inbound_opt_out",
        message_body: body,
        status: "received",
      });

      await sendSms(twilioSid, twilioAuth, responsePhone, from, 
        "You've been unsubscribed from PeachHaus messages. Reply START to resubscribe.");

      return xmlResponse();
    }

    // Check for re-subscribe keywords (global)
    const resubKeywords = ["start", "yes", "unstop"];
    const isResubscribe = resubKeywords.some(kw => body.toLowerCase() === kw);

    if (isResubscribe && isGoogleReviewsChannel) {
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

      await sendSms(twilioSid, twilioAuth, googleReviewsPhone, from,
        "You've been re-subscribed to PeachHaus messages. Thank you!");

      return xmlResponse();
    }

    // ============================================
    // MAINTENANCE CHANNEL: Vendor and Owner Responses
    // ============================================
    if (isMaintenanceChannel) {
      console.log("=== MAINTENANCE CHANNEL ===");
      
      // Check if this is a VENDOR response
      const vendorResult = await checkVendorResponse(supabase, phoneDigits, body, twilioSid, twilioAuth, vendorMaintenancePhone);
      if (vendorResult.handled) {
        console.log("Message handled as vendor response");
        return xmlResponse();
      }

      // Check if this is a PROPERTY OWNER response (quote approvals)
      const ownerResult = await checkOwnerResponse(supabase, phoneDigits, body, twilioSid, twilioAuth, vendorMaintenancePhone);
      if (ownerResult.handled) {
        console.log("Message handled as owner response");
        return xmlResponse();
      }

      // Unmatched maintenance message
      console.log(`Unmatched maintenance message from ${phoneDigits}`);
      await supabase.from("sms_log").insert({
        phone_number: from,
        message_type: "inbound_unmatched_maintenance",
        message_body: body,
        status: "received",
      });

      return xmlResponse();
    }

    // ============================================
    // GOOGLE REVIEWS CHANNEL: Guest Review Responses
    // ============================================
    if (isGoogleReviewsChannel) {
      console.log("=== GOOGLE REVIEWS CHANNEL ===");
      
      const { data: reviewRequest, error: findError } = await supabase
        .from("google_review_requests")
        .select("*, ownerrez_reviews(*)")
        .ilike("guest_phone", `%${phoneDigits}`)
        .in("workflow_status", ["permission_asked"])
        .eq("opted_out", false)
        .order("permission_asked_at", { ascending: false })
        .limit(1)
        .single();

      if (!findError && reviewRequest) {
        console.log(`Found pending Google review request: ${reviewRequest.id}`);
        await processGoogleReviewReply(supabase, reviewRequest, body, googleReviewUrl, twilioSid, twilioAuth, googleReviewsPhone);
        return xmlResponse();
      }

      // Unmatched Google reviews message
      console.log(`No pending review request found for phone digits ${phoneDigits}`);
      await supabase.from("sms_log").insert({
        phone_number: from,
        message_type: "inbound_unmatched_reviews",
        message_body: body,
        status: "received",
      });

      return xmlResponse();
    }

    // ============================================
    // UNKNOWN CHANNEL - Log and exit
    // ============================================
    console.log(`Unknown channel - received on ${to}, not matching either number`);
    await supabase.from("sms_log").insert({
      phone_number: from,
      message_type: "inbound_unknown_channel",
      message_body: body,
      status: "received",
    });

    return xmlResponse();
  } catch (error) {
    console.error("Webhook error:", error);
    return xmlResponse();
  }
});

function xmlResponse() {
  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    { headers: { "Content-Type": "text/xml" } }
  );
}

// ============================================
// VENDOR RESPONSE HANDLING (Maintenance)
// ============================================
interface VendorResponseParsed {
  type: "confirm" | "decline" | "quote" | "complete" | "eta" | "unknown";
  quote?: number;
  eta?: string;
}

function parseVendorResponse(body: string): VendorResponseParsed {
  const lower = body.toLowerCase().trim();
  
  if (lower === "confirm" || lower === "yes" || lower === "accept" || lower.includes("on my way") || lower.includes("omw")) {
    return { type: "confirm" };
  }
  if (lower === "decline" || lower === "no" || lower === "reject" || lower.includes("can't make it") || lower.includes("cannot")) {
    return { type: "decline" };
  }
  if (lower === "complete" || lower === "done" || lower === "finished" || lower.includes("job complete")) {
    return { type: "complete" };
  }
  
  // Check for quote pattern: "quote $500" or "$500" or "500"
  const quoteMatch = body.match(/(?:quote\s*)?[\$]?\s*(\d+(?:\.\d{2})?)/i);
  if (quoteMatch && (lower.includes("quote") || lower.startsWith("$"))) {
    return { type: "quote", quote: parseFloat(quoteMatch[1]) };
  }
  
  // Check for ETA pattern
  const etaMatch = body.match(/(?:eta|arrive|arriving|be there)\s*(?:in\s*)?(.+)/i);
  if (etaMatch) {
    return { type: "eta", eta: etaMatch[1].trim() };
  }
  
  return { type: "unknown" };
}

async function checkVendorResponse(
  supabase: any,
  phoneDigits: string,
  body: string,
  twilioSid: string,
  twilioAuth: string,
  twilioPhone: string
): Promise<{ handled: boolean }> {
  // Find vendor by phone number
  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, name, phone")
    .or(`phone.ilike.%${phoneDigits},phone.ilike.%${phoneDigits.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3")}`)
    .limit(1)
    .single();

  if (!vendor) {
    return { handled: false };
  }

  console.log(`Found vendor: ${vendor.name} (${vendor.id})`);

  // Find assigned work orders for this vendor
  const { data: workOrders } = await supabase
    .from("work_orders")
    .select("*, properties(name, owner_id, property_owners(phone))")
    .eq("assigned_vendor_id", vendor.id)
    .in("status", ["assigned", "scheduled", "in_progress", "pending_approval"])
    .order("updated_at", { ascending: false });

  if (!workOrders || workOrders.length === 0) {
    console.log("No active work orders for this vendor");
    return { handled: false };
  }

  const workOrder = workOrders[0];
  const parsed = parseVendorResponse(body);

  console.log(`Vendor response type: ${parsed.type} for work order ${workOrder.id}`);

  // Log the vendor message to maintenance_messages
  await supabase.from("maintenance_messages").insert({
    work_order_id: workOrder.id,
    sender_type: "vendor",
    sender_name: vendor.name,
    message_text: body,
    visible_to_owner: true,
    visible_to_vendor: true,
  });

  // Also log to lead_communications with vendor metadata for inbox display
  await supabase.from("lead_communications").insert({
    communication_type: "sms",
    direction: "inbound",
    body: body,
    from_phone: vendor.phone,
    metadata: {
      vendor_id: vendor.id,
      vendor_name: vendor.name,
      vendor_phone: vendor.phone,
      contact_type: "vendor",
      work_order_id: workOrder.id,
      response_type: parsed.type,
    },
  });

  switch (parsed.type) {
    case "confirm":
      await supabase.from("work_orders").update({
        status: "scheduled",
        updated_at: new Date().toISOString(),
      }).eq("id", workOrder.id);
      
      await sendSms(twilioSid, twilioAuth, twilioPhone, vendor.phone,
        `Thank you! You're confirmed for: ${workOrder.title}. Please reply COMPLETE when finished.`);
      break;

    case "decline":
      await supabase.from("work_orders").update({
        status: "new",
        assigned_vendor_id: null,
        updated_at: new Date().toISOString(),
      }).eq("id", workOrder.id);
      
      await sendSms(twilioSid, twilioAuth, twilioPhone, vendor.phone,
        `Understood. We'll find another vendor for this job. Thank you for letting us know.`);
      break;

    case "quote":
      // Check if quote needs owner approval (over threshold)
      const threshold = workOrder.properties?.auto_approve_threshold || 300;
      if (parsed.quote && parsed.quote > threshold) {
        await supabase.from("work_orders").update({
          status: "pending_approval",
          quoted_cost: parsed.quote,
          updated_at: new Date().toISOString(),
        }).eq("id", workOrder.id);
        
        // Notify owner for approval
        const ownerPhone = workOrder.properties?.property_owners?.phone;
        if (ownerPhone) {
          await sendSms(twilioSid, twilioAuth, twilioPhone, ownerPhone,
            `Quote received for ${workOrder.title}: $${parsed.quote}. Reply APPROVE or DECLINE.`);
        }
        
        await sendSms(twilioSid, twilioAuth, twilioPhone, vendor.phone,
          `Quote of $${parsed.quote} received. Waiting for owner approval.`);
      } else {
        await supabase.from("work_orders").update({
          quoted_cost: parsed.quote,
          status: "scheduled",
          updated_at: new Date().toISOString(),
        }).eq("id", workOrder.id);
        
        await sendSms(twilioSid, twilioAuth, twilioPhone, vendor.phone,
          `Quote of $${parsed.quote} auto-approved. Please proceed with the work.`);
      }
      break;

    case "complete":
      await supabase.from("work_orders").update({
        status: "pending_verification",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", workOrder.id);
      
      await sendSms(twilioSid, twilioAuth, twilioPhone, vendor.phone,
        `Great! Job marked as complete. Thank you for your work!`);
      break;

    case "eta":
      await supabase.from("work_orders").update({
        status: "in_progress",
        updated_at: new Date().toISOString(),
      }).eq("id", workOrder.id);
      
      await sendSms(twilioSid, twilioAuth, twilioPhone, vendor.phone,
        `Thanks for the update! ETA noted: ${parsed.eta}`);
      break;

    default:
      // Unknown response, just log it
      console.log("Unknown vendor response, logged as message");
      break;
  }

  return { handled: true };
}

// ============================================
// OWNER RESPONSE HANDLING (Quote Approvals)
// ============================================
async function checkOwnerResponse(
  supabase: any,
  phoneDigits: string,
  body: string,
  twilioSid: string,
  twilioAuth: string,
  twilioPhone: string
): Promise<{ handled: boolean }> {
  // Find owner by phone number
  const { data: owner } = await supabase
    .from("property_owners")
    .select("id, name, phone")
    .or(`phone.ilike.%${phoneDigits},phone.ilike.%${phoneDigits.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3")}`)
    .limit(1)
    .single();

  if (!owner) {
    return { handled: false };
  }

  console.log(`Found owner: ${owner.name} (${owner.id})`);

  // Find pending approval work orders for this owner's properties
  const { data: workOrders } = await supabase
    .from("work_orders")
    .select("*, properties!inner(name, owner_id), vendors(name, phone)")
    .eq("properties.owner_id", owner.id)
    .eq("status", "pending_approval")
    .order("updated_at", { ascending: false });

  if (!workOrders || workOrders.length === 0) {
    console.log("No pending approval work orders for this owner");
    return { handled: false };
  }

  const workOrder = workOrders[0];
  const lower = body.toLowerCase().trim();

  if (lower === "approve" || lower === "yes" || lower === "ok" || lower === "approved") {
    await supabase.from("work_orders").update({
      status: "scheduled",
      updated_at: new Date().toISOString(),
    }).eq("id", workOrder.id);

    await supabase.from("maintenance_messages").insert({
      work_order_id: workOrder.id,
      sender_type: "owner",
      sender_name: owner.name,
      message_text: `Approved: ${body}`,
      visible_to_owner: true,
      visible_to_vendor: true,
    });

    // Notify vendor
    if (workOrder.vendors?.phone) {
      await sendSms(twilioSid, twilioAuth, twilioPhone, workOrder.vendors.phone,
        `Good news! Quote approved for: ${workOrder.title}. Please proceed with the work.`);
    }

    await sendSms(twilioSid, twilioAuth, twilioPhone, owner.phone,
      `Quote approved. Vendor has been notified to proceed.`);

    return { handled: true };
  }

  if (lower === "decline" || lower === "no" || lower === "reject" || lower === "declined") {
    await supabase.from("work_orders").update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    }).eq("id", workOrder.id);

    await supabase.from("maintenance_messages").insert({
      work_order_id: workOrder.id,
      sender_type: "owner",
      sender_name: owner.name,
      message_text: `Declined: ${body}`,
      visible_to_owner: true,
      visible_to_vendor: true,
    });

    // Notify vendor
    if (workOrder.vendors?.phone) {
      await sendSms(twilioSid, twilioAuth, twilioPhone, workOrder.vendors.phone,
        `Quote was declined for: ${workOrder.title}. Job cancelled.`);
    }

    await sendSms(twilioSid, twilioAuth, twilioPhone, owner.phone,
      `Quote declined. Vendor has been notified.`);

    return { handled: true };
  }

  return { handled: false };
}

// ============================================
// GOOGLE REVIEW REPLY HANDLING
// ============================================
async function processGoogleReviewReply(
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

  console.log(`Processing Google review reply for request ${request.id}`);

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

// ============================================
// SMS SENDING HELPER
// ============================================
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
    console.log(`SMS sent successfully from ${twilioPhone}, SID: ${data.sid}`);
    return { success: true, sid: data.sid };
  } catch (error) {
    console.error("Twilio send exception:", error);
    return { success: false, error: String(error) };
  }
}
