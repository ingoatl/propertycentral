import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");



const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReviewEmailRequest {
  bookingId: string;
  tenantName: string;
  tenantEmail: string;
  propertyName: string;
  reviewToken: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookingId, tenantName, tenantEmail, propertyName, reviewToken }: ReviewEmailRequest = await req.json();

    console.log("Sending review request email to:", tenantEmail, "for property:", propertyName);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the app URL from environment or use default
    const appUrl = Deno.env.get("APP_URL") || "https://ijsxcaaqphaciaenlegl.lovableproject.com";
    const reviewPageUrl = `${appUrl}/leave-review?token=${reviewToken}`;

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Thank You for Staying at ${propertyName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #f97316, #fb923c); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: white; font-size: 28px; font-weight: bold;">
                Thank You for Staying With Us! 🏡
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; font-size: 18px; color: #1f2937;">
                Dear ${tenantName},
              </p>
              
              <p style="margin: 0 0 20px; font-size: 16px; color: #4b5563; line-height: 1.6;">
                It's been a wonderful time since you moved into <strong>${propertyName}</strong>, and we wanted to reach out personally to see how you're enjoying your stay!
              </p>
              
              <!-- Host Image Section -->
              <div style="text-align: center; margin: 30px 0;">
                <img src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/hosts/anja-ingo-hosts.jpg" alt="Anja & Ingo" style="width: 100%; max-width: 400px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
              </div>
              
              <p style="margin: 0 0 20px; font-size: 16px; color: #4b5563; line-height: 1.6;">
                We're <strong>Anja & Ingo</strong>, and we truly pour our hearts into making every stay at PeachHaus properties feel like home. Your comfort and experience mean everything to us.
              </p>
              
              <p style="margin: 0 0 20px; font-size: 16px; color: #4b5563; line-height: 1.6;">
                If you have a moment, we would be incredibly grateful if you could share your thoughts with a quick review. Your feedback helps us:
              </p>
              
              <ul style="margin: 0 0 20px; padding-left: 20px; color: #4b5563; line-height: 1.8;">
                <li>Continue improving our processes</li>
                <li>Help other travelers find great mid-term housing</li>
                <li>Know we're on the right track!</li>
              </ul>
              
              <!-- Gift Card Callout -->
              <div style="background: linear-gradient(135deg, #ecfdf5, #d1fae5); border: 1px solid #6ee7b7; border-radius: 12px; padding: 20px; margin: 30px 0; text-align: center;">
                <p style="margin: 0; font-size: 18px; color: #047857; font-weight: bold;">
                  🎁 As a thank you, receive a $15 Amazon Gift Card
                </p>
                <p style="margin: 10px 0 0; font-size: 14px; color: #059669;">
                  once you submit your review!
                </p>
              </div>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${reviewPageUrl}" style="display: inline-block; background: linear-gradient(135deg, #f97316, #fb923c); color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-size: 16px; font-weight: bold; box-shadow: 0 4px 12px rgba(249, 115, 22, 0.4);">
                  Leave a Review →
                </a>
              </div>
              
              <p style="margin: 30px 0 0; font-size: 14px; color: #9ca3af; text-align: center;">
                We've made it super easy — just click the button above, personalize your review, and you're done!
              </p>
            </td>
          </tr>
          
          <!-- Signature -->
          <tr>
            <td style="padding: 20px 30px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px; font-size: 16px; color: #6b7280;">
                With warmest gratitude,
              </p>
              <img src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/hosts/anja-signature.png" alt="Anja's Signature" style="height: 50px; margin: 10px 0;">
              <p style="margin: 10px 0 0; font-size: 16px; color: #1f2937; font-weight: bold;">
                Anja & Ingo
              </p>
              <p style="margin: 5px 0 0; font-size: 14px; color: #6b7280;">
                Your Hosts at PeachHaus Group
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

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "PeachHaus Group <hello@peachhausgroup.com>",
        to: [tenantEmail],
        subject: `Thank You for Staying at ${propertyName} 🏡`,
        html: emailHtml,
      }),
    });

    const emailData = await emailResponse.json();
    console.log("Email sent successfully:", emailData);

    // Update the booking record
    const { error: updateError } = await supabase
      .from("mid_term_bookings")
      .update({
        review_email_sent: true,
        review_email_sent_at: new Date().toISOString(),
      })
      .eq("id", bookingId);

    if (updateError) {
      console.error("Error updating booking:", updateError);
    }

    return new Response(JSON.stringify({ success: true, emailData }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-review-request-email function:", error);
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
