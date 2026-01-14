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

// Demo portal data for Sara Thompson demo (no database dependencies)
function getDemoPortalData() {
  const today = new Date();
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const twoMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 2, 1);
  const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1);
  
  const formatMonth = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  return {
    owner: {
      id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      name: "Sara Thompson",
      email: "sara.thompson@demo.com",
      phone: "(404) 555-0123",
      secondOwnerName: "Michael Thompson",
      secondOwnerEmail: "michael.thompson@demo.com",
    },
    property: {
      id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      name: "3069 Rita Way Retreat",
      address: "3069 Rita Way, Smyrna, GA 30080",
      rental_type: "hybrid",
      image_path: null, // Will use bundled demo image
      management_fee_percentage: 20,
      bedrooms: 4,
      bathrooms: 3,
      square_feet: 2400,
      max_guests: 8,
      amenities: ["WiFi", "Pool", "Hot Tub", "Smart TV", "Full Kitchen", "Washer/Dryer"],
      onboarding_stage: null,
    },
    statements: [
      {
        id: "stmt-demo-1",
        reconciliation_month: formatMonth(lastMonth),
        total_revenue: 4850,
        total_expenses: 320,
        net_to_owner: 3624,
        actual_net_earnings: 3624,
        status: "sent",
        short_term_revenue: 2350,
        mid_term_revenue: 2500,
      },
      {
        id: "stmt-demo-2",
        reconciliation_month: formatMonth(twoMonthsAgo),
        total_revenue: 5200,
        total_expenses: 450,
        net_to_owner: 3800,
        actual_net_earnings: 3800,
        status: "completed",
        short_term_revenue: 2700,
        mid_term_revenue: 2500,
      },
      {
        id: "stmt-demo-3",
        reconciliation_month: formatMonth(threeMonthsAgo),
        total_revenue: 4600,
        total_expenses: 280,
        net_to_owner: 3456,
        actual_net_earnings: 3456,
        status: "completed",
        short_term_revenue: 2100,
        mid_term_revenue: 2500,
      },
    ],
    expenses: [
      { id: "exp-demo-1", date: formatDate(new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000)), amount: 89.99, purpose: "Pool maintenance supplies", vendor: "Leslie's Pool Supplies", category: "Maintenance", file_path: null, original_receipt_path: null, email_screenshot_path: "demo-receipts/pool-supplies.jpg" },
      { id: "exp-demo-2", date: formatDate(new Date(today.getTime() - 12 * 24 * 60 * 60 * 1000)), amount: 156.50, purpose: "Deep cleaning between guests", vendor: "CleanCo Pro", category: "Cleaning", file_path: null, original_receipt_path: null, email_screenshot_path: "demo-receipts/cleaning.jpg" },
      { id: "exp-demo-3", date: formatDate(new Date(today.getTime() - 20 * 24 * 60 * 60 * 1000)), amount: 45.00, purpose: "Welcome basket supplies", vendor: "Costco", category: "Guest Amenities", file_path: null, original_receipt_path: null, email_screenshot_path: "demo-receipts/costco.jpg" },
    ],
    credentials: [
      { id: "cred-1", service_name: "WiFi Network", username: "RitaWay_Guest", password: "Welcome2024!", url: null, notes: "5GHz network for best streaming" },
      { id: "cred-2", service_name: "Smart Lock", username: null, password: "Last 4 of guest phone", url: null, notes: "Auto-generated for each booking" },
      { id: "cred-3", service_name: "Nest Thermostat", username: "ritaway@peachhausgroup.com", password: "Contact PeachHaus", url: "https://home.nest.com", notes: "Set to 72°F for guest comfort" },
    ],
    bookings: {
      str: [
        { id: "str-1", booking_id: "ORZ-12345", guest_name: "Jennifer Martinez", check_in: formatDate(new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000)), check_out: formatDate(new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)), total_amount: 875, management_fee: 175, booking_status: "confirmed" },
        { id: "str-2", booking_id: "ORZ-12344", guest_name: "David Chen", check_in: formatDate(new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000)), check_out: formatDate(new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000)), total_amount: 720, management_fee: 144, booking_status: "completed" },
        { id: "str-3", booking_id: "ORZ-12343", guest_name: "Sarah Williams", check_in: formatDate(new Date(today.getTime() - 25 * 24 * 60 * 60 * 1000)), check_out: formatDate(new Date(today.getTime() - 20 * 24 * 60 * 60 * 1000)), total_amount: 950, management_fee: 190, booking_status: "completed" },
      ],
      mtr: [
        { id: "mtr-1", tenant_name: "Robert Anderson", tenant_email: "r.anderson@delta.com", start_date: formatDate(new Date(today.getTime() - 45 * 24 * 60 * 60 * 1000)), end_date: formatDate(new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000)), monthly_rent: 2500, deposit_amount: 2500, status: "active", notes: "Delta relocation - excellent tenant" },
      ],
    },
    reviews: [
      { id: "rev-1", guestName: "Jennifer M.", rating: 5, text: "Absolutely stunning property! The pool was pristine and the host communication was exceptional. Will definitely return!", date: formatDate(new Date(today.getTime() - 8 * 24 * 60 * 60 * 1000)), source: "Airbnb" },
      { id: "rev-2", guestName: "David C.", rating: 5, text: "Perfect for our family vacation. Clean, spacious, and every amenity we needed. The smart home features were a nice touch.", date: formatDate(new Date(today.getTime() - 15 * 24 * 60 * 60 * 1000)), source: "VRBO" },
      { id: "rev-3", guestName: "Sarah W.", rating: 4, text: "Great location and beautiful home. Minor issue with AC was resolved within an hour. Very responsive management.", date: formatDate(new Date(today.getTime() - 22 * 24 * 60 * 60 * 1000)), source: "Airbnb" },
    ],
    performance: {
      totalRevenue: 14650,
      strRevenue: 7150,
      mtrRevenue: 7500,
      totalBookings: 12,
      strBookings: 9,
      mtrBookings: 3,
      occupancyRate: 87,
      averageRating: 4.8,
      reviewCount: 3,
    },
    monthlyRevenue: [
      { month: formatMonth(threeMonthsAgo).substring(0, 7), str: 2100, mtr: 2500, total: 4600 },
      { month: formatMonth(twoMonthsAgo).substring(0, 7), str: 2700, mtr: 2500, total: 5200 },
      { month: formatMonth(lastMonth).substring(0, 7), str: 2350, mtr: 2500, total: 4850 },
    ],
    ownerHighlights: [
      { type: "review", message: "New 5-star review from Jennifer M.!", date: formatDate(new Date(today.getTime() - 8 * 24 * 60 * 60 * 1000)) },
      { type: "booking", message: "Upcoming STR booking confirmed: Jennifer Martinez (4 nights)", date: formatDate(today) },
      { type: "revenue", message: "MTR tenant Robert Anderson extended stay by 1 month!", date: formatDate(new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000)) },
    ],
    revenueBreakdown: {
      mtr: [],
      str: [],
      summary: {
        mtrFromStatements: 7500,
        mtrFromFutureBookings: 0,
        strFromReconciliation: 7150,
        strFromBookings: 7150,
      }
    },
    dataWarnings: [],
  };
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

    // Demo mode - return mock data for demo owner ID
    const DEMO_OWNER_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    const DEMO_PROPERTY_ID = "b2c3d4e5-f6a7-8901-bcde-f12345678901";
    
    if (validatedOwnerId === DEMO_OWNER_ID) {
      console.log("Demo mode activated - returning mock data");
      return new Response(
        JSON.stringify(getDemoPortalData()),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
      .is("offboarded_at", null)
      .order("name", { ascending: true });

    if (validatedPropertyId) {
      propertyQuery = propertyQuery.eq("id", validatedPropertyId);
    } else {
      propertyQuery = propertyQuery.eq("owner_id", validatedOwnerId);
    }

    // Use limit(1) and get first item to handle owners with multiple properties
    const { data: properties, error: propertyError } = await propertyQuery.limit(1);
    const property = properties?.[0] || null;

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
      leadOnboardingResult,
    ] = await Promise.all([
      // Monthly reconciliations (statements) - fetch all historical data (24 months)
      supabase
        .from("monthly_reconciliations")
        .select("id, reconciliation_month, total_revenue, total_expenses, management_fee, net_to_owner, status, short_term_revenue, mid_term_revenue, revenue_override")
        .eq("property_id", property.id)
        .in("status", ["sent", "statement_sent", "completed", "approved", "preview", "pending"])
        .order("reconciliation_month", { ascending: false })
        .limit(60), // 5 years of data
      
      // Expenses - Show expenses that are either:
      // 1. Billed (part of approved reconciliations), OR
      // 2. Recent (within last 6 months) - captures new unbilled expenses
      // This prevents old unbilled expenses from showing up (data hygiene issue)
      supabase
        .from("expenses")
        .select("id, date, amount, purpose, vendor, category, file_path, original_receipt_path, email_screenshot_path, items_detail, billed, reconciliation_id")
        .eq("property_id", property.id)
        .or(`billed.eq.true,date.gte.${new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}`)
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
      
      // Lead onboarding status for this property
      supabase
        .from("leads")
        .select("id, stage")
        .eq("property_id", property.id)
        .in("stage", ['contract_signed', 'ach_form_signed', 'onboarding_form_requested', 'insurance_requested', 'inspection_scheduled'])
        .maybeSingle(),
    ]);

    const rawStatements = statementsResult.data || [];
    const expenses = expensesResult.data || [];
    const credentials = credentialsResult.data || [];
    const strBookings = strBookingsResult.data || [];
    const mtrBookings = mtrBookingsResult.data || [];
    const emailInsights = emailInsightsResult.data || [];
    const propertyDetails = propertyDetailsResult.data;
    const leadOnboarding = leadOnboardingResult.data;
    
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
    // IMPORTANT: Respect property rental_type classification
    // - "mid_term" properties: ALL revenue is MTR (even Airbnb 30+ day stays)
    // - "long_term" properties: ALL revenue is MTR
    // - "hybrid" properties: STR and MTR are tracked separately
    const isMidTermOnly = property.rental_type === 'mid_term' || property.rental_type === 'long_term';
    console.log(`Property rental_type: ${property.rental_type}, isMidTermOnly: ${isMidTermOnly}`);
    
    // STR revenue: from reconciliation data (most accurate), fallback to bookings
    const totalSTRFromRecon = statements.reduce((sum, s) => sum + (s.short_term_revenue || 0), 0);
    const calculatedSTRRevenue = validSTRBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);
    
    // For mid_term/long_term properties, ALL booking revenue is classified as MTR
    const strRevenue = isMidTermOnly ? 0 : (totalSTRFromRecon > 0 ? totalSTRFromRecon : calculatedSTRRevenue);

    // MTR revenue: Use statement data for months with statements (most accurate after reconciliation)
    // For future months without statements, calculate from bookings
    
    // Track detailed breakdown for UI display
    const mtrBreakdown: { month: string; tenant: string; amount: number; source: string; days?: number; startDate?: string; endDate?: string; monthlyRent?: number }[] = [];
    const strBreakdown: { guest: string; checkIn: string; checkOut: string; amount: number; source: string; nights?: number }[] = [];
    
    // First, get MTR from statements (already adjusted during reconciliation)
    // We need to correlate with actual bookings to show tenant names
    let mtrFromStatements = 0;
    const monthsWithStatements = new Set<string>();
    
    // Build a map of which tenants were in which months for name attribution
    const tenantsByMonth: Record<string, { tenant: string; rent: number; days: number; startDate: string; endDate: string }[]> = {};
    for (const b of mtrBookings) {
      if (!b.start_date || !b.end_date || !b.monthly_rent) continue;
      const startDate = new Date(b.start_date);
      const endDate = new Date(b.end_date);
      
      let currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        const daysInMonth = monthEnd.getDate();
        
        const effectiveStart = startDate > monthStart ? startDate : monthStart;
        const effectiveEnd = endDate < monthEnd ? endDate : monthEnd;
        const daysOccupied = Math.max(1, Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        
        if (!tenantsByMonth[monthKey]) tenantsByMonth[monthKey] = [];
        tenantsByMonth[monthKey].push({
          tenant: b.tenant_name || 'MTR Guest',
          rent: b.monthly_rent,
          days: daysOccupied,
          startDate: b.start_date,
          endDate: b.end_date,
        });
        
        currentDate.setMonth(currentDate.getMonth() + 1);
        currentDate.setDate(1);
      }
    }
    
    for (const s of statements) {
      const monthKey = s.reconciliation_month?.substring(0, 7) || '';
      if (!monthKey) continue;
      monthsWithStatements.add(monthKey);
      
      const statementMtr = s.mid_term_revenue || 0;
      if (statementMtr <= 0) continue;
      
      // If revenue_override is set and less than total, calculate adjusted MTR
      let finalMtr = statementMtr;
      if (s.revenue_override !== null && s.revenue_override !== undefined) {
        const originalTotal = (s.short_term_revenue || 0) + (s.mid_term_revenue || 0);
        if (originalTotal > 0 && s.revenue_override < originalTotal) {
          const ratio = s.revenue_override / originalTotal;
          finalMtr = statementMtr * ratio;
          console.log(`Month ${monthKey}: MTR adjusted from $${statementMtr} to $${finalMtr.toFixed(2)} (override ratio: ${ratio.toFixed(2)})`);
        }
      }
      
      mtrFromStatements += finalMtr;
      
      // Attribute to actual tenants from that month
      const tenantsInMonth = tenantsByMonth[monthKey] || [];
      if (tenantsInMonth.length > 0) {
        // If multiple tenants, prorate the statement amount based on expected rent proportions
        const totalExpectedRent = tenantsInMonth.reduce((sum, t) => sum + (t.rent * t.days / 30), 0);
        for (const t of tenantsInMonth) {
          const expectedRent = t.rent * t.days / 30;
          const share = totalExpectedRent > 0 ? (expectedRent / totalExpectedRent) * finalMtr : finalMtr;
          mtrBreakdown.push({
            month: monthKey,
            tenant: t.tenant,
            amount: share,
            source: 'statement',
            days: t.days,
            startDate: t.startDate,
            endDate: t.endDate,
            monthlyRent: t.rent,
          });
        }
      } else {
        // No booking data, just show as statement
        mtrBreakdown.push({
          month: monthKey,
          tenant: 'Mid-Term Tenant',
          amount: finalMtr,
          source: 'statement',
        });
      }
    }
    
    // For months without statements (future bookings), calculate from bookings
    let mtrFromFutureBookings = 0;
    for (const b of mtrBookings) {
      if (!b.start_date || !b.end_date || !b.monthly_rent) continue;
      const startDate = new Date(b.start_date);
      const endDate = new Date(b.end_date);
      
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
          mtrBreakdown.push({
            month: monthKey,
            tenant: b.tenant_name || 'MTR Guest',
            amount: proratedRent,
            source: 'projected',
            days: daysOccupied,
            startDate: b.start_date,
            endDate: b.end_date,
            monthlyRent: b.monthly_rent,
          });
        }
        
        currentDate.setMonth(currentDate.getMonth() + 1);
        currentDate.setDate(1);
      }
    }
    
    // Build STR breakdown with nights calculation
    for (const b of validSTRBookings) {
      const checkIn = new Date(b.check_in);
      const checkOut = new Date(b.check_out);
      const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
      strBreakdown.push({
        guest: b.guest_name || 'Guest',
        checkIn: b.check_in,
        checkOut: b.check_out,
        amount: b.total_amount || 0,
        source: b.ownerrez_listing_name || 'OwnerRez',
        nights: nights,
      });
    }
    
    // For mid_term/long_term properties, include ALL STR bookings as MTR revenue
    const strRevenueAsMtr = isMidTermOnly ? (totalSTRFromRecon > 0 ? totalSTRFromRecon : calculatedSTRRevenue) : 0;
    const mtrRevenue = mtrFromStatements + mtrFromFutureBookings + strRevenueAsMtr;
    console.log(`MTR revenue: from statements=$${mtrFromStatements.toFixed(2)}, from future bookings=$${mtrFromFutureBookings.toFixed(2)}, STR as MTR=$${strRevenueAsMtr.toFixed(2)}, total=$${mtrRevenue.toFixed(2)}`);
    
    // Total revenue is STR + MTR
    const totalRevenue = strRevenue + mtrRevenue;

    // Calculate occupancy rate using only valid bookings
    // Calculate for CURRENT year (any booking that overlaps with this year)
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    const daysThisYear = Math.ceil((now.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24));
    
    let bookedDays = 0;
    const occupancyDetails = { strDays: 0, mtrDays: 0, strBookingsThisYear: 0, mtrBookingsThisYear: 0 };
    
    // Count STR booked days (bookings that overlap with current year)
    validSTRBookings.forEach(b => {
      if (!b.check_in || !b.check_out) return;
      const checkIn = new Date(b.check_in);
      const checkOut = new Date(b.check_out);
      
      // Check if booking overlaps with current year
      if (checkOut >= yearStart && checkIn <= now) {
        const effectiveStart = checkIn < yearStart ? yearStart : checkIn;
        const effectiveEnd = checkOut > now ? now : checkOut;
        const days = Math.max(0, Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)));
        bookedDays += days;
        occupancyDetails.strDays += days;
        if (days > 0) occupancyDetails.strBookingsThisYear++;
      }
    });
    
    // Count MTR booked days (bookings that overlap with current year)
    mtrBookings.forEach(b => {
      if (!b.start_date || !b.end_date) return;
      const start = new Date(b.start_date);
      const end = new Date(b.end_date);
      
      // Check if booking overlaps with current year
      if (end >= yearStart && start <= now) {
        const effectiveStart = start < yearStart ? yearStart : start;
        const effectiveEnd = end > now ? now : end;
        const days = Math.max(0, Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)));
        bookedDays += days;
        occupancyDetails.mtrDays += days;
        if (days > 0) occupancyDetails.mtrBookingsThisYear++;
      }
    });

    const occupancyRate = daysThisYear > 0 ? Math.min(100, Math.round((bookedDays / daysThisYear) * 100)) : 0;
    console.log(`Occupancy calc: ${bookedDays}/${daysThisYear} days = ${occupancyRate}%`, occupancyDetails);

  // Calculate average rating using star_rating column
  const ratingsWithValue = reviews.filter(r => r.star_rating && r.star_rating > 0);
  const averageRating = ratingsWithValue.length > 0
    ? ratingsWithValue.reduce((sum, r) => sum + r.star_rating, 0) / ratingsWithValue.length
    : null;

  // Build monthly revenue data for charts - use statement data as source of truth
  const monthlyRevenue: Record<string, { month: string; str: number; mtr: number; total: number; expenses: number; net: number }> = {};
  
  // First, populate from reconciliation data (most accurate - already includes adjustments)
  statements.forEach(s => {
    const month = s.reconciliation_month;
    if (!monthlyRevenue[month]) {
      monthlyRevenue[month] = { month, str: 0, mtr: 0, total: 0, expenses: 0, net: 0 };
    }
    // Use statement values - they include manual adjustments/overrides
    monthlyRevenue[month].str = s.short_term_revenue || 0;
    monthlyRevenue[month].mtr = s.mid_term_revenue || 0;
    monthlyRevenue[month].total = (s.short_term_revenue || 0) + (s.mid_term_revenue || 0);
    
    // Include both actual expenses AND management fee in the expenses shown
    const actualExpenses = Math.abs(s.total_expenses || 0);
    const managementFee = Math.abs(s.management_fee || 0);
    monthlyRevenue[month].expenses = actualExpenses + managementFee;
    
    // For co-hosting: actual_net = revenue - net_to_owner (net_to_owner is what they owe us)
    // For full-service: actual_net = net_to_owner
    const actualNet = isCohosting 
      ? (s.total_revenue || 0) - (s.net_to_owner || 0)
      : (s.net_to_owner || 0);
    monthlyRevenue[month].net = actualNet;
  });

  // For months WITHOUT statements, supplement from booking data
  validSTRBookings.forEach(b => {
    if (!b.check_in || b.total_amount <= 0) return;
    const month = b.check_in.substring(0, 7) + '-01'; // Format as YYYY-MM-01
    // Only add if no statement data for this month
    if (!monthlyRevenue[month] || (monthlyRevenue[month].str === 0 && monthlyRevenue[month].mtr === 0)) {
      if (!monthlyRevenue[month]) {
        monthlyRevenue[month] = { month, str: 0, mtr: 0, total: 0, expenses: 0, net: 0 };
      }
      monthlyRevenue[month].str += b.total_amount;
    }
  });

  // For MTR, only add future months that don't have statements yet
  mtrBookings.forEach(b => {
    if (!b.start_date || !b.end_date || !b.monthly_rent) return;
    const startDate = new Date(b.start_date);
    const endDate = new Date(b.end_date);
    
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-01`;
      
      // ONLY add MTR for months WITHOUT statement data
      if (!monthsWithStatements.has(monthKey.substring(0, 7))) {
        const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        const daysInMonth = monthEnd.getDate();
        
        const effectiveStart = startDate > monthStart ? startDate : monthStart;
        const effectiveEnd = endDate < monthEnd ? endDate : monthEnd;
        const daysOccupied = Math.max(1, Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        const proratedRent = (b.monthly_rent / daysInMonth) * daysOccupied;
        
        if (!monthlyRevenue[monthKey]) {
          monthlyRevenue[monthKey] = { month: monthKey, str: 0, mtr: 0, total: 0, expenses: 0, net: 0 };
        }
        monthlyRevenue[monthKey].mtr += proratedRent;
      }
      
      currentDate.setMonth(currentDate.getMonth() + 1);
      currentDate.setDate(1);
    }
  });

  // Recalculate totals and net for months supplemented with booking data
  Object.keys(monthlyRevenue).forEach(key => {
    monthlyRevenue[key].total = monthlyRevenue[key].str + monthlyRevenue[key].mtr;
    // For months without statements, net = total (no expenses known)
    if (monthlyRevenue[key].net === 0 && monthlyRevenue[key].total > 0) {
      monthlyRevenue[key].net = monthlyRevenue[key].total - monthlyRevenue[key].expenses;
    }
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
    // For mid_term/long_term properties, classify ALL bookings as MTR
    const performance = {
      totalRevenue,
      strRevenue,
      mtrRevenue,
      totalBookings: allSTRBookings.length + mtrBookings.length,
      strBookings: isMidTermOnly ? 0 : allSTRBookings.length,
      mtrBookings: isMidTermOnly ? (allSTRBookings.length + mtrBookings.length) : mtrBookings.length,
      occupancyRate,
      averageRating,
      reviewCount: reviews.length,
      rentalType: property.rental_type, // Include for frontend display logic
    };

    console.log("Performance metrics calculated:", performance);

    // DATA VALIDATION WATCHDOG - Check for data anomalies and log warnings
    const dataWarnings: string[] = [];
    const currentYear = new Date().getFullYear();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    // Check for unbilled expenses older than 6 months (data hygiene issue)
    const oldUnbilledExpenses = expenses.filter((e: any) => {
      const expenseDate = new Date(e.date);
      return !e.billed && expenseDate < sixMonthsAgo;
    });
    if (oldUnbilledExpenses.length > 0) {
      const warning = `Found ${oldUnbilledExpenses.length} unbilled expense(s) older than 6 months - may need reconciliation`;
      console.warn("[DATA WATCHDOG]", warning, oldUnbilledExpenses.map((e: any) => ({ id: e.id, date: e.date, amount: e.amount })));
      dataWarnings.push(warning);
    }
    
    // Check for expenses with dates outside reasonable range (future or very old)
    const suspiciousDateExpenses = expenses.filter((e: any) => {
      const expenseDate = new Date(e.date);
      return expenseDate.getFullYear() < currentYear - 2 || expenseDate > new Date();
    });
    if (suspiciousDateExpenses.length > 0) {
      const warning = `Found ${suspiciousDateExpenses.length} expense(s) with suspicious dates (older than 2 years or in the future)`;
      console.warn("[DATA WATCHDOG]", warning, suspiciousDateExpenses.map((e: any) => ({ id: e.id, date: e.date, purpose: e.purpose?.substring(0, 50) })));
      dataWarnings.push(warning);
    }
    
    // Check for statements with zero revenue but should have bookings
    const statementsWithZeroRevenue = statements.filter((s: any) => 
      (s.total_revenue === 0 || s.total_revenue === null) && 
      s.status !== 'draft' && s.status !== 'preview'
    );
    if (statementsWithZeroRevenue.length > 0) {
      console.warn("[DATA WATCHDOG] Found statements with zero revenue:", statementsWithZeroRevenue.map((s: any) => s.reconciliation_month));
    }
    
    // Validate that statement months match expense dates
    const expensesByMonth: Record<string, number> = {};
    expenses.forEach((e: any) => {
      const month = e.date?.substring(0, 7);
      if (month) {
        expensesByMonth[month] = (expensesByMonth[month] || 0) + 1;
      }
    });
    
    console.log("[DATA WATCHDOG] Expense distribution by month:", expensesByMonth);
    
    if (dataWarnings.length > 0) {
      console.warn(`[DATA WATCHDOG] ${dataWarnings.length} data issue(s) detected for property ${property.name}`);
    }

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
        onboarding_stage: leadOnboarding?.stage || null,
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
      revenueBreakdown: {
        mtr: mtrBreakdown,
        str: strBreakdown,
        summary: {
          mtrFromStatements,
          mtrFromFutureBookings,
          strFromReconciliation: totalSTRFromRecon,
          strFromBookings: calculatedSTRRevenue,
        }
      },
      dataWarnings, // Include any data quality warnings for admin awareness
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