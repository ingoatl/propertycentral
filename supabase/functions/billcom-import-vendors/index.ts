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

  if (!BILLCOM_DEV_KEY || !BILLCOM_USERNAME || !BILLCOM_PASSWORD || !BILLCOM_ORG_ID) {
    throw new Error("Bill.com credentials not configured");
  }

  const loginResponse = await fetch("https://api.bill.com/api/v2/Login.json", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      devKey: BILLCOM_DEV_KEY,
      userName: BILLCOM_USERNAME,
      password: BILLCOM_PASSWORD,
      orgId: BILLCOM_ORG_ID,
    }),
  });

  const loginData = await loginResponse.json();
  
  if (loginData.response_status !== 0) {
    throw new Error(loginData.response_message || "Bill.com authentication failed");
  }

  return {
    sessionId: loginData.response_data.sessionId,
    devKey: BILLCOM_DEV_KEY,
  };
}

// Auto-classify vendor specialty based on name/description
function classifyVendorSpecialty(name: string, description?: string): string[] {
  const text = `${name} ${description || ""}`.toLowerCase();
  const specialties: string[] = [];

  if (text.includes("electric") || text.includes("lighting") || text.includes("wiring")) {
    specialties.push("electrical");
  }
  if (text.includes("plumb") || text.includes("pipe") || text.includes("drain") || text.includes("water heater")) {
    specialties.push("plumbing");
  }
  if (text.includes("hvac") || text.includes("air condition") || text.includes("heating") || text.includes("furnace") || text.includes("a/c") || text.includes("ac ")) {
    specialties.push("hvac");
  }
  if (text.includes("pest") || text.includes("termite") || text.includes("exterminator") || text.includes("rodent")) {
    specialties.push("pest_control");
  }
  if (text.includes("lawn") || text.includes("landscape") || text.includes("garden") || text.includes("tree") || text.includes("yard")) {
    specialties.push("landscaping");
  }
  if (text.includes("clean") || text.includes("maid") || text.includes("janitorial")) {
    specialties.push("cleaning");
  }
  if (text.includes("lock") || text.includes("security") || text.includes("alarm") || text.includes("key")) {
    specialties.push("locks_security");
  }
  if (text.includes("appliance") || text.includes("refrigerator") || text.includes("washer") || text.includes("dryer") || text.includes("dishwasher")) {
    specialties.push("appliances");
  }
  if (text.includes("roof") || text.includes("gutter") || text.includes("shingle")) {
    specialties.push("roofing");
  }
  if (text.includes("paint") || text.includes("drywall") || text.includes("wall")) {
    specialties.push("painting");
  }
  if (text.includes("floor") || text.includes("carpet") || text.includes("tile") || text.includes("hardwood")) {
    specialties.push("flooring");
  }
  if (text.includes("pool") || text.includes("spa") || text.includes("hot tub")) {
    specialties.push("pool_maintenance");
  }
  if (text.includes("window") || text.includes("glass") || text.includes("door")) {
    specialties.push("windows_doors");
  }
  if (text.includes("garage") || text.includes("gate")) {
    specialties.push("garage_doors");
  }
  if (text.includes("handyman") || text.includes("general")) {
    specialties.push("general");
  }

  // Default to general if no match
  if (specialties.length === 0) {
    specialties.push("general");
  }

  return specialties;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting Bill.com vendor import...");

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get Bill.com session
    const { sessionId, devKey } = await getBillComSession();
    console.log("Bill.com authentication successful");

    // Fetch all vendors from Bill.com
    const listResponse = await fetch("https://api.bill.com/api/v2/List/Vendor.json", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        devKey,
        sessionId,
        data: JSON.stringify({
          start: 0,
          max: 999,
        }),
      }),
    });

    const listData = await listResponse.json();

    if (listData.response_status !== 0) {
      console.error("Failed to fetch vendors from Bill.com:", listData);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: listData.response_message || "Failed to fetch vendors from Bill.com" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const billcomVendors = listData.response_data || [];
    console.log(`Found ${billcomVendors.length} vendors in Bill.com`);

    // Get existing vendors from our database
    const { data: existingVendors, error: fetchError } = await supabase
      .from("vendors")
      .select("id, email, billcom_vendor_id");

    if (fetchError) {
      console.error("Failed to fetch existing vendors:", fetchError);
      throw new Error("Failed to fetch existing vendors");
    }

    // Create lookup maps for duplicate detection
    const existingByBillcomId = new Map(
      existingVendors?.filter(v => v.billcom_vendor_id).map(v => [v.billcom_vendor_id, v]) || []
    );
    const existingByEmail = new Map(
      existingVendors?.filter(v => v.email).map(v => [v.email.toLowerCase(), v]) || []
    );

    let imported = 0;
    let skipped = 0;
    let updated = 0;
    const importedNames: string[] = [];
    const skippedNames: string[] = [];

    for (const bcVendor of billcomVendors) {
      const billcomId = bcVendor.id;
      const email = bcVendor.email?.toLowerCase();
      const name = bcVendor.name || bcVendor.companyName || "Unknown Vendor";
      const companyName = bcVendor.companyName || bcVendor.name;
      const phone = bcVendor.phone || bcVendor.altPhone || "";

      // Skip inactive vendors
      if (bcVendor.isActive === "2" || bcVendor.isActive === 2) {
        console.log(`Skipping inactive vendor: ${name}`);
        skippedNames.push(`${name} (inactive)`);
        skipped++;
        continue;
      }

      // Check for duplicate by Bill.com ID
      if (existingByBillcomId.has(billcomId)) {
        console.log(`Vendor already exists with billcom_vendor_id: ${name}`);
        skippedNames.push(`${name} (already synced)`);
        skipped++;
        continue;
      }

      // Check for duplicate by email
      if (email && existingByEmail.has(email)) {
        const existingVendor = existingByEmail.get(email);
        // Update the existing vendor with Bill.com ID if not set
        if (existingVendor && !existingVendor.billcom_vendor_id) {
          const { error: updateError } = await supabase
            .from("vendors")
            .update({
              billcom_vendor_id: billcomId,
              billcom_synced_at: new Date().toISOString(),
            })
            .eq("id", existingVendor.id);

          if (!updateError) {
            console.log(`Linked existing vendor to Bill.com: ${name}`);
            updated++;
          }
        } else {
          skippedNames.push(`${name} (email exists)`);
          skipped++;
        }
        continue;
      }

      // Classify vendor specialty based on name
      const specialties = classifyVendorSpecialty(name, bcVendor.description);

      // Create new vendor record
      const vendorData = {
        name: name,
        company_name: companyName !== name ? companyName : null,
        email: bcVendor.email || null,
        phone: phone || null,
        specialty: specialties,
        status: "active",
        billcom_vendor_id: billcomId,
        billcom_synced_at: new Date().toISOString(),
        notes: bcVendor.description || null,
        // Additional fields from Bill.com if available
        w9_on_file: bcVendor.form1099Required === "1" || bcVendor.form1099Required === 1,
      };

      const { error: insertError } = await supabase
        .from("vendors")
        .insert(vendorData);

      if (insertError) {
        console.error(`Failed to insert vendor ${name}:`, insertError);
        skippedNames.push(`${name} (insert failed: ${insertError.message})`);
        skipped++;
      } else {
        console.log(`Imported vendor: ${name} with specialties: ${specialties.join(", ")}`);
        importedNames.push(name);
        imported++;
      }
    }

    console.log(`Import complete: ${imported} imported, ${updated} updated, ${skipped} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        imported,
        updated,
        skipped,
        totalInBillcom: billcomVendors.length,
        importedNames,
        skippedNames,
        message: `Imported ${imported} new vendors, updated ${updated}, skipped ${skipped} duplicates`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error importing vendors from Bill.com:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
