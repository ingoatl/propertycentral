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

const TOPIC_PREP_TIPS: Record<string, string> = {
  monthly_statement: "Have your latest monthly statement open for reference. We'll walk through any questions together.",
  maintenance: "Note down any specific repair concerns or questions about property upkeep.",
  guest_concerns: "Gather details about the specific guest situation including dates and any relevant communications.",
  pricing: "Review your current pricing and occupancy rates. We'll discuss market trends and optimization strategies.",
  general_checkin: "Think about any questions or updates you'd like to discuss about your property.",
  property_update: "Prepare any property changes, upcoming plans, or updates you'd like to share.",
  other: "Have your specific topic details ready so we can make the most of our time together."
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

    // Fetch the owner call details with property info
    const { data: call, error: callError } = await supabase
      .from('owner_calls')
      .select('*, property_owners(name, email)')
      .eq('id', ownerCallId)
      .single();

    if (callError || !call) {
      throw new Error(`Owner call not found: ${callError?.message}`);
    }

    // Get property info if owner exists
    let propertyInfo = null;
    if (call.owner_id) {
      const { data: props } = await supabase
        .from('properties')
        .select('name, address')
        .eq('owner_id', call.owner_id)
        .limit(1);
      if (props && props.length > 0) {
        propertyInfo = props[0];
      }
    }

    const scheduledTime = formatInEST(new Date(call.scheduled_at));
    const topicLabel = TOPIC_LABELS[call.topic] || call.topic;
    const prepTip = TOPIC_PREP_TIPS[call.topic] || TOPIC_PREP_TIPS.other;
    const isVideoCall = call.meeting_type !== 'phone';
    const callDate = new Date(call.scheduled_at);

    let emailsSent = [];

    // Generate high-end email HTML
    const generateEmailHTML = (type: 'confirmation' | 'reminder_48h' | 'reminder_24h' | 'reminder_1h') => {
      const getHeaderText = () => {
        switch (type) {
          case 'confirmation': return { emoji: '✨', title: 'Call Confirmed', subtitle: 'Your owner call is scheduled' };
          case 'reminder_48h': return { emoji: '📅', title: 'Call in 2 Days', subtitle: 'Just a friendly reminder' };
          case 'reminder_24h': return { emoji: '⏰', title: 'Call Tomorrow', subtitle: 'Your call is coming up soon' };
          case 'reminder_1h': return { emoji: '🔔', title: 'Starting Soon', subtitle: 'Your call begins in 1 hour' };
        }
      };

      const header = getHeaderText();
      const urgencyColor = type === 'reminder_1h' ? '#dc2626' : '#f97316';

      return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${header.title}</title>
</head>
<body style="margin:0;padding:0;background-color:#faf5f0;font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background-color:#ffffff;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#f97316 0%,#ea580c 100%);padding:40px 30px;text-align:center;">
      <div style="font-size:48px;margin-bottom:12px;">${header.emoji}</div>
      <h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:700;">${header.title}</h1>
      <p style="color:rgba(255,255,255,0.9);margin:8px 0 0;font-size:16px;">${header.subtitle}</p>
    </div>

    <!-- Greeting -->
    <div style="padding:30px 30px 20px;">
      <p style="font-size:16px;color:#374151;margin:0 0 20px;line-height:1.6;">
        Hi ${call.contact_name.split(' ')[0]},
      </p>
      <p style="font-size:16px;color:#374151;margin:0;line-height:1.6;">
        ${type === 'confirmation' 
          ? "Great news! Your call with the PeachHaus team has been confirmed. We're looking forward to connecting with you!"
          : type === 'reminder_48h'
          ? "We're excited to speak with you in just a couple of days! Here's a quick reminder about your upcoming call."
          : type === 'reminder_24h'
          ? "Your call with us is tomorrow! We wanted to make sure you have all the details handy."
          : "Your call starts in about an hour! We're ready when you are."
        }
      </p>
    </div>

    <!-- Call Details Card -->
    <div style="margin:0 30px 25px;background:#fef7f0;border-radius:16px;overflow:hidden;border:1px solid #fed7aa;">
      <div style="padding:20px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:12px 0;border-bottom:1px solid #fed7aa;">
              <div style="display:flex;align-items:center;">
                <span style="font-size:20px;margin-right:12px;">📅</span>
                <div>
                  <div style="font-size:13px;color:#9a3412;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Date & Time</div>
                  <div style="font-size:16px;color:#1f2937;font-weight:600;margin-top:2px;">${scheduledTime} EST</div>
                </div>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 0;border-bottom:1px solid #fed7aa;">
              <div style="display:flex;align-items:center;">
                <span style="font-size:20px;margin-right:12px;">${isVideoCall ? '🎥' : '📞'}</span>
                <div>
                  <div style="font-size:13px;color:#9a3412;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Meeting Type</div>
                  <div style="font-size:16px;color:#1f2937;font-weight:600;margin-top:2px;">${isVideoCall ? 'Video Call (Google Meet)' : 'Phone Call'}</div>
                  ${!isVideoCall && call.contact_phone ? `<div style="font-size:14px;color:#6b7280;margin-top:2px;">We'll call: ${call.contact_phone}</div>` : ''}
                </div>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 0;border-bottom:1px solid #fed7aa;">
              <div style="display:flex;align-items:center;">
                <span style="font-size:20px;margin-right:12px;">⏱️</span>
                <div>
                  <div style="font-size:13px;color:#9a3412;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Duration</div>
                  <div style="font-size:16px;color:#1f2937;font-weight:600;margin-top:2px;">30 minutes</div>
                </div>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 0;${propertyInfo ? 'border-bottom:1px solid #fed7aa;' : ''}">
              <div style="display:flex;align-items:center;">
                <span style="font-size:20px;margin-right:12px;">💬</span>
                <div>
                  <div style="font-size:13px;color:#9a3412;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Topic</div>
                  <div style="font-size:16px;color:#1f2937;font-weight:600;margin-top:2px;">${topicLabel}</div>
                  ${call.topic_details ? `<div style="font-size:14px;color:#6b7280;margin-top:4px;">${call.topic_details}</div>` : ''}
                </div>
              </div>
            </td>
          </tr>
          ${propertyInfo ? `
          <tr>
            <td style="padding:12px 0;">
              <div style="display:flex;align-items:center;">
                <span style="font-size:20px;margin-right:12px;">🏠</span>
                <div>
                  <div style="font-size:13px;color:#9a3412;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Property</div>
                  <div style="font-size:16px;color:#1f2937;font-weight:600;margin-top:2px;">${propertyInfo.name}</div>
                  ${propertyInfo.address ? `<div style="font-size:14px;color:#6b7280;margin-top:2px;">${propertyInfo.address}</div>` : ''}
                </div>
              </div>
            </td>
          </tr>
          ` : ''}
        </table>
      </div>
    </div>

    ${isVideoCall && call.google_meet_link ? `
    <!-- Join Button -->
    <div style="text-align:center;padding:0 30px 25px;">
      <a href="${call.google_meet_link}" style="display:inline-block;background:linear-gradient(135deg,#f97316 0%,#ea580c 100%);color:#ffffff;text-decoration:none;padding:16px 48px;border-radius:12px;font-size:16px;font-weight:700;box-shadow:0 4px 14px rgba(249,115,22,0.4);">
        ${type === 'reminder_1h' ? '🎥 Join Video Call Now' : '🎥 Join Video Call'}
      </a>
      <p style="font-size:13px;color:#9ca3af;margin:12px 0 0;">Or copy: ${call.google_meet_link}</p>
    </div>
    ` : ''}

    <!-- Preparation Tip -->
    <div style="margin:0 30px 25px;background:#f0fdf4;border-radius:12px;padding:20px;border-left:4px solid #22c55e;">
      <div style="font-size:14px;font-weight:700;color:#15803d;margin-bottom:8px;">💡 To Prepare</div>
      <p style="font-size:14px;color:#166534;margin:0;line-height:1.6;">${prepTip}</p>
    </div>

    <!-- Contact Info -->
    <div style="padding:20px 30px;background:#f9fafb;border-top:1px solid #e5e7eb;">
      <p style="font-size:14px;color:#6b7280;margin:0 0 8px;text-align:center;">
        Need to reschedule? Reply to this email or call us:
      </p>
      <p style="font-size:16px;color:#1f2937;margin:0;text-align:center;font-weight:600;">
        📞 (770) 933-0004
      </p>
    </div>

    <!-- Footer -->
    <div style="padding:25px 30px;background:#1f2937;text-align:center;">
      <p style="color:#f97316;font-size:18px;font-weight:700;margin:0 0 4px;">PeachHaus Group</p>
      <p style="color:#9ca3af;font-size:13px;margin:0;">Premium Property Management • Atlanta, GA</p>
      <p style="color:#6b7280;font-size:12px;margin:15px 0 0;">
        <a href="https://peachhausgroup.com" style="color:#f97316;text-decoration:none;">peachhausgroup.com</a>
      </p>
    </div>
  </div>
</body>
</html>`;
    };

    // Generate admin notification HTML
    const generateAdminHTML = () => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #f97316, #ea580c); color: white; padding: 20px; text-align: center; }
    .content { padding: 25px; background: #fff; }
    .details { background: #fef7f0; padding: 20px; border-radius: 12px; margin: 15px 0; }
    .detail-row { margin: 10px 0; }
    .label { font-weight: bold; color: #9a3412; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .badge-new { background: #fef3c7; color: #92400e; }
    .badge-existing { background: #d1fae5; color: #065f46; }
    .badge-video { background: #dbeafe; color: #1e40af; }
    .badge-phone { background: #fce7f3; color: #9d174d; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin:0;">📞 New Owner Call Scheduled</h2>
    </div>
    <div class="content">
      <p style="margin-top:0;">
        <strong>${call.contact_name}</strong> 
        <span class="badge ${call.owner_id ? 'badge-existing' : 'badge-new'}">${call.owner_id ? '✓ Existing Owner' : '⚠️ New Inquiry'}</span>
        <span class="badge ${isVideoCall ? 'badge-video' : 'badge-phone'}">${isVideoCall ? '🎥 Video' : '📞 Phone'}</span>
      </p>
      
      <div class="details">
        <div class="detail-row"><span class="label">📅 When:</span> ${scheduledTime} EST</div>
        <div class="detail-row"><span class="label">📧 Email:</span> ${call.contact_email}</div>
        ${call.contact_phone ? `<div class="detail-row"><span class="label">📱 Phone:</span> ${call.contact_phone}</div>` : ''}
        <div class="detail-row"><span class="label">💬 Topic:</span> ${topicLabel}</div>
        ${call.topic_details ? `<div class="detail-row"><span class="label">📝 Details:</span> ${call.topic_details}</div>` : ''}
        ${propertyInfo ? `<div class="detail-row"><span class="label">🏠 Property:</span> ${propertyInfo.name}${propertyInfo.address ? ` - ${propertyInfo.address}` : ''}</div>` : ''}
        ${call.google_meet_link ? `<div class="detail-row"><span class="label">🔗 Meet:</span> <a href="${call.google_meet_link}">${call.google_meet_link}</a></div>` : ''}
      </div>
    </div>
  </div>
</body>
</html>`;

    if (RESEND_API_KEY) {
      if (notificationType === 'confirmation') {
        // Send owner confirmation
        const ownerRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: call.contact_email,
            subject: `✨ Your PeachHaus Call is Confirmed - ${scheduledTime} EST`,
            html: generateEmailHTML('confirmation')
          })
        });

        if (ownerRes.ok) {
          emailsSent.push('owner_confirmation');
        } else {
          console.error('Failed to send owner confirmation:', await ownerRes.text());
        }

        // Send admin notification
        const adminRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: ADMIN_EMAIL,
            subject: `📞 Owner Call: ${call.contact_name} - ${topicLabel} (${isVideoCall ? 'Video' : 'Phone'})`,
            html: generateAdminHTML()
          })
        });

        if (adminRes.ok) {
          emailsSent.push('admin_notification');
        }

        // Mark confirmation as sent
        await supabase
          .from('owner_calls')
          .update({ confirmation_sent: true })
          .eq('id', ownerCallId);
      }

      if (notificationType === 'reminder_48h') {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: call.contact_email,
            subject: `📅 Reminder: Your PeachHaus Call in 2 Days - ${scheduledTime} EST`,
            html: generateEmailHTML('reminder_48h')
          })
        });

        if (res.ok) {
          emailsSent.push('reminder_48h');
          await supabase
            .from('owner_calls')
            .update({ reminder_48h_sent: true })
            .eq('id', ownerCallId);
        }
      }

      if (notificationType === 'reminder_24h') {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: call.contact_email,
            subject: `⏰ Tomorrow: Your PeachHaus Call - ${scheduledTime} EST`,
            html: generateEmailHTML('reminder_24h')
          })
        });

        if (res.ok) {
          emailsSent.push('reminder_24h');
          await supabase
            .from('owner_calls')
            .update({ reminder_24h_sent: true })
            .eq('id', ownerCallId);
        }
      }

      if (notificationType === 'reminder_1h') {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: call.contact_email,
            subject: `🔔 Starting Soon: Your PeachHaus Call in 1 Hour`,
            html: generateEmailHTML('reminder_1h')
          })
        });

        if (res.ok) {
          emailsSent.push('reminder_1h');
          await supabase
            .from('owner_calls')
            .update({ reminder_1h_sent: true })
            .eq('id', ownerCallId);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, emailsSent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in owner-call-notifications:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
