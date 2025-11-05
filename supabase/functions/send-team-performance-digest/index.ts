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
    owner_name: string;
    completed_at: string;
    field_value: string;
    phase_number: number;
  }>;
  openTasks: Array<{
    title: string;
    property_address: string;
    owner_name: string;
    due_date: string | null;
    phase_number: number;
  }>;
  overdueTasks: Array<{
    title: string;
    property_address: string;
    owner_name: string;
    due_date: string;
    days_overdue: number;
    phase_number: number;
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

    // Get yesterday's date range (since email is sent for previous day's activity)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const startOfDay = new Date(yesterday.setHours(0, 0, 0, 0)).toISOString();
    const endOfDay = new Date(yesterday.setHours(23, 59, 59, 999)).toISOString();

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

    // Fetch daily performance entries from yesterday
    const yesterdayDate = yesterday.toISOString().split('T')[0];
    const { data: dailyEntries, error: entriesError } = await supabase
      .from('daily_performance_entries')
      .select(`
        id,
        date,
        entry,
        user_id,
        profiles!inner(first_name, last_name)
      `)
      .eq('date', yesterdayDate)
      .order('created_at', { ascending: false });

    if (entriesError) {
      console.error('Error fetching daily entries:', entriesError);
    }

    // Process each user
    for (const user of users || []) {
      try {
        // Get tasks completed yesterday
        const { data: completedTasks, error: tasksError } = await supabase
          .from("onboarding_tasks")
          .select(`
            id,
            title,
            updated_at,
            status,
            field_value,
            phase_number,
            assigned_to_uuid,
            assigned_role_id,
            onboarding_projects (
              property_address,
              owner_name
            )
          `)
          .eq("status", "completed")
          .gte("updated_at", startOfDay)
          .lte("updated_at", endOfDay);

        if (tasksError) {
          console.error(`Error fetching tasks for user ${user.email}:`, tasksError);
          continue;
        }

        console.log(`User ${user.email}: Found ${completedTasks?.length || 0} completed tasks`);

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

        console.log(`User ${user.email}: ${userCompletedTasks.length} tasks assigned to them`);

        // Get tasks currently in progress with full details
        const { data: inProgressTasks } = await supabase
          .from("onboarding_tasks")
          .select(`
            id,
            title,
            due_date,
            phase_number,
            assigned_to_uuid,
            assigned_role_id,
            onboarding_projects (
              property_address,
              owner_name
            )
          `)
          .eq("status", "in-progress");

        const userInProgressTasks = (inProgressTasks || []).filter(task => 
          task.assigned_to_uuid === user.id || 
          (task.assigned_role_id && userRoleIds.includes(task.assigned_role_id))
        );

        // Get overdue tasks
        const today = new Date().toISOString().split('T')[0];
        const { data: overdueTasks } = await supabase
          .from("onboarding_tasks")
          .select(`
            id,
            title,
            due_date,
            phase_number,
            assigned_to_uuid,
            assigned_role_id,
            onboarding_projects (
              property_address,
              owner_name
            )
          `)
          .neq("status", "completed")
          .not("due_date", "is", null)
          .lt("due_date", today);

        const userOverdueTasks = (overdueTasks || []).filter(task => 
          task.assigned_to_uuid === user.id || 
          (task.assigned_role_id && userRoleIds.includes(task.assigned_role_id))
        ).map(task => {
          const dueDate = new Date(task.due_date!);
          const now = new Date();
          const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          
          return {
            title: task.title,
            property_address: (task.onboarding_projects as any)?.property_address || "Unknown",
            owner_name: (task.onboarding_projects as any)?.owner_name || "",
            due_date: task.due_date!,
            days_overdue: daysOverdue,
            phase_number: task.phase_number
          };
        }).sort((a, b) => b.days_overdue - a.days_overdue);

        // Get data entries (visits, expenses added today)
        const dataEntered: Array<{
          type: string;
          description: string;
          timestamp: string;
        }> = [];

        // Check for visits added yesterday
        const { data: visits } = await supabase
          .from("visits")
          .select("*, properties(name, address)")
          .eq("user_id", user.id)
          .gte("created_at", startOfDay)
          .lte("created_at", endOfDay);

        (visits || []).forEach(visit => {
          dataEntered.push({
            type: "Visit",
            description: `Visit logged for ${(visit.properties as any)?.name || 'property'} - $${visit.price}`,
            timestamp: visit.created_at
          });
        });

        // Check for expenses added yesterday
        const { data: expenses } = await supabase
          .from("expenses")
          .select("*, properties(name, address)")
          .eq("user_id", user.id)
          .gte("created_at", startOfDay)
          .lte("created_at", endOfDay);

        (expenses || []).forEach(expense => {
          dataEntered.push({
            type: "Expense",
            description: `$${expense.amount} - ${expense.category || 'Uncategorized'} for ${(expense.properties as any)?.name || 'property'}`,
            timestamp: expense.created_at
          });
        });

        // Check for comments added yesterday
        const { data: comments } = await supabase
          .from("onboarding_comments")
          .select("*, onboarding_tasks(title)")
          .eq("user_id", user.id)
          .gte("created_at", startOfDay)
          .lte("created_at", endOfDay);

        (comments || []).forEach(comment => {
          dataEntered.push({
            type: "Comment",
            description: `Comment on: ${(comment.onboarding_tasks as any)?.title || 'task'}`,
            timestamp: comment.created_at
          });
        });

        // Check for FAQ questions asked yesterday
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

        console.log(`User ${user.email}: ${dataEntered.length} data entries found`);

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
              owner_name: (task.onboarding_projects as any)?.owner_name || "",
              completed_at: task.updated_at,
              field_value: task.field_value,
              phase_number: task.phase_number
            })),
            openTasks: userInProgressTasks.map(task => ({
              title: task.title,
              property_address: (task.onboarding_projects as any)?.property_address || "Unknown",
              owner_name: (task.onboarding_projects as any)?.owner_name || "",
              due_date: task.due_date,
              phase_number: task.phase_number
            })),
            overdueTasks: userOverdueTasks,
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
  const emailHtml = generateTeamPerformanceEmail(teamPerformance, dailyEntries || []);

    const reportDate = new Date();
    reportDate.setDate(reportDate.getDate() - 1);
    
    const emailResponse = await resend.emails.send({
      from: "Property Central Team <admin@peachhausgroup.com>",
      to: ["anja@peachhausgroup.com", "ingo@peachhausgroup.com"],
      subject: `Team Performance Summary - ${reportDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`,
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

function generateTeamPerformanceEmail(teamPerformance: TeamMemberPerformance[], dailyEntries?: any[]): string {
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const totalTasksCompleted = teamPerformance.reduce((sum, m) => sum + m.tasksCompleted, 0);
  const totalDataEntries = teamPerformance.reduce((sum, m) => sum + m.dataEntered.length, 0);
  const totalOverdue = teamPerformance.reduce((sum, m) => sum + m.overdueTasks.length, 0);
  const totalOpen = teamPerformance.reduce((sum, m) => sum + m.openTasks.length, 0);

  const teamMembersSection = teamPerformance.length > 0 ? teamPerformance.map(member => `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px; background-color: #ffffff; border: 2px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
      <tr>
        <td style="background: linear-gradient(135deg, #FF7A00 0%, #C7A36E 100%); padding: 20px 25px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width: 60%;">
                <h3 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: bold;">
                  👤 ${member.name}
                </h3>
                <p style="margin: 5px 0 0 0; color: rgba(255,255,255,0.9); font-size: 13px;">${member.email}</p>
              </td>
              <td style="width: 40%; text-align: right;">
                <div style="display: inline-block; background-color: rgba(255,255,255,0.95); padding: 8px 16px; border-radius: 20px; margin-left: 8px;">
                  <span style="color: #FF7A00; font-size: 24px; font-weight: bold;">${member.tasksCompleted}</span>
                  <span style="color: #666; font-size: 12px; display: block; margin-top: 2px;">Tasks Done</span>
                </div>
                <div style="display: inline-block; background-color: rgba(255,255,255,0.95); padding: 8px 16px; border-radius: 20px; margin-left: 8px;">
                  <span style="color: #2563eb; font-size: 24px; font-weight: bold;">${member.dataEntered.length}</span>
                  <span style="color: #666; font-size: 12px; display: block; margin-top: 2px;">Data Entries</span>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      
      ${member.overdueTasks.length > 0 ? `
        <tr>
          <td style="padding: 25px;">
            <h4 style="margin: 0 0 15px 0; color: #dc2626; font-size: 17px; font-weight: 700; border-bottom: 2px solid #dc2626; padding-bottom: 8px;">
              ⚠️ Overdue Tasks (${member.overdueTasks.length})
            </h4>
            ${member.overdueTasks.map(task => `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 12px; background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border-left: 4px solid #dc2626; border-radius: 8px; padding: 15px;">
                <tr>
                  <td>
                    <div style="font-weight: 700; color: #991b1b; margin-bottom: 6px; font-size: 15px;">${task.title}</div>
                    <div style="font-size: 13px; color: #666; margin-bottom: 6px;">
                      📍 ${task.property_address}${task.owner_name ? ` (Owner: ${task.owner_name})` : ''}
                    </div>
                    <div style="font-size: 12px; color: #666; margin-bottom: 6px;">
                      📋 Phase ${task.phase_number}
                    </div>
                    <div style="display: inline-block;">
                      <div style="background-color: #dc2626; color: white; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 700; margin-right: 8px; display: inline-block;">
                        ${task.days_overdue} day${task.days_overdue !== 1 ? 's' : ''} overdue
                      </div>
                      <span style="font-size: 12px; color: #991b1b; font-weight: 600;">
                        📅 Due: ${new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                  </td>
                </tr>
              </table>
            `).join('')}
          </td>
        </tr>
      ` : ''}
      
      ${member.completedTasks.length > 0 ? `
        <tr>
          <td style="padding: 25px;">
            <h4 style="margin: 0 0 15px 0; color: #059669; font-size: 17px; font-weight: 700; border-bottom: 2px solid #059669; padding-bottom: 8px;">
              ✅ Tasks Completed
            </h4>
            ${member.completedTasks.map(task => `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 12px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-left: 4px solid #059669; border-radius: 8px; padding: 15px;">
                <tr>
                  <td>
                    <div style="font-weight: 700; color: #065f46; margin-bottom: 6px; font-size: 15px;">${task.title}</div>
                    ${task.field_value ? `<div style="font-size: 13px; color: #047857; margin-bottom: 6px; background-color: rgba(255,255,255,0.6); padding: 6px 10px; border-radius: 4px; display: inline-block;"><strong>Value:</strong> ${task.field_value}</div>` : ''}
                    <div style="font-size: 13px; color: #666; margin-top: 6px;">
                      📍 ${task.property_address}${task.owner_name ? ` (Owner: ${task.owner_name})` : ''}
                    </div>
                    <div style="font-size: 12px; color: #666; margin-top: 4px;">
                      📋 Phase ${task.phase_number}
                    </div>
                    <div style="font-size: 12px; color: #059669; margin-top: 8px; font-weight: 600;">
                      ⏰ Completed at ${formatTime(task.completed_at)}
                    </div>
                  </td>
                </tr>
              </table>
            `).join('')}
          </td>
        </tr>
      ` : ''}
      
      ${member.dataEntered.length > 0 ? `
        <tr>
          <td style="padding: 0 25px 25px 25px;">
            <h4 style="margin: 0 0 15px 0; color: #2563eb; font-size: 17px; font-weight: 700; border-bottom: 2px solid #2563eb; padding-bottom: 8px;">
              📝 Data Entries & Activities
            </h4>
            ${member.dataEntered.map(entry => `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 10px; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-left: 4px solid #2563eb; border-radius: 8px; padding: 12px 15px;">
                <tr>
                  <td style="width: 80%;">
                    <span style="background-color: #2563eb; color: white; padding: 4px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; margin-right: 10px; display: inline-block;">
                      ${entry.type}
                    </span>
                    <span style="font-size: 14px; color: #1e40af; font-weight: 500;">${entry.description}</span>
                  </td>
                  <td style="width: 20%; text-align: right;">
                    <div style="font-size: 13px; color: #2563eb; font-weight: 600; white-space: nowrap;">
                      ${formatTime(entry.timestamp)}
                    </div>
                  </td>
                </tr>
              </table>
            `).join('')}
          </td>
        </tr>
      ` : ''}
      
      ${member.openTasks.length > 0 ? `
        <tr>
          <td style="padding: 0 25px 25px 25px;">
            <h4 style="margin: 0 0 15px 0; color: #2563eb; font-size: 17px; font-weight: 700; border-bottom: 2px solid #2563eb; padding-bottom: 8px;">
              📋 Open Tasks (${member.openTasks.length})
            </h4>
            ${member.openTasks.map(task => {
              const dueDate = task.due_date ? new Date(task.due_date) : null;
              const now = new Date();
              const isUpcoming = dueDate && (dueDate.getTime() - now.getTime() < 3 * 24 * 60 * 60 * 1000) && (dueDate > now);
              const dueDateStr = dueDate ? dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
              
              return `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 12px; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-left: 4px solid #2563eb; border-radius: 8px; padding: 15px;">
                <tr>
                  <td>
                    <div style="font-weight: 700; color: #1e40af; margin-bottom: 6px; font-size: 15px;">${task.title}</div>
                    <div style="font-size: 13px; color: #666; margin-bottom: 6px;">
                      📍 ${task.property_address}${task.owner_name ? ` (Owner: ${task.owner_name})` : ''}
                    </div>
                    <div style="font-size: 12px; color: #666; margin-bottom: 6px;">
                      📋 Phase ${task.phase_number}
                    </div>
                    ${task.due_date ? `
                      <div style="font-size: 12px; color: #1e40af; font-weight: 600;">
                        ${isUpcoming ? '⏰' : '📅'} Due: ${dueDateStr}
                        ${isUpcoming ? '<span style="background-color: #f59e0b; color: white; padding: 2px 8px; border-radius: 4px; margin-left: 8px; font-size: 11px;">DUE SOON</span>' : ''}
                      </div>
                    ` : ''}
                  </td>
                </tr>
              </table>
            `}).join('')}
          </td>
        </tr>
      ` : ''}
      
      ${member.tasksInProgress > 0 ? `
        <tr>
          <td style="padding: 0 25px 25px 25px;">
            <div style="padding: 15px; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 8px; border-left: 4px solid #f59e0b;">
              <span style="color: #92400e; font-size: 15px; font-weight: 600;">
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
        <td style="padding: 50px; text-align: center; background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%); border-radius: 12px; border: 2px dashed #d1d5db;">
          <div style="font-size: 48px; margin-bottom: 15px;">📊</div>
          <p style="margin: 0; color: #6b7280; font-size: 18px; font-weight: 500;">No team activity recorded yesterday.</p>
          <p style="margin: 10px 0 0 0; color: #9ca3af; font-size: 14px;">Check back tomorrow for the latest updates!</p>
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
                <td style="padding: 50px 40px; text-align: center; background: linear-gradient(135deg, #FF7A00 0%, #C7A36E 100%);">
                  <h1 style="color: #ffffff; margin: 0; font-size: 36px; font-weight: bold; text-shadow: 2px 2px 4px rgba(0,0,0,0.2);">📊 Property Central</h1>
                  <h2 style="color: #ffffff; margin: 15px 0 0 0; font-size: 24px; font-weight: 600;">Team Performance Report</h2>
                  <p style="color: rgba(255,255,255,0.95); margin: 15px 0 0 0; font-size: 16px; background-color: rgba(255,255,255,0.15); display: inline-block; padding: 8px 20px; border-radius: 20px;">
                    ${(() => {
                      const yesterday = new Date();
                      yesterday.setDate(yesterday.getDate() - 1);
                      return yesterday.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
                    })()}
                  </p>
                </td>
              </tr>
              
              <!-- Summary Stats -->
              <tr>
                <td style="padding: 35px 40px; background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td width="25%" style="text-align: center; padding: 15px;">
                        <div style="background-color: rgba(255,255,255,0.95); padding: 25px 20px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                          <div style="font-size: 42px; font-weight: bold; color: #059669; margin-bottom: 8px;">${totalTasksCompleted}</div>
                          <div style="font-size: 14px; color: #666; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Tasks Completed</div>
                        </div>
                      </td>
                      <td width="25%" style="text-align: center; padding: 15px;">
                        <div style="background-color: rgba(255,255,255,0.95); padding: 25px 20px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                          <div style="font-size: 42px; font-weight: bold; color: #2563eb; margin-bottom: 8px;">${totalDataEntries}</div>
                          <div style="font-size: 14px; color: #666; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Data Entries</div>
                        </div>
                      </td>
                      <td width="25%" style="text-align: center; padding: 15px;">
                        <div style="background-color: rgba(255,255,255,0.95); padding: 25px 20px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                          <div style="font-size: 42px; font-weight: bold; color: #dc2626; margin-bottom: 8px;">${totalOverdue}</div>
                          <div style="font-size: 14px; color: #666; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Overdue Tasks</div>
                        </div>
                      </td>
                      <td width="25%" style="text-align: center; padding: 15px;">
                        <div style="background-color: rgba(255,255,255,0.95); padding: 25px 20px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                          <div style="font-size: 42px; font-weight: bold; color: #2563eb; margin-bottom: 8px;">${totalOpen}</div>
                          <div style="font-size: 14px; color: #666; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Open Tasks</div>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Team Members Content -->
              <tr>
                <td style="padding: 40px; background-color: #f9fafb;">
                  <h2 style="margin: 0 0 30px 0; color: #1f2937; font-size: 26px; font-weight: bold; text-align: center; padding-bottom: 15px; border-bottom: 3px solid #FF7A00;">
                    📋 Detailed Team Activity
                  </h2>
                  
                  ${teamMembersSection}
                </td>
              </tr>
              
              ${dailyEntries && dailyEntries.length > 0 ? `
              <!-- Daily Performance Entries Section -->
              <tr>
                <td style="padding: 40px; background-color: #ffffff;">
                  <h2 style="margin: 0 0 30px 0; color: #1f2937; font-size: 26px; font-weight: bold; text-align: center; padding-bottom: 15px; border-bottom: 3px solid #3b82f6;">
                    📝 Daily Performance Entries
                  </h2>
                  
                  <div style="background: #f8fafc; padding: 24px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    ${dailyEntries.map((entry: any) => {
                      const userName = `${entry.profiles?.first_name || ''} ${entry.profiles?.last_name || ''}`.trim() || 'Unknown User';
                      const entryDate = new Date(entry.date + 'T12:00:00').toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                      });
                      
                      return `
                        <div style="background: white; padding: 16px; border-radius: 6px; margin-bottom: 16px; border-left: 4px solid #3b82f6;">
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="font-weight: 600; color: #2c3e50; font-size: 15px;">👤 ${userName}</td>
                              <td align="right" style="color: #64748b; font-size: 13px;">📅 ${entryDate}</td>
                            </tr>
                            <tr>
                              <td colspan="2" style="padding-top: 8px; color: #475569; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${entry.entry}</td>
                            </tr>
                          </table>
                        </div>
                      `;
                    }).join('')}
                  </div>
                </td>
              </tr>
              ` : ''}

              <!-- Footer -->
              <tr>
                <td style="padding: 30px 40px; background: linear-gradient(135deg, #1f2937 0%, #111827 100%); border-top: 3px solid #FF7A00;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="text-align: center;">
                        <p style="margin: 0 0 10px 0; color: #d1d5db; font-size: 14px; line-height: 1.6;">
                          This is an automated daily summary generated by the Property Central team management system.
                        </p>
                        <p style="margin: 10px 0 0 0; color: #FF7A00; font-size: 15px; font-weight: 700;">
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
