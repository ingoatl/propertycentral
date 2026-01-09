import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendRecapRequest {
  recapId: string;
  subject?: string;
  emailBody?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recapId, subject, emailBody }: SendRecapRequest = await req.json();

    if (!recapId) {
      throw new Error("recapId is required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";

    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    // Fetch the recap
    const { data: recap, error: fetchError } = await supabase
      .from("pending_call_recaps")
      .select("*")
      .eq("id", recapId)
      .single();

    if (fetchError || !recap) {
      throw new Error(`Recap not found: ${fetchError?.message}`);
    }

    if (!recap.recipient_email) {
      throw new Error("No recipient email available for this recap");
    }

    // Use provided values or fall back to stored values
    const finalSubject = subject || recap.subject;
    const finalBody = emailBody || recap.email_body;

    // Format the email with a nice template
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
      color: white;
      padding: 30px;
      border-radius: 12px 12px 0 0;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .header p {
      margin: 10px 0 0;
      opacity: 0.9;
      font-size: 14px;
    }
    .content {
      background: #ffffff;
      padding: 30px;
      border: 1px solid #e5e5e5;
      border-top: none;
      border-radius: 0 0 12px 12px;
    }
    .action-item {
      background: #f8f9fa;
      border-left: 4px solid #FF6B6B;
      padding: 12px 16px;
      margin: 10px 0;
      border-radius: 0 8px 8px 0;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e5e5;
      color: #666;
      font-size: 14px;
    }
    .logo {
      font-size: 28px;
      margin-bottom: 10px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">🍑</div>
    <h1>Call Summary</h1>
    <p>${new Date(recap.call_date).toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })}</p>
  </div>
  
  <div class="content">
    ${finalBody}
  </div>
  
  <div class="footer">
    <p>PeachHaus Property Management</p>
    <p style="font-size: 12px; color: #999;">
      This is a summary of your recent call. If you have any questions, please reply to this email.
    </p>
  </div>
</body>
</html>
`;

    // Send the email
    const emailResponse = await resend.emails.send({
      from: "PeachHaus <hello@peachhausgroup.com>",
      to: [recap.recipient_email],
      subject: finalSubject,
      html: htmlContent,
    });

    console.log("Email sent successfully:", emailResponse);

    // Get current user from auth header
    const authHeader = req.headers.get("authorization");
    let sentBy = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      sentBy = user?.id;
    }

    // Update recap status
    const { error: updateError } = await supabase
      .from("pending_call_recaps")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        sent_by: sentBy,
        subject: finalSubject,
        email_body: finalBody,
      })
      .eq("id", recapId);

    if (updateError) {
      console.error("Error updating recap status:", updateError);
    }

    // Log the sent email in lead_communications
    await supabase.from("lead_communications").insert({
      owner_id: recap.owner_id,
      lead_id: recap.lead_id,
      property_id: recap.property_id,
      communication_type: "email",
      direction: "outbound",
      subject: finalSubject,
      body: finalBody,
      status: "sent",
      metadata: {
        type: "call_recap",
        original_call_id: recap.communication_id,
        recap_id: recapId,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        emailId: emailResponse.id,
        sentTo: recap.recipient_email,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error sending call recap email:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
