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
        assigned_role_id,
        onboarding_projects!inner (
          property_address,
          owner_name,
          status
        )
      `)
      .lt("due_date", today)
      .neq("status", "completed")
      .eq("onboarding_projects.status", "in-progress")
      .or("field_value.is.null,field_value.eq.")
      .is("file_path", null);

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

    // Get all user-role assignments
    const { data: userRoles } = await supabase
      .from("user_team_roles")
      .select("user_id, role_id");

    // Group tasks by user (either directly assigned or through role)
    const tasksByUser = new Map<string, any[]>();
    
    for (const task of overdueTasks) {
      const userIds = new Set<string>();
      
      // Add directly assigned user
      if (task.assigned_to_uuid) {
        userIds.add(task.assigned_to_uuid);
      }
      
      // Add users with the assigned role
      if (task.assigned_role_id && userRoles) {
        const usersWithRole = userRoles
          .filter(ur => ur.role_id === task.assigned_role_id)
          .map(ur => ur.user_id);
        usersWithRole.forEach(uid => userIds.add(uid));
      }
      
      // If no specific assignment, check phase-level role assignment
      if (!task.assigned_to_uuid && !task.assigned_role_id) {
        const { data: phaseAssignment } = await supabase
          .from("phase_role_assignments")
          .select("role_id")
          .eq("phase_number", task.phase_number)
          .maybeSingle();
        
        if (phaseAssignment?.role_id && userRoles) {
          const usersWithRole = userRoles
            .filter(ur => ur.role_id === phaseAssignment.role_id)
            .map(ur => ur.user_id);
          usersWithRole.forEach(uid => userIds.add(uid));
        }
      }
      
      // Add task to each user's list
      for (const userId of userIds) {
        if (!tasksByUser.has(userId)) {
          tasksByUser.set(userId, []);
        }
        tasksByUser.get(userId)!.push(task);
      }
    }

    console.log(`Tasks grouped for ${tasksByUser.size} users`);

    // Get user emails
    const userEmails = new Map<string, string>();
    for (const userId of tasksByUser.keys()) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", userId)
        .maybeSingle();
      
      if (profile?.email) {
        userEmails.set(userId, profile.email);
      }
    }

    // Send emails with delay to avoid rate limiting
    let emailsSent = 0;
    const errors: any[] = [];

    const userEntries = Array.from(tasksByUser.entries());
    
    for (let i = 0; i < userEntries.length; i++) {
      const [userId, tasks] = userEntries[i];
      const userEmail = userEmails.get(userId);
      
      if (!userEmail) {
        console.log(`No email found for user ${userId}`);
        continue;
      }

      // Add delay between emails to respect rate limits (2 per second = 500ms minimum)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 600));
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

        // Generate HTML list of tasks with better structure
        const taskListHTML = tasksWithDaysOverdue
          .map((task, index) => `
            <div style="margin-bottom: 20px; padding: 16px; background-color: ${task.daysOverdue >= 7 ? '#fee2e2' : task.daysOverdue >= 3 ? '#fef3c7' : '#fef9c3'}; border-left: 4px solid ${task.daysOverdue >= 7 ? '#dc2626' : task.daysOverdue >= 3 ? '#f59e0b' : '#eab308'}; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                <h3 style="margin: 0; color: #111827; font-size: 16px; font-weight: 600;">
                  ${index + 1}. ${task.title}
                </h3>
                <span style="background-color: ${task.daysOverdue >= 7 ? '#dc2626' : task.daysOverdue >= 3 ? '#f59e0b' : '#eab308'}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; white-space: nowrap; margin-left: 12px;">
                  ${task.daysOverdue} day${task.daysOverdue !== 1 ? 's' : ''} overdue
                </span>
              </div>
              
              <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(0,0,0,0.1);">
                <table style="width: 100%; font-size: 14px; color: #4b5563;">
                  <tr>
                    <td style="padding: 4px 0; width: 100px; font-weight: 600;">Property:</td>
                    <td style="padding: 4px 0;">${task.onboarding_projects?.property_address || 'Unknown Property'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0; font-weight: 600;">Phase:</td>
                    <td style="padding: 4px 0;">${task.phase_title}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0; font-weight: 600;">Due Date:</td>
                    <td style="padding: 4px 0; color: #dc2626; font-weight: 500;">
                      ${new Date(task.due_date).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                  </tr>
                </table>
              </div>
            </div>
          `)
          .join('');

        const emailHTML = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 650px; margin: 0 auto; padding: 0; background-color: #f3f4f6;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                ⚠️ Overdue Tasks Reminder
              </h1>
              <p style="color: rgba(255,255,255,0.95); margin: 10px 0 0 0; font-size: 16px;">
                PeachHaus Group Task Management
              </p>
            </div>
            
            <div style="background-color: white; padding: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
                <p style="margin: 0; font-size: 16px; color: #92400e; font-weight: 500;">
                  You have <strong style="color: #dc2626; font-size: 20px;">${tasks.length}</strong> overdue task${tasks.length !== 1 ? 's' : ''} requiring immediate attention.
                </p>
              </div>
              
              <h2 style="color: #111827; font-size: 20px; font-weight: 600; margin: 0 0 20px 0; padding-bottom: 12px; border-bottom: 2px solid #e5e7eb;">
                Your Overdue Tasks:
              </h2>
              
              <div style="margin: 20px 0;">
                ${taskListHTML}
              </div>
              
              <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); padding: 20px; border-radius: 8px; margin: 30px 0; border: 1px solid #93c5fd;">
                <p style="margin: 0 0 8px 0; color: #1e40af; font-size: 15px;">
                  <strong style="font-size: 16px;">💡 Next Steps:</strong>
                </p>
                <ul style="margin: 0; padding-left: 20px; color: #1e3a8a; font-size: 14px; line-height: 1.8;">
                  <li>Click the button below to view all your tasks</li>
                  <li>Update each task's status or reschedule with a reason</li>
                  <li>Keep the team informed of any delays or blockers</li>
                </ul>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://9ed06ecd-51b7-4166-a07a-107b37f1e8c1.lovableproject.com/" 
                   style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.4); transition: transform 0.2s;">
                  View Dashboard & Update Tasks
                </a>
              </div>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
                <p style="color: #6b7280; font-size: 13px; margin: 0; line-height: 1.5;">
                  This is an automated reminder from PeachHaus Group.<br/>
                  Please update your tasks to keep all projects on track.
                </p>
              </div>
            </div>
            
            <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
              <p style="margin: 0;">© ${new Date().getFullYear()} PeachHaus Group. All rights reserved.</p>
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
