import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

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
    }: AssignmentNotificationRequest = await req.json();

    // Validate required fields
    if (!recipientEmail || !recipientName || !contactName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const appUrl = Deno.env.get("VITE_SUPABASE_URL")?.replace(".supabase.co", "") || "";
    const directLink = `https://propertycentral.lovable.app/communications?message=${communicationId}`;

    const emailResponse = await resend.emails.send({
      from: "PropertyCentral <notifications@peachhausgroup.com>",
      to: [recipientEmail],
      subject: "New Request Assigned to You",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Request Assigned</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">New Request Assigned</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e9ecef; border-top: none;">
            <p style="font-size: 16px; margin-bottom: 20px;">
              Hi <strong>${recipientName}</strong>,
            </p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              ${assignerName} has assigned a new request to your inbox.
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; margin-bottom: 25px;">
              <p style="margin: 0; font-size: 14px; color: #666;">Request from:</p>
              <p style="margin: 5px 0 0; font-size: 18px; font-weight: 600; color: #333;">${contactName}</p>
            </div>
            
            <p style="font-size: 16px; margin-bottom: 25px;">
              Please review and respond at your earliest convenience.
            </p>
            
            <div style="text-align: center;">
              <a href="${directLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 30px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                View Request
              </a>
            </div>
            
            <p style="font-size: 12px; color: #999; margin-top: 30px; text-align: center;">
              This is an automated notification from PropertyCentral.<br>
              If you have questions, please contact your team lead.
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
