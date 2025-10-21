import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import React from "npm:react@18.3.1";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import { NewBugEmail } from "./_templates/new-bug-email.tsx";
import { BugResolvedEmail } from "./_templates/bug-resolved-email.tsx";

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
      // Send email to admin using React Email template
      const html = await renderAsync(
        React.createElement(NewBugEmail, {
          bugTitle: bug.title,
          priority: bug.priority,
          description: bug.description,
          submittedBy: bug.submitted_by_profile?.first_name || "Unknown",
          submittedEmail: bug.submitted_by_profile?.email || "",
          submittedAt: new Date(bug.submitted_at).toLocaleString(),
          loomVideoUrl: bug.loom_video_url || undefined,
          propertyName: bug.property?.name || undefined,
          projectAddress: bug.project?.property_address || undefined,
          taskTitle: bug.task?.title || undefined,
        })
      );

      const emailResponse = await resend.emails.send({
        from: "PeachHaus <onboarding@resend.dev>",
        to: ["ingo@peachhausgroup.com"],
        subject: `🐛 New Bug Report: ${bug.title}`,
        html,
      });

      console.log("Admin email sent:", emailResponse);

    } else if (type === "bug_resolved") {
      // Send email to user using React Email template
      const html = await renderAsync(
        React.createElement(BugResolvedEmail, {
          bugTitle: bug.title,
          description: bug.description,
          resolutionNotes: bug.resolution_notes || "Bug has been fixed.",
          resolvedBy: bug.resolved_by_profile?.first_name || "Admin",
          resolvedAt: new Date(bug.resolved_at).toLocaleString(),
          userName: bug.submitted_by_profile?.first_name || "there",
        })
      );

      const emailResponse = await resend.emails.send({
        from: "PeachHaus <onboarding@resend.dev>",
        to: [bug.submitted_by_profile?.email || ""],
        subject: `✅ Your Bug Report Has Been Resolved: ${bug.title}`,
        html,
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
