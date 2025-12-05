import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Checking for review-eligible tenants...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate the date 4 weeks (28 days) ago
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    const fourWeeksAgoStr = fourWeeksAgo.toISOString().split("T")[0];

    // Find eligible bookings:
    // - Started at least 4 weeks ago
    // - Haven't received review email yet
    // - Have a tenant email
    // - Are active
    const { data: eligibleBookings, error: fetchError } = await supabase
      .from("mid_term_bookings")
      .select(`
        id,
        tenant_name,
        tenant_email,
        property_id,
        review_token,
        properties!inner(name)
      `)
      .eq("status", "active")
      .eq("review_email_sent", false)
      .not("tenant_email", "is", null)
      .lte("start_date", fourWeeksAgoStr);

    if (fetchError) {
      console.error("Error fetching eligible bookings:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${eligibleBookings?.length || 0} eligible bookings`);

    const results = [];

    for (const booking of eligibleBookings || []) {
      try {
        const propertyName = (booking as any).properties?.name || "Your Property";
        
        console.log(`Sending review email to ${booking.tenant_email} for ${propertyName}`);

        // Call the send-review-request-email function
        const { error: invokeError } = await supabase.functions.invoke("send-review-request-email", {
          body: {
            bookingId: booking.id,
            tenantName: booking.tenant_name,
            tenantEmail: booking.tenant_email,
            propertyName: propertyName,
            reviewToken: booking.review_token,
          },
        });

        if (invokeError) {
          console.error(`Error sending email to ${booking.tenant_email}:`, invokeError);
          results.push({ bookingId: booking.id, success: false, error: invokeError.message });
        } else {
          results.push({ bookingId: booking.id, success: true });
        }
      } catch (err: any) {
        console.error(`Error processing booking ${booking.id}:`, err);
        results.push({ bookingId: booking.id, success: false, error: err.message });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: eligibleBookings?.length || 0,
        results,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in check-review-eligible-tenants function:", error);
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
