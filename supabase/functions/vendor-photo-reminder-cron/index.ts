import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Business hours: 8 AM - 6 PM EST
const BUSINESS_HOURS_START = 8;
const BUSINESS_HOURS_END = 18;

// Vendor phone number for SMS
const VENDOR_FROM_NUMBER = "+14045741740";

// Max reminders per phase
const MAX_BEFORE_REMINDERS = 2;
const MAX_AFTER_REMINDERS = 2;

// Hours to wait before sending reminder
const BEFORE_PHOTO_DELAY_HOURS = 2;
const AFTER_PHOTO_DELAY_HOURS = 4;

function formatPhoneE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length > 10) {
    return `+${digits}`;
  }
  return phone;
}

function isBusinessHours(): boolean {
  // Get current EST time
  const now = new Date();
  const estOffset = -5; // EST is UTC-5
  const estHour = (now.getUTCHours() + 24 + estOffset) % 24;
  const dayOfWeek = now.getUTCDay();
  
  // Skip weekends
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }
  
  return estHour >= BUSINESS_HOURS_START && estHour < BUSINESS_HOURS_END;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ghlApiKey = Deno.env.get("GHL_API_KEY");
    const ghlLocationId = Deno.env.get("GHL_LOCATION_ID");
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Running vendor photo reminder cron...");

    // Check if within business hours
    if (!isBusinessHours()) {
      console.log("Outside business hours, skipping reminders");
      return new Response(
        JSON.stringify({
          success: true,
          message: "Outside business hours",
          remindersAttempted: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = {
      beforePhotoReminders: 0,
      afterPhotoReminders: 0,
      errors: [] as string[],
    };

    // Find work orders needing BEFORE photo reminders
    // Status: scheduled, no before photos, assigned > 2 hours ago, < max reminders
    const { data: beforeReminders, error: beforeError } = await supabase
      .from("work_orders")
      .select(`
        id, title, vendor_access_token,
        before_photo_reminder_count, before_photo_reminder_sent_at,
        assigned_at, status,
        property:properties(name, address),
        assigned_vendor:vendors!work_orders_assigned_vendor_id_fkey(id, name, phone)
      `)
      .eq("status", "scheduled")
      .lt("before_photo_reminder_count", MAX_BEFORE_REMINDERS)
      .not("assigned_vendor_id", "is", null)
      .not("vendor_access_token", "is", null);

    if (beforeError) {
      console.error("Error fetching before reminders:", beforeError);
      results.errors.push(beforeError.message);
    }

    // Process before photo reminders
    for (const wo of beforeReminders || []) {
      // Check if enough time has passed since assignment
      const assignedAt = wo.assigned_at ? new Date(wo.assigned_at) : null;
      if (!assignedAt) continue;
      
      const hoursSinceAssignment = (Date.now() - assignedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceAssignment < BEFORE_PHOTO_DELAY_HOURS) continue;

      // Check if we already sent a reminder recently (within 4 hours)
      if (wo.before_photo_reminder_sent_at) {
        const lastReminder = new Date(wo.before_photo_reminder_sent_at);
        const hoursSinceReminder = (Date.now() - lastReminder.getTime()) / (1000 * 60 * 60);
        if (hoursSinceReminder < 4) continue;
      }

      // Check if there are before photos
      const { data: photos } = await supabase
        .from("work_order_photos")
        .select("id")
        .eq("work_order_id", wo.id)
        .eq("photo_type", "before")
        .limit(1);

      if (photos && photos.length > 0) continue; // Already has before photos

      // Send reminder
      const vendor = wo.assigned_vendor as any;
      if (!vendor?.phone) continue;

      const portalUrl = `https://propertycentral.lovable.app/vendor-job/${wo.vendor_access_token}`;
      const propertyName = (wo.property as any)?.name || "the property";
      
      const message = `📸 Reminder: Please take BEFORE photos before starting work at ${propertyName}.

This helps document the original condition and protects both parties.

📱 Upload here: ${portalUrl}`;

      const smsSent = await sendSmsViaGhl(
        vendor.phone,
        message,
        ghlApiKey,
        ghlLocationId,
        vendor.name
      );

      if (smsSent) {
        // Update reminder count
        await supabase
          .from("work_orders")
          .update({
            before_photo_reminder_count: (wo.before_photo_reminder_count || 0) + 1,
            before_photo_reminder_sent_at: new Date().toISOString(),
          })
          .eq("id", wo.id);

        // Log to timeline
        await supabase.from("work_order_timeline").insert({
          work_order_id: wo.id,
          action: "Before photo reminder sent to vendor",
          performed_by_type: "system",
          performed_by_name: "Auto-Reminder",
        });

        results.beforePhotoReminders++;
        console.log(`Sent before photo reminder for WO ${wo.id} to ${vendor.name}`);
      }
    }

    // Find work orders needing AFTER photo reminders
    // Status: in_progress, no after photos, started > 4 hours ago, < max reminders
    const { data: afterReminders, error: afterError } = await supabase
      .from("work_orders")
      .select(`
        id, title, vendor_access_token,
        after_photo_reminder_count, after_photo_reminder_sent_at,
        status, updated_at,
        property:properties(name, address),
        assigned_vendor:vendors!work_orders_assigned_vendor_id_fkey(id, name, phone)
      `)
      .eq("status", "in_progress")
      .lt("after_photo_reminder_count", MAX_AFTER_REMINDERS)
      .not("assigned_vendor_id", "is", null)
      .not("vendor_access_token", "is", null);

    if (afterError) {
      console.error("Error fetching after reminders:", afterError);
      results.errors.push(afterError.message);
    }

    // Process after photo reminders
    for (const wo of afterReminders || []) {
      // Check if enough time has passed since status changed to in_progress
      const updatedAt = wo.updated_at ? new Date(wo.updated_at) : null;
      if (!updatedAt) continue;
      
      const hoursSinceStart = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceStart < AFTER_PHOTO_DELAY_HOURS) continue;

      // Check if we already sent a reminder recently (within 4 hours)
      if (wo.after_photo_reminder_sent_at) {
        const lastReminder = new Date(wo.after_photo_reminder_sent_at);
        const hoursSinceReminder = (Date.now() - lastReminder.getTime()) / (1000 * 60 * 60);
        if (hoursSinceReminder < 4) continue;
      }

      // Check if there are after photos
      const { data: photos } = await supabase
        .from("work_order_photos")
        .select("id")
        .eq("work_order_id", wo.id)
        .eq("photo_type", "after")
        .limit(1);

      if (photos && photos.length > 0) continue; // Already has after photos

      // Send reminder
      const vendor = wo.assigned_vendor as any;
      if (!vendor?.phone) continue;

      const portalUrl = `https://propertycentral.lovable.app/vendor-job/${wo.vendor_access_token}`;
      const propertyName = (wo.property as any)?.name || "the property";
      
      const message = `✅ Reminder: Don't forget to upload AFTER photos showing the completed work at ${propertyName}.

This helps verify the repair and speeds up payment processing!

📱 Upload here: ${portalUrl}`;

      const smsSent = await sendSmsViaGhl(
        vendor.phone,
        message,
        ghlApiKey,
        ghlLocationId,
        vendor.name
      );

      if (smsSent) {
        // Update reminder count
        await supabase
          .from("work_orders")
          .update({
            after_photo_reminder_count: (wo.after_photo_reminder_count || 0) + 1,
            after_photo_reminder_sent_at: new Date().toISOString(),
          })
          .eq("id", wo.id);

        // Log to timeline
        await supabase.from("work_order_timeline").insert({
          work_order_id: wo.id,
          action: "After photo reminder sent to vendor",
          performed_by_type: "system",
          performed_by_name: "Auto-Reminder",
        });

        results.afterPhotoReminders++;
        console.log(`Sent after photo reminder for WO ${wo.id} to ${vendor.name}`);
      }
    }

    // Log cron run
    console.log("Photo reminder cron completed:", results);

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
        totalReminders: results.beforePhotoReminders + results.afterPhotoReminders,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Cron error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper function to send SMS via GoHighLevel
async function sendSmsViaGhl(
  phone: string,
  message: string,
  ghlApiKey?: string,
  ghlLocationId?: string,
  contactName?: string
): Promise<boolean> {
  if (!ghlApiKey || !ghlLocationId) {
    console.log("GHL not configured, skipping SMS");
    return false;
  }

  try {
    const formattedPhone = formatPhoneE164(phone);

    // Find or create contact
    const searchResponse = await fetch(
      `https://services.leadconnectorhq.com/contacts/search/duplicate?locationId=${ghlLocationId}&phone=${encodeURIComponent(formattedPhone)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${ghlApiKey}`,
          Version: "2021-07-28",
          "Content-Type": "application/json",
        },
      }
    );

    let ghlContactId = null;
    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      ghlContactId = searchData.contact?.id;
    }

    if (!ghlContactId) {
      const createResponse = await fetch(
        `https://services.leadconnectorhq.com/contacts/`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${ghlApiKey}`,
            Version: "2021-07-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            locationId: ghlLocationId,
            phone: formattedPhone,
            name: contactName || "Vendor",
          }),
        }
      );

      if (createResponse.ok) {
        const createData = await createResponse.json();
        ghlContactId = createData.contact?.id;
      }
    }

    if (!ghlContactId) {
      console.error("Could not find or create GHL contact");
      return false;
    }

    // Send SMS
    const sendResponse = await fetch(
      `https://services.leadconnectorhq.com/conversations/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ghlApiKey}`,
          Version: "2021-04-15",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "SMS",
          contactId: ghlContactId,
          message,
          fromNumber: VENDOR_FROM_NUMBER,
        }),
      }
    );

    if (sendResponse.ok) {
      console.log("SMS sent successfully");
      return true;
    } else {
      console.error("Failed to send SMS:", await sendResponse.text());
      return false;
    }
  } catch (error) {
    console.error("SMS error:", error);
    return false;
  }
}
