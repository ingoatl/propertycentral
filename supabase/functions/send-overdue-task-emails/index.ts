import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OverdueTask {
  id: string;
  title: string;
  phase_title: string;
  phase_number: number;
  due_date: string;
  project_id: string;
  assigned_to_uuid: string;
  onboarding_projects: {
    property_address: string;
    owner_name: string;
  } | null;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting overdue task email notification process...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all overdue tasks with user information
    const today = new Date().toISOString().split('T')[0];
    
    const { data: overdueTasks, error: tasksError } = await supabase
      .from("onboarding_tasks")
      .select(`
        id,
        title,
        phase_title,
        phase_number,
        due_date,
        project_id,
        assigned_to_uuid,
        onboarding_projects (
          property_address,
          owner_name
        )
      `)
      .lt("due_date", today)
      .neq("status", "completed")
      .not("assigned_to_uuid", "is", null);

    if (tasksError) {
      console.error("Error fetching overdue tasks:", tasksError);
      throw tasksError;
    }

    if (!overdueTasks || overdueTasks.length === 0) {
      console.log("No overdue tasks found");
      return new Response(
        JSON.stringify({ message: "No overdue tasks found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    console.log(`Found ${overdueTasks.length} overdue tasks`);

    // Group tasks by user
    const tasksByUser = new Map<string, any[]>();
    for (const task of overdueTasks) {
      if (!task.assigned_to_uuid) continue;
      
      if (!tasksByUser.has(task.assigned_to_uuid)) {
        tasksByUser.set(task.assigned_to_uuid, []);
      }
      tasksByUser.get(task.assigned_to_uuid)!.push(task);
    }

    console.log(`Tasks grouped for ${tasksByUser.size} users`);

    // Get user emails
    const userEmails = new Map<string, string>();
    for (const userId of tasksByUser.keys()) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", userId)
        .single();
      
      if (profile?.email) {
        userEmails.set(userId, profile.email);
      }
    }

    // Send emails
    let emailsSent = 0;
    const errors: any[] = [];

    for (const [userId, tasks] of tasksByUser.entries()) {
      const userEmail = userEmails.get(userId);
      if (!userEmail) {
        console.log(`No email found for user ${userId}`);
        continue;
      }

      try {
        // Calculate days overdue for each task
        const tasksWithDaysOverdue = tasks.map(task => {
          const daysOverdue = Math.floor(
            (new Date().getTime() - new Date(task.due_date).getTime()) / (1000 * 60 * 60 * 24)
          );
          return { ...task, daysOverdue };
        });

        // Sort by most overdue first
        tasksWithDaysOverdue.sort((a, b) => b.daysOverdue - a.daysOverdue);

        // Generate HTML list of tasks
        const taskListHTML = tasksWithDaysOverdue
          .map(task => `
            <li style="margin-bottom: 15px; padding: 12px; background-color: #fee2e2; border-left: 4px solid #dc2626; border-radius: 4px;">
              <strong style="color: #991b1b;">${task.title}</strong><br/>
              <span style="color: #6b7280; font-size: 14px;">
                ${task.onboarding_projects?.property_address || 'Unknown Property'} - ${task.phase_title}
              </span><br/>
              <span style="color: #dc2626; font-weight: 600; font-size: 14px;">
                Due: ${new Date(task.due_date).toLocaleDateString()} (${task.daysOverdue} day${task.daysOverdue !== 1 ? 's' : ''} overdue)
              </span>
            </li>
          `)
          .join('');

        const emailHTML = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0;">⚠️ Overdue Tasks Alert</h1>
            </div>
            
            <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
              <p style="font-size: 16px; margin-bottom: 20px;">
                You have <strong style="color: #dc2626;">${tasks.length}</strong> overdue task${tasks.length !== 1 ? 's' : ''} that require your attention:
              </p>
              
              <ul style="list-style: none; padding: 0; margin: 20px 0;">
                ${taskListHTML}
              </ul>
              
              <div style="background-color: #eff6ff; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #3b82f6;">
                <p style="margin: 0; color: #1e40af;">
                  <strong>💡 Tip:</strong> Click on any task in your dashboard to reschedule it and provide a reason for the delay. This helps maintain accountability and keeps everyone informed.
                </p>
              </div>
              
              <div style="text-align: center; margin-top: 30px;">
                <a href="${supabaseUrl.replace('https://', 'https://').replace('.supabase.co', '.lovableproject.com')}/onboarding" 
                   style="display: inline-block; background-color: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                  View My Tasks
                </a>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; margin-top: 30px; text-align: center;">
                This is an automated reminder. Please update your tasks to keep projects on track.
              </p>
            </div>
          </body>
          </html>
        `;

        const emailResponse = await resend.emails.send({
          from: "PeachHaus <admin@peachhausgroup.com>",
          to: [userEmail],
          subject: `⚠️ You have ${tasks.length} overdue task${tasks.length !== 1 ? 's' : ''}`,
          html: emailHTML,
        });

        console.log(`Email sent to ${userEmail}:`, emailResponse);
        emailsSent++;
      } catch (error: any) {
        console.error(`Error sending email to ${userEmail}:`, error);
        errors.push({ userId, email: userEmail, error: error?.message || String(error) });
      }
    }

    const result = {
      success: true,
      overdueTasksFound: overdueTasks.length,
      emailsSent,
      errors: errors.length > 0 ? errors : undefined,
    };

    console.log("Email sending complete:", result);

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in send-overdue-task-emails:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
};

serve(handler);
