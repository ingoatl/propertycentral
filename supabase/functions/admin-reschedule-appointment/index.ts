import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const LOGO_URL = "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png";
const FROM_EMAIL = "PeachHaus <info@peachhausgroup.com>";
const RESCHEDULE_BASE_URL = "https://propertycentral.lovable.app/reschedule";
const GOOGLE_MEET_LINK = "https://meet.google.com/jww-deey-iaa";

interface RescheduleRequest {
  appointmentId: string;
  appointmentType: "discovery_call" | "inspection" | "visit";
  newScheduledAt: string;
  reason: string;
  notes?: string;
  sendNotification: boolean;
}

const REASON_LABELS: Record<string, string> = {
  client_request: "Client requested change",
  conflict: "Schedule conflict",
  emergency: "Emergency/urgent matter",
  availability: "Staff availability",
  weather: "Weather conditions",
  other: "Other reason",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the user from auth header
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    let userName = "System";

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: userData } = await supabase.auth.getUser(token);
      if (userData?.user) {
        userId = userData.user.id;
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", userId)
          .single();
        if (profile) {
          userName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Admin";
        }
      }
    }

    const body: RescheduleRequest = await req.json();
    const { appointmentId, appointmentType, newScheduledAt, reason, notes, sendNotification } = body;

    if (!appointmentId || !newScheduledAt || !reason) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newTime = new Date(newScheduledAt);
    const now = new Date();

    // Validate new time is in the future
    if (newTime <= now) {
      return new Response(
        JSON.stringify({ error: "New time must be in the future" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let appointment: any;
    let lead: any;
    let oldScheduledAt: string;
    let googleCalendarEventId: string | null = null;

    // Handle discovery calls
    if (appointmentType === "discovery_call" || appointmentType === "inspection") {
      const { data, error } = await supabase
        .from("discovery_calls")
        .select(`*, leads(*)`)
        .eq("id", appointmentId)
        .single();

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: "Appointment not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      appointment = data;
      lead = data.leads;
      oldScheduledAt = data.scheduled_at;
      googleCalendarEventId = data.google_calendar_event_id;

      // Check for conflicts
      const duration = data.duration_minutes || 30;
      const { data: conflicts } = await supabase
        .from("discovery_calls")
        .select("id")
        .neq("id", appointmentId)
        .in("status", ["scheduled", "confirmed"])
        .gte("scheduled_at", new Date(newTime.getTime() - duration * 60 * 1000).toISOString())
        .lte("scheduled_at", new Date(newTime.getTime() + duration * 60 * 1000).toISOString());

      if (conflicts && conflicts.length > 0) {
        return new Response(
          JSON.stringify({ error: "This time slot conflicts with another appointment" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update the discovery call
      const { error: updateError } = await supabase
        .from("discovery_calls")
        .update({
          scheduled_at: newScheduledAt,
          rescheduled_at: now.toISOString(),
          rescheduled_from: oldScheduledAt,
          reschedule_count: (data.reschedule_count || 0) + 1,
          reminder_48h_sent: false,
          reminder_24h_sent: false,
          reminder_1h_sent: false,
          meeting_notes: `${data.meeting_notes || ""}\n\n[${formatInEST(now)}] Rescheduled by ${userName}: ${REASON_LABELS[reason] || reason}${notes ? ` - ${notes}` : ""}`.trim(),
        })
        .eq("id", appointmentId);

      if (updateError) throw updateError;

      // CRITICAL: Dynamically adjust all pending follow-up schedules for this lead
      if (lead?.id) {
        const oldTime = new Date(oldScheduledAt);
        const timeDiffMs = newTime.getTime() - oldTime.getTime();
        
        // Fetch all pending follow-ups for this lead
        const { data: pendingFollowUps, error: followUpFetchError } = await supabase
          .from("lead_follow_up_schedules")
          .select("id, scheduled_for")
          .eq("lead_id", lead.id)
          .eq("status", "pending");

        if (followUpFetchError) {
          console.error("Error fetching follow-ups:", followUpFetchError);
        } else if (pendingFollowUps && pendingFollowUps.length > 0) {
          console.log(`Adjusting ${pendingFollowUps.length} pending follow-ups by ${timeDiffMs}ms`);
          
          // Update each follow-up with the new adjusted time
          for (const followUp of pendingFollowUps) {
            const oldFollowUpTime = new Date(followUp.scheduled_for);
            const newFollowUpTime = new Date(oldFollowUpTime.getTime() + timeDiffMs);
            
            const { error: followUpUpdateError } = await supabase
              .from("lead_follow_up_schedules")
              .update({ 
                scheduled_for: newFollowUpTime.toISOString(),
                updated_at: now.toISOString()
              })
              .eq("id", followUp.id);

            if (followUpUpdateError) {
              console.error(`Error updating follow-up ${followUp.id}:`, followUpUpdateError);
            } else {
              console.log(`Adjusted follow-up ${followUp.id}: ${followUp.scheduled_for} → ${newFollowUpTime.toISOString()}`);
            }
          }
        }
      }
    }

    // Log the reschedule
    await supabase.from("appointment_reschedule_logs").insert({
      appointment_id: appointmentId,
      appointment_type: appointmentType,
      previous_scheduled_at: oldScheduledAt,
      new_scheduled_at: newScheduledAt,
      reason: REASON_LABELS[reason] || reason,
      reschedule_notes: notes,
      rescheduled_by: userId,
      rescheduled_by_name: userName,
      rescheduled_by_type: "admin",
      notification_sent: sendNotification,
    });

    // Add to lead timeline if applicable
    if (lead?.id) {
      await supabase.from("lead_timeline").insert({
        lead_id: lead.id,
        event_type: "call_rescheduled",
        title: "Appointment Rescheduled by Admin",
        description: `${userName} rescheduled from ${formatInEST(new Date(oldScheduledAt))} to ${formatInEST(newTime)} EST. Reason: ${REASON_LABELS[reason] || reason}`,
        metadata: {
          old_time: oldScheduledAt,
          new_time: newScheduledAt,
          reason,
          notes,
          rescheduled_by: userName,
          follow_ups_adjusted: true,
        },
      });
    }

    // Update Google Calendar if applicable
    if (googleCalendarEventId) {
      try {
        const pipedreamClientId = Deno.env.get("PIPEDREAM_CLIENT_ID");
        const pipedreamClientSecret = Deno.env.get("PIPEDREAM_CLIENT_SECRET");
        const pipedreamProjectId = Deno.env.get("PIPEDREAM_PROJECT_ID");

        if (pipedreamClientId && pipedreamClientSecret && pipedreamProjectId) {
          const tokenResponse = await fetch("https://api.pipedream.com/v1/oauth/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              grant_type: "client_credentials",
              client_id: pipedreamClientId,
              client_secret: pipedreamClientSecret,
            }),
          });

          if (tokenResponse.ok) {
            const tokenData = await tokenResponse.json();
            const accessToken = tokenData.access_token;
            const duration = appointment?.duration_minutes || 30;
            const endTime = new Date(newTime.getTime() + duration * 60 * 1000);

            const mcpResponse = await fetch(
              `https://api.pipedream.com/v1/connect/${pipedreamProjectId}/mcp`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                  "x-pd-external-user-id": "system",
                },
                body: JSON.stringify({
                  method: "tools/call",
                  params: {
                    name: "google_calendar-update-event",
                    arguments: {
                      calendarId: "primary",
                      eventId: googleCalendarEventId,
                      // IMPORTANT: Use timeZone: "UTC" since toISOString() produces UTC times
                      // Using "America/New_York" with UTC ISO strings causes a 5-hour offset error
                      start: { dateTime: newTime.toISOString(), timeZone: "UTC" },
                      end: { dateTime: endTime.toISOString(), timeZone: "UTC" },
                      summary: `[RESCHEDULED] ${appointmentType === "inspection" ? "Inspection" : "Discovery Call"} - ${lead?.name || "Guest"}`,
                    },
                  },
                }),
              }
            );

            if (mcpResponse.ok) {
              await supabase
                .from("appointment_reschedule_logs")
                .update({ google_calendar_updated: true })
                .eq("appointment_id", appointmentId)
                .order("created_at", { ascending: false })
                .limit(1);
            }
          }
        }
      } catch (calError) {
        console.error("Error updating Google Calendar:", calError);
      }
    }

    // Send notification if requested
    if (sendNotification && lead) {
      const oldDate = new Date(oldScheduledAt);
      const formattedOldDate = format(oldDate, "EEEE, MMMM d, yyyy");
      const formattedOldTime = format(oldDate, "h:mm a");
      const formattedNewDate = format(newTime, "EEEE, MMMM d, yyyy");
      const formattedNewTime = format(newTime, "h:mm a");
      const isVideoCall = appointment?.meeting_type === "video";
      const rescheduleUrl = `${RESCHEDULE_BASE_URL}/${appointmentId}`;

      // Send email notification
      if (lead.email) {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: [lead.email],
          subject: `📅 Your Appointment Has Been Rescheduled - ${formattedNewDate}`,
          html: `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
              </head>
              <body style="margin: 0; padding: 0; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif;">
                <div style="max-width: 600px; margin: 0 auto; background: #ffffff;">
                  
                  <!-- Header -->
                  <div style="padding: 24px 32px; border-bottom: 2px solid #111111;">
                    <table style="width: 100%;">
                      <tr>
                        <td style="vertical-align: middle;">
                          <img src="${LOGO_URL}" alt="PeachHaus" style="height: 40px; width: auto;" />
                        </td>
                        <td style="text-align: right; vertical-align: middle;">
                          <div style="font-size: 14px; font-weight: 600; color: #f59e0b;">RESCHEDULED</div>
                        </td>
                      </tr>
                    </table>
                  </div>

                  <!-- Content -->
                  <div style="padding: 32px;">
                    <p style="font-size: 14px; color: #111111; margin: 0 0 16px 0;">
                      Hi ${lead.name?.split(" ")[0] || "there"},
                    </p>
                    <p style="font-size: 14px; color: #444444; line-height: 1.6; margin: 0 0 24px 0;">
                      Your upcoming appointment has been rescheduled. Please see the updated details below.
                    </p>

                    <!-- Old Schedule (strikethrough) -->
                    <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin-bottom: 16px; border-left: 4px solid #ef4444;">
                      <p style="margin: 0; font-size: 12px; color: #991b1b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Previous Schedule</p>
                      <p style="margin: 0; font-size: 14px; color: #991b1b; text-decoration: line-through;">
                        ${formattedOldDate} at ${formattedOldTime}
                      </p>
                    </div>

                    <!-- New Schedule (highlighted) -->
                    <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin-bottom: 24px; border-left: 4px solid #16a34a;">
                      <p style="margin: 0; font-size: 12px; color: #166534; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">New Schedule ✓</p>
                      <p style="margin: 0; font-size: 18px; color: #166534; font-weight: 600;">
                        ${formattedNewDate}
                      </p>
                      <p style="margin: 4px 0 0 0; font-size: 16px; color: #166534;">
                        ${formattedNewTime}
                      </p>
                    </div>

                    ${isVideoCall ? `
                    <!-- Video Call Button -->
                    <div style="text-align: center; margin-bottom: 24px;">
                      <a href="${GOOGLE_MEET_LINK}" style="display: inline-block; background: #16a34a; color: white; padding: 14px 32px; text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 6px;">
                        📹 Join Video Call
                      </a>
                      <p style="margin: 8px 0 0 0; font-size: 12px; color: #666666;">${GOOGLE_MEET_LINK}</p>
                    </div>
                    ` : `
                    <p style="text-align: center; font-size: 14px; color: #666666; margin-bottom: 24px;">
                      📞 We will call you at <strong>${lead.phone || "your phone number"}</strong>
                    </p>
                    `}

                    <!-- Add to Calendar -->
                    <div style="text-align: center; margin-bottom: 24px;">
                      <p style="font-size: 13px; color: #666666; margin-bottom: 12px;">Add to your calendar:</p>
                      <a href="https://calendar.google.com/calendar/render?action=TEMPLATE&text=PeachHaus%20Discovery%20Call&dates=${format(newTime, "yyyyMMdd'T'HHmmss")}/${format(new Date(newTime.getTime() + 30 * 60 * 1000), "yyyyMMdd'T'HHmmss")}" 
                         style="display: inline-block; background: #4285f4; color: white; padding: 10px 20px; text-decoration: none; font-size: 13px; border-radius: 4px; margin: 0 4px;">
                        Google Calendar
                      </a>
                    </div>

                    <!-- Reschedule Option -->
                    <div style="text-align: center; padding: 16px; background: #f5f5f5; border-radius: 8px;">
                      <p style="font-size: 12px; color: #666666; margin: 0 0 8px 0;">Need a different time?</p>
                      <a href="${rescheduleUrl}" style="color: #2563eb; font-size: 13px; text-decoration: underline;">
                        Reschedule this appointment
                      </a>
                    </div>
                  </div>

                  <!-- Footer -->
                  <div style="padding: 20px 32px; background: #f9f9f9; border-top: 1px solid #e5e5e5; text-align: center;">
                    <p style="margin: 0; font-size: 12px; color: #666666;">
                      PeachHaus Property Management · Atlanta, Georgia
                    </p>
                    <p style="margin: 8px 0 0 0; font-size: 11px; color: #888888;">
                      (404) 800-5932 · info@peachhausgroup.com
                    </p>
                  </div>
                </div>
              </body>
            </html>
          `,
        });
      }

      // Send SMS notification
      if (lead.phone) {
        try {
          await supabase.functions.invoke("send-sms", {
            body: {
              to: lead.phone,
              message: `📅 PeachHaus: Your appointment has been rescheduled to ${formattedNewDate} at ${formattedNewTime}. ${isVideoCall ? `Join: ${GOOGLE_MEET_LINK}` : "We'll call you!"} Questions? Reply here.`,
            },
          });
        } catch (smsError) {
          console.error("SMS notification failed:", smsError);
        }
      }

      // Update notification status
      await supabase
        .from("appointment_reschedule_logs")
        .update({ notification_sent: true, notification_sent_at: new Date().toISOString() })
        .eq("appointment_id", appointmentId)
        .order("created_at", { ascending: false })
        .limit(1);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Appointment rescheduled successfully",
        newScheduledAt,
        oldScheduledAt,
        notificationSent: sendNotification,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in admin-reschedule-appointment:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Format a date in EST timezone for display
function formatInEST(date: Date): string {
  // Convert to EST/EDT timezone offset (-5 or -4 hours from UTC)
  // For simplicity, we'll format as a readable string
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };
  return date.toLocaleString('en-US', options);
}

function format(date: Date, formatStr: string): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  
  const tokens: Record<string, string> = {
    yyyy: date.getFullYear().toString(),
    MM: pad(date.getMonth() + 1),
    dd: pad(date.getDate()),
    HH: pad(date.getHours()),
    mm: pad(date.getMinutes()),
    ss: pad(date.getSeconds()),
  };

  // Handle special formats
  if (formatStr === "EEEE, MMMM d, yyyy") {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  }

  if (formatStr === "h:mm a") {
    const hours = date.getHours();
    const ampm = hours >= 12 ? "PM" : "AM";
    const h = hours % 12 || 12;
    return `${h}:${pad(date.getMinutes())} ${ampm}`;
  }

  if (formatStr === "MMM d, h:mm a") {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const hours = date.getHours();
    const ampm = hours >= 12 ? "PM" : "AM";
    const h = hours % 12 || 12;
    return `${months[date.getMonth()]} ${date.getDate()}, ${h}:${pad(date.getMinutes())} ${ampm}`;
  }

  if (formatStr === "yyyy-MM-dd HH:mm") {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  if (formatStr.includes("yyyyMMdd'T'HHmmss")) {
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  }

  let result = formatStr;
  for (const [token, value] of Object.entries(tokens)) {
    result = result.replace(token, value);
  }
  return result;
}
