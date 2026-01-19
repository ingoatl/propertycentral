import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const twilioAuth = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse Twilio form data
    const formDataText = await req.text();
    const formData = new URLSearchParams(formDataText);
    
    const from = formData.get("From") as string;
    const body = (formData.get("Body") as string || "").trim().toLowerCase();
    const messageSid = formData.get("MessageSid") as string;

    console.log(`[Maintenance SMS] Received from ${from}: ${body}`);

    if (!from || !body) {
      console.log("Missing from or body");
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    // Clean phone number - match on last 10 digits
    const cleanPhone = from.replace(/[\s\-\(\)\+]/g, "");
    const phoneDigits = cleanPhone.slice(-10);

    // Log inbound message
    await supabase.from("sms_log").insert({
      phone_number: from,
      message_type: "maintenance_inbound",
      message_body: body,
      twilio_message_sid: messageSid,
      status: "received",
    });

    // Find vendor by phone number
    const { data: vendor, error: vendorError } = await supabase
      .from("vendors")
      .select("*")
      .or(`phone.ilike.%${phoneDigits},phone.ilike.%${cleanPhone}`)
      .limit(1)
      .single();

    if (vendorError || !vendor) {
      // Check if it's an owner responding
      const ownerResponse = await handleOwnerResponse(supabase, phoneDigits, body, twilioSid, twilioAuth, twilioPhone);
      if (ownerResponse.handled) {
        return new Response(
          '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
          { headers: { "Content-Type": "text/xml" } }
        );
      }

      console.log(`No vendor or owner found for phone ${phoneDigits}`);
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    console.log(`Found vendor: ${vendor.name} (${vendor.id})`);

    // Find the most recent dispatched work order for this vendor
    const { data: workOrder, error: woError } = await supabase
      .from("work_orders")
      .select("*, property:properties(name, address, owner_id)")
      .eq("assigned_vendor_id", vendor.id)
      .in("status", ["dispatched", "awaiting_approval", "scheduled"])
      .order("assigned_at", { ascending: false })
      .limit(1)
      .single();

    if (woError || !workOrder) {
      console.log(`No pending work order for vendor ${vendor.name}`);
      await sendSms(twilioSid, twilioAuth, twilioPhone, from, 
        "We couldn't find an active work order for you. Please contact our office if you need assistance.");
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    console.log(`Found work order: ${workOrder.title} (${workOrder.id})`);

    // Parse vendor response
    const response = parseVendorResponse(body);
    
    switch (response.type) {
      case "confirm":
        await handleVendorConfirm(supabase, workOrder, vendor, twilioSid, twilioAuth, twilioPhone);
        break;
      
      case "decline":
        await handleVendorDecline(supabase, workOrder, vendor, response.reason || "No reason provided", twilioSid, twilioAuth, twilioPhone, from);
        break;
      
      case "quote":
        await handleVendorQuote(supabase, workOrder, vendor, response.amount!, twilioSid, twilioAuth, twilioPhone, from);
        break;
      
      case "complete":
        await handleVendorComplete(supabase, workOrder, vendor, twilioSid, twilioAuth, twilioPhone, from);
        break;
      
      case "eta":
        await handleVendorETA(supabase, workOrder, vendor, response.eta!, twilioSid, twilioAuth, twilioPhone, from);
        break;
      
      default:
        // Log as general message
        await supabase.from("maintenance_messages").insert({
          work_order_id: workOrder.id,
          sender_type: "vendor",
          sender_name: vendor.name,
          message_text: body,
          visible_to_owner: true,
          visible_to_vendor: true,
        });
        
        await sendSms(twilioSid, twilioAuth, twilioPhone, from,
          `Message received for WO #${workOrder.work_order_number}. Reply:\n• CONFIRMED - accept job\n• DECLINE - decline job\n• QUOTE $xxx - send quote\n• DONE - mark complete\n• ETA xx:xx - provide arrival time`);
    }

    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { "Content-Type": "text/xml" } }
    );
  } catch (error) {
    console.error("Maintenance SMS webhook error:", error);
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { "Content-Type": "text/xml" } }
    );
  }
});

