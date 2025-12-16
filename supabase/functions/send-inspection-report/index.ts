import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InspectionReportRequest {
  inspectionId: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { inspectionId }: InspectionReportRequest = await req.json();

    if (!inspectionId) {
      throw new Error("Missing inspectionId");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch inspection with property
    const { data: inspection, error: inspectionError } = await supabase
      .from("inspections")
      .select(`
        *,
        property:properties(id, name, address)
      `)
      .eq("id", inspectionId)
      .single();

    if (inspectionError) throw inspectionError;

    // Fetch responses
    const { data: responses, error: responsesError } = await supabase
      .from("inspection_responses")
      .select("*")
      .eq("inspection_id", inspectionId);

    if (responsesError) throw responsesError;

    // Fetch issues
    const { data: issues, error: issuesError } = await supabase
      .from("inspection_issues")
      .select("*")
      .eq("inspection_id", inspectionId);

    if (issuesError) throw issuesError;

    // Fetch photos
    const { data: photos, error: photosError } = await supabase
      .from("inspection_photos")
      .select("*")
      .eq("inspection_id", inspectionId);

    if (photosError) throw photosError;

    // Build email HTML
    const propertyName = inspection.property?.name || "Unknown Property";
    const propertyAddress = inspection.property?.address || "N/A";
    const inspectorName = inspection.inspector_name || "Unknown";
    const remarks = inspection.notes || "No remarks provided";
    const inspectionDate = new Date(inspection.created_at).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Group responses by pass/fail
    const passedItems = responses?.filter((r) => r.value_bool === true) || [];
    const failedItems = responses?.filter((r) => r.value_bool === false) || [];

    // Build photo HTML
    const photoHtml = photos?.length
      ? photos
          .map(
            (p) => `
          <div style="margin: 10px 0;">
            <img src="${p.photo_url}" alt="${p.field_key || 'Inspection photo'}" 
              style="max-width: 300px; border-radius: 8px; border: 1px solid #e5e7eb;" />
            <p style="margin: 4px 0; font-size: 12px; color: #6b7280;">
              ${p.field_key ? p.field_key.replace(/_/g, " ") : "Photo"} 
              ${p.caption ? `- ${p.caption}` : ""}
            </p>
          </div>
        `
          )
          .join("")
      : "<p>No photos captured</p>";

    // Build issues HTML
    const issuesHtml = issues?.length
      ? issues
          .map(
            (issue) => `
          <div style="padding: 12px; background: #fef2f2; border-radius: 8px; margin: 8px 0;">
            <p style="font-weight: 600; color: #dc2626; margin: 0;">${issue.title}</p>
            ${issue.detail ? `<p style="margin: 4px 0 0; color: #374151;">${issue.detail}</p>` : ""}
            <p style="margin: 4px 0 0; font-size: 12px; color: #6b7280;">
              Severity: ${issue.severity} | Responsible: ${issue.responsible_party === 'pm' ? 'PM' : issue.responsible_party}
            </p>
          </div>
        `
          )
          .join("")
      : "<p style='color: #22c55e;'>No issues found</p>";

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Inspection Report - ${propertyName}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; max-width: 700px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">🏠 Inspection Report</h1>
          <p style="margin: 8px 0 0; opacity: 0.9;">${propertyName}</p>
        </div>
        
        <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: 0;">
          <table style="width: 100%; font-size: 14px;">
            <tr>
              <td style="padding: 4px 0;"><strong>Property:</strong></td>
              <td>${propertyName}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0;"><strong>Address:</strong></td>
              <td>${propertyAddress}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0;"><strong>Inspector:</strong></td>
              <td>${inspectorName}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0;"><strong>Date:</strong></td>
              <td>${inspectionDate}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0;"><strong>Status:</strong></td>
              <td>${inspection.status === 'completed' ? '✅ Completed' : '🔄 In Progress'}</td>
            </tr>
          </table>
        </div>
        
        <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: 0;">
          <h2 style="font-size: 18px; margin: 0 0 12px;">📝 Inspector Remarks</h2>
          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px;">
            <p style="margin: 0; white-space: pre-wrap;">${remarks}</p>
          </div>
        </div>
        
        <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: 0;">
          <h2 style="font-size: 18px; margin: 0 0 12px;">📊 Summary</h2>
          <div style="display: flex; gap: 16px;">
            <div style="flex: 1; background: #dcfce7; padding: 16px; border-radius: 8px; text-align: center;">
              <p style="margin: 0; font-size: 28px; font-weight: bold; color: #16a34a;">${passedItems.length}</p>
              <p style="margin: 4px 0 0; font-size: 14px; color: #15803d;">Passed</p>
            </div>
            <div style="flex: 1; background: #fef2f2; padding: 16px; border-radius: 8px; text-align: center;">
              <p style="margin: 0; font-size: 28px; font-weight: bold; color: #dc2626;">${failedItems.length}</p>
              <p style="margin: 4px 0 0; font-size: 14px; color: #b91c1c;">Failed</p>
            </div>
            <div style="flex: 1; background: #fef3c7; padding: 16px; border-radius: 8px; text-align: center;">
              <p style="margin: 0; font-size: 28px; font-weight: bold; color: #d97706;">${issues?.length || 0}</p>
              <p style="margin: 4px 0 0; font-size: 14px; color: #b45309;">Issues</p>
            </div>
          </div>
        </div>
        
        <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: 0;">
          <h2 style="font-size: 18px; margin: 0 0 12px;">⚠️ Issues Found</h2>
          ${issuesHtml}
        </div>
        
        <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: 0;">
          <h2 style="font-size: 18px; margin: 0 0 12px;">✅ Passed Items (${passedItems.length})</h2>
          <div style="font-size: 14px;">
            ${passedItems.map((r) => `<span style="display: inline-block; background: #dcfce7; color: #15803d; padding: 4px 8px; border-radius: 4px; margin: 2px; font-size: 12px;">✓ ${r.field_key.replace(/_/g, " ")}</span>`).join("")}
          </div>
        </div>
        
        <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: 0;">
          <h2 style="font-size: 18px; margin: 0 0 12px;">❌ Failed Items (${failedItems.length})</h2>
          <div style="font-size: 14px;">
            ${failedItems.length ? failedItems.map((r) => `<span style="display: inline-block; background: #fef2f2; color: #dc2626; padding: 4px 8px; border-radius: 4px; margin: 2px; font-size: 12px;">✗ ${r.field_key.replace(/_/g, " ")}</span>`).join("") : "<p style='color: #22c55e;'>All items passed!</p>"}
          </div>
        </div>
        
        <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: 0; border-radius: 0 0 12px 12px;">
          <h2 style="font-size: 18px; margin: 0 0 12px;">📸 Photos (${photos?.length || 0})</h2>
          ${photoHtml}
        </div>
        
        <p style="text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px;">
          This report was generated by PeachHaus Property Central
        </p>
      </body>
      </html>
    `;

    // Send email using Resend API directly
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "PeachHaus Inspections <info@peachhausgroup.com>",
        to: ["info@peachhausgroup.com"],
        subject: `Inspection Report: ${propertyName} - ${inspectionDate}`,
        html: emailHtml,
      }),
    });

    const emailResult = await emailResponse.json();

    console.log("Inspection report email sent:", emailResult);

    return new Response(
      JSON.stringify({ success: true, emailId: emailResult.id }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error sending inspection report:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
