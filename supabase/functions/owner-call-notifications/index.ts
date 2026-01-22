import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = 'PeachHaus Group <hello@peachhausgroup.com>';
const ADMIN_EMAIL = 'info@peachhausgroup.com';

function formatInEST(date: Date): string {
  return date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

const TOPIC_LABELS: Record<string, string> = {
  monthly_statement: "Monthly Statement Questions",
  maintenance: "Maintenance & Repairs", 
  guest_concerns: "Guest Concerns",
  pricing: "Pricing Discussion",
  general_checkin: "General Check-in",
  property_update: "Property Updates",
  other: "Other"
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ownerCallId, notificationType } = await req.json();

    if (!ownerCallId) {
      return new Response(
        JSON.stringify({ error: "ownerCallId is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the owner call details
    const { data: call, error: callError } = await supabase
      .from('owner_calls')
      .select('*, property_owners(name, email)')
      .eq('id', ownerCallId)
      .single();

    if (callError || !call) {
      throw new Error(`Owner call not found: ${callError?.message}`);
    }

    const scheduledTime = formatInEST(new Date(call.scheduled_at));
    const topicLabel = TOPIC_LABELS[call.topic] || call.topic;

    let emailsSent = [];

    if (notificationType === 'confirmation') {
      // Send confirmation to owner
      if (RESEND_API_KEY) {
        const ownerEmailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #7c3aed; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
    .detail-row { display: flex; margin: 8px 0; }
    .label { font-weight: bold; width: 120px; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin:0;">Call Confirmed! 📞</h1>
    </div>
    <div class="content">
      <p>Hi ${call.contact_name},</p>
      <p>Your call with the PeachHaus team has been scheduled. We look forward to speaking with you!</p>
      
      <div class="details">
        <div class="detail-row">
          <span class="label">📅 When:</span>
          <span>${scheduledTime} EST</span>
        </div>
        <div class="detail-row">
          <span class="label">⏱️ Duration:</span>
          <span>30 minutes</span>
        </div>
        <div class="detail-row">
          <span class="label">💬 Topic:</span>
          <span>${topicLabel}</span>
        </div>
        ${call.topic_details ? `
        <div class="detail-row">
          <span class="label">📝 Details:</span>
          <span>${call.topic_details}</span>
        </div>
        ` : ''}
        ${call.google_meet_link ? `
        <div class="detail-row">
          <span class="label">🎥 Join:</span>
          <span><a href="${call.google_meet_link}" style="color: #7c3aed;">Click here to join the video call</a></span>
        </div>
        ` : ''}
      </div>

      <p>Need to reschedule? Please reply to this email or call us at (770) 933-0004.</p>
    </div>
    <div class="footer">
      <p>PeachHaus Group | Property Management</p>
      <p>Atlanta, GA | <a href="https://peachhausgroup.com" style="color: #7c3aed;">peachhausgroup.com</a></p>
    </div>
  </div>
</body>
</html>
        `;

        const ownerRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: call.contact_email,
            subject: `Your PeachHaus Call is Confirmed - ${scheduledTime} EST`,
            html: ownerEmailHtml
          })
        });

        if (ownerRes.ok) {
          emailsSent.push('owner_confirmation');
        } else {
          console.error('Failed to send owner confirmation:', await ownerRes.text());
        }

        // Send admin notification
        const adminEmailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #7c3aed; color: white; padding: 15px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .details { background: white; padding: 15px; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin:0;">New Owner Call Scheduled 📞</h2>
    </div>
    <div class="content">
      <div class="details">
        <p><strong>Owner:</strong> ${call.contact_name}${call.owner_id ? '' : ' <span style="color: #f59e0b;">(New - Not in system)</span>'}</p>
        <p><strong>Email:</strong> ${call.contact_email}</p>
        ${call.contact_phone ? `<p><strong>Phone:</strong> ${call.contact_phone}</p>` : ''}
        <p><strong>When:</strong> ${scheduledTime} EST</p>
        <p><strong>Topic:</strong> ${topicLabel}</p>
        ${call.topic_details ? `<p><strong>Details:</strong> ${call.topic_details}</p>` : ''}
        ${call.google_meet_link ? `<p><strong>Meet Link:</strong> <a href="${call.google_meet_link}">${call.google_meet_link}</a></p>` : ''}
      </div>
    </div>
  </div>
</body>
</html>
        `;

        const adminRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: ADMIN_EMAIL,
            subject: `🔔 Owner Call: ${call.contact_name} - ${topicLabel}`,
            html: adminEmailHtml
          })
        });

        if (adminRes.ok) {
          emailsSent.push('admin_notification');
        }
      }

      // Mark confirmation as sent
      await supabase
        .from('owner_calls')
        .update({ confirmation_sent: true })
        .eq('id', ownerCallId);
    }

    if (notificationType === 'reminder_24h') {
      // Similar reminder logic can be added here
      await supabase
        .from('owner_calls')
        .update({ reminder_24h_sent: true })
        .eq('id', ownerCallId);
      emailsSent.push('reminder_24h');
    }

    return new Response(
      JSON.stringify({ success: true, emailsSent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in owner-call-notifications:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
