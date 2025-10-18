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
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, tempPassword }: WelcomeEmailRequest = await req.json();
    
    console.log("Sending welcome email to:", email);

    const emailResponse = await resend.emails.send({
      from: "PeachHaus Group <onboarding@resend.dev>",
      to: [email],
      bcc: ["ingo@peachhausgroup.com"],
      subject: "Welcome to PeachHaus Property Management System",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #f97316;">Welcome to PeachHaus Property Management System</h1>
          
          <p>Hello,</p>
          
          <p>Your account has been created for the PeachHaus Property Management System. We're excited to have you on our team!</p>
          
          <h2 style="color: #555; margin-top: 30px;">🔑 Your Login Details</h2>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f97316;">
            <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 5px 0;"><strong>Temporary Password:</strong> <code style="background-color: #fff; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${tempPassword}</code></p>
          </div>
          
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <p style="margin: 0; color: #856404;"><strong>⚠️ Important Security Note:</strong> Please change your password after your first login for security purposes.</p>
          </div>
          
          <h2 style="color: #555; margin-top: 30px;">📋 What This System Does</h2>
          <p>The PeachHaus Property Management System is your central hub for managing property onboarding and operations. Here's what you can do:</p>
          <ul style="line-height: 1.8;">
            <li><strong>Property Onboarding:</strong> When we bring on a new property, we assign you specific tasks through this system. You'll be able to track all assigned tasks, upload documents, and mark items as complete.</li>
            <li><strong>Task Management:</strong> View all your assigned tasks with due dates, priorities, and detailed instructions.</li>
            <li><strong>Property Visits:</strong> Log and track property visits with detailed notes and timestamps.</li>
            <li><strong>Expense Tracking:</strong> Monitor property-related expenses and maintain accurate financial records.</li>
            <li><strong>Team Collaboration:</strong> Work seamlessly with other team members on property projects.</li>
            <li><strong>Document Access:</strong> Access important property details, documents, and information all in one place.</li>
          </ul>
          
          <div style="background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin: 30px 0; border-left: 4px solid #2196f3;">
            <h3 style="margin-top: 0; color: #1976d2;">📌 Bookmark This Page!</h3>
            <p style="margin: 10px 0;">Please save this link to your browser bookmarks for quick and easy access:</p>
            <p style="margin: 10px 0;">
              <strong>Login URL:</strong><br>
              <a href="https://property-visit-expense-tracker.lovable.app" style="color: #2196f3; font-size: 16px; word-break: break-all;">https://property-visit-expense-tracker.lovable.app</a>
            </p>
          </div>
          
          <h2 style="color: #555; margin-top: 30px;">🚀 Getting Started</h2>
          <ol style="line-height: 1.8;">
            <li>Click the login link above</li>
            <li>Enter your email and temporary password</li>
            <li>Change your password to something secure and memorable</li>
            <li>Explore your dashboard and check for any assigned tasks</li>
            <li>Bookmark the page for easy access</li>
          </ol>
          
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd;">
            <p>If you have any questions or need assistance getting started, please don't hesitate to reach out to our team.</p>
            
            <p style="margin-top: 30px;">Best regards,<br>
            <strong>The PeachHaus Group Team</strong></p>
          </div>
        </div>
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
