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
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Welcome to PeachHaus Property Management System</h1>
          
          <p>Hello,</p>
          
          <p>Your account has been created for the PeachHaus Property Management System. This system is designed to streamline property onboarding and task management.</p>
          
          <h2 style="color: #555;">Your Login Details</h2>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Temporary Password:</strong> ${tempPassword}</p>
          </div>
          
          <p style="color: #d32f2f;"><strong>Important:</strong> Please change your password after your first login for security purposes.</p>
          
          <h2 style="color: #555;">What This System Does</h2>
          <p>Our property management system helps you:</p>
          <ul>
            <li>Track and manage property onboarding tasks</li>
            <li>Monitor property visits and expenses</li>
            <li>Collaborate with team members on property projects</li>
            <li>Access property details and documentation</li>
          </ul>
          
          <p><strong>📌 Please bookmark this page</strong> so you can easily access the system whenever you need it.</p>
          
          <div style="margin: 30px 0; padding: 20px; background-color: #e3f2fd; border-radius: 5px;">
            <p style="margin: 0;"><strong>Login URL:</strong> <a href="${Deno.env.get("VITE_SUPABASE_URL") || "https://property-visit-expense-tracker.lovable.app"}">${Deno.env.get("VITE_SUPABASE_URL") || "https://property-visit-expense-tracker.lovable.app"}</a></p>
          </div>
          
          <p>If you have any questions or need assistance, please don't hesitate to reach out to our team.</p>
          
          <p>Best regards,<br>
          The PeachHaus Group Team</p>
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
