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

    // Fetch all bookings for the month from OwnerRez - NOW WITH FEE BREAKDOWN
    const { data: allBookings } = await supabaseClient
      .from("ownerrez_bookings")
      .select("*")
      .eq("property_id", property_id)
      .gte("check_in", firstDayOfMonth.toISOString().split("T")[0])
      .lte("check_in", lastDayOfMonth.toISOString().split("T")[0]);

    // Filter out OwnerRez bookings that overlap with mid-term bookings (duplicate detection)
    const bookings = (allBookings || []).filter(ownerrezBooking => {
      const ownerrezStart = new Date(ownerrezBooking.check_in);
      const ownerrezEnd = new Date(ownerrezBooking.check_out);
      const ownerrezGuest = (ownerrezBooking.guest_name || "").toLowerCase().trim();
      
      const isDuplicate = (midTermBookingsEarly || []).some(midTerm => {
        const midTermStart = new Date(midTerm.start_date);
        const midTermEnd = new Date(midTerm.end_date);
        const midTermGuest = (midTerm.tenant_name || "").toLowerCase().trim();
        
        const datesOverlap = ownerrezStart <= midTermEnd && ownerrezEnd >= midTermStart;
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

    // Calculate totals WITH FEE BREAKDOWN
    let accommodationRevenueTotal = 0;
    let cleaningFeesTotal = 0;
    let petFeesTotal = 0;
    let totalNights = 0;
    
    if (bookings && bookings.length > 0) {
      for (const booking of bookings) {
        // Use accommodation_revenue for management fee base, fallback to total_amount
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
    }

    console.log(`Fee breakdown from ${bookings?.length || 0} bookings:`);
    console.log(`  Accommodation Revenue (mgmt fee base): $${accommodationRevenueTotal.toFixed(2)}`);
    console.log(`  Cleaning Fees (pass-through): $${cleaningFeesTotal.toFixed(2)}`);
    console.log(`  Pet Fees (pass-through): $${petFeesTotal.toFixed(2)}`);
    console.log(`  Total Nights: ${totalNights}`);

    // Calculate nightly rate from ACCOMMODATION revenue only
    const calculatedNightlyRate = totalNights > 0 ? accommodationRevenueTotal / totalNights : 0;

    // Check for mid-term bookings
    const hasMidTermBookings = (midTermBookingsEarly?.length || 0) > 0;
    
    // Determine order minimum based on nightly rate tier - ONLY if no mid-term bookings
    let orderMinimumFee = 0;

    if (!hasMidTermBookings) {
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

    // Use mid-term bookings for revenue calculation
    const midTermBookings = midTermBookingsEarly;
    
    // Fetch UNBILLED expenses for the reconciliation month only
    const { data: expenses } = await supabaseClient
      .from("expenses")
      .select("*")
      .eq("property_id", property_id)
      .eq("exported", false)
      .gte("date", firstDayOfMonth.toISOString().split("T")[0])
      .lte("date", lastDayOfMonth.toISOString().split("T")[0]);

    console.log(`Found ${expenses?.length || 0} unbilled expenses for the reconciliation month`);

    // Fetch UNBILLED visits for the reconciliation month only
    const { data: visits } = await supabaseClient
      .from("visits")
      .select("*")
      .eq("property_id", property_id)
      .eq("billed", false)
      .gte("date", firstDayOfMonth.toISOString().split("T")[0])
      .lte("date", lastDayOfMonth.toISOString().split("T")[0]);

    console.log(`Found ${visits?.length || 0} unbilled visits for the reconciliation month`);

    // Calculate mid-term revenue (prorated)
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

    // SHORT-TERM REVENUE = total_amount (what guest paid, for display)
    // But management fee is calculated on ACCOMMODATION REVENUE only
    const shortTermRevenue = (bookings || []).reduce((sum, b) => sum + Number(b.total_amount || 0), 0);
    const totalRevenue = shortTermRevenue + midTermRevenue;
    
    const visitFees = (visits || []).reduce((sum, v) => sum + (v.price || 0), 0);
    const totalExpenses = (expenses || []).reduce((sum, e) => sum + (e.amount || 0), 0);
    
    // MANAGEMENT FEE calculated on ACCOMMODATION REVENUE ONLY (per agreement)
    // NOT on cleaning fees, pet fees, or other ancillary charges
    const managementFeeBase = accommodationRevenueTotal + midTermRevenue;
    const calculatedManagementFee = managementFeeBase * (managementFeePercentage / 100);
    
    console.log(`Management fee calculation:`);
    console.log(`  Base (accommodation + mid-term): $${managementFeeBase.toFixed(2)}`);
    console.log(`  Percentage: ${managementFeePercentage}%`);
    console.log(`  Calculated fee: $${calculatedManagementFee.toFixed(2)}`);
    
    // Apply order minimum as floor
    const propertyMinimumFee = property.order_minimum_fee || 0;
    const managementFee = Math.max(calculatedManagementFee, propertyMinimumFee);
    const usedMinimumFee = managementFee > calculatedManagementFee;
    
    if (usedMinimumFee) {
      console.log(`Management fee minimum applied: calculated $${calculatedManagementFee.toFixed(2)} < minimum $${propertyMinimumFee}, using $${managementFee}`);
    }
    
    // Due from Owner = Management Fee + Visit Fees + Expenses + Cleaning Fees + Pet Fees
    // Cleaning and pet fees are pass-through: owner received them from guest, needs to pay us back
    const dueFromOwner = managementFee + visitFees + totalExpenses + cleaningFeesTotal + petFeesTotal;

    console.log(`Reconciliation calculation:`);
    console.log(`  Short-term (display): $${shortTermRevenue}, Mid-term: $${midTermRevenue}`);
    console.log(`  Total Revenue (display): $${totalRevenue}`);
    console.log(`  Accommodation Revenue (mgmt base): $${accommodationRevenueTotal}`);
    console.log(`  Cleaning Fees (pass-through): $${cleaningFeesTotal}`);
    console.log(`  Pet Fees (pass-through): $${petFeesTotal}`);
    console.log(`  Management Fee: $${managementFee}`);
    console.log(`  Visit Fees: $${visitFees}, Expenses: $${totalExpenses}`);
    console.log(`  Due from Owner: $${dueFromOwner}`);

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
    const lineItems: any[] = [];

    // Add bookings with fee breakdown
    for (const booking of bookings || []) {
      const totalAmount = Number(booking.total_amount || 0);
      if (totalAmount <= 0) continue;
      
      const accommodationRevenue = Number(booking.accommodation_revenue || totalAmount);
      const cleaningFee = Number(booking.cleaning_fee || 0);
      const petFee = Number(booking.pet_fee || 0);
      
      // Main booking line item (accommodation revenue for display)
      lineItems.push({
        reconciliation_id: reconciliation.id,
        item_type: "booking",
        item_id: booking.id,
        description: `${booking.guest_name || "Guest"} - ${booking.ownerrez_listing_name}`,
        amount: accommodationRevenue,
        date: booking.check_in,
        category: "Short-term Booking",
        fee_type: "accommodation",
      });
      
      // Cleaning fee pass-through line item
      if (cleaningFee > 0) {
        lineItems.push({
          reconciliation_id: reconciliation.id,
          item_type: "pass_through_fee",
          item_id: `${booking.id}_cleaning`,
          description: `Cleaning Fee - ${booking.guest_name || "Guest"}`,
          amount: -cleaningFee, // Negative = due from owner
          date: booking.check_in,
          category: "Cleaning Fee",
          fee_type: "cleaning_fee",
        });
      }
      
      // Pet fee pass-through line item
      if (petFee > 0) {
        lineItems.push({
          reconciliation_id: reconciliation.id,
          item_type: "pass_through_fee",
          item_id: `${booking.id}_pet`,
          description: `Pet Fee - ${booking.guest_name || "Guest"}`,
          amount: -petFee, // Negative = due from owner
          date: booking.check_in,
          category: "Pet Fee",
          fee_type: "pet_fee",
        });
      }
    }

    // Add mid-term bookings (prorated if needed)
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
      
      if (proratedAmount > 0) {
        lineItems.push({
          reconciliation_id: reconciliation.id,
          item_type: "mid_term_booking",
          item_id: booking.id,
          description: `${booking.tenant_name} - Mid-term Rental (${daysInBooking}/${daysInMonth} days)`,
          amount: proratedAmount,
          date: effectiveStart.toISOString().split("T")[0],
          category: "Mid-term Rental",
          fee_type: "accommodation",
        });
      }
    }

    // Add visits
    for (const visit of visits || []) {
      if (visit.billed === true) {
        console.warn(`⚠️ WATCHDOG: Skipping already-billed visit ${visit.id}`);
        continue;
      }
      
      lineItems.push({
        reconciliation_id: reconciliation.id,
        item_type: "visit",
        item_id: visit.id,
        description: `Property visit - ${visit.visited_by || "Staff"}`,
        amount: -Math.abs(visit.price),
        date: visit.date,
        category: "Visit Fee",
        fee_type: "visit",
      });
    }

    // Add expenses (excluding visit-related)
    for (const expense of expenses || []) {
      const description = (expense.purpose || "").toLowerCase();
      
      const isVisitRelated = 
        description.includes('visit fee') ||
        description.includes('visit charge') ||
        description.includes('hourly charge') ||
        description.includes('property visit');
      
      if (isVisitRelated) {
        console.log(`Skipping visit-related expense: ${expense.purpose} ($${expense.amount})`);
        continue;
      }
      
      let expenseDescription = expense.items_detail || expense.purpose || "Expense";
      if (expenseDescription.match(/^\d+\s*items?\s*(from|on)\s*amazon/i) && expense.items_detail) {
        expenseDescription = expense.items_detail;
      }
      
      lineItems.push({
        reconciliation_id: reconciliation.id,
        item_type: "expense",
        item_id: expense.id,
        description: expenseDescription,
        amount: -Math.abs(expense.amount),
        date: expense.date,
        category: expense.category || "General Expense",
        fee_type: "expense",
      });
    }

    // WATCHDOG: Verify no order_minimum line items
    const hasOrderMinimumLineItem = lineItems.some(item => item.item_type === 'order_minimum');
    if (hasOrderMinimumLineItem) {
      console.error(`⚠️ WATCHDOG VIOLATION: Order minimum was added as a line item! Removing it.`);
      const filteredItems = lineItems.filter(item => item.item_type !== 'order_minimum');
      lineItems.length = 0;
      lineItems.push(...filteredItems);
    }
    
    console.log(`WATCHDOG: ${lineItems.length} line items ready`);
    console.log(`  - Bookings: ${lineItems.filter(i => i.item_type === 'booking').length}`);
    console.log(`  - Pass-through fees: ${lineItems.filter(i => i.item_type === 'pass_through_fee').length}`);
    console.log(`  - Mid-term: ${lineItems.filter(i => i.item_type === 'mid_term_booking').length}`);
    console.log(`  - Visits: ${lineItems.filter(i => i.item_type === 'visit').length}`);
    console.log(`  - Expenses: ${lineItems.filter(i => i.item_type === 'expense').length}`);

    // Create line items with verified: false
    const lineItemsWithMetadata = lineItems.map(item => ({
      ...item,
      verified: false,
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
        feeBreakdown: {
          accommodationRevenue: accommodationRevenueTotal,
          cleaningFees: cleaningFeesTotal,
          petFees: petFeesTotal,
        }
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
