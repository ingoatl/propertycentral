import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ghlApiKey = Deno.env.get("GHL_API_KEY");
    const ghlLocationId = Deno.env.get("GHL_LOCATION_ID");
    
    if (!ghlApiKey || !ghlLocationId) {
      throw new Error("GHL_API_KEY and GHL_LOCATION_ID are required");
    }

    const { leadId, ownerId, vendorId, workOrderId, requestedByUserId, phone, to, message, fromNumber, mediaUrls } = await req.json();

    // Accept either 'phone' or 'to' parameter for the recipient
    const recipientPhone = phone || to;
    
    if (!recipientPhone || !message) {
      throw new Error("phone/to and message are required");
    }

    const formattedPhone = formatPhoneE164(recipientPhone);
    
    // Use the GHL vendor number +1 404-574-1740 for vendor communications
    // Otherwise use 404-991-5076 as default (A2P registered for maintenance)
    const isVendorMessage = !!vendorId;
    const defaultNumber = isVendorMessage ? "+14045741740" : "+14049915076";
    const formattedFromNumber = formatPhoneE164(fromNumber || defaultNumber);
    
    console.log(`Sending SMS via GHL to ${formattedPhone} from ${formattedFromNumber} (vendor=${isVendorMessage})`);

    // Initialize Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Step 1: Find or create contact in GHL
    // First, search for existing contact by phone
    const searchResponse = await fetch(
      `https://services.leadconnectorhq.com/contacts/search/duplicate?locationId=${ghlLocationId}&phone=${encodeURIComponent(formattedPhone)}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${ghlApiKey}`,
          "Version": "2021-07-28",
          "Content-Type": "application/json",
        },
      }
    );

    let contactId = null;
    let contactName = "Contact";

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      if (searchData.contact?.id) {
        contactId = searchData.contact.id;
        contactName = searchData.contact.name || contactName;
        console.log(`Found existing GHL contact: ${contactId}`);
      }
    }

    // If no contact found, DO NOT create one - use Twilio as fallback to avoid GHL duplicates
    // The user explicitly requested to disable contact sync back to GHL
    if (!contactId) {
      console.log(`No GHL contact found for ${formattedPhone} - using Twilio fallback to avoid creating duplicates`);
      
      // Get contact data from our database for logging
      let contactData: { name?: string; email?: string; phone?: string } | null = null;
      let contactName = "Contact";
      
      if (leadId) {
        const { data } = await supabase
          .from("leads")
          .select("name, email, phone")
          .eq("id", leadId)
          .single();
        contactData = data;
        contactName = contactData?.name || "Lead";
      } else if (ownerId) {
        const { data } = await supabase
          .from("property_owners")
          .select("name, email, phone")
          .eq("id", ownerId)
          .single();
        contactData = data;
        contactName = contactData?.name || "Owner";
      } else if (vendorId) {
        const { data } = await supabase
          .from("vendors")
          .select("name, email, phone")
          .eq("id", vendorId)
          .single();
        contactData = data;
        contactName = contactData?.name || "Vendor";
      }

      // FALLBACK: Send SMS directly via Twilio if no GHL contact exists
      console.log(`Sending SMS via Twilio fallback to ${formattedPhone} (${contactName})`);
      
      const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
      const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
      
      if (!twilioAccountSid || !twilioAuthToken) {
        throw new Error(`No GHL contact found for ${formattedPhone} and Twilio credentials not configured.`);
      }
      
      // Send via Twilio
      const twilioResponse = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            "Authorization": `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: formattedPhone,
            From: formattedFromNumber,
            Body: message,
          }).toString(),
        }
      );
      
      if (!twilioResponse.ok) {
        const errorText = await twilioResponse.text();
        console.error("Twilio error:", errorText);
        throw new Error(`Failed to send SMS via Twilio: ${twilioResponse.status}`);
      }
      
      const twilioData = await twilioResponse.json();
      console.log(`SMS sent via Twilio fallback. SID: ${twilioData.sid}`);
      
      // Get user ID from auth header
      const authHeader = req.headers.get('Authorization');
      let userId: string | null = null;
      if (authHeader) {
        const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
        userId = user?.id || null;
      }
      
      // Record the communication in our database
      const commRecord: Record<string, unknown> = {
        communication_type: "sms",
        direction: "outbound",
        body: message,
        status: "sent",
        external_id: twilioData.sid,
        assigned_user_id: userId,
        metadata: {
          provider: "twilio_fallback",
          from_number: formattedFromNumber,
          to_number: formattedPhone,
          twilio_sid: twilioData.sid,
          sent_by_user_id: userId,
          contact_name: contactName,
        },
      };
      
      if (leadId) commRecord.lead_id = leadId;
      if (ownerId) commRecord.owner_id = ownerId;
      if (vendorId) {
        commRecord.metadata = {
          ...commRecord.metadata as Record<string, unknown>,
          vendor_id: vendorId,
          vendor_phone: formattedPhone,
          contact_type: "vendor",
        };
      }
      
      await supabase.from("lead_communications").insert(commRecord);
      console.log(`Recorded Twilio fallback SMS in database`);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          messageId: twilioData.sid,
          provider: "twilio_fallback",
          note: "Sent via Twilio (no GHL contact found)",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Send SMS message (or MMS if media attached)
    const hasMedia = mediaUrls && Array.isArray(mediaUrls) && mediaUrls.length > 0;
    console.log(`Sending ${hasMedia ? 'MMS' : 'SMS'} to contact ${contactId} with message: "${message.substring(0, 50)}..."${hasMedia ? ` with ${mediaUrls.length} attachment(s)` : ''}`);
    
    // Build request payload - GHL uses "attachments" for MMS
    const messagePayload: any = {
      type: "SMS",
      contactId: contactId,
      message: message,
      fromNumber: formattedFromNumber,
    };
    
    // Add attachments for MMS - GHL expects array of URLs
    if (hasMedia) {
      messagePayload.attachments = mediaUrls;
      console.log(`MMS attachments:`, mediaUrls);
    }
    
    const sendResponse = await fetch(
      `https://services.leadconnectorhq.com/conversations/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${ghlApiKey}`,
          "Version": "2021-04-15",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messagePayload),
      }
    );

    const sendResponseText = await sendResponse.text();
    console.log(`GHL send response status: ${sendResponse.status}, body: ${sendResponseText}`);
    
    if (!sendResponse.ok) {
      console.error("Error sending SMS via GHL:", sendResponseText);
      throw new Error(`Failed to send SMS: ${sendResponse.status} - ${sendResponseText}`);
    }

    let sendData;
    try {
      sendData = JSON.parse(sendResponseText);
    } catch (e) {
      console.error("Failed to parse GHL send response:", e);
      throw new Error(`Failed to parse GHL response: ${sendResponseText}`);
    }
    
    console.log(`SMS sent successfully via GHL. Message ID: ${sendData.messageId}, Conversation ID: ${sendData.conversationId}`);

    // Get user ID from auth header FIRST so we can use it when recording communications
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      userId = user?.id || null;
    }
    console.log(`SMS sent by user: ${userId || 'unknown'}`);

    // Record communication for leads - include assigned_user_id to track who sent it
    if (leadId) {
      await supabase.from("lead_communications").insert({
        lead_id: leadId,
        communication_type: "sms",
        direction: "outbound",
        body: message,
        status: "sent",
        external_id: sendData.messageId || sendData.conversationId,
        ghl_conversation_id: sendData.conversationId,
        assigned_user_id: userId, // Track who sent this message
        metadata: {
          provider: "gohighlevel",
          ghl_contact_id: contactId,
          ghl_conversation_id: sendData.conversationId,
          from_number: formattedFromNumber,
          to_number: formattedPhone,
          sent_by_user_id: userId, // Also store in metadata for reference
        },
      });

      await supabase.from("lead_timeline").insert({
        lead_id: leadId,
        action: "SMS sent via HighLevel",
        metadata: {
          message_id: sendData.messageId,
          ghl_contact_id: contactId,
          ghl_conversation_id: sendData.conversationId,
          from_number: formattedFromNumber,
          sent_by_user_id: userId,
        },
      });

      // Mark all unread inbound communications for this lead as read (auto-complete review task)
      await supabase
        .from("lead_communications")
        .update({ is_read: true })
        .eq("lead_id", leadId)
        .eq("direction", "inbound")
        .eq("is_read", false);
      
      console.log(`Marked inbound communications as read for lead ${leadId}`);
    }

    // Record communication for owners
    if (ownerId) {
      await supabase.from("lead_communications").insert({
        owner_id: ownerId,
        communication_type: "sms",
        direction: "outbound",
        body: message,
        status: "sent",
        external_id: sendData.messageId || sendData.conversationId,
        ghl_conversation_id: sendData.conversationId,
        metadata: {
          provider: "gohighlevel",
          ghl_contact_id: contactId,
          ghl_conversation_id: sendData.conversationId,
          from_number: formattedFromNumber,
          to_number: formattedPhone,
        },
      });

      // Mark all unread inbound communications for this owner as read
      await supabase
        .from("lead_communications")
        .update({ is_read: true })
        .eq("owner_id", ownerId)
        .eq("direction", "inbound")
        .eq("is_read", false);
      
      console.log(`Marked inbound communications as read for owner ${ownerId}`);
    }

    // Record communication for vendors - store in lead_communications with vendor metadata
    // This allows messages to show in both the vendor tab AND the user's inbox
    if (vendorId) {
      // Use requestedByUserId if provided, otherwise use the current user
      const assignedUserId = requestedByUserId || userId;
      
      await supabase.from("lead_communications").insert({
        communication_type: "sms",
        direction: "outbound",
        body: message,
        status: "sent",
        external_id: sendData.messageId || sendData.conversationId,
        ghl_conversation_id: sendData.conversationId,
        assigned_user_id: assignedUserId, // Track who should see replies (requester)
        metadata: {
          provider: "gohighlevel",
          ghl_contact_id: contactId,
          ghl_conversation_id: sendData.conversationId,
          from_number: formattedFromNumber,
          to_number: formattedPhone,
          vendor_id: vendorId,
          vendor_phone: formattedPhone,
          contact_type: "vendor",
          sent_by_user_id: userId,
          requested_by_user_id: requestedByUserId, // Original requester
          work_order_id: workOrderId, // Link to work order if provided
        },
      });

      // Mark all unread inbound communications for this vendor as read
      const { data: vendorComms } = await supabase
        .from("lead_communications")
        .select("id, metadata")
        .eq("direction", "inbound")
        .eq("is_read", false)
        .is("lead_id", null)
        .is("owner_id", null);

      if (vendorComms) {
        const matchingIds: string[] = [];
        for (const comm of vendorComms) {
          const meta = comm.metadata as any;
          const commVendorId = meta?.vendor_id;
          const commVendorPhone = meta?.vendor_phone || meta?.ghl_data?.contactPhone;
          if (commVendorId === vendorId || (commVendorPhone && formatPhoneE164(commVendorPhone) === formattedPhone)) {
            matchingIds.push(comm.id);
          }
        }
        if (matchingIds.length > 0) {
          await supabase
            .from("lead_communications")
            .update({ is_read: true })
            .in("id", matchingIds);
          console.log(`Marked ${matchingIds.length} vendor communications as read for vendor ${vendorId}`);
        }
      }
      
      console.log(`Recorded vendor SMS for vendor ${vendorId}`);
    }
    // so they appear in the conversation thread
    if (!leadId && !ownerId) {
      // Insert outbound message into lead_communications with phone in metadata
      await supabase.from("lead_communications").insert({
        communication_type: "sms",
        direction: "outbound",
        body: message,
        status: "sent",
        external_id: sendData.messageId || sendData.conversationId,
        ghl_contact_id: contactId,
        ghl_conversation_id: sendData.conversationId,
        metadata: {
          provider: "gohighlevel",
          ghl_contact_id: contactId,
          ghl_conversation_id: sendData.conversationId,
          from_number: formattedFromNumber,
          to_number: formattedPhone,
          unmatched_phone: formattedPhone,
          contact_name: contactName,
          sent_by_user_id: userId,
          ghl_data: {
            contactPhone: formattedPhone,
            contactName: contactName,
          },
        },
      });
      console.log(`Logged outbound SMS to lead_communications for unmatched contact: ${formattedPhone}`);

      // Try to mark by ghl_contact_id first (most accurate)
      const { count: ghlCount } = await supabase
        .from("lead_communications")
        .update({ is_read: true })
        .eq("ghl_contact_id", contactId)
        .eq("direction", "inbound")
        .eq("is_read", false);

      // Also try by phone number in metadata for messages without ghl_contact_id
      // This catches messages where the phone was stored in metadata
      const { data: unmatchedComms } = await supabase
        .from("lead_communications")
        .select("id, metadata")
        .eq("direction", "inbound")
        .eq("is_read", false)
        .is("lead_id", null)
        .is("owner_id", null);

      if (unmatchedComms) {
        const matchingIds: string[] = [];
        for (const comm of unmatchedComms) {
          const meta = comm.metadata as any;
          const commPhone = meta?.ghl_data?.contactPhone || meta?.unmatched_phone;
          if (commPhone && formatPhoneE164(commPhone) === formattedPhone) {
            matchingIds.push(comm.id);
          }
        }
        if (matchingIds.length > 0) {
          await supabase
            .from("lead_communications")
            .update({ is_read: true })
            .in("id", matchingIds);
          console.log(`Marked ${matchingIds.length} unmatched inbound communications as read for phone ${formattedPhone}`);
        }
      }
      
      console.log(`Marked communications as read for GHL contact ${contactId}`);
    }

    // Also store in user_phone_messages for unified tracking
    // userId was already extracted at line 190-195

    await supabase.from("user_phone_messages").insert({
      user_id: userId,
      direction: "outbound",
      from_number: formattedFromNumber,
      to_number: formattedPhone,
      body: message,
      status: "sent",
      external_id: sendData.messageId || sendData.conversationId,
    });

    return new Response(
      JSON.stringify({
        success: true,
        messageId: sendData.messageId,
        conversationId: sendData.conversationId,
        contactId: contactId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error sending GHL SMS:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
