import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getBillComSession() {
  const BILLCOM_DEV_KEY = Deno.env.get("BILLCOM_DEV_KEY");
  const BILLCOM_USERNAME = Deno.env.get("BILLCOM_USERNAME");
  const BILLCOM_PASSWORD = Deno.env.get("BILLCOM_PASSWORD");
  const BILLCOM_ORG_ID = Deno.env.get("BILLCOM_ORG_ID");

  const loginResponse = await fetch("https://api.bill.com/api/v2/Login.json", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      devKey: BILLCOM_DEV_KEY!,
      userName: BILLCOM_USERNAME!,
      password: BILLCOM_PASSWORD!,
      orgId: BILLCOM_ORG_ID!,
    }),
  });

  const loginData = await loginResponse.json();
  
  if (loginData.response_status !== 0) {
    throw new Error(loginData.response_message || "Bill.com authentication failed");
  }

  return {
    sessionId: loginData.response_data.sessionId,
    devKey: BILLCOM_DEV_KEY!,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { vendorId } = await req.json();

    if (!vendorId) {
      return new Response(
        JSON.stringify({ success: false, error: "Vendor ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch vendor from database
    const { data: vendor, error: vendorError } = await supabase
      .from("vendors")
      .select("*")
      .eq("id", vendorId)
      .single();

    if (vendorError || !vendor) {
      console.error("Vendor not found:", vendorError);
      return new Response(
        JSON.stringify({ success: false, error: "Vendor not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!vendor.email) {
      return new Response(
        JSON.stringify({ success: false, error: "Vendor email is required to send invitation" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Sending Bill.com invitation to vendor ${vendor.name}...`);

    // Get Bill.com session
    const { sessionId, devKey } = await getBillComSession();

    // First, create the vendor in Bill.com if not already synced
    let billcomVendorId = vendor.billcom_vendor_id;

    if (!billcomVendorId) {
      const createResponse = await fetch("https://api.bill.com/api/v2/Crud/Create/Vendor.json", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          devKey,
          sessionId,
          data: JSON.stringify({
            obj: {
              entity: "Vendor",
              isActive: "1",
              name: vendor.company_name || vendor.name,
              shortName: vendor.name.substring(0, 20),
              companyName: vendor.company_name || vendor.name,
              email: vendor.email,
              phone: vendor.phone || "",
              paymentEmail: vendor.email,
              country: "US",
            },
          }),
        }),
      });

      const createData = await createResponse.json();

      if (createData.response_status !== 0) {
        console.error("Failed to create vendor in Bill.com:", createData);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: createData.response_message || "Failed to create vendor in Bill.com" 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      billcomVendorId = createData.response_data.id;
      console.log(`Created vendor in Bill.com with ID: ${billcomVendorId}`);
    }

    // Send invitation to vendor to join Bill.com network
    // Note: Bill.com API uses "id" parameter for SendVendorInvite
    const inviteResponse = await fetch("https://api.bill.com/api/v2/SendVendorInvite.json", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        devKey,
        sessionId,
        data: JSON.stringify({
          vendorId: billcomVendorId,
        }),
      }),
    });

    const inviteData = await inviteResponse.json();
    console.log("Bill.com invite response:", JSON.stringify(inviteData));

    if (inviteData.response_status !== 0) {
      console.error("Failed to send Bill.com invitation:", inviteData);
      // Don't fail if invitation fails - vendor might already be in network
      console.log("Invitation may have already been sent or vendor is already in network");
    } else {
      console.log(`Bill.com invitation sent to ${vendor.email}`);
    }

    // Update vendor in Supabase
    const { error: updateError } = await supabase
      .from("vendors")
      .update({
        billcom_vendor_id: billcomVendorId,
        billcom_synced_at: new Date().toISOString(),
        billcom_invite_sent_at: new Date().toISOString(),
      })
      .eq("id", vendorId);

    if (updateError) {
      console.error("Failed to update vendor in Supabase:", updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        billcomVendorId,
        message: `Bill.com invitation sent to ${vendor.email}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error sending Bill.com invitation:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
