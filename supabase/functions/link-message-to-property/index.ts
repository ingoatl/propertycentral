import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messageId, messageBody, messageType } = await req.json();

    console.log("Link message to property request:", { messageId, messageType });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all properties
    const { data: properties, error: propertiesError } = await supabase
      .from("properties")
      .select("id, name, address");

    if (propertiesError) {
      throw propertiesError;
    }

    if (!properties || properties.length === 0) {
      return new Response(
        JSON.stringify({ matched: false, reason: "No properties found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Simple matching: check if message contains property name or address
    const messageLower = messageBody.toLowerCase();
    let matchedProperty = null;

    for (const property of properties) {
      const nameMatch = property.name && messageLower.includes(property.name.toLowerCase());
      const addressMatch = property.address && messageLower.includes(property.address.toLowerCase());
      
      // Also try partial address matching (street name, city)
      let partialAddressMatch = false;
      if (property.address) {
        const addressParts = property.address.split(",").map((p: string) => p.trim().toLowerCase());
        partialAddressMatch = addressParts.some((part: string) => 
          part.length > 3 && messageLower.includes(part)
        );
      }

      if (nameMatch || addressMatch || partialAddressMatch) {
        matchedProperty = property;
        break;
      }
    }

    if (!matchedProperty) {
      console.log("No property match found for message");
      return new Response(
        JSON.stringify({ matched: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Matched property: ${matchedProperty.name || matchedProperty.address}`);

    // Update the message with the property_id
    const table = messageType === "sms" ? "user_phone_messages" : "user_phone_calls";
    
    const { error: updateError } = await supabase
      .from(table)
      .update({ property_id: matchedProperty.id })
      .eq("id", messageId);

    if (updateError) {
      console.error("Error updating message:", updateError);
      throw updateError;
    }

    return new Response(
      JSON.stringify({ 
        matched: true, 
        propertyId: matchedProperty.id,
        propertyName: matchedProperty.name || matchedProperty.address
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Link message to property error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
