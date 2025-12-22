import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const BILLCOM_DEV_KEY = Deno.env.get("BILLCOM_DEV_KEY");
    const BILLCOM_USERNAME = Deno.env.get("BILLCOM_USERNAME");
    const BILLCOM_PASSWORD = Deno.env.get("BILLCOM_PASSWORD");
    const BILLCOM_ORG_ID = Deno.env.get("BILLCOM_ORG_ID");

    if (!BILLCOM_DEV_KEY || !BILLCOM_USERNAME || !BILLCOM_PASSWORD || !BILLCOM_ORG_ID) {
      console.error("Missing Bill.com credentials");
      return new Response(
        JSON.stringify({ success: false, error: "Bill.com credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Authenticating with Bill.com...");

    // Bill.com API authentication
    const loginResponse = await fetch("https://api.bill.com/api/v2/Login.json", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        devKey: BILLCOM_DEV_KEY,
        userName: BILLCOM_USERNAME,
        password: BILLCOM_PASSWORD,
        orgId: BILLCOM_ORG_ID,
      }),
    });

    const loginData = await loginResponse.json();

    if (loginData.response_status !== 0) {
      console.error("Bill.com login failed:", loginData);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: loginData.response_message || "Authentication failed" 
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Bill.com authentication successful");

    return new Response(
      JSON.stringify({
        success: true,
        sessionId: loginData.response_data.sessionId,
        orgId: BILLCOM_ORG_ID,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Bill.com authentication error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