interface VendorResponseParsed {
  type: "confirm" | "decline" | "quote" | "complete" | "eta" | "unknown";
  reason?: string;
  amount?: number;
  eta?: string;
}

function parseVendorResponse(body: string): VendorResponseParsed {
  const text = body.toLowerCase().trim();
  
  // Confirm patterns
  if (text === "confirmed" || text === "confirm" || text === "yes" || text === "accept" || text === "ok" || text === "y") {
    return { type: "confirm" };
  }
  
  // Decline patterns
  if (text.startsWith("decline") || text.startsWith("no") || text === "n" || text.startsWith("can't") || text.startsWith("cannot")) {
    const reason = text.replace(/^(decline|no|n|can't|cannot)\s*/i, "").trim();
    return { type: "decline", reason: reason || "No reason provided" };
  }
  
  // Quote patterns - "quote $500" or "$500" or "500"
  const quoteMatch = text.match(/(?:quote\s*)?\$?(\d+(?:\.\d{2})?)/);
  if (quoteMatch && (text.includes("quote") || text.startsWith("$") || /^\d+$/.test(text))) {
    return { type: "quote", amount: parseFloat(quoteMatch[1]) };
  }
  
  // Complete patterns
  if (text === "done" || text === "complete" || text === "completed" || text === "finished") {
    return { type: "complete" };
  }
  
  // ETA patterns - "eta 2pm" or "arriving 2:30"
  const etaMatch = text.match(/(?:eta|arriving|arrival)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
  if (etaMatch) {
    return { type: "eta", eta: etaMatch[1] };
  }
  
  return { type: "unknown" };
}

async function handleVendorConfirm(
  supabase: any,
  workOrder: any,
  vendor: any,
  twilioSid: string,
  twilioAuth: string,
  twilioPhone: string
) {
  console.log(`Vendor ${vendor.name} confirmed WO #${workOrder.work_order_number}`);
  
  // Update work order
  await supabase
    .from("work_orders")
    .update({
      vendor_accepted: true,
      vendor_accepted_at: new Date().toISOString(),
      status: "scheduled",
    })
    .eq("id", workOrder.id);

  // Add timeline entry
  await supabase.from("work_order_timeline").insert({
    work_order_id: workOrder.id,
    action: `Vendor ${vendor.name} confirmed availability`,
    performed_by_type: "vendor",
    performed_by_name: vendor.name,
    new_status: "scheduled",
  });

  // Add message
  await supabase.from("maintenance_messages").insert({
    work_order_id: workOrder.id,
    sender_type: "vendor",
    sender_name: vendor.name,
    message_text: "I'm available and confirmed for this job.",
    visible_to_owner: true,
    visible_to_vendor: true,
  });

  // Send confirmation to vendor
  await sendSms(twilioSid, twilioAuth, twilioPhone, vendor.phone,
    `Great! You're confirmed for WO #${workOrder.work_order_number} at ${workOrder.property?.name || workOrder.property?.address}.\n\nReply with:\n• ETA xx:xx - when you're on the way\n• DONE - when complete\n• QUOTE $xxx - if cost changes`);
}

async function handleVendorDecline(
  supabase: any,
  workOrder: any,
  vendor: any,
  reason: string,
  twilioSid: string,
  twilioAuth: string,
  twilioPhone: string,
  vendorPhone: string
) {
  console.log(`Vendor ${vendor.name} declined WO #${workOrder.work_order_number}: ${reason}`);
  
  // Update work order
  await supabase
    .from("work_orders")
    .update({
      vendor_accepted: false,
      vendor_declined_reason: reason,
      assigned_vendor_id: null,
      status: "new",
    })
    .eq("id", workOrder.id);

  // Add timeline entry
  await supabase.from("work_order_timeline").insert({
    work_order_id: workOrder.id,
    action: `Vendor ${vendor.name} declined: ${reason}`,
    performed_by_type: "vendor",
    performed_by_name: vendor.name,
    new_status: "new",
  });

  // Send confirmation
  await sendSms(twilioSid, twilioAuth, twilioPhone, vendorPhone,
    `We've noted that you're unavailable for WO #${workOrder.work_order_number}. Thank you for letting us know.`);
}

async function handleVendorQuote(
  supabase: any,
  workOrder: any,
  vendor: any,
  amount: number,
  twilioSid: string,
  twilioAuth: string,
  twilioPhone: string,
  vendorPhone: string
) {
  console.log(`Vendor ${vendor.name} quoted $${amount} for WO #${workOrder.work_order_number}`);
  
  // Get property owner for approval threshold
  const { data: property } = await supabase
    .from("properties")
    .select("owner_id, property_maintenance_books(*)")
    .eq("id", workOrder.property_id)
    .single();

  const maintenanceBook = property?.property_maintenance_books?.[0];
  const approvalThreshold = maintenanceBook?.require_owner_approval_above || 300; // Default $300

  // Update work order with quote
  await supabase
    .from("work_orders")
    .update({
      quoted_cost: amount,
      vendor_accepted: true,
      vendor_accepted_at: new Date().toISOString(),
      status: amount > approvalThreshold ? "awaiting_approval" : "scheduled",
      owner_notified: amount > approvalThreshold,
    })
    .eq("id", workOrder.id);

  // Add timeline entry
  await supabase.from("work_order_timeline").insert({
    work_order_id: workOrder.id,
    action: `Vendor ${vendor.name} quoted $${amount}${amount > approvalThreshold ? " (awaiting owner approval)" : ""}`,
    performed_by_type: "vendor",
    performed_by_name: vendor.name,
    details: { quoted_amount: amount },
  });

  // Add message
  await supabase.from("maintenance_messages").insert({
    work_order_id: workOrder.id,
    sender_type: "vendor",
    sender_name: vendor.name,
    message_text: `Quote: $${amount}`,
    visible_to_owner: true,
    visible_to_vendor: true,
  });

  // If quote exceeds threshold, notify owner
  if (amount > approvalThreshold && property?.owner_id) {
    await notifyOwnerForApproval(supabase, workOrder, vendor, amount, property.owner_id, twilioSid, twilioAuth, twilioPhone);
    
    await sendSms(twilioSid, twilioAuth, twilioPhone, vendorPhone,
      `Quote of $${amount} received for WO #${workOrder.work_order_number}. This requires owner approval - we'll notify you once approved.`);
  } else {
    await sendSms(twilioSid, twilioAuth, twilioPhone, vendorPhone,
      `Quote of $${amount} approved for WO #${workOrder.work_order_number}. Please proceed with the repair and reply DONE when complete.`);
  }
}

async function handleVendorComplete(
  supabase: any,
  workOrder: any,
  vendor: any,
  twilioSid: string,
  twilioAuth: string,
  twilioPhone: string,
  vendorPhone: string
) {
  console.log(`Vendor ${vendor.name} completed WO #${workOrder.work_order_number}`);
  
  // Update work order
  await supabase
    .from("work_orders")
    .update({
      status: "pending_verification",
      vendor_notes: "Vendor marked as complete via SMS",
    })
    .eq("id", workOrder.id);

  // Add timeline entry
  await supabase.from("work_order_timeline").insert({
    work_order_id: workOrder.id,
    action: `Vendor ${vendor.name} marked work as complete`,
    performed_by_type: "vendor",
    performed_by_name: vendor.name,
    new_status: "pending_verification",
  });

  // Add message
  await supabase.from("maintenance_messages").insert({
    work_order_id: workOrder.id,
    sender_type: "vendor",
    sender_name: vendor.name,
    message_text: "Work completed.",
    visible_to_owner: true,
    visible_to_vendor: true,
  });

  await sendSms(twilioSid, twilioAuth, twilioPhone, vendorPhone,
    `Thank you! WO #${workOrder.work_order_number} marked complete. Please submit your invoice via Bill.com. We'll verify and process payment.`);
}

async function handleVendorETA(
  supabase: any,
  workOrder: any,
  vendor: any,
  eta: string,
  twilioSid: string,
  twilioAuth: string,
  twilioPhone: string,
  vendorPhone: string
) {
  console.log(`Vendor ${vendor.name} ETA ${eta} for WO #${workOrder.work_order_number}`);
  
  // Update status to in_progress
  await supabase
    .from("work_orders")
    .update({
      status: "in_progress",
      scheduled_time_window: `ETA: ${eta}`,
    })
    .eq("id", workOrder.id);

  // Add timeline entry
  await supabase.from("work_order_timeline").insert({
    work_order_id: workOrder.id,
    action: `Vendor ${vendor.name} is en route, ETA: ${eta}`,
    performed_by_type: "vendor",
    performed_by_name: vendor.name,
    new_status: "in_progress",
  });

  // Add message
  await supabase.from("maintenance_messages").insert({
    work_order_id: workOrder.id,
    sender_type: "vendor",
    sender_name: vendor.name,
    message_text: `On my way, ETA: ${eta}`,
    visible_to_owner: true,
    visible_to_vendor: true,
  });

  await sendSms(twilioSid, twilioAuth, twilioPhone, vendorPhone,
    `Thanks! We've noted your ETA of ${eta} for WO #${workOrder.work_order_number}. Reply DONE when work is complete.`);
}

async function notifyOwnerForApproval(
  supabase: any,
  workOrder: any,
  vendor: any,
  amount: number,
  ownerId: string,
  twilioSid: string,
  twilioAuth: string,
  twilioPhone: string
) {
  // Get owner details
  const { data: owner } = await supabase
    .from("property_owners")
    .select("*")
    .eq("id", ownerId)
    .single();

  if (!owner) {
    console.log("Owner not found for approval notification");
    return;
  }

  const message = `🔧 Approval Needed\n\nProperty: ${workOrder.property?.name || workOrder.property?.address}\nIssue: ${workOrder.title}\nVendor: ${vendor.name}\nQuote: $${amount}\n\nReply:\n• APPROVE - authorize work\n• DECLINE - reject quote`;

  // Send SMS if owner has phone
  if (owner.phone) {
    await sendSms(twilioSid, twilioAuth, twilioPhone, owner.phone, message);
    
    await supabase.from("sms_log").insert({
      phone_number: owner.phone,
      message_type: "owner_approval_request",
      message_body: message,
      status: "sent",
    });

    console.log(`Owner approval SMS sent to ${owner.phone}`);
  }

  // Also log for email notification (can be extended)
  await supabase.from("work_order_timeline").insert({
    work_order_id: workOrder.id,
    action: `Owner notified for approval - Quote: $${amount}`,
    performed_by_type: "system",
    performed_by_name: "System",
  });
}

async function handleOwnerResponse(
  supabase: any,
  phoneDigits: string,
  body: string,
  twilioSid: string,
  twilioAuth: string,
  twilioPhone: string
): Promise<{ handled: boolean }> {
  // Find owner by phone
  const { data: owner, error } = await supabase
    .from("property_owners")
    .select("*")
    .or(`phone.ilike.%${phoneDigits}`)
    .limit(1)
    .single();

  if (error || !owner) {
    return { handled: false };
  }

  console.log(`Found owner: ${owner.name} (${owner.id})`);

  // Find work order awaiting this owner's approval
  const { data: workOrder } = await supabase
    .from("work_orders")
    .select("*, property:properties(name, address), assigned_vendor:vendors(*)")
    .eq("status", "awaiting_approval")
    .eq("property.owner_id", owner.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  if (!workOrder) {
    console.log(`No work orders awaiting approval for owner ${owner.name}`);
    return { handled: false };
  }

  const text = body.toLowerCase().trim();

  if (text === "approve" || text === "approved" || text === "yes" || text === "y" || text === "ok") {
    // Owner approved
    await supabase
      .from("work_orders")
      .update({
        owner_approved: true,
        owner_approved_at: new Date().toISOString(),
        status: "scheduled",
      })
      .eq("id", workOrder.id);

    await supabase.from("work_order_timeline").insert({
      work_order_id: workOrder.id,
      action: `Owner ${owner.name} approved quote of $${workOrder.quoted_cost}`,
      performed_by_type: "owner",
      performed_by_name: owner.name,
      new_status: "scheduled",
    });

    await supabase.from("maintenance_messages").insert({
      work_order_id: workOrder.id,
      sender_type: "owner",
      sender_name: owner.name,
      message_text: `Approved quote of $${workOrder.quoted_cost}`,
      visible_to_owner: true,
      visible_to_vendor: true,
    });

    // Notify owner
    await sendSms(twilioSid, twilioAuth, twilioPhone, owner.phone,
      `✓ Approved! The repair at ${workOrder.property?.name || workOrder.property?.address} ($${workOrder.quoted_cost}) has been authorized. We'll notify the vendor to proceed.`);

    // Notify vendor
    if (workOrder.assigned_vendor?.phone) {
      await sendSms(twilioSid, twilioAuth, twilioPhone, workOrder.assigned_vendor.phone,
        `✓ Quote Approved!\n\nYour quote of $${workOrder.quoted_cost} for WO #${workOrder.work_order_number} at ${workOrder.property?.name || workOrder.property?.address} has been approved.\n\nPlease proceed with the repair and reply DONE when complete.`);
    }

    return { handled: true };
  }

  if (text === "decline" || text === "declined" || text === "no" || text === "n" || text === "reject") {
    // Owner declined
    await supabase
      .from("work_orders")
      .update({
        owner_approved: false,
        status: "on_hold",
      })
      .eq("id", workOrder.id);

    await supabase.from("work_order_timeline").insert({
      work_order_id: workOrder.id,
      action: `Owner ${owner.name} declined quote of $${workOrder.quoted_cost}`,
      performed_by_type: "owner",
      performed_by_name: owner.name,
      new_status: "on_hold",
    });

    await supabase.from("maintenance_messages").insert({
      work_order_id: workOrder.id,
      sender_type: "owner",
      sender_name: owner.name,
      message_text: `Declined quote of $${workOrder.quoted_cost}`,
      visible_to_owner: true,
      visible_to_vendor: true,
    });

    // Notify owner
    await sendSms(twilioSid, twilioAuth, twilioPhone, owner.phone,
      `The repair at ${workOrder.property?.name || workOrder.property?.address} has been placed on hold. We'll contact you to discuss alternatives.`);

    // Notify vendor
    if (workOrder.assigned_vendor?.phone) {
      await sendSms(twilioSid, twilioAuth, twilioPhone, workOrder.assigned_vendor.phone,
        `Quote Update: Your quote of $${workOrder.quoted_cost} for WO #${workOrder.work_order_number} was not approved. We'll be in touch with next steps.`);
    }

    return { handled: true };
  }

  return { handled: false };
}

async function sendSms(
  twilioSid: string,
  twilioAuth: string,
  twilioPhone: string,
  to: string,
  body: string
): Promise<{ success: boolean; sid?: string; error?: string }> {
  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
      {
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
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Twilio send error:", errorText);
      return { success: false, error: errorText };
    }

    const data = await response.json();
    console.log(`SMS sent, SID: ${data.sid}`);
    return { success: true, sid: data.sid };
  } catch (error) {
    console.error("Twilio exception:", error);
    return { success: false, error: String(error) };
  }
}
