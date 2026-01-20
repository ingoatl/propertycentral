import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leadId } = await req.json();
    
    if (!leadId) {
      return new Response(
        JSON.stringify({ error: "Missing leadId parameter" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log(`Fetching lead data for payment setup: ${leadId}`);

    // Initialize Supabase with service role to bypass RLS
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch lead data including payment info and property address
    const { data, error } = await supabase
      .from("leads")
      .select("id, name, email, phone, property_address, stripe_customer_id, payment_method, has_payment_method")
      .eq("id", leadId)
      .single();

    if (error) {
      console.error("Error fetching lead:", error);
      return new Response(
        JSON.stringify({ error: "Lead not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // Return data in format matching owner payment setup
    return new Response(
      JSON.stringify({
        name: data.name,
        email: data.email,
        payment_method: data.payment_method,
        stripe_customer_id: data.stripe_customer_id,
        has_payment_method: data.has_payment_method || false,
        // For leads, we use property_address as the "property" info
        properties: data.property_address ? [{ name: data.property_address }] : [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in get-lead-for-payment:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
