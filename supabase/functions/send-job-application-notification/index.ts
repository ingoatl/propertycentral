import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface JobApplicationNotification {
  fullName: string;
  email: string;
  phone: string;
  availability: string[];
  hasTechnicalSkills: boolean;
  detailOrientedExample: string | null;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Job application notification function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const application: JobApplicationNotification = await req.json();
    console.log("Processing application for:", application.fullName);

    const availabilityText = application.availability.length > 0 
      ? application.availability.map(a => a.charAt(0).toUpperCase() + a.slice(1)).join(", ")
      : "Not specified";

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f97316, #fb923c); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
          .content { background: #fff; border: 1px solid #e5e7eb; border-top: none; padding: 30px; border-radius: 0 0 12px 12px; }
          .badge { display: inline-block; background: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 10px; }
          .field { margin-bottom: 20px; }
          .field-label { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
          .field-value { font-size: 16px; font-weight: 500; }
          .skills-badge { display: inline-block; padding: 6px 14px; border-radius: 20px; font-size: 14px; font-weight: 500; }
          .skills-yes { background: #dcfce7; color: #166534; }
          .skills-no { background: #f3f4f6; color: #6b7280; }
          .quote-box { background: #f9fafb; border-left: 4px solid #f97316; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0; }
          .cta { text-align: center; margin-top: 30px; }
          .cta a { display: inline-block; background: #f97316; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 24px;">🏠 New Job Application</h1>
            <p style="margin: 10px 0 0; opacity: 0.9;">Property Inspector & Maintenance Tech</p>
          </div>
          <div class="content">
            <div class="badge">Independent Contractor Position</div>
            
            <div class="field">
              <div class="field-label">Applicant Name</div>
              <div class="field-value">${application.fullName}</div>
            </div>
            
            <div class="field">
              <div class="field-label">Email</div>
              <div class="field-value"><a href="mailto:${application.email}">${application.email}</a></div>
            </div>
            
            <div class="field">
              <div class="field-label">Phone</div>
              <div class="field-value"><a href="tel:${application.phone}">${application.phone}</a></div>
            </div>
            
            <div class="field">
              <div class="field-label">Availability</div>
              <div class="field-value">${availabilityText}</div>
            </div>
            
            <div class="field">
              <div class="field-label">Technical Skills (Smart Locks, Minor Repairs)</div>
              <span class="skills-badge ${application.hasTechnicalSkills ? 'skills-yes' : 'skills-no'}">
                ${application.hasTechnicalSkills ? '✓ Yes' : '✗ No'}
              </span>
            </div>
            
            ${application.detailOrientedExample ? `
            <div class="field">
              <div class="field-label">What Makes Them Detail-Oriented</div>
              <div class="quote-box">
                "${application.detailOrientedExample}"
              </div>
            </div>
            ` : ''}
            
            <div class="cta">
              <a href="mailto:${application.email}?subject=Re: Property Inspector Application at PeachHaus">
                📧 Reply to Applicant
              </a>
            </div>
            
            <div class="footer">
              <p>This application was submitted through the PeachHaus careers page.</p>
              <p>View all applications in Property Central → Admin → Applications</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "PeachHaus Hiring <info@peachhausgroup.com>",
        to: ["ingo@peachhausgroup.com"],
        subject: `🎯 New Job Application: ${application.fullName} - Property Inspector`,
        html: emailHtml,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Resend API error:", errorText);
      throw new Error(`Failed to send email: ${errorText}`);
    }

    const emailResponse = await res.json();
    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending job application notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
