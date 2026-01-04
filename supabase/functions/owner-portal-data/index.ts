import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

// Declare EdgeRuntime for background tasks
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

// Background task to sync OwnerRez data
async function syncOwnerRezInBackground(): Promise<void> {
  try {
    console.log("Starting background OwnerRez sync...");
    const response = await fetch(`${supabaseUrl}/functions/v1/sync-ownerrez`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${supabaseAnonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log("Background OwnerRez sync completed:", result.message || "Success");
    } else {
      console.error("Background OwnerRez sync failed:", response.status, await response.text());
    }
  } catch (error) {
    console.error("Background OwnerRez sync error:", error);
  }
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { token, ownerId, propertyId } = await req.json();
    
    // Trigger OwnerRez sync in background (non-blocking)
    EdgeRuntime.waitUntil(syncOwnerRezInBackground());

    console.log("Owner portal data request:", { token, ownerId, propertyId });

    let validatedOwnerId = ownerId;
    let validatedPropertyId = propertyId;

    // If token provided, validate it and get owner/property info
    if (token) {
      const { data: sessionData, error: sessionError } = await supabase
        .from("owner_portal_sessions")
        .select("owner_id, property_id, email, expires_at, is_admin_preview")
        .eq("token", token)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (sessionError || !sessionData) {
        console.error("Session validation failed:", sessionError);
        return new Response(
          JSON.stringify({ error: "Invalid or expired session" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      validatedOwnerId = sessionData.owner_id;
      validatedPropertyId = sessionData.property_id;
      console.log("Session validated:", { validatedOwnerId, validatedPropertyId });
    }

    if (!validatedOwnerId) {
      return new Response(
        JSON.stringify({ error: "Owner ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch owner details including second owner and service type
    const { data: owner, error: ownerError } = await supabase
      .from("property_owners")
      .select("id, name, email, phone, second_owner_name, second_owner_email, service_type")
      .eq("id", validatedOwnerId)
      .single();

    if (ownerError || !owner) {
      console.error("Owner fetch failed:", ownerError);
      return new Response(
        JSON.stringify({ error: "Owner not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Owner found:", owner.name);

    // Fetch property - either specific or first active for owner
    let propertyQuery = supabase
      .from("properties")
      .select("id, name, address, rental_type, image_path, management_fee_percentage, nightly_rate")
      .is("offboarded_at", null);

    if (validatedPropertyId) {
      propertyQuery = propertyQuery.eq("id", validatedPropertyId);
    } else {
      propertyQuery = propertyQuery.eq("owner_id", validatedOwnerId);
    }

    const { data: property, error: propertyError } = await propertyQuery.single();

    if (propertyError || !property) {
      console.error("Property fetch failed:", propertyError);
      return new Response(
        JSON.stringify({ error: "Property not found", owner }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Property found:", property.name);

    // Fetch all data in parallel using service role key (bypasses RLS)
    const [
      statementsResult,
      expensesResult,
      credentialsResult,
      strBookingsResult,
      mtrBookingsResult,
      reviewsResult,
      reviewsByListingResult,
      emailInsightsResult,
      propertyDetailsResult,
    ] = await Promise.all([
      // Monthly reconciliations (statements) - fetch all historical data (24 months)
      supabase
        .from("monthly_reconciliations")
        .select("id, reconciliation_month, total_revenue, total_expenses, net_to_owner, status, short_term_revenue, mid_term_revenue, revenue_override")
        .eq("property_id", property.id)
        .in("status", ["sent", "statement_sent", "completed", "approved", "preview", "pending"])
        .order("reconciliation_month", { ascending: false })
        .limit(60), // 5 years of data
      
      // Expenses - ONLY show approved expenses (billed or with reconciliation)
      supabase
        .from("expenses")
        .select("id, date, amount, purpose, vendor, category, file_path, original_receipt_path, email_screenshot_path, items_detail")
        .eq("property_id", property.id)
        .or("billed.eq.true,reconciliation_id.not.is.null")
        .order("date", { ascending: false })
        .limit(200),
      
      // Property credentials
      supabase
        .from("property_credentials")
        .select("id, service_name, username, password, url, notes")
        .eq("property_id", property.id)
        .order("service_name"),
      
      // STR bookings (OwnerRez) - exclude canceled and zero-amount - ALL historical data
      supabase
        .from("ownerrez_bookings")
        .select("id, booking_id, guest_name, check_in, check_out, total_amount, management_fee, booking_status, ownerrez_listing_name")
        .eq("property_id", property.id)
        .not("booking_status", "eq", "canceled")
        .not("booking_status", "eq", "Canceled")
        .order("check_in", { ascending: false })
        .limit(500), // Extended for ALL historical data
      
      // MTR bookings - ALL historical data
      supabase
        .from("mid_term_bookings")
        .select("id, tenant_name, tenant_email, start_date, end_date, monthly_rent, deposit_amount, status, notes")
        .eq("property_id", property.id)
        .order("start_date", { ascending: false })
        .limit(200), // Extended for ALL historical data
      
      // Reviews - direct property_id match
      supabase
        .from("ownerrez_reviews")
        .select("id, guest_name, star_rating, review_text, review_date, review_source")
        .eq("property_id", property.id)
        .order("review_date", { ascending: false })
        .limit(50),
      
      // Fallback: Reviews via booking join (for reviews linked by booking_id to bookings with this property)
      supabase
        .from("ownerrez_reviews")
        .select(`
          id, guest_name, star_rating, review_text, review_date, review_source, booking_id,
          ownerrez_bookings!inner(property_id, ownerrez_listing_name)
        `)
        .eq("ownerrez_bookings.property_id", property.id)
        .order("review_date", { ascending: false })
        .limit(50),
      
      // Email insights - positive sentiment for owner engagement
      supabase
        .from("email_insights")
        .select("id, subject, summary, sentiment, category, created_at, email_date")
        .eq("property_id", property.id)
        .in("sentiment", ["positive", "neutral"])
        .order("created_at", { ascending: false })
        .limit(20),
      
      // Comprehensive property data for details
      supabase
        .from("comprehensive_property_data")
        .select("bedrooms, bathrooms, square_feet, max_guests, amenities")
        .eq("id", property.id)
        .maybeSingle(),
    ]);

    const rawStatements = statementsResult.data || [];
    const expenses = expensesResult.data || [];
    const credentials = credentialsResult.data || [];
    const strBookings = strBookingsResult.data || [];
    const mtrBookings = mtrBookingsResult.data || [];
    const emailInsights = emailInsightsResult.data || [];
    const propertyDetails = propertyDetailsResult.data;
    
    // Process statements to calculate correct net owner earnings based on service type
    // For co-hosting: owner keeps revenue, net_to_owner = what they owe us, so actual_net = revenue - net_to_owner
    // For full-service: we collect revenue, net_to_owner = what we pay them, so actual_net = net_to_owner
    const isCohosting = owner.service_type === 'cohosting';
    console.log(`Service type: ${owner.service_type}, isCohosting: ${isCohosting}`);
    
    const statements = rawStatements.map(s => {
      const actualNet = isCohosting 
        ? (s.total_revenue || 0) - (s.net_to_owner || 0)  // Co-hosting: revenue minus fees owed
        : (s.net_to_owner || 0);  // Full-service: net_to_owner is already correct
      
      console.log(`Statement ${s.reconciliation_month}: revenue=${s.total_revenue}, net_to_owner=${s.net_to_owner}, actual_net_earnings=${actualNet}`);
      
      return {
        ...s,
        actual_net_earnings: actualNet
      };
    });
    
    // Merge reviews from both queries (direct property_id match and via booking join), deduplicate by id
    const reviewsById = reviewsResult.data || [];
    const reviewsByBooking = (reviewsByListingResult.data || []).map((r: any) => ({
      id: r.id,
      guest_name: r.guest_name,
      star_rating: r.star_rating,
      review_text: r.review_text,
      review_date: r.review_date,
      review_source: r.review_source,
    }));
    const reviewIdSet = new Set(reviewsById.map((r: any) => r.id));
    const mergedReviews = [...reviewsById];
    for (const r of reviewsByBooking) {
      if (!reviewIdSet.has(r.id)) {
        mergedReviews.push(r);
        reviewIdSet.add(r.id);
      }
    }
    const reviews = mergedReviews;
    
    console.log("Reviews fetched:", {
      directMatch: reviewsById.length,
      viaBookingJoin: reviewsByBooking.length,
      merged: reviews.length,
    });

    console.log("Data fetched:", {
      statements: statements.length,
      expenses: expenses.length,
      credentials: credentials.length,
      strBookings: strBookings.length,
      mtrBookings: mtrBookings.length,
      reviews: reviews.length,
      reviewsByBooking: reviewsByBooking.length,
      emailInsights: emailInsights.length,
    });

    // Log MTR bookings for debugging
    if (mtrBookings.length > 0) {
      console.log("MTR Bookings found:", mtrBookings.map(b => ({
        id: b.id,
        tenant: b.tenant_name,
        dates: `${b.start_date} to ${b.end_date}`,
        rent: b.monthly_rent,
        status: b.status,
      })));
    }

    // Include ALL valid bookings (not just those with amounts for revenue, but all for counting/display)
    const allSTRBookings = strBookings.filter(b => 
      b.booking_status !== 'canceled' && 
      b.booking_status !== 'Canceled' &&
      b.booking_status !== 'owner_block'
    );
    
    // Filter valid bookings for revenue calculations (exclude canceled, owner blocks, and zero-amount)
    const validSTRBookings = strBookings.filter(b => 
      b.total_amount > 0 && 
      b.booking_status !== 'canceled' && 
      b.booking_status !== 'Canceled' &&
      b.booking_status !== 'owner_block'
    );

    // Calculate performance metrics from actual data
    // STR revenue: from reconciliation data (most accurate), fallback to bookings
    const totalSTRFromRecon = statements.reduce((sum, s) => sum + (s.short_term_revenue || 0), 0);
    const calculatedSTRRevenue = validSTRBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);
    const strRevenue = totalSTRFromRecon > 0 ? totalSTRFromRecon : calculatedSTRRevenue;

    // MTR revenue: Use statement data for months with statements (most accurate after reconciliation)
    // For future months without statements, calculate from bookings
    
    // First, get MTR from statements (already adjusted during reconciliation)
    let mtrFromStatements = 0;
    const monthsWithStatements = new Set<string>();
    
    for (const s of statements) {
      const monthKey = s.reconciliation_month?.substring(0, 7) || '';
      if (!monthKey) continue;
      monthsWithStatements.add(monthKey);
      
      // If revenue_override is set and less than total, use it proportionally
      // revenue_override = 0 means no revenue that month (manual adjustment)
      if (s.revenue_override !== null && s.revenue_override !== undefined) {
        // revenue_override replaces total_revenue, so calculate MTR proportion
        const originalTotal = (s.short_term_revenue || 0) + (s.mid_term_revenue || 0);
        if (originalTotal > 0 && s.revenue_override < originalTotal) {
          // Reduce MTR proportionally to the override
          const ratio = s.revenue_override / originalTotal;
          mtrFromStatements += (s.mid_term_revenue || 0) * ratio;
          console.log(`Month ${monthKey}: MTR adjusted from $${s.mid_term_revenue} to $${((s.mid_term_revenue || 0) * ratio).toFixed(2)} (override ratio: ${ratio.toFixed(2)})`);
        } else {
          // Override is >= original, use full MTR
          mtrFromStatements += s.mid_term_revenue || 0;
        }
      } else {
        // No override, use statement's mid_term_revenue
        mtrFromStatements += s.mid_term_revenue || 0;
      }
    }
    
    // For months without statements (future bookings), calculate from bookings
    let mtrFromFutureBookings = 0;
    const nowDate = new Date();
    for (const b of mtrBookings) {
      if (!b.start_date || !b.end_date || !b.monthly_rent) continue;
      const startDate = new Date(b.start_date);
      const endDate = new Date(b.end_date);
      
      // Prorate across months
      let currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        
        // Only add if this month has no statement (future months)
        if (!monthsWithStatements.has(monthKey)) {
          const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
          const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
          const daysInMonth = monthEnd.getDate();
          
          const effectiveStart = startDate > monthStart ? startDate : monthStart;
          const effectiveEnd = endDate < monthEnd ? endDate : monthEnd;
          const daysOccupied = Math.max(1, Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
          const proratedRent = (b.monthly_rent / daysInMonth) * daysOccupied;
          
          mtrFromFutureBookings += proratedRent;
        }
        
        currentDate.setMonth(currentDate.getMonth() + 1);
        currentDate.setDate(1);
      }
    }
    
    const mtrRevenue = mtrFromStatements + mtrFromFutureBookings;
    console.log(`MTR revenue: from statements=$${mtrFromStatements.toFixed(2)}, from future bookings=$${mtrFromFutureBookings.toFixed(2)}, total=$${mtrRevenue.toFixed(2)}`);
    
    // Total revenue is STR + MTR
    const totalRevenue = strRevenue + mtrRevenue;

    // Calculate occupancy rate using only valid bookings
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const daysThisYear = Math.ceil((now.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24));
    
    let bookedDays = 0;
    
    // Count STR booked days (only valid bookings)
    validSTRBookings.forEach(b => {
      if (!b.check_in || !b.check_out) return;
      const checkIn = new Date(b.check_in);
      const checkOut = new Date(b.check_out);
      if (checkIn.getFullYear() === now.getFullYear()) {
        const days = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
        bookedDays += days;
      }
    });
    
    // Count MTR booked days
    mtrBookings.forEach(b => {
      if (!b.start_date || !b.end_date) return;
      const start = new Date(b.start_date);
      const end = new Date(b.end_date);
      if (start.getFullYear() === now.getFullYear() || end.getFullYear() === now.getFullYear()) {
        const effectiveStart = start < yearStart ? yearStart : start;
        const effectiveEnd = end > now ? now : end;
        const days = Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24));
        bookedDays += Math.max(0, days);
      }
    });

    const occupancyRate = daysThisYear > 0 ? Math.min(100, Math.round((bookedDays / daysThisYear) * 100)) : 0;

  // Calculate average rating using star_rating column
  const ratingsWithValue = reviews.filter(r => r.star_rating && r.star_rating > 0);
  const averageRating = ratingsWithValue.length > 0
    ? ratingsWithValue.reduce((sum, r) => sum + r.star_rating, 0) / ratingsWithValue.length
    : null;

  // Build monthly revenue data for charts - combine reconciliation + booking data
  const monthlyRevenue: Record<string, { month: string; str: number; mtr: number; total: number }> = {};
  
  // First, populate STR from reconciliation data (most accurate when available)
  statements.forEach(s => {
    const month = s.reconciliation_month;
    if (!monthlyRevenue[month]) {
      monthlyRevenue[month] = { month, str: 0, mtr: 0, total: 0 };
    }
    monthlyRevenue[month].str = s.short_term_revenue || 0;
    // Don't use reconciliation MTR - we'll calculate from bookings
  });

  // Supplement STR with booking data for months without reconciliation
  validSTRBookings.forEach(b => {
    if (!b.check_in || b.total_amount <= 0) return;
    const month = b.check_in.substring(0, 7) + '-01'; // Format as YYYY-MM-01
    if (!monthlyRevenue[month]) {
      monthlyRevenue[month] = { month, str: 0, mtr: 0, total: 0 };
    }
    // Only add if no reconciliation data for this month
    if (monthlyRevenue[month].str === 0) {
      monthlyRevenue[month].str += b.total_amount;
    }
  });

  // ALWAYS calculate MTR from mid_term_bookings (source of truth)
  mtrBookings.forEach(b => {
    if (!b.start_date || !b.end_date || !b.monthly_rent) return;
    const startDate = new Date(b.start_date);
    const endDate = new Date(b.end_date);
    
    // Prorate across the months the booking spans
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-01`;
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      const daysInMonth = monthEnd.getDate();
      
      const effectiveStart = startDate > monthStart ? startDate : monthStart;
      const effectiveEnd = endDate < monthEnd ? endDate : monthEnd;
      const daysOccupied = Math.max(1, Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      const proratedRent = (b.monthly_rent / daysInMonth) * daysOccupied;
      
      if (!monthlyRevenue[monthKey]) {
        monthlyRevenue[monthKey] = { month: monthKey, str: 0, mtr: 0, total: 0 };
      }
      monthlyRevenue[monthKey].mtr += proratedRent;
      
      // Move to next month
      currentDate.setMonth(currentDate.getMonth() + 1);
      currentDate.setDate(1);
    }
  });

  // Recalculate totals for each month
  Object.keys(monthlyRevenue).forEach(key => {
    monthlyRevenue[key].total = monthlyRevenue[key].str + monthlyRevenue[key].mtr;
  });

  const monthlyRevenueArray = Object.values(monthlyRevenue)
    .sort((a, b) => a.month.localeCompare(b.month));

    // Format reviews for frontend - map star_rating to rating
    const formattedReviews = reviews.map(r => ({
      id: r.id,
      guestName: r.guest_name,
      rating: r.star_rating,
      text: r.review_text,
      date: r.review_date,
      source: r.review_source || "OwnerRez",
    }));

    // Format email insights for owner highlights
    const ownerHighlights = emailInsights
      .filter(e => e.sentiment === 'positive' || e.category === 'booking_confirmation')
      .slice(0, 5)
      .map(e => ({
        id: e.id,
        subject: e.subject,
        summary: e.summary,
        category: e.category,
        date: e.email_date || e.created_at,
      }));

    // Build performance object - use allSTRBookings for counts, validSTRBookings for revenue
    const performance = {
      totalRevenue,
      strRevenue,
      mtrRevenue,
      totalBookings: allSTRBookings.length + mtrBookings.length,
      strBookings: allSTRBookings.length,
      mtrBookings: mtrBookings.length,
      occupancyRate,
      averageRating,
      reviewCount: reviews.length,
    };

    console.log("Performance metrics calculated:", performance);

    // Build response with owner names
    const response = {
      owner: {
        id: owner.id,
        name: owner.name,
        email: owner.email,
        secondOwnerName: owner.second_owner_name,
        secondOwnerEmail: owner.second_owner_email,
      },
      property: {
        id: property.id,
        name: property.name,
        address: property.address,
        rental_type: property.rental_type,
        image_path: property.image_path,
        management_fee_percentage: property.management_fee_percentage,
        bedrooms: propertyDetails?.bedrooms,
        bathrooms: propertyDetails?.bathrooms,
        square_feet: propertyDetails?.square_feet,
        max_guests: propertyDetails?.max_guests,
        amenities: propertyDetails?.amenities,
      },
      statements,
      expenses,
      credentials,
      bookings: {
        str: allSTRBookings, // Return all valid bookings for display
        mtr: mtrBookings,
      },
      reviews: formattedReviews,
      performance,
      monthlyRevenue: monthlyRevenueArray,
      ownerHighlights,
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Owner portal data error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});