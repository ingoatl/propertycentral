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
    const { vendorId, workOrderId } = await req.json();

    if (!vendorId) {
      return new Response(
        JSON.stringify({ success: false, error: "Vendor ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[billcom-enroll-on-completion] Starting enrollment for vendor ${vendorId}`);

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

    // Fetch work order for context
    let propertyName = "the property";
    let workOrderRef: string | null = null;
    
    if (workOrderId) {
      const { data: workOrder } = await supabase
        .from("work_orders")
        .select(`
          id, title, quoted_cost,
          property:properties(name, address)
        `)
        .eq("id", workOrderId)
        .single();
      
      if (workOrder) {
        workOrderRef = `WO-${workOrderId.slice(0, 8).toUpperCase()}`;
        // Property comes back as an object from the join
        const property = workOrder.property as unknown as { name: string; address: string } | null;
        if (property?.name) {
          propertyName = property.name;
        }
      }
    }

    // Check if already connected to Bill.com
    if (vendor.billcom_vendor_id) {
      console.log(`Vendor ${vendor.name} already connected to Bill.com`);
      return new Response(
        JSON.stringify({
          success: true,
          alreadyConnected: true,
          billcomVendorId: vendor.billcom_vendor_id,
          message: "Vendor is already connected to Bill.com",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if vendor has email or phone
    if (!vendor.email && !vendor.phone) {
      return new Response(
        JSON.stringify({ success: false, error: "Vendor needs email or phone for Bill.com enrollment" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let billcomVendorId = null;

    // Try to create vendor in Bill.com if they have an email
    if (vendor.email) {
      try {
        console.log(`Creating vendor ${vendor.name} in Bill.com...`);
        const { sessionId, devKey } = await getBillComSession();

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
                address1: "",
                city: "",
                state: "",
                zip: "",
                country: "US",
              },
            }),
          }),
        });

        const createData = await createResponse.json();

        if (createData.response_status === 0) {
          billcomVendorId = createData.response_data.id;
          console.log(`Created vendor in Bill.com with ID: ${billcomVendorId}`);

          // Send enrollment invitation via Bill.com
          try {
            const inviteResponse = await fetch("https://api.bill.com/api/v2/SendVendorInvite.json", {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({
                devKey,
                sessionId,
                vendorId: billcomVendorId,
              }),
            });

            const inviteData = await inviteResponse.json();
            console.log("Bill.com invite response:", inviteData);
          } catch (inviteError) {
            console.error("Bill.com invite error (non-critical):", inviteError);
          }
        } else {
          console.error("Failed to create vendor in Bill.com:", createData);
        }
      } catch (billcomError) {
        console.error("Bill.com API error:", billcomError);
        // Continue - we'll send SMS notification even if Bill.com fails
      }
    }

    // Send SMS notification via GHL
    if (vendor.phone) {
      try {
        const GHL_API_KEY = Deno.env.get("GHL_API_KEY");
        const GHL_LOCATION_ID = Deno.env.get("GHL_LOCATION_ID");

        if (GHL_API_KEY && GHL_LOCATION_ID) {
          // Build the SMS message - don't include generic link, Bill.com sends proper invite email
          const smsMessage = `PeachHaus Property Management

${vendor.name}, you completed a job at ${propertyName}.

To receive payment, check your email (${vendor.email}) for a Bill.com invitation from info@peachhausgroup.com.

This allows us to pay you directly via bank deposit within 7-10 business days.

${workOrderRef ? `Reference: ${workOrderRef}` : ""}

Questions? 404-991-5076

- Ingo, PeachHaus`;

          // Send SMS via GHL
          const { data: smsResult, error: smsError } = await supabase.functions.invoke("ghl-send-sms", {
            body: {
              toNumber: vendor.phone,
              message: smsMessage.trim(),
              fromNumber: "+14045741740", // Maintenance line
            },
          });

          if (smsError) {
            console.error("SMS send error:", smsError);
          } else {
            console.log("SMS sent successfully:", smsResult);
          }
        }
      } catch (smsError) {
        console.error("SMS notification error:", smsError);
      }
    }

    // Update vendor record
    const updateData: Record<string, unknown> = {
      billcom_invite_sent_at: new Date().toISOString(),
    };

    if (billcomVendorId) {
      updateData.billcom_vendor_id = billcomVendorId;
      updateData.billcom_synced_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from("vendors")
      .update(updateData)
      .eq("id", vendorId);

    if (updateError) {
      console.error("Failed to update vendor record:", updateError);
    }

    console.log(`[billcom-enroll-on-completion] Enrollment complete for ${vendor.name}`);

    return new Response(
      JSON.stringify({
        success: true,
        billcomVendorId,
        inviteSent: true,
        smsSent: !!vendor.phone,
        message: billcomVendorId
          ? "Vendor enrolled in Bill.com and notified"
          : "Enrollment invitation sent via SMS",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[billcom-enroll-on-completion] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
