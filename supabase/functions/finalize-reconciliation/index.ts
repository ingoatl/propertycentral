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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) throw new Error("Unauthorized");

    const { reconciliation_id } = await req.json();
    if (!reconciliation_id) {
      throw new Error("reconciliation_id is required");
    }

    console.log(`Finalizing reconciliation ${reconciliation_id}`);

    // Get the reconciliation with platform listings to check if property is live
    const { data: rec, error: recError } = await supabaseClient
      .from("monthly_reconciliations")
      .select(`
        *,
        properties(id, name, management_fee_percentage, order_minimum_fee, first_listing_live_at),
        property_owners(service_type)
      `)
      .eq("id", reconciliation_id)
      .single();

    if (recError || !rec) {
      throw new Error("Reconciliation not found");
    }

    // Check if month has ended
    const reconciliationMonth = new Date(rec.reconciliation_month + "T00:00:00");
    const now = new Date();
    const monthEnd = new Date(reconciliationMonth.getFullYear(), reconciliationMonth.getMonth() + 1, 0);
    
    if (now <= monthEnd) {
      throw new Error("Cannot finalize reconciliation - month has not ended yet");
    }

    const firstDayOfMonth = new Date(reconciliationMonth.getFullYear(), reconciliationMonth.getMonth(), 1);
    const lastDayOfMonth = monthEnd;

    console.log(`Finalizing for month: ${firstDayOfMonth.toISOString().split("T")[0]} to ${lastDayOfMonth.toISOString().split("T")[0]}`);

    // Fetch mid-term bookings for duplicate detection
    const { data: midTermBookings } = await supabaseClient
      .from("mid_term_bookings")
      .select("*")
      .eq("property_id", rec.property_id)
      .eq("status", "active")
      .lte("start_date", lastDayOfMonth.toISOString().split("T")[0])
      .gte("end_date", firstDayOfMonth.toISOString().split("T")[0]);

    // Fetch final bookings from OwnerRez
    const { data: allBookings } = await supabaseClient
      .from("ownerrez_bookings")
      .select("*")
      .eq("property_id", rec.property_id)
      .gte("check_in", firstDayOfMonth.toISOString().split("T")[0])
      .lte("check_in", lastDayOfMonth.toISOString().split("T")[0]);

    // Filter out duplicates with mid-term
    const bookings = (allBookings || []).filter(ownerrezBooking => {
      const ownerrezStart = new Date(ownerrezBooking.check_in);
      const ownerrezEnd = new Date(ownerrezBooking.check_out);
      const ownerrezGuest = (ownerrezBooking.guest_name || "").toLowerCase().trim();
      
      return !(midTermBookings || []).some(midTerm => {
        const midTermStart = new Date(midTerm.start_date);
        const midTermEnd = new Date(midTerm.end_date);
        const midTermGuest = (midTerm.tenant_name || "").toLowerCase().trim();
        
        const datesOverlap = ownerrezStart <= midTermEnd && ownerrezEnd >= midTermStart;
        const guestMatch = ownerrezGuest.includes(midTermGuest.split(" ")[0]) || 
                          midTermGuest.includes(ownerrezGuest.split(" ")[0]);
        
        return datesOverlap && guestMatch;
      });
    });

    // Calculate revenue totals
    let accommodationRevenueTotal = 0;
    let cleaningFeesTotal = 0;
    let petFeesTotal = 0;
    let totalNights = 0;
    
    for (const booking of bookings) {
      const accommodationRevenue = Number(booking.accommodation_revenue || booking.total_amount || 0);
      const cleaningFee = Number(booking.cleaning_fee || 0);
      const petFee = Number(booking.pet_fee || 0);
      
      if (accommodationRevenue <= 0) continue;

      accommodationRevenueTotal += accommodationRevenue;
      cleaningFeesTotal += cleaningFee;
      petFeesTotal += petFee;

      if (booking.check_in && booking.check_out) {
        const checkIn = new Date(booking.check_in);
        const checkOut = new Date(booking.check_out);
        const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
        if (nights > 0) totalNights += nights;
      }
    }

    // Calculate mid-term revenue (prorated)
    let midTermRevenue = 0;
    for (const booking of midTermBookings || []) {
      const bookingStart = new Date(booking.start_date);
      const bookingEnd = new Date(booking.end_date);
      
      const effectiveStart = bookingStart > firstDayOfMonth ? bookingStart : firstDayOfMonth;
      const effectiveEnd = bookingEnd < lastDayOfMonth ? bookingEnd : lastDayOfMonth;
      const daysInBooking = Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const daysInMonth = lastDayOfMonth.getDate();
      const proratedAmount = (booking.monthly_rent / daysInMonth) * daysInBooking;
      
      midTermRevenue += proratedAmount;
    }

    const shortTermRevenue = bookings.reduce((sum, b) => sum + Number(b.total_amount || 0), 0);
    const totalRevenue = shortTermRevenue + midTermRevenue;

    // Get existing line items
    const { data: existingLineItems } = await supabaseClient
      .from("reconciliation_line_items")
      .select("*")
      .eq("reconciliation_id", reconciliation_id);

    const existingItemIds = new Set(
      (existingLineItems || []).map((item: any) => `${item.item_type}:${item.item_id}`)
    );

    // Find new expenses that weren't in preview
    const { data: newExpenses } = await supabaseClient
      .from("expenses")
      .select("*")
      .eq("property_id", rec.property_id)
      .eq("exported", false)
      .gte("date", firstDayOfMonth.toISOString().split("T")[0])
      .lte("date", lastDayOfMonth.toISOString().split("T")[0]);

    const expensesToAdd = (newExpenses || []).filter(
      (expense: any) => !existingItemIds.has(`expense:${expense.id}`)
    );

    // Find new visits
    const { data: newVisits } = await supabaseClient
      .from("visits")
      .select("*")
      .eq("property_id", rec.property_id)
      .eq("billed", false)
      .gte("date", firstDayOfMonth.toISOString().split("T")[0])
      .lte("date", lastDayOfMonth.toISOString().split("T")[0]);

    const visitsToAdd = (newVisits || []).filter(
      (visit: any) => !existingItemIds.has(`visit:${visit.id}`)
    );

    // Add new line items
    const newLineItems: any[] = [];

    // Add booking line items if not already present
    for (const booking of bookings) {
      if (existingItemIds.has(`booking:${booking.id}`)) continue;
      
      const accommodationRevenue = Number(booking.accommodation_revenue || booking.total_amount || 0);
      const cleaningFee = Number(booking.cleaning_fee || 0);
      const petFee = Number(booking.pet_fee || 0);
      
      if (accommodationRevenue > 0) {
        newLineItems.push({
          reconciliation_id,
          item_type: "booking",
          item_id: booking.id,
          description: `${booking.guest_name || "Guest"} - ${booking.ownerrez_listing_name}`,
          amount: accommodationRevenue,
          date: booking.check_in,
          category: "Short-term Booking",
          fee_type: "accommodation",
          verified: false,
        });
      }
      
      if (cleaningFee > 0 && !existingItemIds.has(`pass_through_fee:${booking.id}_cleaning`)) {
        newLineItems.push({
          reconciliation_id,
          item_type: "pass_through_fee",
          item_id: `${booking.id}_cleaning`,
          description: `Cleaning Fee - ${booking.guest_name || "Guest"}`,
          amount: -cleaningFee,
          date: booking.check_in,
          category: "Cleaning Fee",
          fee_type: "cleaning_fee",
          verified: false,
        });
      }
      
      if (petFee > 0 && !existingItemIds.has(`pass_through_fee:${booking.id}_pet`)) {
        newLineItems.push({
          reconciliation_id,
          item_type: "pass_through_fee",
          item_id: `${booking.id}_pet`,
          description: `Pet Fee - ${booking.guest_name || "Guest"}`,
          amount: -petFee,
          date: booking.check_in,
          category: "Pet Fee",
          fee_type: "pet_fee",
          verified: false,
        });
      }
    }

    // Add new expenses
    for (const expense of expensesToAdd) {
      const description = (expense.purpose || "").toLowerCase();
      const isVisitRelated = 
        description.includes('visit fee') ||
        description.includes('visit charge') ||
        description.includes('hourly charge') ||
        description.includes('property visit');
      
      if (isVisitRelated) continue;
      
      newLineItems.push({
        reconciliation_id,
        item_type: "expense",
        item_id: expense.id,
        description: expense.items_detail || expense.purpose || "Expense",
        amount: -Math.abs(expense.amount),
        date: expense.date,
        category: expense.category || "General Expense",
        fee_type: "expense",
        verified: false,
      });
    }

    // Add new visits
    for (const visit of visitsToAdd) {
      if (visit.billed) continue;
      
      newLineItems.push({
        reconciliation_id,
        item_type: "visit",
        item_id: visit.id,
        description: `Property visit - ${visit.visited_by || "Staff"}`,
        amount: -Math.abs(visit.price || 0),
        date: visit.date,
        category: "Visit Fee",
        fee_type: "visit",
        verified: false,
      });
    }

    // Insert new line items
    if (newLineItems.length > 0) {
      const { error: insertError } = await supabaseClient
        .from("reconciliation_line_items")
        .insert(newLineItems);
      
      if (insertError) throw insertError;
    }

    // Calculate management fee
    const managementFeePercentage = rec.properties?.management_fee_percentage || 15;
    const hasMidTerm = (midTermBookings?.length || 0) > 0;
    
    // Only charge minimum fee if property is actually live on a platform
    const isPropertyLive = rec.properties?.first_listing_live_at != null;
    
    let orderMinimumFee = 0;
    if (!hasMidTerm && isPropertyLive) {
      const nightlyRate = totalNights > 0 ? accommodationRevenueTotal / totalNights : 0;
      if (nightlyRate < 200) orderMinimumFee = 250;
      else if (nightlyRate <= 400) orderMinimumFee = 400;
      else orderMinimumFee = 750;
    }
    // Properties without first_listing_live_at = no minimum fee (not yet listed)

    const managementFeeBase = accommodationRevenueTotal + midTermRevenue;
    const calculatedFee = managementFeeBase * (managementFeePercentage / 100);
    const managementFee = Math.max(calculatedFee, orderMinimumFee);

    // Get updated line items for totals
    const { data: finalLineItems } = await supabaseClient
      .from("reconciliation_line_items")
      .select("*")
      .eq("reconciliation_id", reconciliation_id);

    const visitFees = (finalLineItems || [])
      .filter((item: any) => item.item_type === 'visit' && !item.excluded)
      .reduce((sum: number, item: any) => sum + Math.abs(item.amount), 0);

    const totalExpenses = (finalLineItems || [])
      .filter((item: any) => item.item_type === 'expense' && !item.excluded)
      .reduce((sum: number, item: any) => sum + Math.abs(item.amount), 0);

    // Update reconciliation with final values
    const { error: updateError } = await supabaseClient
      .from("monthly_reconciliations")
      .update({
        total_revenue: totalRevenue,
        short_term_revenue: shortTermRevenue,
        mid_term_revenue: midTermRevenue,
        management_fee: managementFee,
        order_minimum_fee: orderMinimumFee,
        visit_fees: visitFees,
        total_expenses: totalExpenses,
        status: "draft", // Move from preview to draft
        updated_at: new Date().toISOString(),
      })
      .eq("id", reconciliation_id);

    if (updateError) throw updateError;

    // Log in audit trail
    await supabaseClient.from("reconciliation_audit_log").insert({
      reconciliation_id,
      action: "finalized",
      user_id: user.id,
      notes: `Finalized with ${bookings.length} bookings, ${expensesToAdd.length} new expenses, ${visitsToAdd.length} new visits. Revenue: $${totalRevenue.toFixed(2)}`
    });

    console.log(`Finalized reconciliation ${reconciliation_id}:`);
    console.log(`  Revenue: $${totalRevenue.toFixed(2)}`);
    console.log(`  Management Fee: $${managementFee.toFixed(2)}`);
    console.log(`  New items added: ${newLineItems.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        reconciliation_id,
        total_revenue: totalRevenue,
        management_fee: managementFee,
        new_items_added: newLineItems.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error finalizing reconciliation:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
