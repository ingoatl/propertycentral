import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Vendor {
  id: string;
  name: string;
  specialty: string[];
  status: string;
  average_rating: number;
  total_jobs_completed: number;
  average_response_time_hours: number | null;
  insurance_verified: boolean;
  emergency_available: boolean;
}

interface AssignmentResult {
  vendor_id: string | null;
  vendor_name: string | null;
  reason: string;
  score: number;
}

function calculateVendorScore(vendor: Vendor, isPreferred: boolean): number {
  // Weighted scoring algorithm
  // Rating: 40% weight (scale 0-5, normalized to 0-40)
  const ratingScore = (vendor.average_rating || 3) * 8;

  // Response time: 30% weight (lower is better, cap at 48 hours)
  const responseHours = Math.min(vendor.average_response_time_hours || 24, 48);
  const responseScore = (48 - responseHours) * 0.625; // Max 30 points

  // Experience: 20% weight (based on completed jobs, cap at 100)
  const jobCount = Math.min(vendor.total_jobs_completed || 0, 100);
  const experienceScore = jobCount * 0.2; // Max 20 points

  // Insurance: 10% weight
  const insuranceScore = vendor.insurance_verified ? 10 : 0;

  // Preferred vendor bonus: +15 points
  const preferredBonus = isPreferred ? 15 : 0;

  return ratingScore + responseScore + experienceScore + insuranceScore + preferredBonus;
}

async function findBestVendor(
  supabase: any,
  propertyId: string,
  category: string,
  preferredVendorId: string | null
): Promise<AssignmentResult> {
  console.log(`Finding best vendor for property ${propertyId}, category: ${category}`);

  // 1. Check if preferred vendor is specified and available
  if (preferredVendorId) {
    const { data: preferredVendor } = await supabase
      .from("vendors")
      .select("*")
      .eq("id", preferredVendorId)
      .in("status", ["active", "preferred"])
      .single();

    if (preferredVendor) {
      console.log(`Using preferred vendor: ${preferredVendor.name}`);
      return {
        vendor_id: preferredVendor.id,
        vendor_name: preferredVendor.name,
        reason: "Preferred vendor for this schedule",
        score: calculateVendorScore(preferredVendor, true),
      };
    }
  }

  // 2. Check for property-level preferred vendor assignments
  const { data: propertyAssignment } = await supabase
    .from("property_vendor_assignments")
    .select("vendor_id, vendors(*)")
    .eq("property_id", propertyId)
    .eq("specialty", category)
    .eq("is_active", true)
    .single();

  if (propertyAssignment?.vendors) {
    const vendor = propertyAssignment.vendors as Vendor;
    console.log(`Using property-assigned vendor: ${vendor.name}`);
    return {
      vendor_id: vendor.id,
      vendor_name: vendor.name,
      reason: "Property preferred vendor",
      score: calculateVendorScore(vendor, true),
    };
  }

  // 3. Find best vendor by score
  const { data: vendors } = await supabase
    .from("vendors")
    .select("*")
    .in("status", ["active", "preferred"])
    .contains("specialty", [category]);

  if (!vendors || vendors.length === 0) {
    // Fallback: get any general contractor
    const { data: generalVendors } = await supabase
      .from("vendors")
      .select("*")
      .in("status", ["active", "preferred"])
      .contains("specialty", ["general"]);

    if (!generalVendors || generalVendors.length === 0) {
      console.log("No vendors available");
      return {
        vendor_id: null,
        vendor_name: null,
        reason: "No vendors available for this category",
        score: 0,
      };
    }

    // Score general vendors
    const scoredVendors = generalVendors.map((v: Vendor) => ({
      ...v,
      score: calculateVendorScore(v, v.status === "preferred"),
    }));

    scoredVendors.sort((a: any, b: any) => b.score - a.score);
    const best = scoredVendors[0];

    return {
      vendor_id: best.id,
      vendor_name: best.name,
      reason: `Best available general vendor (score: ${best.score.toFixed(1)})`,
      score: best.score,
    };
  }

  // Score and rank vendors
  const scoredVendors = vendors.map((v: Vendor) => ({
    ...v,
    score: calculateVendorScore(v, v.status === "preferred"),
  }));

  scoredVendors.sort((a: any, b: any) => b.score - a.score);
  const best = scoredVendors[0];

  console.log(`Best vendor: ${best.name} with score ${best.score.toFixed(1)}`);

  return {
    vendor_id: best.id,
    vendor_name: best.name,
    reason: `Best rated ${category} vendor (score: ${best.score.toFixed(1)})`,
    score: best.score,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { propertyId, category, preferredVendorId, scheduleId } = await req.json();

    if (!propertyId || !category) {
      throw new Error("propertyId and category are required");
    }

    const result = await findBestVendor(supabase, propertyId, category, preferredVendorId);

    // If scheduleId provided, update the schedule with the assignment
    if (scheduleId && result.vendor_id) {
      await supabase
        .from("property_maintenance_schedules")
        .update({ preferred_vendor_id: result.vendor_id })
        .eq("id", scheduleId);
    }

    console.log("Assignment result:", result);

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in auto-assign-preventive-vendor:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
