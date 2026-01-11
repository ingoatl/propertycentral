import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LookupResult {
  phone: string;
  name?: string;
  carrier?: string;
  lineType?: string;
  callerName?: string;
  valid: boolean;
  cached: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phones } = await req.json();
    
    if (!phones || !Array.isArray(phones) || phones.length === 0) {
      return new Response(
        JSON.stringify({ error: "phones array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Limit to 10 lookups per request
    const phonesToLookup = phones.slice(0, 10);
    
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    
    if (!accountSid || !authToken) {
      console.error("Missing Twilio credentials");
      return new Response(
        JSON.stringify({ error: "Twilio not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const results: LookupResult[] = [];

    for (const phone of phonesToLookup) {
      // Normalize phone number
      const normalizedPhone = phone.replace(/\D/g, "");
      if (normalizedPhone.length < 10) {
        results.push({ phone, valid: false, cached: false });
        continue;
      }

      // Check cache first (in phone_lookups table if exists)
      const { data: cached } = await supabase
        .from("phone_lookups")
        .select("*")
        .eq("phone", normalizedPhone)
        .single();

      if (cached) {
        results.push({
          phone: normalizedPhone,
          name: cached.caller_name || undefined,
          carrier: cached.carrier || undefined,
          lineType: cached.line_type || undefined,
          callerName: cached.caller_name || undefined,
          valid: true,
          cached: true,
        });
        continue;
      }

      // Format phone for Twilio (E.164)
      const e164Phone = normalizedPhone.startsWith("1") 
        ? `+${normalizedPhone}` 
        : `+1${normalizedPhone}`;

      try {
        // Use Twilio Lookup API v2 with caller name
        const lookupUrl = `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(e164Phone)}?Fields=caller_name,line_type_intelligence`;
        
        const authHeader = btoa(`${accountSid}:${authToken}`);
        const response = await fetch(lookupUrl, {
          headers: {
            Authorization: `Basic ${authHeader}`,
          },
        });

        if (!response.ok) {
          console.error(`Twilio lookup failed for ${e164Phone}:`, await response.text());
          results.push({ phone: normalizedPhone, valid: false, cached: false });
          continue;
        }

        const data = await response.json();
        
        const callerName = data.caller_name?.caller_name || null;
        const lineType = data.line_type_intelligence?.type || null;
        const carrier = data.line_type_intelligence?.carrier_name || null;

        // Cache the result
        await supabase.from("phone_lookups").upsert({
          phone: normalizedPhone,
          e164_phone: e164Phone,
          caller_name: callerName,
          carrier: carrier,
          line_type: lineType,
          valid: data.valid !== false,
          raw_response: data,
          looked_up_at: new Date().toISOString(),
        }, { onConflict: "phone" });

        results.push({
          phone: normalizedPhone,
          name: callerName || undefined,
          carrier: carrier || undefined,
          lineType: lineType || undefined,
          callerName: callerName || undefined,
          valid: data.valid !== false,
          cached: false,
        });

      } catch (lookupError) {
        console.error(`Error looking up ${e164Phone}:`, lookupError);
        results.push({ phone: normalizedPhone, valid: false, cached: false });
      }
    }

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Phone lookup error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
