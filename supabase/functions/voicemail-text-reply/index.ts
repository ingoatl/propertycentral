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
    const { token, voicemailId, message } = await req.json();

    if (!token || !voicemailId || !message) {
      throw new Error("Missing required fields: token, voicemailId, message");
    }

    console.log("Processing text reply for token:", token);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the voicemail exists and matches the token
    const { data: voicemail, error: fetchError } = await supabase
      .from("voicemail_messages")
      .select("*, leads(id, name, email, phone)")
      .eq("id", voicemailId)
      .eq("token", token)
      .single();

    if (fetchError || !voicemail) {
      console.error("Voicemail not found or token mismatch:", fetchError);
      throw new Error("Voicemail not found or invalid token");
    }

    // Check if already replied (voice or text)
    if (voicemail.reply_audio_url || voicemail.reply_text) {
      throw new Error("A reply has already been sent for this voicemail");
    }

    console.log("Storing text reply for voicemail:", voicemailId);

    // Update voicemail record with text reply
    const { error: updateError } = await supabase
      .from("voicemail_messages")
      .update({
        reply_text: message,
        reply_text_sent_at: new Date().toISOString(),
        reply_method: "text",
        status: "replied",
        updated_at: new Date().toISOString(),
      })
      .eq("id", voicemailId);

    if (updateError) {
      console.error("Update error:", updateError);
      throw new Error(`Failed to update voicemail record: ${updateError.message}`);
    }

    console.log("Voicemail record updated with text reply");

    // Create a lead communication entry to show in sender's inbox
    const { error: commError } = await supabase
      .from("lead_communications")
      .insert({
        lead_id: voicemail.lead_id,
        owner_id: voicemail.owner_id,
        communication_type: "sms",
        direction: "inbound",
        subject: `Text reply from ${voicemail.recipient_name || "Property Owner"}`,
        body: message,
        status: "received",
        is_read: false,
        recipient_user_id: voicemail.sender_user_id,
        metadata: {
          voicemail_id: voicemailId,
          is_voicemail_text_reply: true,
          original_sender_name: voicemail.sender_name,
          reply_method: "text",
        },
      });

    if (commError) {
      console.error("Failed to create communication record:", commError);
    } else {
      console.log("Communication record created for sender's inbox");
    }

    // Send Slack notification if configured
    const slackToken = Deno.env.get("SLACK_BOT_TOKEN");
    if (slackToken) {
      try {
        const recipientName = voicemail.recipient_name || "An owner";
        const propertyAddress = voicemail.property_address || "Unknown property";
        
        const slackMessage = {
          channel: "#owner-communications",
          text: `💬 *Text Reply Received*\n\n*From:* ${recipientName}\n*Property:* ${propertyAddress}\n\n*Message:* ${message}`,
        };

        await fetch("https://slack.com/api/chat.postMessage", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${slackToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(slackMessage),
        });
        console.log("Slack notification sent");
      } catch (slackErr) {
        console.error("Failed to send Slack notification:", slackErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Text reply sent successfully",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Text reply error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
