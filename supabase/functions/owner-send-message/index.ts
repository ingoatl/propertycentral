import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

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
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { 
      owner_id, 
      property_id, 
      message_type, // 'voicemail' | 'sms' | 'email'
      body, 
      subject,
      sender_email,
      sender_name,
      attachment_url,
      duration // for voicemails
    } = await req.json();

    if (!owner_id || !message_type || !body) {
      return new Response(
        JSON.stringify({ error: "owner_id, message_type, and body are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Owner message received: ${message_type} from ${sender_name || owner_id}`);

    // Verify owner exists
    const { data: owner, error: ownerError } = await supabase
      .from("property_owners")
      .select("id, name, email")
      .eq("id", owner_id)
      .single();

    if (ownerError || !owner) {
      console.error("Owner not found:", ownerError);
      return new Response(
        JSON.stringify({ error: "Owner not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get property name if provided
    let propertyName = "";
    if (property_id) {
      const { data: property } = await supabase
        .from("properties")
        .select("name")
        .eq("id", property_id)
        .single();
      propertyName = property?.name || "";
    }

    // Build the subject line
    let finalSubject = subject;
    if (!finalSubject) {
      switch (message_type) {
        case "voicemail":
          finalSubject = `🎙️ Voice message from ${sender_name || owner.name}${propertyName ? ` - ${propertyName}` : ''}`;
          break;
        case "sms":
          finalSubject = `💬 Text from ${sender_name || owner.name}${propertyName ? ` - ${propertyName}` : ''}`;
          break;
        case "email":
          finalSubject = `📧 Email from ${sender_name || owner.name}${propertyName ? ` - ${propertyName}` : ''}`;
          break;
        default:
          finalSubject = `Message from ${sender_name || owner.name}`;
      }
    }

    // Insert into lead_communications
    // Note: lead_communications uses call_recording_url for voicemails, media_urls for other attachments
    // Note: lead_communications does NOT have a property_id column - property context is stored in metadata
    const { data: comm, error: insertError } = await supabase
      .from("lead_communications")
      .insert({
        owner_id,
        communication_type: message_type,
        direction: "inbound",
        body,
        subject: finalSubject,
        status: "unread",
        call_recording_url: message_type === "voicemail" && attachment_url ? attachment_url : null,
        media_urls: attachment_url && message_type !== "voicemail" ? [attachment_url] : null,
        metadata: property_id ? { property_id, property_name: propertyName } : null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting communication:", insertError);
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Communication created: ${comm.id}`);

    // Update conversation status to ensure it appears in inbox
    await supabase
      .from("conversation_status")
      .upsert({
        contact_id: owner_id,
        contact_type: "owner",
        contact_email: owner.email,
        status: "open",
        priority: "high",
        last_message_at: new Date().toISOString(),
        last_inbound_at: new Date().toISOString(),
        unread_count: 1,
      }, { onConflict: "contact_id,contact_type" });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Message sent successfully",
        communication_id: comm.id
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in owner-send-message:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
