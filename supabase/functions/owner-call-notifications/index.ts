import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = 'PeachHaus <info@peachhausgroup.com>';
const ADMIN_EMAIL = 'info@peachhausgroup.com';
const LOGO_URL = "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png";
const HOSTS_PHOTO_URL = "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/ingo-headshot.png";
const SIGNATURE_URL = "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/ingo-signature.png";

function formatInEST(date: Date): { date: string; time: string; dateTime: string } {
  const estDateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const estTimeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  
  const formattedDate = estDateFormatter.format(date);
  const formattedTime = estTimeFormatter.format(date) + " EST";
  
  return {
    date: formattedDate,
    time: formattedTime,
    dateTime: `${formattedDate} at ${formattedTime}`
  };
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

// Fortune 500 style email template - clean, corporate, professional
function generateFortune500EmailHTML(
  type: 'confirmation' | 'reminder_48h' | 'reminder_24h' | 'reminder_1h',
  call: any,
  scheduledTime: { date: string; time: string; dateTime: string },
  topicLabel: string,
  prepTip: string,
  isVideoCall: boolean,
  propertyInfo: any,
  firstName: string
): string {
  const getHeaderConfig = () => {
    switch (type) {
      case 'confirmation': return { badge: 'CALL CONFIRMED', title: 'Your Owner Call is Scheduled' };
      case 'reminder_48h': return { badge: 'REMINDER • 2 DAYS', title: 'Your Call is in 2 Days' };
      case 'reminder_24h': return { badge: 'REMINDER • TOMORROW', title: 'Your Call is Tomorrow' };
      case 'reminder_1h': return { badge: 'STARTING SOON', title: 'Your Call Starts in 1 Hour' };
    }
  };

  const getGreeting = () => {
    switch (type) {
      case 'confirmation': return `Thank you for scheduling a call with PeachHaus. We're looking forward to connecting with you to discuss ${topicLabel.toLowerCase()}.`;
      case 'reminder_48h': return `This is a friendly reminder about your upcoming call with PeachHaus in 2 days. We're looking forward to speaking with you.`;
      case 'reminder_24h': return `Your call with PeachHaus is tomorrow. We wanted to make sure you have all the details ready.`;
      case 'reminder_1h': return `Your call with PeachHaus starts in about an hour. We're ready when you are!`;
    }
  };

  const header = getHeaderConfig();
  const greeting = getGreeting();
  const callId = `CALL-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${call.id.slice(0, 6).toUpperCase()}`;
  const isUrgent = type === 'reminder_1h';

  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${header.title}</title>
  </head>
  <body style="margin: 0; padding: 0; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; background: #ffffff;">
      
      <!-- Header - Corporate Minimal with Logo -->
      <div style="padding: 24px 32px; border-bottom: 2px solid #111111;">
        <table style="width: 100%;">
          <tr>
            <td style="vertical-align: middle;">
              <img src="${LOGO_URL}" alt="PeachHaus" style="height: 40px; width: auto;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
              <div style="display: none; font-size: 20px; font-weight: 700; color: #111111; letter-spacing: -0.3px;">PeachHaus</div>
            </td>
            <td style="text-align: right; vertical-align: middle;">
              <div style="font-size: 16px; font-weight: 600; color: ${isUrgent ? '#dc2626' : '#111111'}; margin-bottom: 4px;">${header.badge}</div>
              <div style="font-size: 10px; color: #666666; font-family: 'SF Mono', Menlo, Consolas, 'Courier New', monospace;">
                ${callId}
              </div>
            </td>
          </tr>
        </table>
      </div>

      <!-- Call Summary Section -->
      <div style="padding: 20px 32px; background: #f9f9f9; border-bottom: 1px solid #e5e5e5;">
        <table style="width: 100%;">
          <tr>
            <td style="vertical-align: top; width: 50%;">
              <div style="font-size: 10px; color: #666666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Scheduled For</div>
              <div style="font-size: 14px; font-weight: 600; color: #111111;">${scheduledTime.date}</div>
              <div style="font-size: 12px; color: #666666; margin-top: 2px;">${scheduledTime.time}</div>
            </td>
            <td style="vertical-align: top; text-align: right;">
              <div style="font-size: 10px; color: #666666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Meeting Type</div>
              <div style="font-size: 14px; font-weight: 600; color: #111111;">${isVideoCall ? '📹 Video Call' : '📞 Phone Call'}</div>
            </td>
          </tr>
        </table>
      </div>

      <!-- Greeting -->
      <div style="padding: 24px 32px 16px 32px;">
        <p style="font-size: 14px; line-height: 1.6; color: #111111; margin: 0;">
          Dear ${firstName},
        </p>
        <p style="font-size: 13px; line-height: 1.6; color: #444444; margin: 12px 0 0 0;">
          ${greeting}
        </p>
      </div>

      <!-- Call Details Table -->
      <div style="padding: 0 32px 24px 32px;">
        <div style="font-size: 11px; font-weight: 600; color: #111111; padding: 8px 0; border-bottom: 1px solid #111111; text-transform: uppercase; letter-spacing: 0.5px;">
          Call Details
        </div>
        <table style="width: 100%;">
          <tr>
            <td style="padding: 12px 0; font-size: 13px; color: #666666; border-bottom: 1px solid #e5e5e5; width: 140px;">Date & Time</td>
            <td style="padding: 12px 0; font-size: 13px; color: #111111; font-weight: 600; border-bottom: 1px solid #e5e5e5;">${scheduledTime.dateTime}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; font-size: 13px; color: #666666; border-bottom: 1px solid #e5e5e5;">Topic</td>
            <td style="padding: 12px 0; font-size: 13px; color: #111111; border-bottom: 1px solid #e5e5e5;">${topicLabel}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; font-size: 13px; color: #666666; border-bottom: 1px solid #e5e5e5;">Meeting Type</td>
            <td style="padding: 12px 0; font-size: 13px; color: #111111; border-bottom: 1px solid #e5e5e5;">
              ${isVideoCall ? 'Video Call (Google Meet)' : `Phone Call to ${call.contact_phone || 'your number'}`}
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 0; font-size: 13px; color: #666666; border-bottom: 1px solid #e5e5e5;">Duration</td>
            <td style="padding: 12px 0; font-size: 13px; color: #111111; border-bottom: 1px solid #e5e5e5;">30 minutes</td>
          </tr>
          ${propertyInfo ? `
          <tr>
            <td style="padding: 12px 0; font-size: 13px; color: #666666; border-bottom: 1px solid #e5e5e5;">Property</td>
            <td style="padding: 12px 0; font-size: 13px; color: #111111; border-bottom: 1px solid #e5e5e5;">${propertyInfo.name}${propertyInfo.address ? ` - ${propertyInfo.address}` : ''}</td>
          </tr>
          ` : ''}
          ${call.topic_details ? `
          <tr>
            <td style="padding: 12px 0; font-size: 13px; color: #666666; border-bottom: 1px solid #e5e5e5;">Notes</td>
            <td style="padding: 12px 0; font-size: 13px; color: #111111; border-bottom: 1px solid #e5e5e5;">${call.topic_details}</td>
          </tr>
          ` : ''}
        </table>
      </div>

      ${isVideoCall && call.google_meet_link ? `
      <!-- Video Call CTA -->
      <div style="padding: 0 32px 24px 32px;">
        <div style="text-align: center; padding: 20px; background: #f0fdf4; border: 1px solid #bbf7d0;">
          <p style="font-size: 12px; color: #166534; margin: 0 0 12px 0; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">${isUrgent ? 'JOIN NOW' : 'JOIN VIDEO CALL'}</p>
          <a href="${call.google_meet_link}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 32px; text-decoration: none; font-size: 13px; font-weight: 600; letter-spacing: 0.5px;">
            Open Google Meet
          </a>
          <p style="font-size: 11px; color: #666666; margin: 12px 0 0 0; font-family: 'SF Mono', Menlo, monospace;">${call.google_meet_link}</p>
        </div>
      </div>
      ` : ''}

      <!-- Preparation Tip -->
      <div style="padding: 0 32px 24px 32px;">
        <div style="background: #f9f9f9; border: 1px solid #e5e5e5; padding: 16px;">
          <div style="font-size: 10px; color: #666666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">💡 To Prepare</div>
          <p style="font-size: 13px; color: #444444; margin: 0; line-height: 1.6;">${prepTip}</p>
        </div>
      </div>

      <!-- Signature Section -->
      <div style="padding: 24px 32px; border-top: 1px solid #e5e5e5;">
        <table style="width: 100%;">
          <tr>
            <td style="vertical-align: middle; width: 70px;">
              <img src="${HOSTS_PHOTO_URL}" alt="Ingo Schaer" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; border: 2px solid #e5e5e5;">
            </td>
            <td style="vertical-align: middle; padding-left: 16px;">
              <p style="margin: 0; font-size: 13px; color: #111111; font-weight: 600;">Looking forward to speaking with you,</p>
              <img src="${SIGNATURE_URL}" alt="Signature" style="height: 32px; margin: 8px 0;">
              <p style="margin: 0; font-size: 12px; color: #666666;">PeachHaus Property Management</p>
              <p style="margin: 4px 0 0 0; font-size: 11px; color: #888888;">(770) 933-0004 · info@peachhausgroup.com</p>
            </td>
          </tr>
        </table>
      </div>

      <!-- Footer -->
      <div style="padding: 16px 32px; background-color: #f9f9f9; border-top: 1px solid #e5e5e5; text-align: center;">
        <p style="margin: 0; font-size: 11px; color: #666666;">
          PeachHaus Property Management · Atlanta, Georgia
        </p>
        <p style="margin: 8px 0 0 0; font-size: 11px; color: #888888;">
          Need to reschedule? Reply to this email or call (770) 933-0004
        </p>
      </div>
    </div>
  </body>
</html>`;
}

// Generate admin notification HTML
function generateAdminHTML(call: any, scheduledTime: { date: string; time: string; dateTime: string }, topicLabel: string, isVideoCall: boolean, propertyInfo: any): string {
  return `
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
        <div class="detail-row"><span class="label">📅 When:</span> ${scheduledTime.dateTime}</div>
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
}

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

    const scheduledAt = new Date(call.scheduled_at);
    const scheduledTime = formatInEST(scheduledAt);
    const topicLabel = TOPIC_LABELS[call.topic] || call.topic;
    const prepTip = TOPIC_PREP_TIPS[call.topic] || TOPIC_PREP_TIPS.other;
    const isVideoCall = call.meeting_type !== 'phone';
    const firstName = call.contact_name.split(' ')[0];

    let emailsSent = [];

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
            subject: `Call Confirmed - ${scheduledTime.date}`,
            html: generateFortune500EmailHTML('confirmation', call, scheduledTime, topicLabel, prepTip, isVideoCall, propertyInfo, firstName)
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
            html: generateAdminHTML(call, scheduledTime, topicLabel, isVideoCall, propertyInfo)
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
            subject: `Reminder: Your Call in 2 Days - ${scheduledTime.date}`,
            html: generateFortune500EmailHTML('reminder_48h', call, scheduledTime, topicLabel, prepTip, isVideoCall, propertyInfo, firstName)
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
            subject: `Tomorrow: Your PeachHaus Call - ${scheduledTime.time}`,
            html: generateFortune500EmailHTML('reminder_24h', call, scheduledTime, topicLabel, prepTip, isVideoCall, propertyInfo, firstName)
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
            subject: `Starting Soon: Your PeachHaus Call in 1 Hour`,
            html: generateFortune500EmailHTML('reminder_1h', call, scheduledTime, topicLabel, prepTip, isVideoCall, propertyInfo, firstName)
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
      JSON.stringify({ success: true, emailsSent, notificationType }),
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
