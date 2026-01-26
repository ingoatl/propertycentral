import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Admin phone numbers for call reminders
const ADMIN_CONTACTS = [
  { 
    name: "Ingo", 
    phone: "+17709065022", 
    userId: "8f7c8f43-536f-4587-99dc-5086c144a045" 
  },
  { 
    name: "Anja", 
    phone: "+17709065654", 
    userId: "b2f495ac-2062-446e-bfa0-2197a82114c1" 
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    
    // 5-minute window: 4-6 minutes from now (cron runs every minute)
    const in4Min = new Date(now.getTime() + 4 * 60 * 1000);
    const in6Min = new Date(now.getTime() + 6 * 60 * 1000);

    console.log(`[5min Reminder Cron] Running at ${now.toISOString()}`);
    console.log(`[5min Reminder Cron] Window: ${in4Min.toISOString()} - ${in6Min.toISOString()}`);

    const results = {
      discoveryCallsFound: 0,
      ownerCallsFound: 0,
      teamAppointmentsFound: 0,
      phoneCallsSent: 0,
      alertsCreated: 0,
      errors: [] as string[],
    };

    // Find discovery calls in 5-min window that haven't had 5min reminder sent
    const { data: discoveryCalls, error: dcError } = await supabase
      .from("discovery_calls")
      .select(`
        id,
        scheduled_at,
        google_meet_link,
        meeting_type,
        leads!inner(name, phone, email, property_address)
      `)
      .eq("status", "scheduled")
      .eq("reminder_5min_sent", false)
      .gte("scheduled_at", in4Min.toISOString())
      .lte("scheduled_at", in6Min.toISOString());

    if (dcError) {
      console.error("Error fetching discovery calls:", dcError);
      results.errors.push(`Discovery calls: ${dcError.message}`);
    }

    results.discoveryCallsFound = discoveryCalls?.length || 0;
    console.log(`[5min Reminder] Found ${results.discoveryCallsFound} discovery calls`);

    // Find owner calls in 5-min window
    const { data: ownerCalls, error: ocError } = await supabase
      .from("owner_calls")
      .select(`
        id,
        scheduled_at,
        google_meet_link,
        meeting_type,
        contact_name,
        contact_phone,
        contact_email,
        property_owners(name, properties(name, address))
      `)
      .in("status", ["scheduled", "confirmed"])
      .eq("reminder_5min_sent", false)
      .gte("scheduled_at", in4Min.toISOString())
      .lte("scheduled_at", in6Min.toISOString());

    if (ocError) {
      console.error("Error fetching owner calls:", ocError);
      results.errors.push(`Owner calls: ${ocError.message}`);
    }

    results.ownerCallsFound = ownerCalls?.length || 0;
    console.log(`[5min Reminder] Found ${results.ownerCallsFound} owner calls`);

    // Find team appointments in 5-min window
    const { data: teamAppts, error: taError } = await supabase
      .from("team_appointments")
      .select(`
        id,
        scheduled_at,
        title,
        location,
        contact_name,
        contact_phone,
        properties(name, address)
      `)
      .eq("status", "scheduled")
      .gte("scheduled_at", in4Min.toISOString())
      .lte("scheduled_at", in6Min.toISOString());

    if (taError) {
      console.error("Error fetching team appointments:", taError);
      results.errors.push(`Team appointments: ${taError.message}`);
    }

    results.teamAppointmentsFound = teamAppts?.length || 0;
    console.log(`[5min Reminder] Found ${results.teamAppointmentsFound} team appointments`);

    // Helper function to make phone call via Twilio
    async function makeReminderCall(toPhone: string, message: string): Promise<{ success: boolean; callSid?: string; error?: string }> {
      try {
        const twimlUrl = `${supabaseUrl}/functions/v1/send-voicemail?message=${encodeURIComponent(message)}&isReminder=true`;
        
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Calls.json`;
        const formData = new URLSearchParams();
        formData.append("To", toPhone);
        formData.append("From", twilioPhone);
        formData.append("Url", twimlUrl);
        formData.append("StatusCallback", `${supabaseUrl}/functions/v1/twilio-call-status`);
        formData.append("Timeout", "30");

        const response = await fetch(twilioUrl, {
          method: "POST",
          headers: {
            "Authorization": `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: formData.toString(),
        });

        const result = await response.json();
        
        if (response.ok) {
          console.log(`Phone call initiated: ${result.sid}`);
          return { success: true, callSid: result.sid };
        } else {
          console.error(`Twilio error: ${result.message}`);
          return { success: false, error: result.message };
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`Call error: ${errorMsg}`);
        return { success: false, error: errorMsg };
      }
    }

    // Process discovery calls
    for (const call of discoveryCalls || []) {
      const lead = (call as any).leads;
      const contactName = lead?.name || "Unknown";
      const propertyAddress = lead?.property_address || "";
      const meetingLink = call.google_meet_link;
      const scheduledAt = new Date(call.scheduled_at);
      const timeStr = scheduledAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });

      for (const admin of ADMIN_CONTACTS) {
        // Create in-app alert
        const { error: alertError } = await supabase
          .from("admin_call_alerts")
          .insert({
            call_id: call.id,
            call_type: "discovery",
            admin_user_id: admin.userId,
            admin_phone: admin.phone,
            alert_type: "5min",
            contact_name: contactName,
            property_address: propertyAddress,
            scheduled_at: call.scheduled_at,
            meeting_link: meetingLink,
            phone_number: lead?.phone,
          });

        if (!alertError) {
          results.alertsCreated++;
        }

        // Make phone call reminder
        const message = `Hello ${admin.name}. This is your 5 minute call reminder. You have a discovery call with ${contactName} at ${timeStr}. ${meetingLink ? "A Google Meet link is available in your dashboard." : "Please prepare to call them."}`;
        
        const callResult = await makeReminderCall(admin.phone, message);
        if (callResult.success) {
          results.phoneCallsSent++;
          
          // Update alert with call SID
          await supabase
            .from("admin_call_alerts")
            .update({ phone_call_sent: true, phone_call_sid: callResult.callSid })
            .eq("call_id", call.id)
            .eq("admin_user_id", admin.userId);
        } else {
          results.errors.push(`Call to ${admin.name}: ${callResult.error}`);
        }
      }

      // Mark discovery call as reminded
      await supabase
        .from("discovery_calls")
        .update({ reminder_5min_sent: true })
        .eq("id", call.id);
    }

    // Process owner calls
    for (const call of ownerCalls || []) {
      const contactName = call.contact_name || (call as any).property_owners?.name || "Owner";
      const property = (call as any).property_owners?.properties?.[0];
      const propertyAddress = property?.address || property?.name || "";
      const meetingLink = call.google_meet_link;
      const scheduledAt = new Date(call.scheduled_at);
      const timeStr = scheduledAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });

      for (const admin of ADMIN_CONTACTS) {
        // Create in-app alert
        const { error: alertError } = await supabase
          .from("admin_call_alerts")
          .insert({
            call_id: call.id,
            call_type: "owner",
            admin_user_id: admin.userId,
            admin_phone: admin.phone,
            alert_type: "5min",
            contact_name: contactName,
            property_address: propertyAddress,
            scheduled_at: call.scheduled_at,
            meeting_link: meetingLink,
            phone_number: call.contact_phone,
          });

        if (!alertError) {
          results.alertsCreated++;
        }

        // Make phone call reminder
        const message = `Hello ${admin.name}. This is your 5 minute call reminder. You have an owner call with ${contactName} at ${timeStr}. ${meetingLink ? "A Google Meet link is available in your dashboard." : "Please prepare to call them."}`;
        
        const callResult = await makeReminderCall(admin.phone, message);
        if (callResult.success) {
          results.phoneCallsSent++;
        } else {
          results.errors.push(`Call to ${admin.name}: ${callResult.error}`);
        }
      }

      // Mark owner call as reminded
      await supabase
        .from("owner_calls")
        .update({ reminder_5min_sent: true })
        .eq("id", call.id);
    }

    // Process team appointments (in-app only, no phone for team appointments)
    for (const appt of teamAppts || []) {
      const contactName = appt.contact_name || appt.title || "Appointment";
      const property = (appt as any).properties;
      const propertyAddress = property?.address || property?.name || appt.location || "";

      // Only create alerts for the assigned user (if we had that info)
      // For now, alert all admins
      for (const admin of ADMIN_CONTACTS) {
        const { error: alertError } = await supabase
          .from("admin_call_alerts")
          .insert({
            call_id: appt.id,
            call_type: "team_appointment",
            admin_user_id: admin.userId,
            admin_phone: admin.phone,
            alert_type: "5min",
            contact_name: contactName,
            property_address: propertyAddress,
            scheduled_at: appt.scheduled_at,
            phone_number: appt.contact_phone,
          });

        if (!alertError) {
          results.alertsCreated++;
        }
      }
    }

    console.log(`[5min Reminder] Complete:`, results);

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
        timestamp: now.toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in call-reminder-5min-cron:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
