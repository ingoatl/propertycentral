import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: string | null;
  category: string | null;
  status: string;
  completed_at: string | null;
}

interface SetupStatusRequest {
  propertyId: string;
  propertyName: string;
  ownerEmail: string;
  tasks: Task[];
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { propertyId, propertyName, ownerEmail, tasks }: SetupStatusRequest = await req.json();

    console.log(`Sending setup status email for ${propertyName} to ${ownerEmail}`);

    const pendingTasks = tasks.filter(t => t.status !== "completed");
    const completedTasks = tasks.filter(t => t.status === "completed");

    const getPriorityEmoji = (priority: string | null) => {
      switch (priority) {
        case "urgent": return "🔴";
        case "high": return "🟠";
        case "medium": return "🟡";
        case "low": return "🟢";
        default: return "⚪";
      }
    };

    const pendingTasksHtml = pendingTasks.length > 0
      ? pendingTasks.map(t => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
            ${getPriorityEmoji(t.priority)} <strong>${t.title}</strong>
            ${t.description ? `<br/><span style="color: #6b7280; font-size: 13px;">${t.description}</span>` : ''}
          </td>
        </tr>
      `).join('')
      : `<tr><td style="padding: 12px; color: #6b7280;">No pending tasks - you're all caught up! 🎉</td></tr>`;

    const completedTasksHtml = completedTasks.length > 0
      ? completedTasks.map(t => `
        <tr>
          <td style="padding: 8px 12px; color: #6b7280; text-decoration: line-through;">
            ✓ ${t.title}
          </td>
        </tr>
      `).join('')
      : '';

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🏠 Property Setup Status</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">${propertyName}</p>
          </div>
          
          <div style="padding: 24px;">
            <p style="color: #374151; font-size: 15px; line-height: 1.6; margin-top: 0;">
              Hello! Here's an update on the setup tasks for your property. We need your help with the items listed below.
            </p>

            <h2 style="color: #111827; font-size: 16px; margin: 24px 0 12px 0; padding-bottom: 8px; border-bottom: 2px solid #f97316;">
              📋 Your Pending Tasks (${pendingTasks.length})
            </h2>
            <table style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border-radius: 8px; overflow: hidden;">
              ${pendingTasksHtml}
            </table>

            ${completedTasks.length > 0 ? `
              <h2 style="color: #6b7280; font-size: 14px; margin: 24px 0 8px 0;">
                ✅ Completed (${completedTasks.length})
              </h2>
              <table style="width: 100%; border-collapse: collapse;">
                ${completedTasksHtml}
              </table>
            ` : ''}

            <div style="margin-top: 32px; padding: 16px; background-color: #fef3c7; border-radius: 8px; border-left: 4px solid #f97316;">
              <p style="color: #92400e; margin: 0; font-size: 14px;">
                <strong>Need help?</strong> Reply to this email and our team will assist you with any questions about these tasks.
              </p>
            </div>
          </div>
          
          <div style="padding: 20px; background-color: #f9fafb; border-radius: 0 0 12px 12px; text-align: center;">
            <p style="color: #6b7280; font-size: 12px; margin: 0;">
              PeachHaus Property Management<br/>
              Making your rental property effortless
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: "PeachHaus <noreply@peachhaus.co>",
      to: [ownerEmail],
      subject: `Action Required: ${pendingTasks.length} Setup Task${pendingTasks.length !== 1 ? 's' : ''} for ${propertyName}`,
      html: emailHtml,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, emailResponse }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error sending owner setup status email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
