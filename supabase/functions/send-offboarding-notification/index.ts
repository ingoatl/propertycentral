import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OffboardingRequest {
  propertyId: string;
  propertyName: string;
  propertyAddress: string;
  reason: string;
  notes: string;
  offboardedBy: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-offboarding-notification function called");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { propertyId, propertyName, propertyAddress, reason, notes, offboardedBy }: OffboardingRequest = await req.json();
    
    console.log(`Processing offboarding for property: ${propertyName}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get property owner info if available
    let ownerName = "N/A";
    const { data: ownerData } = await supabase
      .from("property_owners")
      .select("name")
      .eq("id", propertyId)
      .maybeSingle();
    
    if (ownerData?.name) {
      ownerName = ownerData.name;
    }

    // Create offboarding task in the property's onboarding project
    const { data: project } = await supabase
      .from("onboarding_projects")
      .select("id")
      .eq("property_id", propertyId)
      .maybeSingle();

    if (project) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);

      await supabase.from("onboarding_tasks").insert({
        project_id: project.id,
        title: "Offboard Property - Disconnect All Platforms",
        description: `Property ${propertyName} has been marked for offboarding. Complete all disconnection tasks.`,
        phase_number: 99,
        phase_title: "Offboarding",
        field_type: "checklist",
        status: "pending",
        due_date: dueDate.toISOString().split("T")[0],
        notes: `
OFFBOARDING CHECKLIST:

□ Remove from PriceLabs
□ Remove from OwnerRez
□ Disconnect from Airbnb (remove PeachHaus access)
□ Disconnect from VRBO (remove PeachHaus access)
□ Disconnect from Booking.com
□ Disconnect from Furnished Finder
□ Remove from CHBO
□ Remove from June Homes
□ Remove from direct booking page
□ Update Google Business listing
□ Archive property in internal systems
□ Notify cleaning team
□ Return any property keys/access devices
□ Final walkthrough documentation

REASON FOR OFFBOARDING: ${reason}
${notes ? `\nADDITIONAL NOTES: ${notes}` : ""}
        `.trim(),
      });
      
      console.log("Offboarding task created successfully");
    }

    // Send email to Alex
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background: linear-gradient(135deg, #f97316, #ea580c); padding: 30px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .property-card { background: #fff8f5; border-left: 4px solid #f97316; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
    .property-name { font-size: 20px; font-weight: bold; color: #1a1a1a; margin-bottom: 5px; }
    .property-address { color: #666; font-size: 14px; }
    .reason-badge { display: inline-block; background: #fee2e2; color: #dc2626; padding: 5px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; margin: 15px 0; }
    .checklist { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .checklist h3 { color: #1a1a1a; margin-top: 0; font-size: 16px; border-bottom: 2px solid #f97316; padding-bottom: 10px; }
    .checklist ul { list-style: none; padding: 0; margin: 0; }
    .checklist li { padding: 10px 0; border-bottom: 1px solid #e5e5e5; display: flex; align-items: center; }
    .checklist li:last-child { border-bottom: none; }
    .checkbox { width: 18px; height: 18px; border: 2px solid #d1d5db; border-radius: 4px; margin-right: 12px; flex-shrink: 0; }
    .notes-section { background: #fffbeb; border: 1px solid #fde68a; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .notes-section h4 { color: #92400e; margin: 0 0 10px 0; font-size: 14px; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
    .urgent-banner { background: #dc2626; color: white; padding: 10px 20px; text-align: center; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="urgent-banner">
      ⚠️ PROPERTY OFFBOARDING REQUIRED
    </div>
    <div class="header">
      <h1>🏠 Property Offboarding Notice</h1>
    </div>
    <div class="content">
      <p>Hi Alex,</p>
      <p>A property has been marked for offboarding and needs to be disconnected from all listing platforms and systems.</p>
      
      <div class="property-card">
        <div class="property-name">${propertyName}</div>
        <div class="property-address">📍 ${propertyAddress}</div>
        <div class="reason-badge">Reason: ${reason}</div>
      </div>

      ${notes ? `
      <div class="notes-section">
        <h4>📝 Additional Notes:</h4>
        <p style="margin: 0; white-space: pre-wrap;">${notes}</p>
      </div>
      ` : ""}

      <div class="checklist">
        <h3>📋 Disconnection Checklist</h3>
        <ul>
          <li><span class="checkbox"></span>Remove from PriceLabs</li>
          <li><span class="checkbox"></span>Remove from OwnerRez</li>
          <li><span class="checkbox"></span>Disconnect from Airbnb (remove PeachHaus access)</li>
          <li><span class="checkbox"></span>Disconnect from VRBO (remove PeachHaus access)</li>
          <li><span class="checkbox"></span>Disconnect from Booking.com</li>
          <li><span class="checkbox"></span>Disconnect from Furnished Finder</li>
          <li><span class="checkbox"></span>Remove from CHBO</li>
          <li><span class="checkbox"></span>Remove from June Homes</li>
          <li><span class="checkbox"></span>Remove from direct booking page</li>
          <li><span class="checkbox"></span>Update Google Business listing</li>
          <li><span class="checkbox"></span>Archive property in internal systems</li>
          <li><span class="checkbox"></span>Notify cleaning team</li>
          <li><span class="checkbox"></span>Return any property keys/access devices</li>
          <li><span class="checkbox"></span>Final walkthrough documentation</li>
        </ul>
      </div>

      <p><strong>Offboarded by:</strong> ${offboardedBy}</p>
      <p><strong>Date:</strong> ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
      
      <p style="margin-top: 30px;">Please complete these tasks within <strong>7 days</strong>. A task has been created in Property Central to track progress.</p>
    </div>
    <div class="footer">
      <p>PeachHaus Group LLC | Property Management</p>
      <p>This is an automated notification from Property Central</p>
    </div>
  </div>
</body>
</html>
    `;

    const emailResponse = await resend.emails.send({
      from: "PeachHaus <notifications@peachhausgroup.com>",
      to: ["alex@peachhausgroup.com"],
      cc: ["info@peachhausgroup.com"],
      subject: `🏠 OFFBOARDING: ${propertyName} - Action Required`,
      html: emailHtml,
    });

    console.log("Offboarding email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, emailResponse }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-offboarding-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
