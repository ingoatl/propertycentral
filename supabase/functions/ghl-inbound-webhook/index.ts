import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

// Format phone number to E.164 for matching - strips ALL non-digit characters including Unicode
function normalizePhone(phone: string): string {
  // Remove ALL non-digit characters including Unicode formatting characters
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return phone.startsWith("+") ? phone : `+${digits}`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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
    
    // Extract media URLs from MMS attachments
    const mediaUrls: string[] = [];
    if (message.attachments && Array.isArray(message.attachments)) {
      for (const attachment of message.attachments) {
        if (attachment.url) {
          mediaUrls.push(attachment.url);
        }
      }
    }
    // Also check for media array (alternative GHL format)
    if (message.media && Array.isArray(message.media)) {
      for (const media of message.media) {
        if (media.url) {
          mediaUrls.push(media.url);
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

    // Normalize phone for matching - extract last 10 digits
    const normalizedPhone = normalizePhone(contactPhone);
    const digits = normalizedPhone.replace(/\D/g, "");
    const last10Digits = digits.slice(-10);
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
          metadata: { 
            unmatched_phone: normalizedPhone, 
            contact_name: contactName,
            ghl_data: { contactPhone: contactPhone, contactName }
          }
        })
        .select()
        .single();

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
