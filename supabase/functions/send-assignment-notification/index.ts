import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AssignmentNotificationRequest {
  recipientEmail: string;
  recipientName: string;
  assignerName?: string;
  contactName: string;
  communicationId: string;
  messageSummary?: string;
  messageSubject?: string;
  messageType?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      recipientEmail,
      recipientName,
      assignerName = "A team member",
      contactName,
      communicationId,
      messageSummary,
      messageSubject,
      messageType = "message",
    }: AssignmentNotificationRequest = await req.json();

    // Validate required fields
    if (!recipientEmail || !recipientName || !contactName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get additional context from the communication if not provided
    let summary = messageSummary;
    let subject = messageSubject;
    let type = messageType;

    if (!summary && communicationId) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const { data: comm } = await supabase
          .from("lead_communications")
          .select("body, subject, communication_type")
          .eq("id", communicationId)
          .maybeSingle();

        if (comm) {
          summary = comm.body?.substring(0, 300) + (comm.body?.length > 300 ? "..." : "");
          subject = comm.subject;
          type = comm.communication_type;
        }
      } catch (e) {
        console.error("Error fetching communication details:", e);
      }
    }

    const directLink = `https://propertycentral.lovable.app/communications?message=${communicationId}`;
    const currentDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Map communication type to friendly name
    const typeLabels: Record<string, string> = {
      sms: "SMS Message",
      email: "Email",
      gmail: "Email",
      call: "Phone Call",
      personal_sms: "SMS Message",
      personal_call: "Phone Call",
    };

    const friendlyType = typeLabels[type] || "Message";

    const emailResponse = await resend.emails.send({
      from: "PeachHaus Group <notifications@peachhausgroup.com>",
      to: [recipientEmail],
      subject: `📥 New ${friendlyType} Assigned: ${contactName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Request Assigned to You</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 640px; margin: 0 auto; padding: 0; background-color: #f5f5f5;">
          <!-- Header with Logo -->
          <div style="background: #1a1a1a; padding: 24px 30px; text-align: center;">
            <img src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo-white.png" alt="PeachHaus Group" style="height: 40px; width: auto;" onerror="this.style.display='none'">
            <h1 style="color: #ffffff; margin: 12px 0 0; font-size: 20px; font-weight: 500; letter-spacing: 0.5px;">
              Request Assignment
            </h1>
          </div>
          
          <!-- Main Content -->
          <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e5e5; border-top: none;">
            <!-- Greeting -->
            <p style="font-size: 16px; margin: 0 0 24px; color: #333;">
              Hi ${recipientName},
            </p>
            
            <p style="font-size: 15px; margin: 0 0 24px; color: #555;">
              ${assignerName} has assigned a ${friendlyType.toLowerCase()} to your inbox that requires your attention.
            </p>
            
            <!-- Request Card -->
            <div style="background: #fafafa; border: 1px solid #eee; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
                    <span style="font-size: 13px; color: #888; text-transform: uppercase; letter-spacing: 0.5px;">From</span>
                  </td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">
                    <span style="font-size: 15px; font-weight: 600; color: #1a1a1a;">${contactName}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
                    <span style="font-size: 13px; color: #888; text-transform: uppercase; letter-spacing: 0.5px;">Type</span>
                  </td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">
                    <span style="font-size: 14px; color: #555;">${friendlyType}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
                    <span style="font-size: 13px; color: #888; text-transform: uppercase; letter-spacing: 0.5px;">Date</span>
                  </td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">
                    <span style="font-size: 14px; color: #555;">${currentDate}</span>
                  </td>
                </tr>
                ${subject ? `
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
                    <span style="font-size: 13px; color: #888; text-transform: uppercase; letter-spacing: 0.5px;">Subject</span>
                  </td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">
                    <span style="font-size: 14px; color: #555;">${subject}</span>
                  </td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 8px 0;">
                    <span style="font-size: 13px; color: #888; text-transform: uppercase; letter-spacing: 0.5px;">Assigned By</span>
                  </td>
                  <td style="padding: 8px 0; text-align: right;">
                    <span style="font-size: 14px; color: #555;">${assignerName}</span>
                  </td>
                </tr>
              </table>
            </div>
            
            ${summary ? `
            <!-- Message Preview -->
            <div style="margin-bottom: 24px;">
              <p style="font-size: 13px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 8px;">
                Message Preview
              </p>
              <div style="background: #f8f9fa; border-left: 3px solid #e67e22; padding: 16px; border-radius: 0 8px 8px 0; font-size: 14px; color: #555; line-height: 1.7;">
                ${summary.replace(/\n/g, '<br>')}
              </div>
            </div>
            ` : ''}
            
            <!-- Action Button -->
            <div style="text-align: center; margin: 32px 0;">
              <a href="${directLink}" style="display: inline-block; background: #e67e22; color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 6px; font-weight: 600; font-size: 15px; letter-spacing: 0.3px;">
                View & Respond
              </a>
            </div>
            
            <p style="font-size: 14px; color: #888; margin: 24px 0 0; text-align: center;">
              Please review and respond at your earliest convenience.
            </p>
          </div>
          
          <!-- Footer -->
          <div style="background: #fafafa; padding: 20px 30px; border: 1px solid #e5e5e5; border-top: none; text-align: center;">
            <p style="font-size: 12px; color: #999; margin: 0 0 8px;">
              This is an automated notification from PropertyCentral
            </p>
            <p style="font-size: 12px; color: #bbb; margin: 0;">
              PeachHaus Group LLC • Atlanta, GA
            </p>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Assignment notification email sent:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending assignment notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
