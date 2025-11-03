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

    const { property_id, month } = await req.json();
    if (!property_id || !month) {
      throw new Error("property_id and month are required");
    }

    console.log(`Creating reconciliation for property ${property_id}, month ${month}`);

    const firstDayOfMonth = new Date(month);
    const lastDayOfMonth = new Date(firstDayOfMonth.getFullYear(), firstDayOfMonth.getMonth() + 1, 0);
    const monthString = firstDayOfMonth.toISOString().split("T")[0];

    console.log(`Checking for existing reconciliation: property=${property_id}, month=${monthString}`);

    // Check if reconciliation already exists for this property and month
    const { data: existingRec, error: checkError } = await supabaseClient
      .from("monthly_reconciliations")
      .select("id, status")
      .eq("property_id", property_id)
      .eq("reconciliation_month", monthString)
      .maybeSingle();

    console.log(`Existing reconciliation check result:`, { existingRec, checkError });

    if (existingRec) {
      console.log(`Found existing reconciliation ${existingRec.id} with status ${existingRec.status}`);
      return new Response(
        JSON.stringify({ 
          error: `A reconciliation for this property and month already exists (Status: ${existingRec.status})`,
          existing_reconciliation_id: existingRec.id,
          can_delete: existingRec.status === "draft"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 }
      );
    }

    // Get property and owner info
    const { data: property, error: propError } = await supabaseClient
      .from("properties")
      .select("*, property_owners(*)")
      .eq("id", property_id)
      .single();

    if (propError || !property) throw new Error("Property not found");
    if (!property.owner_id) throw new Error("Property has no owner assigned");

    const managementFeePercentage = property.management_fee_percentage || 15.00;
    console.log(`Using management fee: ${managementFeePercentage}% for property ${property.name}`);

    // Fetch all bookings for the month
    const { data: bookings } = await supabaseClient
      .from("ownerrez_bookings")
      .select("*")
      .eq("property_id", property_id)
      .gte("check_in", firstDayOfMonth.toISOString().split("T")[0])
      .lte("check_in", lastDayOfMonth.toISOString().split("T")[0]);

    // Calculate average nightly rate from bookings for this property
    let calculatedNightlyRate = 0;
    let bookingRevenueForRate = 0;
    let totalNights = 0;
    
    if (bookings && bookings.length > 0) {
      for (const booking of bookings) {
        // Skip bookings with no revenue or invalid dates
        if (!booking.total_amount || booking.total_amount <= 0) {
          console.log(`Skipping booking ${booking.id} - no revenue ($${booking.total_amount || 0})`);
          continue;
        }

        if (!booking.check_in || !booking.check_out) {
          console.log(`Skipping booking ${booking.id} - missing check-in or check-out dates`);
          continue;
        }

        try {
          const checkIn = new Date(booking.check_in);
          const checkOut = new Date(booking.check_out);
          
          // Validate dates
          if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
            console.log(`Skipping booking ${booking.id} - invalid dates`);
            continue;
          }

          const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
          
          if (nights <= 0) {
            console.log(`Skipping booking ${booking.id} - invalid night count: ${nights}`);
            continue;
          }

          bookingRevenueForRate += booking.total_amount;
          totalNights += nights;
        } catch (err) {
          console.error(`Error processing booking ${booking.id}:`, err);
          continue;
        }
      }
      
      if (totalNights > 0) {
        calculatedNightlyRate = bookingRevenueForRate / totalNights;
      }
    }

    console.log(`Calculated nightly rate from ${bookings?.length || 0} bookings: $${calculatedNightlyRate.toFixed(2)} (${totalNights} total nights, $${bookingRevenueForRate} total revenue)`);

    // Determine order minimum based on nightly rate tier
    let orderMinimumFee = 250; // Default minimum

    if (calculatedNightlyRate > 0) {
      if (calculatedNightlyRate < 200) {
        orderMinimumFee = 250;
      } else if (calculatedNightlyRate >= 200 && calculatedNightlyRate <= 400) {
        orderMinimumFee = 400;
      } else {
        orderMinimumFee = 750;
      }
      
      console.log(`Nightly rate $${calculatedNightlyRate.toFixed(2)} → Order minimum: $${orderMinimumFee}`);
    } else {
      // No bookings this month → charge minimum
      console.log(`No bookings found for property ${property.name} → Charging minimum order fee: $${orderMinimumFee}`);
    }

    // Update property with calculated nightly rate and order minimum
    await supabaseClient
      .from("properties")
      .update({
        nightly_rate: calculatedNightlyRate > 0 ? calculatedNightlyRate : null,
        order_minimum_fee: orderMinimumFee
      })
      .eq("id", property_id);

    // Fetch mid-term bookings that are active during the month
    // Include bookings that: start during month OR are ongoing (started before and end after/during)
    const { data: midTermBookings, error: midTermError } = await supabaseClient
      .from("mid_term_bookings")
      .select("*")
      .eq("property_id", property_id)
      .eq("status", "active")
      .lte("start_date", lastDayOfMonth.toISOString().split("T")[0])
      .gte("end_date", firstDayOfMonth.toISOString().split("T")[0]);

    console.log(`Found ${midTermBookings?.length || 0} mid-term bookings for the period`);

    // Fetch all UNBILLED expenses for the month
    const { data: expenses } = await supabaseClient
      .from("expenses")
      .select("*")
      .eq("property_id", property_id)
      .eq("exported", false)
      .gte("date", firstDayOfMonth.toISOString().split("T")[0])
      .lte("date", lastDayOfMonth.toISOString().split("T")[0]);

    // Fetch visits
    const { data: visits } = await supabaseClient
      .from("visits")
      .select("*")
      .eq("property_id", property_id)
      .gte("date", firstDayOfMonth.toISOString().split("T")[0])
      .lte("date", lastDayOfMonth.toISOString().split("T")[0]);

    // Calculate totals with prorated mid-term revenue
    const shortTermRevenue = (bookings || []).reduce((sum, b) => sum + (b.total_amount && b.total_amount > 0 ? b.total_amount : 0), 0);
    
    // Calculate prorated mid-term revenue
    let midTermRevenue = 0;
    for (const booking of midTermBookings || []) {
      const bookingStart = new Date(booking.start_date);
      const bookingEnd = new Date(booking.end_date);
      const monthStart = new Date(firstDayOfMonth);
      const monthEnd = new Date(lastDayOfMonth);
      
      const effectiveStart = bookingStart > monthStart ? bookingStart : monthStart;
      const effectiveEnd = bookingEnd < monthEnd ? bookingEnd : monthEnd;
      const daysInBooking = Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
      const proratedAmount = (booking.monthly_rent / daysInMonth) * daysInBooking;
      
      midTermRevenue += proratedAmount;
    }
    
    const totalRevenue = shortTermRevenue + midTermRevenue;
    const visitExpenses = (visits || []).reduce((sum, v) => sum + (v.price || 0), 0);
    const otherExpenses = (expenses || []).reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalExpenses = otherExpenses + visitExpenses;
    
    // Management fee uses property-specific percentage
    const managementFee = totalRevenue * (managementFeePercentage / 100);
    const netToOwner = totalRevenue - totalExpenses - managementFee - orderMinimumFee;

    console.log(`Reconciliation calculation: Short-term: $${shortTermRevenue}, Mid-term: $${midTermRevenue}, Total Revenue: $${totalRevenue}, Visit Fees: $${visitExpenses}, Other Expenses: $${otherExpenses}, Management Fee (${managementFeePercentage}%): $${managementFee}, Order Minimum: $${orderMinimumFee}, Net to Owner: $${netToOwner}`);

    // Create reconciliation
    const { data: reconciliation, error: recError } = await supabaseClient
      .from("monthly_reconciliations")
      .insert({
        property_id,
        owner_id: property.owner_id,
        reconciliation_month: monthString,
        total_revenue: totalRevenue,
        short_term_revenue: shortTermRevenue,
        mid_term_revenue: midTermRevenue,
        visit_fees: visitExpenses,
        total_expenses: otherExpenses,
        management_fee: managementFee,
        order_minimum_fee: orderMinimumFee,
        net_to_owner: netToOwner,
        status: "draft",
      })
      .select()
      .single();

    if (recError) {
      // Handle duplicate key error specifically
      if (recError.code === "23505") {
        console.error("Duplicate key error - reconciliation already exists");
        return new Response(
          JSON.stringify({ 
            error: "A reconciliation for this property and month already exists",
            can_delete: false
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 }
        );
      }
      throw recError;
    }

    // Create line items
    const lineItems = [];

    // Add bookings (only those with revenue)
    for (const booking of bookings || []) {
      if ((booking.total_amount || 0) > 0) {
        lineItems.push({
          reconciliation_id: reconciliation.id,
          item_type: "booking",
          item_id: booking.id,
          description: `${booking.guest_name || "Guest"} - ${booking.ownerrez_listing_name}`,
          amount: booking.total_amount,
          date: booking.check_in,
          category: "Short-term Booking",
        });
      }
    }

    // Add mid-term bookings (prorated if needed, only with revenue)
    for (const booking of midTermBookings || []) {
      const bookingStart = new Date(booking.start_date);
      const bookingEnd = new Date(booking.end_date);
      const monthStart = new Date(firstDayOfMonth);
      const monthEnd = new Date(lastDayOfMonth);
      
      // Calculate prorated amount for this month
      const effectiveStart = bookingStart > monthStart ? bookingStart : monthStart;
      const effectiveEnd = bookingEnd < monthEnd ? bookingEnd : monthEnd;
      const daysInBooking = Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
      const proratedAmount = (booking.monthly_rent / daysInMonth) * daysInBooking;
      
      // Only add if there's revenue
      if (proratedAmount > 0) {
        lineItems.push({
          reconciliation_id: reconciliation.id,
          item_type: "mid_term_booking",
          item_id: booking.id,
          description: `${booking.tenant_name} - Mid-term Rental (${daysInBooking}/${daysInMonth} days)`,
          amount: proratedAmount,
          date: effectiveStart.toISOString().split("T")[0],
          category: "Mid-term Rental",
        });
      }
    }

    // Add visits as expenses (negative amounts)
    for (const visit of visits || []) {
      lineItems.push({
        reconciliation_id: reconciliation.id,
        item_type: "visit",
        item_id: visit.id,
        description: `Property visit - ${visit.visited_by || "Staff"}`,
        amount: -Math.abs(visit.price), // Negative for expenses
        date: visit.date,
        category: "Visit Fee",
      });
    }

    // Add expenses
    for (const expense of expenses || []) {
      lineItems.push({
        reconciliation_id: reconciliation.id,
        item_type: "expense",
        item_id: expense.id,
        description: expense.purpose || "Expense",
        amount: -Math.abs(expense.amount), // Negative for expenses
        date: expense.date,
        category: expense.category || "General Expense",
      });
    }

    // Add order minimum fee as a line item
    lineItems.push({
      reconciliation_id: reconciliation.id,
      item_type: "order_minimum",
      item_id: reconciliation.id,
      description: `Monthly Order Minimum Fee (Rate Tier: ${calculatedNightlyRate > 0 ? `$${calculatedNightlyRate.toFixed(2)}/night` : 'No Bookings'})`,
      amount: -Math.abs(orderMinimumFee), // Negative because it's a deduction
      date: firstDayOfMonth.toISOString().split("T")[0],
      category: "Order Minimum Fee",
    });

    if (lineItems.length > 0) {
      const { error: lineItemError } = await supabaseClient
        .from("reconciliation_line_items")
        .insert(lineItems);

      if (lineItemError) throw lineItemError;
    }

    console.log(`Created reconciliation ${reconciliation.id} with ${lineItems.length} line items`);

    return new Response(
      JSON.stringify({
        success: true,
        reconciliation,
        lineItemCount: lineItems.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error creating reconciliation:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : "";
    console.error("Error stack:", errorStack);
    return new Response(
      JSON.stringify({ error: errorMessage, details: errorStack }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});