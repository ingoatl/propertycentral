import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Hosted image URLs
const hostsPhotoUrl = "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/Gemini_Generated_Image_1rel501rel501rel.png";
const signatureUrl = "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/Screenshot_41.jpg";

function buildStyledEmailHtml({
  subject,
  message,
  recipientFirstName,
}: {
  subject: string;
  message: string;
  recipientFirstName: string;
}) {
  const currentYear = new Date().getFullYear();
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f3ef; -webkit-font-smoothing: antialiased;">
  
  <!-- Outer Container -->
  <table cellpadding="0" cellspacing="0" width="100%" style="background-color: #f5f3ef;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        
        <!-- Main Email Card -->
        <table cellpadding="0" cellspacing="0" width="620" style="max-width: 620px; background-color: #ffffff; border-radius: 0; box-shadow: 0 4px 24px rgba(0,0,0,0.04);">
          
          <!-- Elegant Top Border -->
          <tr>
            <td style="height: 4px; background: linear-gradient(90deg, #b8956a 0%, #d4b896 50%, #b8956a 100%);"></td>
          </tr>
          
          <!-- Logo Header -->
          <tr>
            <td style="padding: 32px 40px 24px 40px; text-align: center; background-color: #ffffff;">
              <img src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png" 
                   alt="PeachHaus" 
                   style="height: 44px; width: auto;"
                   onerror="this.style.display='none'">
            </td>
          </tr>
          
          <!-- Message Content -->
          <tr>
            <td style="padding: 24px 48px 36px 48px;">
              
              <!-- Greeting -->
              <p style="margin: 0 0 24px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 24px; font-weight: 400; color: #1a1a1a; letter-spacing: 0.5px; line-height: 1.2;">
                Dear ${recipientFirstName},
              </p>
              
              <!-- Message Body -->
              ${message.split('\n\n').map(para => `
              <p style="margin: 0 0 18px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 15px; line-height: 1.8; color: #4a4a4a; font-weight: 400; letter-spacing: 0.2px;">
                ${para.replace(/\n/g, '<br>')}
              </p>
              `).join('')}
              
            </td>
          </tr>
          
          <!-- Elegant Divider -->
          <tr>
            <td style="padding: 0 48px;">
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="height: 1px; background: linear-gradient(90deg, transparent 0%, #d4b896 20%, #d4b896 80%, transparent 100%);"></td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Signature Section -->
          <tr>
            <td style="padding: 32px 48px 40px 48px;">
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <!-- Hosts Photo -->
                  <td style="width: 100px; vertical-align: top; padding-right: 20px;">
                    <img src="${hostsPhotoUrl}" 
                         alt="Anja & Ingo" 
                         style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 3px solid #f5f3ef; box-shadow: 0 4px 12px rgba(0,0,0,0.06);">
                  </td>
                  
                  <!-- Signature Info -->
                  <td style="vertical-align: top;">
                    <p style="margin: 0 0 8px 0; font-family: Georgia, serif; font-size: 14px; color: #4a4a4a; line-height: 1.5;">
                      With warm regards,
                    </p>
                    <img src="${signatureUrl}" 
                         alt="Anja's Signature" 
                         style="height: 40px; width: auto; margin: 4px 0 8px 0;">
                    <p style="margin: 0; font-family: Georgia, serif; font-size: 13px; color: #6b6b6b; line-height: 1.5;">
                      Anja Schär &amp; Ingo Schär<br>
                      <span style="color: #b8956a;">Founders, PeachHaus Group</span>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Elegant Bottom Border -->
          <tr>
            <td style="height: 4px; background: linear-gradient(90deg, #b8956a 0%, #d4b896 50%, #b8956a 100%);"></td>
          </tr>
          
        </table>
        
        <!-- Footer -->
        <table cellpadding="0" cellspacing="0" width="620" style="max-width: 620px;">
          <tr>
            <td style="padding: 28px 20px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-family: Georgia, serif; font-size: 13px; color: #8b8b8b; line-height: 1.6;">
                <a href="https://peachhaus.co" style="color: #b8956a; text-decoration: none;">peachhaus.co</a>
                &nbsp;&nbsp;•&nbsp;&nbsp;
                <a href="mailto:info@peachhausgroup.com" style="color: #b8956a; text-decoration: none;">info@peachhausgroup.com</a>
              </p>
              <p style="margin: 0; font-family: Georgia, serif; font-size: 12px; color: #ababab;">
                © ${currentYear} PeachHaus Group. Atlanta, GA
              </p>
            </td>
          </tr>
        </table>
        
      </td>
    </tr>
  </table>
  
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { leadId, type, message, subject, isTest } = await req.json();
    console.log(`Sending ${type} notification to lead ${leadId}${isTest ? ' (TEST)' : ''}`);

    // Fetch the lead
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      throw new Error("Lead not found");
    }

    const recipientFirstName = lead.name?.split(' ')[0] || 'there';
    let result: { success: boolean; externalId?: string; error?: string } = { success: false };

    if (type === "sms" && lead.phone) {
      const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
      const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
      const twilioPhone = Deno.env.get("TWILIO_VENDOR_PHONE_NUMBER") || Deno.env.get("TWILIO_PHONE_NUMBER");

      if (!twilioAccountSid || !twilioAuthToken || !twilioPhone) {
        throw new Error("Twilio credentials not configured");
      }

      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
      
      const formData = new URLSearchParams();
      formData.append("To", lead.phone);
      formData.append("From", twilioPhone);
      formData.append("Body", message);

      const twilioResponse = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      const twilioResult = await twilioResponse.json();
      
      result = {
        success: twilioResponse.ok,
        externalId: twilioResult.sid,
        error: twilioResult.error_message,
      };

      // Update communication record (skip for test)
      if (!isTest) {
        await supabase
          .from("lead_communications")
          .update({
            status: twilioResponse.ok ? "sent" : "failed",
            external_id: twilioResult.sid,
            error_message: twilioResult.error_message,
            sent_at: twilioResponse.ok ? new Date().toISOString() : null,
          })
          .eq("lead_id", leadId)
          .eq("communication_type", "sms")
          .eq("body", message)
          .eq("status", "pending");
      }

      console.log(`SMS ${twilioResponse.ok ? "sent" : "failed"}: ${twilioResult.sid || twilioResult.error_message}`);
      
    } else if (type === "email" && lead.email) {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      
      if (!resendApiKey) {
        throw new Error("Resend API key not configured");
      }

      // Build styled HTML email
      const htmlContent = buildStyledEmailHtml({
        subject: subject || "Message from PeachHaus",
        message,
        recipientFirstName,
      });

      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "PeachHaus Group <info@peachhausgroup.com>",
          to: [lead.email],
          cc: ["anja@peachhausgroup.com"],
          subject: subject || "Message from PeachHaus",
          html: htmlContent,
        }),
      });

      const emailResult = await emailResponse.json();
      
      result = {
        success: emailResponse.ok,
        externalId: emailResult.id,
        error: emailResult.message,
      };

      // Update communication record (skip for test)
      if (!isTest) {
        await supabase
          .from("lead_communications")
          .update({
            status: emailResponse.ok ? "sent" : "failed",
            external_id: emailResult.id,
            error_message: emailResult.message,
            sent_at: emailResponse.ok ? new Date().toISOString() : null,
          })
          .eq("lead_id", leadId)
          .eq("communication_type", "email")
          .eq("body", message)
          .eq("status", "pending");
      }

      console.log(`Email ${emailResponse.ok ? "sent" : "failed"}: ${emailResult.id || emailResult.message}`);
    } else {
      throw new Error(`Invalid notification type or missing contact info for ${type}`);
    }

    // Add timeline entry (skip for test)
    if (result.success && !isTest) {
      await supabase.from("lead_timeline").insert({
        lead_id: leadId,
        action: `Manual ${type.toUpperCase()} sent`,
        metadata: { external_id: result.externalId },
      });
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error sending lead notification:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
