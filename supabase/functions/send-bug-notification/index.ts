import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BugNotificationRequest {
  type: "new_bug" | "bug_resolved";
  bugId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, bugId }: BugNotificationRequest = await req.json();
    console.log("Processing bug notification:", { type, bugId });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch bug report with related data
    const { data: bug, error: bugError } = await supabase
      .from("bug_reports")
      .select(`
        *,
        submitted_by_profile:profiles!bug_reports_submitted_by_fkey(first_name, email),
        resolved_by_profile:profiles!bug_reports_resolved_by_fkey(first_name, email),
        property:properties(name),
        project:onboarding_projects(property_address),
        task:onboarding_tasks(title)
      `)
      .eq("id", bugId)
      .single();

    if (bugError || !bug) {
      throw new Error(`Bug report not found: ${bugError?.message}`);
    }

    console.log("Bug report data:", bug);

    if (type === "new_bug") {
      // Send email to admin
      const priorityEmoji = {
        critical: "🔴",
        high: "🟠",
        medium: "🟡",
        low: "🟢",
      }[bug.priority] || "🔵";

      let contextHtml = "";
      if (bug.property) {
        contextHtml += `<p><strong>Property:</strong> ${bug.property.name}</p>`;
      }
      if (bug.project) {
        contextHtml += `<p><strong>Project:</strong> ${bug.project.property_address}</p>`;
      }
      if (bug.task) {
        contextHtml += `<p><strong>Task:</strong> ${bug.task.title}</p>`;
      }

      let loomHtml = "";
      if (bug.loom_video_url) {
        const loomEmbedUrl = bug.loom_video_url.replace("/share/", "/embed/");
        loomHtml = `
          <div style="margin: 20px 0;">
            <p><strong>Video Documentation:</strong></p>
            <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; background: #000;">
              <iframe 
                src="${loomEmbedUrl}" 
                frameborder="0" 
                webkitallowfullscreen 
                mozallowfullscreen 
                allowfullscreen 
                style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;">
              </iframe>
            </div>
            <p style="margin-top: 10px;"><a href="${bug.loom_video_url}" style="color: #0066cc;">View in Loom →</a></p>
          </div>
        `;
      }

      const emailResponse = await resend.emails.send({
        from: "PeachHaus <onboarding@resend.dev>",
        to: ["ingo@peachhausgroup.com"],
        subject: `🐛 New Bug Report: ${bug.title}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>🐛 New Bug Report</h2>
            <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin: 16px 0;">
              <h3>${priorityEmoji} ${bug.title}</h3>
              <p style="margin: 4px 0;"><strong>Priority:</strong> ${bug.priority.toUpperCase()}</p>
            </div>
            
            <p><strong>Submitted by:</strong> ${bug.submitted_by_profile?.first_name || "Unknown"} (${bug.submitted_by_profile?.email})</p>
            <p><strong>Date:</strong> ${new Date(bug.submitted_at).toLocaleString()}</p>
            
            ${contextHtml}
            
            <div style="margin: 20px 0;">
              <p><strong>Description:</strong></p>
              <p style="white-space: pre-wrap; background: #f9fafb; padding: 12px; border-radius: 4px;">${bug.description}</p>
            </div>
            
            ${loomHtml}
            
            <div style="margin-top: 30px;">
              <a href="${Deno.env.get("SUPABASE_URL")}" 
                 style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
                View in Bug Tracker →
              </a>
            </div>
          </div>
        `,
      });

      console.log("Admin email sent:", emailResponse);

    } else if (type === "bug_resolved") {
      // Send email to user
      const emailResponse = await resend.emails.send({
        from: "PeachHaus <onboarding@resend.dev>",
        to: [bug.submitted_by_profile?.email || ""],
        subject: `✅ Your Bug Report Has Been Resolved: ${bug.title}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>✅ Your Bug Report Has Been Resolved!</h2>
            <p>Hi ${bug.submitted_by_profile?.first_name || "there"},</p>
            <p>Great news! The bug you reported has been resolved.</p>
            
            <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 16px; margin: 16px 0;">
              <h3>${bug.title}</h3>
            </div>
            
            <div style="margin: 20px 0;">
              <p><strong>Your Report:</strong></p>
              <p style="white-space: pre-wrap; background: #f9fafb; padding: 12px; border-radius: 4px;">${bug.description}</p>
            </div>
            
            <div style="margin: 20px 0;">
              <p><strong>Resolution:</strong></p>
              <p style="white-space: pre-wrap; background: #f0fdf4; padding: 12px; border-radius: 4px;">${bug.resolution_notes || "Bug has been fixed."}</p>
            </div>
            
            <p><strong>Resolved by:</strong> ${bug.resolved_by_profile?.first_name || "Admin"}</p>
            <p><strong>Resolution Date:</strong> ${new Date(bug.resolved_at).toLocaleString()}</p>
            
            <p style="margin-top: 30px;">Thank you for helping us improve the platform!</p>
            <p>Best regards,<br>The PeachHaus Team</p>
          </div>
        `,
      });

      console.log("User email sent:", emailResponse);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-bug-notification:", error);
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
