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

    const { leadId, phone, message, fromNumber } = await req.json();

    if (!phone || !message) {
      throw new Error("phone and message are required");
    }

    const formattedPhone = formatPhoneE164(phone);
    // Use the 404-800-5932 number as the default from number
    const formattedFromNumber = formatPhoneE164(fromNumber || "+14048005932");
    
    console.log(`Sending SMS via GHL to ${formattedPhone} from ${formattedFromNumber}`);

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

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      if (searchData.contact?.id) {
        contactId = searchData.contact.id;
        console.log(`Found existing GHL contact: ${contactId}`);
      }
    }

    // If no contact found, create one
    if (!contactId) {
      // Get lead data if leadId provided
      let leadData = null;
      if (leadId) {
        const { data } = await supabase
          .from("leads")
          .select("name, email, phone")
          .eq("id", leadId)
          .single();
        leadData = data;
      }

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
            phone: formattedPhone,
            name: leadData?.name || "Lead",
            email: leadData?.email || undefined,
            source: "PropertyCentral",
          }),
        }
      );

      if (!createContactResponse.ok) {
        const errorText = await createContactResponse.text();
        console.error("Error creating GHL contact:", errorText);
        throw new Error(`Failed to create GHL contact: ${createContactResponse.status}`);
      }

      const createData = await createContactResponse.json();
      contactId = createData.contact?.id;
      console.log(`Created new GHL contact: ${contactId}`);
    }

    if (!contactId) {
      throw new Error("Failed to find or create GHL contact");
    }

    // Step 2: Send SMS message
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
          contactId: contactId,
          message: message,
          fromNumber: formattedFromNumber,
        }),
      }
    );

    if (!sendResponse.ok) {
      const errorText = await sendResponse.text();
      console.error("Error sending SMS via GHL:", errorText);
      throw new Error(`Failed to send SMS: ${sendResponse.status} - ${errorText}`);
    }

    const sendData = await sendResponse.json();
    console.log(`SMS sent successfully via GHL. Message ID: ${sendData.messageId}`);

    // Record communication if leadId provided
    if (leadId) {
      await supabase.from("lead_communications").insert({
        lead_id: leadId,
        communication_type: "sms",
        direction: "outbound",
        body: message,
        status: "sent",
        external_id: sendData.messageId || sendData.conversationId,
        metadata: {
          provider: "gohighlevel",
          ghl_contact_id: contactId,
          from_number: formattedFromNumber,
          to_number: formattedPhone,
        },
      });

      await supabase.from("lead_timeline").insert({
        lead_id: leadId,
        action: "SMS sent via HighLevel",
        metadata: {
          message_id: sendData.messageId,
          ghl_contact_id: contactId,
          from_number: formattedFromNumber,
        },
      });
    }

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
