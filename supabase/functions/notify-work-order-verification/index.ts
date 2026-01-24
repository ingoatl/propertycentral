import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const ALEX_EMAIL = "alex@peachhaus.co";
const ALEX_NAME = "Alex";

interface NotificationPayload {
  workOrderId: string;
  workOrderNumber: string;
  title: string;
  propertyName: string;
  vendorName: string;
  photoCount: number;
  videoCount: number;
  vendorNotes?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { workOrderId } = body;

    if (!workOrderId) {
      return new Response(
        JSON.stringify({ success: false, error: "workOrderId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing verification notification for work order: ${workOrderId}`);

    // Fetch work order details with photos
    const { data: workOrder, error: woError } = await supabase
      .from("work_orders")
      .select(`
        id,
        work_order_number,
        title,
        description,
        vendor_notes,
        property:properties(id, name, address),
        vendor:vendors!work_orders_assigned_vendor_id_fkey(id, name)
      `)
      .eq("id", workOrderId)
      .maybeSingle();

    if (woError || !workOrder) {
      console.error("Error fetching work order:", woError);
      throw new Error("Work order not found");
    }

    // Fetch media uploaded for this work order
    const { data: media, error: mediaError } = await supabase
      .from("work_order_photos")
      .select("*")
      .eq("work_order_id", workOrderId);

    if (mediaError) {
      console.error("Error fetching media:", mediaError);
    }

    const photos = media?.filter(m => m.media_type !== 'video') || [];
    const videos = media?.filter(m => m.media_type === 'video') || [];
    const beforePhotos = photos.filter(p => p.photo_type === 'before');
    const afterPhotos = photos.filter(p => p.photo_type === 'after');

    // Handle array relations
    const property = Array.isArray(workOrder.property) ? workOrder.property[0] : workOrder.property;
    const vendor = Array.isArray(workOrder.vendor) ? workOrder.vendor[0] : workOrder.vendor;

    const propertyName = property?.name || property?.address || "Unknown Property";
    const vendorName = vendor?.name || "Vendor";

    // 1. Send Team Hub Message to Alex
    console.log("Sending Team Hub notification...");

    // Find Alex's user ID
    const { data: alexProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", ALEX_EMAIL)
      .maybeSingle();

    if (alexProfile) {
      // Find or create a notifications channel
      let { data: notifChannel } = await supabase
        .from("team_channels")
        .select("id")
        .eq("name", "work-order-alerts")
        .maybeSingle();

      if (!notifChannel) {
        // Create the channel if it doesn't exist
        const { data: newChannel } = await supabase
          .from("team_channels")
          .insert({
            name: "work-order-alerts",
            description: "Automated notifications for work order verification",
            is_private: false,
            created_by: alexProfile.id,
          })
          .select()
          .single();
        notifChannel = newChannel;
      }

      if (notifChannel) {
        // Send the team message
        const teamMessage = `🔔 **Work Order Verification Required**

📋 **WO-${workOrder.work_order_number}**: ${workOrder.title}
📍 **Property**: ${propertyName}
👷 **Vendor**: ${vendorName}

**Media Submitted:**
• 📷 Before Photos: ${beforePhotos.length}
• 📷 After Photos: ${afterPhotos.length}
• 🎥 Videos: ${videos.length}

${workOrder.vendor_notes ? `**Vendor Notes:** ${workOrder.vendor_notes}` : ''}

Please review the submitted photos and videos to verify the work was completed correctly.

[View Work Order →](/maintenance?wo=${workOrderId})`;

        await supabase.from("team_messages").insert({
          channel_id: notifChannel.id,
          sender_id: alexProfile.id, // System notification
          content: teamMessage,
          work_order_id: workOrderId,
        });

        console.log("Team Hub message sent successfully");
      }
    }

    // 2. Send Email to Alex
    if (RESEND_API_KEY) {
      console.log("Sending email notification...");

      const portalUrl = `https://propertycentral.lovable.app/maintenance?wo=${workOrderId}`;
      
      // Build photo thumbnails HTML
      const photoThumbnailsHtml = afterPhotos.slice(0, 4).map(p => `
        <div style="display: inline-block; margin: 5px; border-radius: 8px; overflow: hidden;">
          <img src="${p.photo_url}" alt="After photo" style="width: 120px; height: 120px; object-fit: cover;" />
        </div>
      `).join('');

      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; }
    .content { background: #fff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px; }
    .badge { display: inline-block; background: #fbbf24; color: #1a1a2e; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .stat-box { display: inline-block; background: #f3f4f6; padding: 15px 20px; border-radius: 8px; margin: 5px; text-align: center; min-width: 80px; }
    .stat-number { font-size: 24px; font-weight: bold; color: #1a1a2e; }
    .stat-label { font-size: 12px; color: #6b7280; }
    .btn { display: inline-block; background: #f59e0b; color: #1a1a2e; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; margin-top: 20px; }
    .photos { margin: 20px 0; }
    .notes { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="badge">🔍 Verification Required</div>
      <h1 style="margin: 15px 0 5px;">Work Order Ready for Review</h1>
      <p style="margin: 0; opacity: 0.8;">WO-${workOrder.work_order_number}</p>
    </div>
    <div class="content">
      <h2 style="margin-top: 0;">${workOrder.title}</h2>
      <p><strong>📍 Property:</strong> ${propertyName}</p>
      <p><strong>👷 Vendor:</strong> ${vendorName}</p>
      
      <div style="margin: 25px 0;">
        <div class="stat-box">
          <div class="stat-number">${beforePhotos.length}</div>
          <div class="stat-label">Before Photos</div>
        </div>
        <div class="stat-box">
          <div class="stat-number">${afterPhotos.length}</div>
          <div class="stat-label">After Photos</div>
        </div>
        <div class="stat-box">
          <div class="stat-number">${videos.length}</div>
          <div class="stat-label">Videos</div>
        </div>
      </div>

      ${afterPhotos.length > 0 ? `
      <div class="photos">
        <p style="font-weight: 600; margin-bottom: 10px;">📸 After Photos Preview:</p>
        ${photoThumbnailsHtml}
        ${afterPhotos.length > 4 ? `<p style="color: #6b7280; font-size: 14px;">+ ${afterPhotos.length - 4} more photos</p>` : ''}
      </div>
      ` : ''}

      ${workOrder.vendor_notes ? `
      <div class="notes">
        <p style="font-weight: 600; margin: 0 0 5px;">📝 Vendor Notes:</p>
        <p style="margin: 0;">${workOrder.vendor_notes}</p>
      </div>
      ` : ''}

      <p>Please review the submitted photos and videos to verify the work was completed correctly.</p>
      
      <a href="${portalUrl}" class="btn">Review Work Order →</a>
      
      <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
        This is an automated notification from PeachHaus Property Central.
      </p>
    </div>
  </div>
</body>
</html>`;

      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "PeachHaus <notifications@peachhaus.co>",
          to: [ALEX_EMAIL],
          subject: `🔔 Verify Work Order WO-${workOrder.work_order_number}: ${workOrder.title}`,
          html: emailHtml,
        }),
      });

      if (emailResponse.ok) {
        console.log("Email sent successfully to Alex");
      } else {
        const errText = await emailResponse.text();
        console.error("Failed to send email:", errText);
      }
    } else {
      console.log("RESEND_API_KEY not configured, skipping email");
    }

    // Log to work order timeline
    await supabase.from("work_order_timeline").insert({
      work_order_id: workOrderId,
      action: `Verification notification sent to ${ALEX_NAME} (Team Hub + Email)`,
      performed_by_type: "system",
      performed_by_name: "Automated Verification System",
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Verification notification sent",
        teamHubSent: !!alexProfile,
        emailSent: !!RESEND_API_KEY,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in verification notification:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
