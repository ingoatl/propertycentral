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

    // Date range validation
    const today = new Date();
    const monthDate = new Date(month);
    
    // Prevent creating reconciliations for future months
    if (monthDate > today) {
      throw new Error("Cannot create reconciliation for future months");
    }
    
    // Warn if creating for months > 2 months old
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(today.getMonth() - 2);
    
    if (monthDate < twoMonthsAgo) {
      console.warn(`⚠️ Creating reconciliation for old month: ${monthString} (${Math.floor((today.getTime() - monthDate.getTime()) / (1000 * 60 * 60 * 24 * 30))} months ago)`);
    }

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

    // First fetch mid-term bookings to filter out duplicates from OwnerRez
    const { data: midTermBookingsEarly } = await supabaseClient
      .from("mid_term_bookings")
      .select("*")
      .eq("property_id", property_id)
      .eq("status", "active")
      .lte("start_date", lastDayOfMonth.toISOString().split("T")[0])
      .gte("end_date", firstDayOfMonth.toISOString().split("T")[0]);

    console.log(`Found ${midTermBookingsEarly?.length || 0} mid-term bookings for duplicate detection`);

    // Fetch all bookings for the month from OwnerRez
    const { data: allBookings } = await supabaseClient
      .from("ownerrez_bookings")
      .select("*")
      .eq("property_id", property_id)
      .gte("check_in", firstDayOfMonth.toISOString().split("T")[0])
      .lte("check_in", lastDayOfMonth.toISOString().split("T")[0]);

    // Filter out OwnerRez bookings that overlap with mid-term bookings (duplicate detection)
    // This prevents double-counting when a booking exists in both systems
    const bookings = (allBookings || []).filter(ownerrezBooking => {
      const ownerrezStart = new Date(ownerrezBooking.check_in);
      const ownerrezEnd = new Date(ownerrezBooking.check_out);
      const ownerrezGuest = (ownerrezBooking.guest_name || "").toLowerCase().trim();
      
      // Check if any mid-term booking overlaps with this OwnerRez booking
      const isDuplicate = (midTermBookingsEarly || []).some(midTerm => {
        const midTermStart = new Date(midTerm.start_date);
        const midTermEnd = new Date(midTerm.end_date);
        const midTermGuest = (midTerm.tenant_name || "").toLowerCase().trim();
        
        // Check for date overlap
        const datesOverlap = ownerrezStart <= midTermEnd && ownerrezEnd >= midTermStart;
        
        // Check if guest names are similar (partial match to handle "Kelly Thew" vs "Kelly T")
        const guestMatch = ownerrezGuest.includes(midTermGuest.split(" ")[0]) || 
                          midTermGuest.includes(ownerrezGuest.split(" ")[0]);
        
        if (datesOverlap && guestMatch) {
          console.log(`Filtering out OwnerRez booking "${ownerrezBooking.guest_name}" - overlaps with mid-term booking "${midTerm.tenant_name}"`);
          return true;
        }
        return false;
      });
      
      return !isDuplicate;
    });

    console.log(`Filtered to ${bookings.length} short-term bookings after removing mid-term duplicates`);

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

    // Check if there are any mid-term bookings for this month FIRST before determining order minimum
    // If there's mid-term revenue, we skip the order minimum fee entirely
    const { data: midTermBookingsForMinimumCheck } = await supabaseClient
      .from("mid_term_bookings")
      .select("*")
      .eq("property_id", property_id)
      .eq("status", "active")
      .lte("start_date", lastDayOfMonth.toISOString().split("T")[0])
      .gte("end_date", firstDayOfMonth.toISOString().split("T")[0]);

    const hasMidTermBookings = (midTermBookingsForMinimumCheck?.length || 0) > 0;
    console.log(`Mid-term bookings for minimum check: ${midTermBookingsForMinimumCheck?.length || 0}, hasMidTermBookings: ${hasMidTermBookings}`);

    // Determine order minimum based on nightly rate tier - ONLY if no mid-term bookings
    let orderMinimumFee = 0; // Default to 0, only set if no mid-term bookings and no short-term bookings

    if (!hasMidTermBookings) {
      // No mid-term bookings - apply order minimum logic based on short-term bookings
      if (calculatedNightlyRate > 0) {
        // Has short-term bookings - set minimum based on rate tier
        if (calculatedNightlyRate < 200) {
          orderMinimumFee = 250;
        } else if (calculatedNightlyRate >= 200 && calculatedNightlyRate <= 400) {
          orderMinimumFee = 400;
        } else {
          orderMinimumFee = 750;
        }
        console.log(`Nightly rate $${calculatedNightlyRate.toFixed(2)} → Order minimum: $${orderMinimumFee}`);
      } else {
        // No bookings at all this month → charge minimum
        orderMinimumFee = 250;
        console.log(`No bookings found for property ${property.name} → Charging minimum order fee: $${orderMinimumFee}`);
      }
    } else {
      console.log(`Property has mid-term booking revenue - skipping order minimum fee`);
    }

    // Update property with calculated nightly rate and order minimum
    await supabaseClient
      .from("properties")
      .update({
        nightly_rate: calculatedNightlyRate > 0 ? calculatedNightlyRate : null,
        order_minimum_fee: orderMinimumFee
      })
      .eq("id", property_id);

    // Use the mid-term bookings we already fetched earlier for duplicate detection
    const midTermBookings = midTermBookingsEarly;
    console.log(`Using ${midTermBookings?.length || 0} mid-term bookings for revenue calculation`);

    // Fetch UNBILLED expenses for the reconciliation month only
    const { data: expenses } = await supabaseClient
      .from("expenses")
      .select("*")
      .eq("property_id", property_id)
      .eq("exported", false)
      .gte("date", firstDayOfMonth.toISOString().split("T")[0])
      .lte("date", lastDayOfMonth.toISOString().split("T")[0]);

    console.log(`Found ${expenses?.length || 0} unbilled expenses for the reconciliation month`);

    // Fetch UNBILLED visits for the reconciliation month only (not all historical visits)
    const { data: visits } = await supabaseClient
      .from("visits")
      .select("*")
      .eq("property_id", property_id)
      .eq("billed", false)
      .gte("date", firstDayOfMonth.toISOString().split("T")[0])
      .lte("date", lastDayOfMonth.toISOString().split("T")[0]);

    console.log(`Found ${visits?.length || 0} unbilled visits for the reconciliation month`);

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
    const visitFees = (visits || []).reduce((sum, v) => sum + (v.price || 0), 0);
    const totalExpenses = (expenses || []).reduce((sum, e) => sum + (e.amount || 0), 0);
    
    // Management fee calculated from booking revenue (property-specific percentage)
    const managementFee = totalRevenue * (managementFeePercentage / 100);
    
    // Due from Owner = Management Fee + Visit Fees + Expenses (NOT including order_minimum_fee)
    const dueFromOwner = managementFee + visitFees + totalExpenses;

    console.log(`Reconciliation calculation: Short-term: $${shortTermRevenue}, Mid-term: $${midTermRevenue}, Total Revenue: $${totalRevenue}, Visit Fees: $${visitFees}, Expenses: $${totalExpenses}, Management Fee (${managementFeePercentage}%): $${managementFee}, Due from Owner: $${dueFromOwner}`);

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
        visit_fees: visitFees,
        total_expenses: totalExpenses,
        management_fee: managementFee,
        order_minimum_fee: orderMinimumFee,
        net_to_owner: dueFromOwner,
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

    // Add visits as expenses (negative amounts) and mark as billed
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

    // Do NOT mark visits as billed here - they will be marked when reconciliation is approved
    // This allows for review and ensures proper sync with the reconciliation approval process

    // Add expenses (excluding visit-related expenses to avoid double counting)
    for (const expense of expenses || []) {
      const description = (expense.purpose || "").toLowerCase();
      
      // Skip visit-related expenses - these are already counted in visit fees
      const isVisitRelated = 
        description.includes('visit fee') ||
        description.includes('visit charge') ||
        description.includes('hourly charge') ||
        description.includes('property visit');
      
      if (isVisitRelated) {
        console.log(`Skipping visit-related expense: ${expense.purpose} ($${expense.amount})`);
        continue;
      }
      
      // Prefer items_detail for full item names, fallback to purpose
      let expenseDescription = expense.items_detail || expense.purpose || "Expense";
      
      // If it's a generic description like "1 item from Amazon", try to get more detail
      if (expenseDescription.match(/^\d+\s*items?\s*(from|on)\s*amazon/i) && expense.items_detail) {
        expenseDescription = expense.items_detail;
      }
      
      lineItems.push({
        reconciliation_id: reconciliation.id,
        item_type: "expense",
        item_id: expense.id,
        description: expenseDescription,
        amount: -Math.abs(expense.amount), // Negative for expenses
        date: expense.date,
        category: expense.category || "General Expense",
      });
    }

    // Add order minimum fee as a line item ONLY if there's no mid-term revenue
    if (orderMinimumFee > 0) {
      lineItems.push({
        reconciliation_id: reconciliation.id,
        item_type: "order_minimum",
        item_id: reconciliation.id,
        description: `Monthly Order Minimum Fee (Rate Tier: ${calculatedNightlyRate > 0 ? `$${calculatedNightlyRate.toFixed(2)}/night` : 'No Bookings'})`,
        amount: -Math.abs(orderMinimumFee), // Negative because it's a deduction
        date: firstDayOfMonth.toISOString().split("T")[0],
        category: "Order Minimum Fee",
      });
    }

    // Create line items with verified: false (manual approval required)
    // Add source tracking and creation metadata
    const lineItemsWithMetadata = lineItems.map(item => ({
      ...item,
      verified: false, // All items start unchecked for manual approval
      source: 'auto_generated',
      added_by: user.id
    }));

    if (lineItemsWithMetadata.length > 0) {
      const { error: lineItemError } = await supabaseClient
        .from("reconciliation_line_items")
        .insert(lineItemsWithMetadata);

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