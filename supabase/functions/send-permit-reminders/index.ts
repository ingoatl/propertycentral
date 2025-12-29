import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

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
    const resendKey = Deno.env.get("RESEND_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);
    const resend = new Resend(resendKey);

    // Calculate the date 30 days from now
    const today = new Date();
    const reminderDate = new Date(today);
    reminderDate.setDate(reminderDate.getDate() + 30);
    const reminderDateStr = reminderDate.toISOString().split('T')[0];

    console.log(`Checking for permits expiring around ${reminderDateStr}`);

    // Find permits expiring in ~30 days that haven't been reminded
    const { data: upcomingExpirationsReminders, error: reminderQueryError } = await supabase
      .from("permit_reminders")
      .select(`
        *,
        properties:property_id (
          id,
          name,
          address,
          owner_id,
          property_owners:owner_id (
            name,
            email
          )
        ),
        property_documents:document_id (
          file_name,
          file_path,
          ai_extracted_data
        )
      `)
      .eq("status", "pending")
      .gte("permit_expiration_date", today.toISOString().split('T')[0])
      .lte("permit_expiration_date", reminderDateStr);

    if (reminderQueryError) {
      console.error("Error querying reminders:", reminderQueryError);
      throw reminderQueryError;
    }

    console.log(`Found ${upcomingExpirationsReminders?.length || 0} permits needing reminders`);

    const results = [];

    for (const reminder of upcomingExpirationsReminders || []) {
      const property = reminder.properties;
      const document = reminder.property_documents;
      const extractedData = document?.ai_extracted_data || {};
      
      // Calculate days until expiration
      const expirationDate = new Date(reminder.permit_expiration_date);
      const daysUntilExpiration = Math.ceil((expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      // Build comprehensive email
      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .info-box { background: white; padding: 15px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #dc2626; }
    .label { font-weight: bold; color: #6b7280; font-size: 12px; text-transform: uppercase; }
    .value { font-size: 16px; color: #111827; margin-top: 4px; }
    .urgent { color: #dc2626; font-weight: bold; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
    .cta { background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ Permit Expiration Alert</h1>
      <p>Action Required Within ${daysUntilExpiration} Days</p>
    </div>
    
    <div class="content">
      <p>This is an automated reminder that the STR permit for the following property is expiring soon.</p>
      
      <div class="info-box">
        <div class="label">Property</div>
        <div class="value">${property?.name || 'Unknown Property'}</div>
        <div class="value" style="color: #6b7280;">${property?.address || 'Address not available'}</div>
      </div>
      
      <div class="info-box">
        <div class="label">Permit Details</div>
        <div class="value">
          <strong>Permit Number:</strong> ${reminder.permit_number || extractedData?.permit_number || 'Not recorded'}<br>
          <strong>Expiration Date:</strong> <span class="urgent">${expirationDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span><br>
          <strong>Days Until Expiration:</strong> <span class="urgent">${daysUntilExpiration} days</span>
        </div>
      </div>
      
      ${extractedData?.jurisdiction ? `
      <div class="info-box">
        <div class="label">Issuing Authority</div>
        <div class="value">${extractedData.jurisdiction}</div>
      </div>
      ` : ''}
      
      ${property?.property_owners ? `
      <div class="info-box">
        <div class="label">Property Owner</div>
        <div class="value">${property.property_owners.name}</div>
        <div class="value" style="color: #6b7280;">${property.property_owners.email}</div>
      </div>
      ` : ''}
      
      ${extractedData?.conditions ? `
      <div class="info-box">
        <div class="label">Permit Conditions</div>
        <div class="value">${extractedData.conditions}</div>
      </div>
      ` : ''}
      
      <div style="text-align: center; margin-top: 20px;">
        <p><strong>Action Required:</strong></p>
        <p>Please initiate the permit renewal process as soon as possible to avoid any lapse in coverage that could affect bookings.</p>
      </div>
    </div>
    
    <div class="footer">
      <p>This is an automated reminder from PeachHaus Property Management System.</p>
      <p>Sent to: ${reminder.reminder_email_to}</p>
    </div>
  </div>
</body>
</html>
      `;

      try {
        const emailResult = await resend.emails.send({
          from: "PeachHaus Alerts <alerts@peachhausgroup.com>",
          to: [reminder.reminder_email_to || "info@peachhausgroup.com"],
          subject: `⚠️ URGENT: Permit Expires in ${daysUntilExpiration} Days - ${property?.name || 'Property'}`,
          html: emailHtml,
        });

        console.log(`Reminder email sent for property ${property?.name}:`, emailResult);

        // Update reminder status
        await supabase
          .from("permit_reminders")
          .update({
            status: "sent",
            reminder_sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", reminder.id);

        results.push({
          property: property?.name,
          status: "sent",
          daysUntilExpiration,
        });

      } catch (emailError: unknown) {
        const errorMessage = emailError instanceof Error ? emailError.message : 'Unknown error';
        console.error(`Failed to send reminder for ${property?.name}:`, emailError);
        results.push({
          property: property?.name,
          status: "failed",
          error: errorMessage,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error in send-permit-reminders:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
