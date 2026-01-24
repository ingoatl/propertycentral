import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VENDOR_FROM_NUMBER = "+14045741740";

function formatPhoneE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length > 10) return `+${digits}`;
  return phone;
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

    console.log("Running vendor follow-up reminder check...");

    // Find work orders dispatched ~1 hour ago that haven't been started
    // (vendor hasn't clicked the portal link or uploaded before photos)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const { data: workOrdersNeedingFollowup, error: queryError } = await supabase
      .from("work_orders")
      .select(`
        id,
        work_order_number,
        title,
        description,
        vendor_access_token,
        assigned_at,
        vendor_viewed_at,
        followup_reminder_sent_at,
        property:properties(name, address),
        vendor:vendors!work_orders_assigned_vendor_id_fkey(id, name, phone, email)
      `)
      .eq("status", "dispatched")
      .is("vendor_viewed_at", null)
      .is("followup_reminder_sent_at", null)
      .not("assigned_vendor_id", "is", null)
      .not("vendor_access_token", "is", null)
      .lte("assigned_at", oneHourAgo.toISOString())
      .gte("assigned_at", twoHoursAgo.toISOString());

    if (queryError) {
      console.error("Error querying work orders:", queryError);
      throw queryError;
    }

    console.log(`Found ${workOrdersNeedingFollowup?.length || 0} work orders needing follow-up`);

    const results = {
      checked: workOrdersNeedingFollowup?.length || 0,
      reminded: 0,
      errors: [] as string[],
    };

    if (!ghlApiKey || !ghlLocationId) {
      console.log("GHL credentials not configured, skipping follow-up reminders");
      return new Response(
        JSON.stringify({ success: true, message: "GHL not configured", results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    for (const workOrder of workOrdersNeedingFollowup || []) {
      // Handle array relations from Supabase joins
      const vendor = Array.isArray(workOrder.vendor) ? workOrder.vendor[0] : workOrder.vendor;
      const property = Array.isArray(workOrder.property) ? workOrder.property[0] : workOrder.property;

      if (!vendor?.phone) {
        console.log(`Work order ${workOrder.work_order_number}: No vendor phone`);
        continue;
      }

      try {
        const formattedPhone = formatPhoneE164(vendor.phone);
        const portalUrl = `https://propertycentral.lovable.app/vendor-job/${workOrder.vendor_access_token}`;
        const propertyAddress = property?.address || property?.name || "the property";

        // Professional follow-up message with clear instructions
        const followupMessage = `Hi ${vendor.name?.split(' ')[0] || 'there'},

Just following up on the work order we sent over 1 hour ago.

📍 Location: ${propertyAddress}
🔧 Issue: ${workOrder.title}

📱 IMPORTANT: Please complete ALL documentation through this link ONLY:
${portalUrl}

To get started:
1. Click the link above
2. Tap "Start Job" button
3. Upload BEFORE photos (required to begin work)
4. Complete the repair
5. Upload AFTER photos showing the fixed condition

⚠️ Please do NOT send photos or videos via text message - all media must be uploaded through the job portal link above. This ensures proper documentation and faster payment processing.

Questions? Just reply to this text.

Thank you!
- PeachHaus Property Team`;

        // Find or create GHL contact
        let ghlContactId = null;
        
        const searchResponse = await fetch(
          `https://services.leadconnectorhq.com/contacts/search/duplicate?locationId=${ghlLocationId}&phone=${encodeURIComponent(formattedPhone)}`,
          {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${ghlApiKey}`,
              "Version": "2021-07-28",
              "Content-Type": "application/json",
            },
          }
        );

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
                "Authorization": `Bearer ${ghlApiKey}`,
                "Version": "2021-07-28",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                locationId: ghlLocationId,
                phone: formattedPhone,
                name: vendor.name || "Vendor",
                email: vendor.email || undefined,
              }),
            }
          );

          if (createResponse.ok) {
            const createData = await createResponse.json();
            ghlContactId = createData.contact?.id;
          }
        }

        if (ghlContactId) {
          const sendResponse = await fetch(
            `https://services.leadconnectorhq.com/conversations/messages`,
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${ghlApiKey}`,
                "Version": "2021-04-15",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                type: "SMS",
                contactId: ghlContactId,
                message: followupMessage,
                fromNumber: VENDOR_FROM_NUMBER,
              }),
            }
          );

          if (sendResponse.ok) {
            console.log(`Follow-up SMS sent to vendor ${vendor.name} for WO-${workOrder.work_order_number}`);
            
            // Mark as follow-up sent
            await supabase
              .from("work_orders")
              .update({ followup_reminder_sent_at: new Date().toISOString() })
              .eq("id", workOrder.id);

            // Log to timeline
            await supabase.from("work_order_timeline").insert({
              work_order_id: workOrder.id,
              action: `Follow-up reminder SMS sent to ${vendor.name} (1 hour after dispatch)`,
              performed_by_type: "system",
              performed_by_name: "Automated Follow-up System",
            });

            // Log to lead_communications
            const sendData = await sendResponse.json();
            await supabase.from("lead_communications").insert({
              communication_type: "sms",
              direction: "outbound",
              body: followupMessage,
              status: "sent",
              external_id: sendData.messageId || sendData.conversationId,
              ghl_conversation_id: sendData.conversationId,
              metadata: {
                provider: "gohighlevel",
                ghl_contact_id: ghlContactId,
                from_number: VENDOR_FROM_NUMBER,
                to_number: formattedPhone,
                vendor_id: vendor.id,
                vendor_phone: formattedPhone,
                contact_type: "vendor",
                work_order_id: workOrder.id,
                reminder_type: "1_hour_followup",
              },
            });

            await supabase.from("sms_log").insert({
              phone_number: vendor.phone,
              message_type: "vendor_followup_reminder",
              message_body: followupMessage,
              ghl_message_id: sendData.messageId,
              status: "sent",
            });

            results.reminded++;
          } else {
            const errorText = await sendResponse.text();
            console.error(`Failed to send follow-up SMS for WO-${workOrder.work_order_number}:`, errorText);
            results.errors.push(`WO-${workOrder.work_order_number}: ${errorText}`);
          }
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error processing WO-${workOrder.work_order_number}:`, error);
        results.errors.push(`WO-${workOrder.work_order_number}: ${errorMessage}`);
      }
    }

    console.log(`Follow-up reminder results: ${results.reminded} sent, ${results.errors.length} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent ${results.reminded} follow-up reminders`,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in vendor follow-up reminder:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
