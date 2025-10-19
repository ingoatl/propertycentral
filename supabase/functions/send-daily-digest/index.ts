import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TaskSummary {
  overdue: Array<{
    id: string;
    title: string;
    property_address: string;
    due_date: string;
    days_overdue: number;
  }>;
  due_today: Array<{
    id: string;
    title: string;
    property_address: string;
    due_date: string;
  }>;
  due_this_week: Array<{
    id: string;
    title: string;
    property_address: string;
    due_date: string;
  }>;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting daily digest email process");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all users with approved status
    const { data: users, error: usersError } = await supabase
      .from("profiles")
      .select("id, email, first_name")
      .eq("status", "approved");

    if (usersError) {
      console.error("Error fetching users:", usersError);
      throw usersError;
    }

    console.log(`Found ${users?.length || 0} approved users`);

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const weekFromNow = new Date(today);
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    const weekFromNowStr = weekFromNow.toISOString().split('T')[0];

    let emailsSent = 0;
    let errors = 0;

    // Process each user
    for (const user of users || []) {
      try {
        // Get user's tasks
        const { data: tasks, error: tasksError } = await supabase
          .from("onboarding_tasks")
          .select(`
            id,
            title,
            due_date,
            status,
            onboarding_projects (
              property_address
            )
          `)
          .eq("assigned_to_uuid", user.id)
          .neq("status", "completed")
          .not("due_date", "is", null);

        if (tasksError) {
          console.error(`Error fetching tasks for user ${user.email}:`, tasksError);
          continue;
        }

        if (!tasks || tasks.length === 0) {
          console.log(`No open tasks for user ${user.email}, skipping email`);
          continue;
        }

        // Categorize tasks
        const taskSummary: TaskSummary = {
          overdue: [],
          due_today: [],
          due_this_week: []
        };

        for (const task of tasks) {
          const dueDate = new Date(task.due_date);
          const dueDateStr = task.due_date;
          const project = Array.isArray(task.onboarding_projects) ? task.onboarding_projects[0] : task.onboarding_projects;
          const property_address = project?.property_address || "Unknown Property";

          if (dueDateStr < todayStr) {
            // Overdue
            const daysDiff = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
            taskSummary.overdue.push({
              id: task.id,
              title: task.title,
              property_address,
              due_date: task.due_date,
              days_overdue: daysDiff
            });
          } else if (dueDateStr === todayStr) {
            // Due today
            taskSummary.due_today.push({
              id: task.id,
              title: task.title,
              property_address,
              due_date: task.due_date
            });
          } else if (dueDateStr <= weekFromNowStr) {
            // Due this week
            taskSummary.due_this_week.push({
              id: task.id,
              title: task.title,
              property_address,
              due_date: task.due_date
            });
          }
        }

        // Only send email if there are tasks to report
        const totalTasks = taskSummary.overdue.length + taskSummary.due_today.length + taskSummary.due_this_week.length;
        if (totalTasks === 0) {
          console.log(`No tasks due soon for ${user.email}, skipping email`);
          continue;
        }

        // Generate email HTML
        const emailHtml = generateDigestEmail(user.first_name || user.email.split('@')[0], taskSummary);

        // Send email
        const emailResponse = await resend.emails.send({
          from: "PeachHaus Tasks <admin@peachhausgroup.com>",
          to: [user.email],
          subject: `Your PeachHaus Tasks - ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`,
          html: emailHtml,
        });

        console.log(`Digest email sent to ${user.email}:`, emailResponse);
        emailsSent++;

      } catch (error) {
        console.error(`Error processing user ${user.email}:`, error);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        emails_sent: emailsSent,
        errors: errors,
        total_users: users?.length || 0
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
    console.error("Error in daily digest function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

function generateDigestEmail(firstName: string, tasks: TaskSummary): string {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const overdueSection = tasks.overdue.length > 0 ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 25px;">
      <tr>
        <td style="padding: 20px; background-color: #fee2e2; border-left: 4px solid #ef4444; border-radius: 8px;">
          <h2 style="margin: 0 0 15px 0; color: #991b1b; font-size: 18px;">
            🔴 OVERDUE (${tasks.overdue.length})
          </h2>
          ${tasks.overdue.map(task => `
            <div style="padding: 12px 0; border-bottom: 1px solid #fecaca;">
              <div style="font-weight: bold; color: #333; margin-bottom: 4px;">${task.title}</div>
              <div style="font-size: 14px; color: #666; margin-bottom: 4px;">${task.property_address}</div>
              <div style="font-size: 13px; color: #991b1b;">${task.days_overdue} day${task.days_overdue === 1 ? '' : 's'} overdue (Due: ${formatDate(task.due_date)})</div>
            </div>
          `).join('')}
        </td>
      </tr>
    </table>
  ` : '';

  const dueTodaySection = tasks.due_today.length > 0 ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 25px;">
      <tr>
        <td style="padding: 20px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px;">
          <h2 style="margin: 0 0 15px 0; color: #92400e; font-size: 18px;">
            ⚠️ DUE TODAY (${tasks.due_today.length})
          </h2>
          ${tasks.due_today.map(task => `
            <div style="padding: 12px 0; border-bottom: 1px solid #fde68a;">
              <div style="font-weight: bold; color: #333; margin-bottom: 4px;">${task.title}</div>
              <div style="font-size: 14px; color: #666;">${task.property_address}</div>
            </div>
          `).join('')}
        </td>
      </tr>
    </table>
  ` : '';

  const dueThisWeekSection = tasks.due_this_week.length > 0 ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 25px;">
      <tr>
        <td style="padding: 20px; background-color: #dbeafe; border-left: 4px solid #3b82f6; border-radius: 8px;">
          <h2 style="margin: 0 0 15px 0; color: #1e40af; font-size: 18px;">
            📅 DUE THIS WEEK (${tasks.due_this_week.length})
          </h2>
          ${tasks.due_this_week.map(task => `
            <div style="padding: 12px 0; border-bottom: 1px solid #bfdbfe;">
              <div style="font-weight: bold; color: #333; margin-bottom: 4px;">${task.title}</div>
              <div style="font-size: 14px; color: #666; margin-bottom: 4px;">${task.property_address}</div>
              <div style="font-size: 13px; color: #1e40af;">Due: ${formatDate(task.due_date)}</div>
            </div>
          `).join('')}
        </td>
      </tr>
    </table>
  ` : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: Arial, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #f97316 0%, #fb923c 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: bold;">Your Daily Task Digest</h1>
                  <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 14px; opacity: 0.95;">${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="font-size: 16px; line-height: 1.6; color: #333; margin: 0 0 25px 0;">Hi ${firstName},</p>
                  
                  <p style="font-size: 16px; line-height: 1.6; color: #333; margin: 0 0 30px 0;">Here's your task summary for today:</p>
                  
                  ${overdueSection}
                  ${dueTodaySection}
                  ${dueThisWeekSection}
                  
                  <!-- Action Button -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                    <tr>
                      <td align="center" style="padding: 20px 0;">
                        <a href="https://property-visit-expense-tracker.lovable.app/properties" style="display: inline-block; background-color: #f97316; color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-size: 16px; font-weight: bold;">View All Tasks</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="padding: 30px; background-color: #f9f9f9; border-radius: 0 0 8px 8px; border-top: 1px solid #e0e0e0;">
                  <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.6; text-align: center;">
                    Best regards,<br>
                    <strong style="color: #f97316;">The PeachHaus Group Team</strong>
                  </p>
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
