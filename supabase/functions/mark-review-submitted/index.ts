import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MarkReviewRequest {
  token: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token }: MarkReviewRequest = await req.json();

    console.log("Marking review as submitted for token:", token);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the booking details
    const { data: booking, error: fetchError } = await supabase
      .from("mid_term_bookings")
      .select(`
        id,
        tenant_name,
        tenant_email,
        property_id,
        properties!inner(name)
      `)
      .eq("review_token", token)
      .single();

    if (fetchError || !booking) {
      console.error("Error fetching booking:", fetchError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Update the booking
    const { error: updateError } = await supabase
      .from("mid_term_bookings")
      .update({
        review_submitted: true,
        review_submitted_at: new Date().toISOString(),
      })
      .eq("id", booking.id);

    if (updateError) {
      console.error("Error updating booking:", updateError);
      throw updateError;
    }

    const propertyName = (booking as any).properties?.name || "Property";

    // Send notification to admin about gift card
    try {
      const adminEmailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px;">
  <h2 style="color: #f97316;">New Review Submitted! 🎉</h2>
  
  <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <p><strong>Tenant:</strong> ${booking.tenant_name}</p>
    <p><strong>Email:</strong> ${booking.tenant_email}</p>
    <p><strong>Property:</strong> ${propertyName}</p>
    <p><strong>Submitted At:</strong> ${new Date().toLocaleString()}</p>
  </div>
  
  <div style="background: #ecfdf5; border: 1px solid #6ee7b7; padding: 20px; border-radius: 8px;">
    <h3 style="color: #047857; margin-top: 0;">Action Required:</h3>
    <p style="color: #047857;">Please send a <strong>$15 Amazon Gift Card</strong> to:</p>
    <p style="color: #047857; font-size: 18px; font-weight: bold;">${booking.tenant_email}</p>
  </div>
  
  <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
    This is an automated notification from the PeachHaus Review System.
  </p>
</body>
</html>`;

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "PeachHaus System <hello@peachhausgroup.com>",
          to: ["admin@peachhausgroup.com", "anja@peachhausgroup.com"],
          subject: `🎁 Review Submitted - Gift Card Needed for ${booking.tenant_name}`,
          html: adminEmailHtml,
        }),
      });
      console.log("Admin notification sent");
    } catch (emailError) {
      console.error("Error sending admin notification:", emailError);
      // Don't fail the whole request if admin email fails
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in mark-review-submitted function:", error);
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
