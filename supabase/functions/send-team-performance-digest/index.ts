import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TeamMemberPerformance {
  name: string;
  email: string;
  tasksCompleted: number;
  tasksInProgress: number;
  completedTasks: Array<{
    title: string;
    property_address: string;
    completed_at: string;
  }>;
  dataEntered: Array<{
    type: string;
    description: string;
    timestamp: string;
  }>;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting team performance digest email process");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get today's date range
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();

    console.log(`Fetching team performance for: ${startOfDay} to ${endOfDay}`);

    // Get all approved users
    const { data: users, error: usersError } = await supabase
      .from("profiles")
      .select("id, email, first_name")
      .eq("status", "approved");

    if (usersError) {
      console.error("Error fetching users:", usersError);
      throw usersError;
    }

    console.log(`Found ${users?.length || 0} approved users`);

    const teamPerformance: TeamMemberPerformance[] = [];

    // Process each user
    for (const user of users || []) {
      try {
        // Get tasks completed today
        const { data: completedTasks, error: tasksError } = await supabase
          .from("onboarding_tasks")
          .select(`
            id,
            title,
            updated_at,
            status,
            field_value,
            assigned_to_uuid,
            assigned_role_id,
            onboarding_projects (
              property_address
            )
          `)
          .eq("status", "completed")
          .gte("updated_at", startOfDay)
          .lte("updated_at", endOfDay);

        if (tasksError) {
          console.error(`Error fetching tasks for user ${user.email}:`, tasksError);
          continue;
        }

        // Get user's role IDs
        const { data: userRoles } = await supabase
          .from("user_team_roles")
          .select("role_id")
          .eq("user_id", user.id);

        const userRoleIds = userRoles?.map(r => r.role_id) || [];

        // Filter tasks assigned to this user (directly or by role)
        const userCompletedTasks = (completedTasks || []).filter(task => 
          task.assigned_to_uuid === user.id || 
          (task.assigned_role_id && userRoleIds.includes(task.assigned_role_id))
        );

        // Get tasks currently in progress
        const { data: inProgressTasks } = await supabase
          .from("onboarding_tasks")
          .select("id, assigned_to_uuid, assigned_role_id")
          .neq("status", "completed");

        const userInProgressTasks = (inProgressTasks || []).filter(task => 
          task.assigned_to_uuid === user.id || 
          (task.assigned_role_id && userRoleIds.includes(task.assigned_role_id))
        );

        // Get data entries (visits, expenses added today)
        const dataEntered: Array<{
          type: string;
          description: string;
          timestamp: string;
        }> = [];

        // Check for visits added today
        const { data: visits } = await supabase
          .from("visits")
          .select("*, properties(name)")
          .eq("user_id", user.id)
          .gte("created_at", startOfDay)
          .lte("created_at", endOfDay);

        (visits || []).forEach(visit => {
          dataEntered.push({
            type: "Visit",
            description: `Visit logged for ${(visit.properties as any)?.name || 'property'}`,
            timestamp: visit.created_at
          });
        });

        // Check for expenses added today
        const { data: expenses } = await supabase
          .from("expenses")
          .select("*, properties(name)")
          .eq("user_id", user.id)
          .gte("created_at", startOfDay)
          .lte("created_at", endOfDay);

        (expenses || []).forEach(expense => {
          dataEntered.push({
            type: "Expense",
            description: `Expense $${expense.amount} for ${(expense.properties as any)?.name || 'property'}`,
            timestamp: expense.created_at
          });
        });

        // Check for comments added today
        const { data: comments } = await supabase
          .from("onboarding_comments")
          .select("*, onboarding_tasks(title)")
          .eq("user_id", user.id)
          .gte("created_at", startOfDay)
          .lte("created_at", endOfDay);

        (comments || []).forEach(comment => {
          dataEntered.push({
            type: "Comment",
            description: `Comment on task: ${(comment.onboarding_tasks as any)?.title || 'task'}`,
            timestamp: comment.created_at
          });
        });

        // Check for FAQ questions asked today
        const { data: questions } = await supabase
          .from("faq_questions")
          .select("question, created_at")
          .eq("asked_by", user.id)
          .gte("created_at", startOfDay)
          .lte("created_at", endOfDay);

        (questions || []).forEach(q => {
          dataEntered.push({
            type: "Question",
            description: q.question,
            timestamp: q.created_at
          });
        });

        // Only include users who had activity today
        if (userCompletedTasks.length > 0 || dataEntered.length > 0) {
          teamPerformance.push({
            name: user.first_name || user.email.split('@')[0],
            email: user.email,
            tasksCompleted: userCompletedTasks.length,
            tasksInProgress: userInProgressTasks.length,
            completedTasks: userCompletedTasks.map(task => ({
              title: task.title,
              property_address: (task.onboarding_projects as any)?.property_address || "Unknown",
              completed_at: task.updated_at
            })),
            dataEntered: dataEntered.sort((a, b) => 
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            )
          });
        }

      } catch (error) {
        console.error(`Error processing user ${user.email}:`, error);
      }
    }

    // Sort team members by activity (most active first)
    teamPerformance.sort((a, b) => {
      const aTotal = a.tasksCompleted + a.dataEntered.length;
      const bTotal = b.tasksCompleted + b.dataEntered.length;
      return bTotal - aTotal;
    });

    console.log(`Team performance summary: ${teamPerformance.length} active members`);

    // Generate and send email
    const emailHtml = generateTeamPerformanceEmail(teamPerformance);

    const emailResponse = await resend.emails.send({
      from: "Property Central Team <admin@peachhausgroup.com>",
      to: ["ingo@peachhausgroup.com"],
      subject: `Team Performance Summary - ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`,
      html: emailHtml,
    });

    console.log("Team performance email sent:", emailResponse);

    return new Response(
      JSON.stringify({
        success: true,
        team_members_with_activity: teamPerformance.length,
        total_tasks_completed: teamPerformance.reduce((sum, m) => sum + m.tasksCompleted, 0),
        total_data_entries: teamPerformance.reduce((sum, m) => sum + m.dataEntered.length, 0)
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );

  } catch (error: any) {
    console.error("Error in team performance digest function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

function generateTeamPerformanceEmail(teamPerformance: TeamMemberPerformance[]): string {
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const totalTasksCompleted = teamPerformance.reduce((sum, m) => sum + m.tasksCompleted, 0);
  const totalDataEntries = teamPerformance.reduce((sum, m) => sum + m.dataEntered.length, 0);

  const teamMembersSection = teamPerformance.length > 0 ? teamPerformance.map(member => `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 25px; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
      <tr>
        <td style="background: linear-gradient(135deg, #f97316 0%, #fb923c 100%); padding: 15px 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <h3 style="margin: 0; color: #ffffff; font-size: 18px; font-weight: bold;">
              👤 ${member.name}
            </h3>
            <div style="text-align: right;">
              <span style="background-color: rgba(255,255,255,0.25); color: #ffffff; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 600; margin-left: 8px;">
                ${member.tasksCompleted} tasks completed
              </span>
              <span style="background-color: rgba(255,255,255,0.25); color: #ffffff; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 600; margin-left: 8px;">
                ${member.dataEntered.length} entries
              </span>
            </div>
          </div>
        </td>
      </tr>
      
      ${member.completedTasks.length > 0 ? `
        <tr>
          <td style="padding: 20px;">
            <h4 style="margin: 0 0 12px 0; color: #059669; font-size: 15px; font-weight: 600;">
              ✅ Tasks Completed Today
            </h4>
            ${member.completedTasks.map(task => `
              <div style="padding: 10px; margin-bottom: 8px; background-color: #f0fdf4; border-left: 3px solid #059669; border-radius: 4px;">
                <div style="font-weight: bold; color: #333; margin-bottom: 4px;">${task.title}</div>
                <div style="font-size: 13px; color: #666;">📍 ${task.property_address}</div>
                <div style="font-size: 12px; color: #059669; margin-top: 4px;">Completed at ${formatTime(task.completed_at)}</div>
              </div>
            `).join('')}
          </td>
        </tr>
      ` : ''}
      
      ${member.dataEntered.length > 0 ? `
        <tr>
          <td style="padding: 0 20px 20px 20px;">
            <h4 style="margin: 0 0 12px 0; color: #2563eb; font-size: 15px; font-weight: 600;">
              📝 Data Entered Today
            </h4>
            ${member.dataEntered.map(entry => `
              <div style="padding: 10px; margin-bottom: 8px; background-color: #eff6ff; border-left: 3px solid #2563eb; border-radius: 4px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <span style="background-color: #2563eb; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; margin-right: 8px;">
                      ${entry.type}
                    </span>
                    <span style="font-size: 14px; color: #333;">${entry.description}</span>
                  </div>
                  <div style="font-size: 12px; color: #2563eb; white-space: nowrap; margin-left: 12px;">
                    ${formatTime(entry.timestamp)}
                  </div>
                </div>
              </div>
            `).join('')}
          </td>
        </tr>
      ` : ''}
      
      ${member.tasksInProgress > 0 ? `
        <tr>
          <td style="padding: 0 20px 20px 20px; border-top: 1px solid #f3f4f6;">
            <div style="margin-top: 15px; padding: 12px; background-color: #fef3c7; border-radius: 6px; text-align: center;">
              <span style="color: #92400e; font-size: 14px;">
                📋 ${member.tasksInProgress} task${member.tasksInProgress !== 1 ? 's' : ''} currently in progress
              </span>
            </div>
          </td>
        </tr>
      ` : ''}
    </table>
  `).join('') : `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 25px;">
      <tr>
        <td style="padding: 40px; text-align: center; background-color: #f9fafb; border-radius: 8px;">
          <p style="margin: 0; color: #6b7280; font-size: 16px;">No team activity recorded today.</p>
        </td>
      </tr>
    </table>
  `;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="700" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); overflow: hidden;">
              
              <!-- Logo Header -->
              <tr>
                <td style="padding: 40px; text-align: center; background: linear-gradient(135deg, #FF7A5C 0%, #FF8F75 100%);">
                  <img src="https://9ed06ecd-51b7-4166-a07a-107b37f1e8c1.lovableproject.com/property-central-logo.png" alt="Property Central" style="max-width: 400px; height: auto; margin-bottom: 20px;" />
                  <h1 style="color: #ffffff; margin: 20px 0 0 0; font-size: 28px; font-weight: bold;">Daily Team Performance</h1>
                  <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 16px; opacity: 0.95;">
                    ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                </td>
              </tr>
              
              <!-- Summary Stats -->
              <tr>
                <td style="padding: 30px 40px; background: linear-gradient(135deg, #f97316 0%, #fb923c 100%);">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td width="33%" style="text-align: center; padding: 15px;">
                        <div style="background-color: rgba(255,255,255,0.25); padding: 20px; border-radius: 8px;">
                          <div style="font-size: 36px; font-weight: bold; color: #ffffff; margin-bottom: 5px;">
                            ${teamPerformance.length}
                          </div>
                          <div style="font-size: 14px; color: #ffffff; opacity: 0.95;">Active Team Members</div>
                        </div>
                      </td>
                      <td width="33%" style="text-align: center; padding: 15px;">
                        <div style="background-color: rgba(255,255,255,0.25); padding: 20px; border-radius: 8px;">
                          <div style="font-size: 36px; font-weight: bold; color: #ffffff; margin-bottom: 5px;">
                            ${totalTasksCompleted}
                          </div>
                          <div style="font-size: 14px; color: #ffffff; opacity: 0.95;">Tasks Completed</div>
                        </div>
                      </td>
                      <td width="33%" style="text-align: center; padding: 15px;">
                        <div style="background-color: rgba(255,255,255,0.25); padding: 20px; border-radius: 8px;">
                          <div style="font-size: 36px; font-weight: bold; color: #ffffff; margin-bottom: 5px;">
                            ${totalDataEntries}
                          </div>
                          <div style="font-size: 14px; color: #ffffff; opacity: 0.95;">Data Entries</div>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Team Members Content -->
              <tr>
                <td style="padding: 40px;">
                  <h2 style="margin: 0 0 25px 0; color: #1f2937; font-size: 22px; font-weight: bold;">
                    Team Member Activity
                  </h2>
                  
                  ${teamMembersSection}
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="padding: 30px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="text-align: center;">
                        <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                          This is an automated daily summary generated by the Property Central team management system.
                        </p>
                        <p style="margin: 0; color: #FF7A5C; font-size: 14px; font-weight: 600;">
                          © ${new Date().getFullYear()} Property Central
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

serve(handler);
