import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
  email: string;
  tempPassword: string;
  isExistingUser?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, tempPassword, isExistingUser = false }: WelcomeEmailRequest = await req.json();
    
    console.log("Sending welcome email to:", email, "isExistingUser:", isExistingUser);

    const loginSection = isExistingUser 
      ? `
        <h2 style="color: #555; margin-top: 30px;">🔑 Your Login Information</h2>
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f97316;">
          <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
          <p style="margin: 5px 0;"><strong>Password:</strong> Use your existing password</p>
        </div>
        
        <div style="background-color: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2196f3;">
          <p style="margin: 0; color: #1565c0;"><strong>💡 Forgot your password?</strong> You can reset it anytime using the "Forgot Password" link on the login page.</p>
        </div>
      `
      : `
        <h2 style="color: #555; margin-top: 30px;">🔑 Your Login Details</h2>
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f97316;">
          <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
          <p style="margin: 5px 0;"><strong>Temporary Password:</strong> <code style="background-color: #fff; padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size: 14px;">${tempPassword}</code></p>
        </div>
        
        <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <p style="margin: 0; color: #856404;"><strong>⚠️ Important Security Note:</strong> Please change your password after your first login for security purposes.</p>
        </div>
      `;

    const emailResponse = await resend.emails.send({
      from: "PeachHaus Group <onboarding@resend.dev>",
      to: [email],
      bcc: ["ingo@peachhausgroup.com"],
      subject: "Welcome to PeachHaus Property Management System",
      html: `
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
                    <td style="background: linear-gradient(135deg, #f97316 0%, #fb923c 100%); padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0;">
                      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">Welcome to PeachHaus</h1>
                      <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 16px; opacity: 0.95;">Property Management System</p>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px 30px;">
                      <p style="font-size: 16px; line-height: 1.6; color: #333; margin: 0 0 20px 0;">Hello,</p>
                      
                      <p style="font-size: 16px; line-height: 1.6; color: #333; margin: 0 0 20px 0;">${isExistingUser ? "Your account is active in" : "Your account has been created for"} the PeachHaus Property Management System. We're excited to have you on our team!</p>
                      
                      ${loginSection}
                      
                      <h2 style="color: #555; margin-top: 40px; margin-bottom: 15px; font-size: 20px;">📋 What This System Does</h2>
                      <p style="font-size: 15px; line-height: 1.6; color: #333; margin: 0 0 15px 0;">The PeachHaus Property Management System is your central hub for managing property onboarding and operations:</p>
                      
                      <table width="100%" cellpadding="8" cellspacing="0" style="margin: 20px 0;">
                        <tr>
                          <td style="vertical-align: top; padding: 12px 0;">
                            <strong style="color: #f97316; font-size: 18px;">✓</strong>
                          </td>
                          <td style="padding: 12px 0;">
                            <strong style="color: #333;">Property Onboarding:</strong><br>
                            <span style="color: #666; font-size: 14px; line-height: 1.5;">When we bring on a new property, we assign you specific tasks through this system. Track all assigned tasks, upload documents, and mark items as complete.</span>
                          </td>
                        </tr>
                        <tr style="background-color: #f9f9f9;">
                          <td style="vertical-align: top; padding: 12px 0;">
                            <strong style="color: #f97316; font-size: 18px;">✓</strong>
                          </td>
                          <td style="padding: 12px 0;">
                            <strong style="color: #333;">Task Management:</strong><br>
                            <span style="color: #666; font-size: 14px; line-height: 1.5;">View all your assigned tasks with due dates, priorities, and detailed instructions.</span>
                          </td>
                        </tr>
                        <tr>
                          <td style="vertical-align: top; padding: 12px 0;">
                            <strong style="color: #f97316; font-size: 18px;">✓</strong>
                          </td>
                          <td style="padding: 12px 0;">
                            <strong style="color: #333;">Property Visits:</strong><br>
                            <span style="color: #666; font-size: 14px; line-height: 1.5;">Log and track property visits with detailed notes and timestamps.</span>
                          </td>
                        </tr>
                        <tr style="background-color: #f9f9f9;">
                          <td style="vertical-align: top; padding: 12px 0;">
                            <strong style="color: #f97316; font-size: 18px;">✓</strong>
                          </td>
                          <td style="padding: 12px 0;">
                            <strong style="color: #333;">Expense Tracking:</strong><br>
                            <span style="color: #666; font-size: 14px; line-height: 1.5;">Monitor property-related expenses and maintain accurate financial records.</span>
                          </td>
                        </tr>
                        <tr>
                          <td style="vertical-align: top; padding: 12px 0;">
                            <strong style="color: #f97316; font-size: 18px;">✓</strong>
                          </td>
                          <td style="padding: 12px 0;">
                            <strong style="color: #333;">Team Collaboration:</strong><br>
                            <span style="color: #666; font-size: 14px; line-height: 1.5;">Work seamlessly with other team members on property projects.</span>
                          </td>
                        </tr>
                        <tr style="background-color: #f9f9f9;">
                          <td style="vertical-align: top; padding: 12px 0;">
                            <strong style="color: #f97316; font-size: 18px;">✓</strong>
                          </td>
                          <td style="padding: 12px 0;">
                            <strong style="color: #333;">Document Access:</strong><br>
                            <span style="color: #666; font-size: 14px; line-height: 1.5;">Access important property details, documents, and information all in one place.</span>
                          </td>
                        </tr>
                      </table>
                      
                      <!-- Login Link Box -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0; background-color: #e3f2fd; border-radius: 8px; border-left: 4px solid #2196f3;">
                        <tr>
                          <td style="padding: 25px;">
                            <h3 style="margin: 0 0 15px 0; color: #1565c0; font-size: 18px;">📌 Bookmark This Page!</h3>
                            <p style="margin: 0 0 15px 0; color: #333; font-size: 15px; line-height: 1.5;">Save this link to your browser bookmarks for quick and easy access:</p>
                            <table width="100%" cellpadding="0" cellspacing="0">
                              <tr>
                                <td style="padding: 15px; background-color: #ffffff; border-radius: 6px;">
                                  <p style="margin: 0 0 5px 0; color: #666; font-size: 13px; font-weight: bold;">LOGIN URL</p>
                                  <a href="https://property-visit-expense-tracker.lovable.app" style="color: #2196f3; font-size: 15px; text-decoration: none; word-break: break-all; font-weight: 500;">https://property-visit-expense-tracker.lovable.app</a>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                      
                      <h2 style="color: #555; margin-top: 40px; margin-bottom: 15px; font-size: 20px;">🚀 Getting Started</h2>
                      <ol style="padding-left: 20px; line-height: 2; color: #333; font-size: 15px;">
                        <li>Click the login link above</li>
                        <li>Enter your email${isExistingUser ? "" : " and temporary password"}</li>
                        ${isExistingUser ? "" : "<li>Change your password to something secure and memorable</li>"}
                        <li>Explore your dashboard and check for any assigned tasks</li>
                        <li>Bookmark the page for easy access</li>
                      </ol>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="padding: 30px; background-color: #f9f9f9; border-radius: 0 0 8px 8px; border-top: 1px solid #e0e0e0;">
                      <p style="margin: 0 0 15px 0; color: #666; font-size: 14px; line-height: 1.6;">If you have any questions or need assistance getting started, please don't hesitate to reach out to our team.</p>
                      
                      <p style="margin: 30px 0 0 0; color: #333; font-size: 14px;">
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
      `,
    });

    console.log("Welcome email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error sending welcome email:", error);
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
