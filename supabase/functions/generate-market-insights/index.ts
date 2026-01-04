import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PropertyInsightsRequest {
  propertyId: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { propertyId }: PropertyInsightsRequest = await req.json();

    if (!propertyId) {
      throw new Error("propertyId is required");
    }

    console.log(`Generating market insights for property: ${propertyId}`);

    // Fetch property data
    const { data: property, error: propError } = await supabase
      .from("properties")
      .select(`
        id, name, address, rental_type, nightly_rate, visit_price,
        property_owners(name, email)
      `)
      .eq("id", propertyId)
      .single();

    if (propError || !property) {
      throw new Error(`Property not found: ${propError?.message}`);
    }

    // Fetch comprehensive property data if available
    const { data: compData } = await supabase
      .from("comprehensive_property_data")
      .select("*")
      .eq("id", propertyId)
      .single();

    // Fetch booking performance data
    const { data: bookings } = await supabase
      .from("ownerrez_bookings")
      .select("*")
      .eq("property_id", propertyId)
      .order("check_in", { ascending: false });

    // Fetch mid-term bookings (correct column names: start_date, end_date, monthly_rent)
    const { data: mtBookings } = await supabase
      .from("mid_term_bookings")
      .select("*")
      .eq("property_id", propertyId)
      .order("start_date", { ascending: false });

    // Fetch reviews
    const { data: reviews } = await supabase
      .from("ownerrez_reviews")
      .select("*")
      .eq("property_id", propertyId)
      .order("review_date", { ascending: false })
      .limit(10);

    // Fetch reconciliation data for financial metrics (primary source of truth)
    const { data: reconciliations } = await supabase
      .from("monthly_reconciliations")
      .select("*")
      .eq("property_id", propertyId)
      .in("status", ["statement_sent", "approved"])
      .order("reconciliation_month", { ascending: false })
      .limit(12);

    // Calculate real metrics from booking data
    const totalSTRRevenue = bookings?.reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0;
    
    // Calculate MTR revenue from mid_term_bookings (monthly_rent * months stayed)
    const totalMTRRevenue = mtBookings?.reduce((sum, b) => {
      const startDate = new Date(b.start_date);
      const endDate = new Date(b.end_date || b.start_date);
      const days = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
      const months = days / 30;
      return sum + ((b.monthly_rent || 0) * months);
    }, 0) || 0;

    const totalBookings = (bookings?.length || 0) + (mtBookings?.length || 0);
    const averageRating = reviews?.length 
      ? reviews.reduce((sum, r) => sum + (r.star_rating || 0), 0) / reviews.length 
      : null;

    // Use reconciliation data as primary revenue source if available
    const reconRevenue = reconciliations?.reduce((sum, r) => sum + (r.total_revenue || 0), 0) || 0;
    const reconSTRRevenue = reconciliations?.reduce((sum, r) => sum + (r.short_term_revenue || 0), 0) || 0;
    const reconMTRRevenue = reconciliations?.reduce((sum, r) => sum + (r.mid_term_revenue || 0), 0) || 0;

    // Use reconciliation data if available, fallback to calculated
    const finalSTRRevenue = reconSTRRevenue > 0 ? reconSTRRevenue : totalSTRRevenue;
    const finalMTRRevenue = reconMTRRevenue > 0 ? reconMTRRevenue : totalMTRRevenue;
    const finalTotalRevenue = reconRevenue > 0 ? reconRevenue : (totalSTRRevenue + totalMTRRevenue);

    // Calculate occupancy from bookings
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const daysInYear = Math.max(1, Math.floor((now.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24)));
    
    let bookedDays = 0;
    // STR bookings use check_in/check_out
    (bookings || []).forEach(b => {
      const checkIn = new Date(b.check_in);
      const checkOut = new Date(b.check_out || b.check_in);
      if (checkIn >= yearStart && checkIn <= now) {
        const nights = Math.floor((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
        bookedDays += Math.min(nights, daysInYear);
      }
    });
    // MTR bookings use start_date/end_date
    (mtBookings || []).forEach(b => {
      const startDate = new Date(b.start_date);
      const endDate = new Date(b.end_date || b.start_date);
      if (startDate >= yearStart && startDate <= now) {
        const nights = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        bookedDays += Math.min(nights, daysInYear);
      }
    });
    const occupancyRate = daysInYear > 0 ? Math.round((bookedDays / daysInYear) * 100) : 0;

    // Extract city/area from address
    const addressParts = property.address?.split(",") || [];
    const city = addressParts[1]?.trim() || "Atlanta";
    const state = addressParts[2]?.trim()?.split(" ")[0] || "GA";

    // Build context for AI
    const propertyContext = {
      name: property.name,
      address: property.address,
      city,
      state,
      bedrooms: compData?.bedrooms || 5,
      bathrooms: compData?.bathrooms || 3,
      sqft: compData?.sqft,
      rentalType: property.rental_type,
      nightlyRate: property.nightly_rate,
      totalSTRRevenue: finalSTRRevenue,
      totalMTRRevenue: finalMTRRevenue,
      totalBookings,
      occupancyRate,
      averageRating,
      reviewCount: reviews?.length || 0,
    };

    // Generate AI insights
    const aiPrompt = `You are a real estate market analyst for PeachHaus Property Management. Generate market insights for this property:

Property: ${propertyContext.name}
Address: ${propertyContext.address}
Bedrooms: ${propertyContext.bedrooms}, Bathrooms: ${propertyContext.bathrooms}
Rental Type: ${propertyContext.rentalType || "Hybrid (STR + MTR)"}
Current Performance:
- STR Revenue: $${finalSTRRevenue.toLocaleString()}
- MTR Revenue: $${finalMTRRevenue.toLocaleString()}
- Total Bookings: ${totalBookings}
- Occupancy Rate: ${occupancyRate}%
- Average Rating: ${averageRating ? averageRating.toFixed(2) : "No reviews yet"}

Generate a JSON response with these sections (use real market data patterns for the Atlanta metro area):

{
  "comparableProperties": [
    {
      "name": "Comparable property name",
      "area": "Specific area/neighborhood",
      "distance": "< X miles",
      "bedrooms": number,
      "bathrooms": number,
      "nightlyRate": number,
      "occupancy": number (percentage),
      "avgMonthly": number,
      "platform": "Airbnb" or "VRBO"
    }
  ],
  "marketMetrics": {
    "areaOccupancy": number,
    "avgNightlyRate": number,
    "yoyGrowth": number,
    "marketTrend": "rising" | "stable" | "declining"
  },
  "futureOpportunities": [
    {
      "title": "Opportunity title",
      "timeframe": "When",
      "description": "2-3 sentences about the opportunity",
      "potentialImpact": "What this could mean for revenue"
    }
  ],
  "demandDrivers": [
    {
      "event": "Event name",
      "date": "Date or timeframe",
      "impact": "Brief description of demand impact"
    }
  ],
  "strengthsForArea": [
    "Bullet point about why this location is strong"
  ]
}

Generate 4-5 comparable properties based on typical ${city} area STR data.
Generate 3-4 future opportunities relevant to Atlanta/Georgia.
Generate 4-5 demand drivers for the area.
Generate 4-5 location strengths.
Be specific and realistic based on Atlanta metro market conditions.`;

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a real estate market analyst. Always respond with valid JSON only, no markdown." },
          { role: "user", content: aiPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error("OpenAI API error:", errorText);
      throw new Error("Failed to generate AI insights");
    }

    const openaiData = await openaiResponse.json();
    const aiContent = openaiData.choices[0]?.message?.content || "{}";
    
    // Parse AI response
    let aiInsights;
    try {
      // Remove any markdown code blocks if present
      const cleanContent = aiContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      aiInsights = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", aiContent);
      aiInsights = {
        comparableProperties: [],
        marketMetrics: { areaOccupancy: 75, avgNightlyRate: 280, yoyGrowth: 5, marketTrend: "stable" },
        futureOpportunities: [],
        demandDrivers: [],
        strengthsForArea: []
      };
    }

    // Build final response with real + AI data
    const response = {
      property: {
        id: property.id,
        name: property.name,
        address: property.address,
        city,
        bedrooms: compData?.bedrooms || 5,
        bathrooms: compData?.bathrooms || 3,
        rentalType: property.rental_type,
      },
      performance: {
        totalRevenue: finalTotalRevenue,
        strRevenue: finalSTRRevenue,
        mtrRevenue: finalMTRRevenue,
        totalBookings,
        strBookings: bookings?.length || 0,
        mtrBookings: mtBookings?.length || 0,
        occupancyRate,
        averageRating,
        reviewCount: reviews?.length || 0,
      },
      reviews: reviews?.map(r => ({
        id: r.id,
        guestName: r.guest_name,
        rating: r.star_rating,
        text: r.review_text,
        date: r.review_date,
        source: r.review_source,
      })) || [],
      monthlyRevenue: reconciliations?.map(r => ({
        month: r.reconciliation_month,
        revenue: r.total_revenue,
        expenses: r.total_expenses,
        net: r.net_to_owner,
      })) || [],
      aiInsights,
      generatedAt: new Date().toISOString(),
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error generating market insights:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
