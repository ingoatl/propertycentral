import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
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
      .select("*")
      .eq("id", bugId)
      .single();

    if (bugError || !bug) {
      throw new Error(`Bug report not found: ${bugError?.message}`);
    }

    // Fetch user profiles separately
    const { data: submittedByProfile } = await supabase
      .from("profiles")
      .select("first_name, email")
      .eq("id", bug.submitted_by)
      .single();

    let resolvedByProfile = null;
    if (bug.resolved_by) {
      const { data } = await supabase
        .from("profiles")
        .select("first_name, email")
        .eq("id", bug.resolved_by)
        .single();
      resolvedByProfile = data;
    }

    // Fetch property, project, task if referenced
    let property = null;
    let project = null;
    let task = null;

    if (bug.property_id) {
      const { data } = await supabase
        .from("properties")
        .select("name")
        .eq("id", bug.property_id)
        .single();
      property = data;
    }

    if (bug.project_id) {
      const { data } = await supabase
        .from("onboarding_projects")
        .select("property_address")
        .eq("id", bug.project_id)
        .single();
      project = data;
    }

    if (bug.task_id) {
      const { data } = await supabase
        .from("onboarding_tasks")
        .select("title")
        .eq("id", bug.task_id)
        .single();
      task = data;
    }

    console.log("Bug report data:", bug);

    if (type === "new_bug") {
      // Send email to admin
      const priorityEmoji: Record<string, string> = {
        critical: "🔴",
        high: "🟠",
        medium: "🟡",
        low: "🟢",
      };

      const priorityColor: Record<string, string> = {
        critical: "#dc2626",
        high: "#ea580c",
        medium: "#f59e0b",
        low: "#84cc16",
      };

      let contextHtml = "";
      if (property) {
        contextHtml += `<p style="margin: 4px 0;"><strong>Property:</strong> ${property.name}</p>`;
      }
      if (project) {
        contextHtml += `<p style="margin: 4px 0;"><strong>Project:</strong> ${project.property_address}</p>`;
      }
      if (task) {
        contextHtml += `<p style="margin: 4px 0;"><strong>Task:</strong> ${task.title}</p>`;
      }

      let loomHtml = "";
      if (bug.loom_video_url) {
        loomHtml = `
          <div style="margin: 20px 0;">
            <p style="margin-bottom: 8px;"><strong>🎥 Video Documentation:</strong></p>
            <a href="${bug.loom_video_url}" 
               style="display: inline-block; color: #2563eb; text-decoration: none; font-weight: 600; font-size: 16px;">
              View Loom Video →
            </a>
          </div>
        `;
      }

      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <div style="padding: 40px 40px 20px;">
            <h1 style="color: #1f2937; font-size: 32px; font-weight: bold; margin: 0 0 20px;">🐛 New Bug Report</h1>
          </div>
          
          <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 20px 40px; margin: 0;">
            <h2 style="color: #1f2937; font-size: 24px; font-weight: bold; margin: 0 0 12px;">
              ${priorityEmoji[bug.priority] || "🔵"} ${bug.title}
            </h2>
            <span style="display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; color: #ffffff; letter-spacing: 0.5px; background-color: ${priorityColor[bug.priority] || "#6b7280"};">
              ${bug.priority.toUpperCase()} PRIORITY
            </span>
          </div>

          <div style="padding: 24px 40px 0;">
            <p style="margin: 0 0 4px; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Submitted by:</p>
            <p style="margin: 0 0 16px; color: #1f2937; font-size: 14px;">${submittedByProfile?.first_name || "Unknown"} (${submittedByProfile?.email})</p>
            
            <p style="margin: 0 0 4px; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Date:</p>
            <p style="margin: 0 0 16px; color: #1f2937; font-size: 14px;">${new Date(bug.submitted_at).toLocaleString()}</p>
          </div>

          ${contextHtml ? `
          <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 20px 40px; margin: 24px 0 0;">
            <p style="margin: 0 0 4px; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Context:</p>
            ${contextHtml}
          </div>
          ` : ''}

          <div style="padding: 24px 40px 0;">
            <p style="margin: 0 0 8px; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Description:</p>
            <div style="background: #f9fafb; padding: 16px; border-radius: 6px; border: 1px solid #e5e7eb;">
              <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${bug.description}</p>
            </div>
          </div>

          ${loomHtml}

          <div style="padding: 32px 40px;">
            <a href="https://app.peachhausgroup.com/admin" 
               style="display: block; background: #2563eb; color: #ffffff; text-align: center; padding: 14px 24px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">
              View in Bug Tracker →
            </a>
          </div>

          <div style="padding: 0 40px 40px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; line-height: 16px; margin: 32px 0 0;">
              This is an automated notification from PeachHaus Group bug tracking system.
            </p>
          </div>
        </div>
      `;

      const emailResponse = await resend.emails.send({
        from: "PeachHaus <onboarding@resend.dev>",
        to: ["ingo@peachhausgroup.com"],
        subject: `🐛 New Bug Report: ${bug.title}`,
        html: emailHtml,
      });

      console.log("Admin email sent:", emailResponse);

    } else if (type === "bug_resolved") {
      // Send email to user
      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <div style="padding: 40px 40px 20px;">
            <h1 style="color: #1f2937; font-size: 32px; font-weight: bold; margin: 0 0 20px;">✅ Bug Resolved!</h1>
            <p style="color: #1f2937; font-size: 16px; line-height: 24px; margin: 0 0 16px;">Hi ${submittedByProfile?.first_name || "there"},</p>
            <p style="color: #374151; font-size: 16px; line-height: 24px; margin: 0 0 24px;">Great news! The bug you reported has been resolved.</p>
          </div>

          <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 20px 40px; margin: 0;">
            <h2 style="color: #1f2937; font-size: 20px; font-weight: bold; margin: 0;">${bug.title}</h2>
          </div>

          <div style="padding: 24px 40px 0;">
            <p style="margin: 0 0 8px; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Your Report:</p>
            <div style="background: #f9fafb; padding: 16px; border-radius: 6px; border: 1px solid #e5e7eb;">
              <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${bug.description}</p>
            </div>
          </div>

          <div style="padding: 24px 40px 0;">
            <p style="margin: 0 0 8px; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Resolution:</p>
            <div style="background: #f0fdf4; padding: 16px; border-radius: 6px; border: 1px solid #bbf7d0;">
              <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${bug.resolution_notes || "Bug has been fixed."}</p>
            </div>
          </div>

          <div style="padding: 24px 40px 0;">
            <p style="margin: 0 0 4px; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Resolved by:</p>
            <p style="margin: 0 0 16px; color: #1f2937; font-size: 14px;">${resolvedByProfile?.first_name || "Admin"}</p>
            
            <p style="margin: 0 0 4px; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Resolution Date:</p>
            <p style="margin: 0 0 16px; color: #1f2937; font-size: 14px;">${new Date(bug.resolved_at).toLocaleString()}</p>
          </div>

          <div style="padding: 32px 40px 24px;">
            <p style="color: #374151; font-size: 16px; line-height: 24px; margin: 0;">
              Thank you for helping us improve the platform! Your feedback helps us create a better experience for everyone.
            </p>
          </div>

          <div style="padding: 0 40px 32px;">
            <p style="color: #374151; font-size: 16px; line-height: 24px; margin: 0;">
              Best regards,<br>The PeachHaus Team
            </p>
          </div>

          <div style="padding: 0 40px 40px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; line-height: 16px; margin: 32px 0 0;">
              If you have any questions about this resolution, please don't hesitate to reach out.
            </p>
          </div>
        </div>
      `;

      const emailResponse = await resend.emails.send({
        from: "PeachHaus <onboarding@resend.dev>",
        to: [submittedByProfile?.email || ""],
        subject: `✅ Your Bug Report Has Been Resolved: ${bug.title}`,
        html: emailHtml,
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
