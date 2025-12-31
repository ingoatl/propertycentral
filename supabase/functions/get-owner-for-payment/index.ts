import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ownerId } = await req.json();
    
    if (!ownerId) {
      throw new Error("Missing required parameter: ownerId");
    }

    console.log(`[GET-OWNER-FOR-PAYMENT] Fetching owner: ${ownerId}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch owner data
    const { data: owner, error } = await supabase
      .from("property_owners")
      .select("id, name, email, payment_method, stripe_customer_id")
      .eq("id", ownerId)
      .single();

    if (error || !owner) {
      throw new Error("Owner not found");
    }

    // Fetch properties for this owner
    const { data: properties } = await supabase
      .from("properties")
      .select("name")
      .eq("owner_id", ownerId)
      .is("offboarded_at", null);

    console.log(`[GET-OWNER-FOR-PAYMENT] Found owner: ${owner.name}`);

    return new Response(JSON.stringify({ 
      ...owner,
      properties: properties || []
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[GET-OWNER-FOR-PAYMENT] Error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
