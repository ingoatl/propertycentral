import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { token, ownerId, propertyId } = await req.json();

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

    // Fetch owner details
    const { data: owner, error: ownerError } = await supabase
      .from("property_owners")
      .select("id, name, email, phone, second_owner_name, second_owner_email")
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
    ] = await Promise.all([
      // Monthly reconciliations (statements)
      supabase
        .from("monthly_reconciliations")
        .select("id, reconciliation_month, total_revenue, total_expenses, net_to_owner, status, short_term_revenue, mid_term_revenue")
        .eq("property_id", property.id)
        .in("status", ["statement_sent", "approved", "preview", "pending"])
        .order("reconciliation_month", { ascending: false })
        .limit(24),
      
      // Expenses
      supabase
        .from("expenses")
        .select("id, date, amount, purpose, vendor, category, file_path, original_receipt_path, email_screenshot_path, items_detail")
        .eq("property_id", property.id)
        .order("date", { ascending: false })
        .limit(200),
      
      // Property credentials
      supabase
        .from("property_credentials")
        .select("id, service_name, username, password, url, notes")
        .eq("property_id", property.id)
        .order("service_name"),
      
      // STR bookings (OwnerRez)
      supabase
        .from("ownerrez_bookings")
        .select("id, booking_id, guest_name, check_in, check_out, total_amount, management_fee, booking_status, ownerrez_listing_name")
        .eq("property_id", property.id)
        .order("check_in", { ascending: false })
        .limit(100),
      
      // MTR bookings
      supabase
        .from("mid_term_bookings")
        .select("id, tenant_name, tenant_email, start_date, end_date, monthly_rent, security_deposit, status, notes")
        .eq("property_id", property.id)
        .order("start_date", { ascending: false })
        .limit(50),
      
      // Reviews
      supabase
        .from("ownerrez_reviews")
        .select("id, guest_name, rating, review_text, review_date, source")
        .eq("property_id", property.id)
        .order("review_date", { ascending: false })
        .limit(50),
    ]);

    const statements = statementsResult.data || [];
    const expenses = expensesResult.data || [];
    const credentials = credentialsResult.data || [];
    const strBookings = strBookingsResult.data || [];
    const mtrBookings = mtrBookingsResult.data || [];
    const reviews = reviewsResult.data || [];

    console.log("Data fetched:", {
      statements: statements.length,
      expenses: expenses.length,
      credentials: credentials.length,
      strBookings: strBookings.length,
      mtrBookings: mtrBookings.length,
      reviews: reviews.length,
    });

    // Calculate performance metrics from actual data
    // Primary source: reconciliation data (most accurate)
    const totalReconRevenue = statements.reduce((sum, s) => sum + (s.total_revenue || 0), 0);
    const totalSTRRevenue = statements.reduce((sum, s) => sum + (s.short_term_revenue || 0), 0);
    const totalMTRRevenue = statements.reduce((sum, s) => sum + (s.mid_term_revenue || 0), 0);

    // Fallback: calculate from bookings if reconciliation data is incomplete
    const calculatedSTRRevenue = strBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);
    const calculatedMTRRevenue = mtrBookings.reduce((sum, b) => {
      if (!b.start_date || !b.end_date || !b.monthly_rent) return sum;
      const startDate = new Date(b.start_date);
      const endDate = new Date(b.end_date);
      const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const months = days / 30;
      return sum + (b.monthly_rent * months);
    }, 0);

    // Use reconciliation revenue if available, otherwise use calculated
    const strRevenue = totalSTRRevenue > 0 ? totalSTRRevenue : calculatedSTRRevenue;
    const mtrRevenue = totalMTRRevenue > 0 ? totalMTRRevenue : calculatedMTRRevenue;
    const totalRevenue = totalReconRevenue > 0 ? totalReconRevenue : (strRevenue + mtrRevenue);

    // Calculate occupancy rate
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const daysThisYear = Math.ceil((now.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24));
    
    let bookedDays = 0;
    
    // Count STR booked days
    strBookings.forEach(b => {
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

    // Calculate average rating
    const ratingsWithValue = reviews.filter(r => r.rating && r.rating > 0);
    const averageRating = ratingsWithValue.length > 0
      ? ratingsWithValue.reduce((sum, r) => sum + r.rating, 0) / ratingsWithValue.length
      : null;

    // Build monthly revenue data for charts
    const monthlyRevenue: Record<string, { month: string; str: number; mtr: number; total: number }> = {};
    
    statements.forEach(s => {
      const month = s.reconciliation_month;
      if (!monthlyRevenue[month]) {
        monthlyRevenue[month] = { month, str: 0, mtr: 0, total: 0 };
      }
      monthlyRevenue[month].str = s.short_term_revenue || 0;
      monthlyRevenue[month].mtr = s.mid_term_revenue || 0;
      monthlyRevenue[month].total = s.total_revenue || 0;
    });

    const monthlyRevenueArray = Object.values(monthlyRevenue)
      .sort((a, b) => a.month.localeCompare(b.month));

    // Format reviews for frontend
    const formattedReviews = reviews.map(r => ({
      id: r.id,
      guestName: r.guest_name,
      rating: r.rating,
      text: r.review_text,
      date: r.review_date,
      source: r.source || "OwnerRez",
    }));

    // Build performance object
    const performance = {
      totalRevenue,
      strRevenue,
      mtrRevenue,
      totalBookings: strBookings.length + mtrBookings.length,
      strBookings: strBookings.length,
      mtrBookings: mtrBookings.length,
      occupancyRate,
      averageRating,
      reviewCount: reviews.length,
    };

    console.log("Performance metrics calculated:", performance);

    // Build response
    const response = {
      owner: {
        id: owner.id,
        name: owner.name,
        email: owner.email,
      },
      property: {
        id: property.id,
        name: property.name,
        address: property.address,
        rental_type: property.rental_type,
        image_path: property.image_path,
        management_fee_percentage: property.management_fee_percentage,
      },
      statements,
      expenses,
      credentials,
      bookings: {
        str: strBookings,
        mtr: mtrBookings,
      },
      reviews: formattedReviews,
      performance,
      monthlyRevenue: monthlyRevenueArray,
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
