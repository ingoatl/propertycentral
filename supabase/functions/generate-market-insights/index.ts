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

    // Get current date for accurate event dates
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    
    // Determine rental type for prompt customization
    const rentalType = property.rental_type || "hybrid";
    const isMTROnly = rentalType === "mid_term";
    const isHybrid = rentalType === "hybrid";

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

    // Generate AI insights - different prompts based on rental type
    let aiPrompt: string;
    
    if (isMTROnly) {
      // MTR-ONLY PROPERTY PROMPT - Focus on corporate housing, insurance, healthcare
      aiPrompt = `You are a real estate market analyst for PeachHaus Property Management specializing in CORPORATE HOUSING and MID-TERM RENTALS.

IMPORTANT: Today's date is ${currentDate.toISOString().split('T')[0]}. This is a MID-TERM ONLY property - focus on 30+ day stays.

Property: ${propertyContext.name}
Address: ${propertyContext.address}
City: ${city}, ${state}
Bedrooms: ${propertyContext.bedrooms}, Bathrooms: ${propertyContext.bathrooms}
Rental Type: Mid-Term Only (30+ day stays)
Current Performance:
- MTR Revenue: $${finalMTRRevenue.toLocaleString()}
- Total Bookings: ${totalBookings}
- Occupancy Rate: ${occupancyRate}%

Generate a JSON response focused on MID-TERM RENTAL opportunities:

{
  "comparableProperties": [
    {
      "name": "Corporate housing / extended stay property",
      "area": "Specific area in ${city}",
      "distance": "< X miles",
      "bedrooms": number,
      "bathrooms": number,
      "nightlyRate": 0,
      "occupancy": number (percentage),
      "avgMonthly": number (monthly rate),
      "platform": "Corporate Housing" or "Furnished Finder"
    }
  ],
  "marketMetrics": {
    "areaOccupancy": number,
    "avgNightlyRate": 0,
    "avgMonthlyRate": number,
    "yoyGrowth": number,
    "marketTrend": "rising" | "stable" | "declining"
  },
  "futureOpportunities": [
    {
      "title": "Corporate/MTR opportunity",
      "timeframe": "When",
      "description": "Focus on corporate relocations, insurance placements, healthcare travelers",
      "potentialImpact": "Revenue impact"
    }
  ],
  "demandDrivers": [
    {
      "event": "Corporate housing demand driver (e.g., 'Q1 Corporate Relocation Season', 'Healthcare Traveler Contract Renewals', 'Insurance Displacement Peak')",
      "date": "YYYY-MM-DD format",
      "impact": "Expected demand increase for extended stays",
      "category": "Corporate" | "Insurance" | "Healthcare" | "Relocation" | "Seasonal"
    }
  ],
  "strengthsForArea": [
    "Focus on corporate housing advantages, hospital proximity, business districts"
  ],
  "mtrDemandSources": [
    {
      "source": "Corporate Relocations",
      "description": "Fortune 500 companies with offices in ${city}",
      "typicalStay": "30-90 days",
      "demandLevel": "High"
    }
  ]
}

CRITICAL for MTR properties:
- Focus on CORPORATE HOUSING demand, not tourist events
- demandDrivers should include: Corporate relocation seasons (Q1, Q3), Insurance claim peaks (storm seasons), Healthcare traveler contract cycles (quarterly), University/hospital rotations
- Include Fortune 500 companies in ${city}: Home Depot, Delta, Coca-Cola, UPS, etc.
- Include major hospital systems for travel nurse demand
- Focus on monthly rates, not nightly rates
- strengthsForArea should emphasize: proximity to business districts, hospitals, corporate headquarters

Generate 4-5 corporate housing comparables.
Generate 3-4 MTR-focused opportunities.
Generate 6-8 corporate/MTR demand drivers.
Generate 4-5 location strengths for corporate housing.`;
    } else {
      // HYBRID or STR PROPERTY PROMPT - Balance events and corporate
      aiPrompt = `You are a real estate market analyst for PeachHaus Property Management. Generate market insights for this HYBRID property that does both short-term and mid-term rentals.

IMPORTANT: Today's date is ${currentDate.toISOString().split('T')[0]}. All events MUST be in the future from this date.

Property: ${propertyContext.name}
Address: ${propertyContext.address}
City: ${city}, ${state}
Bedrooms: ${propertyContext.bedrooms}, Bathrooms: ${propertyContext.bathrooms}
Rental Type: ${isHybrid ? "Hybrid (STR + MTR)" : "Short-Term Rental"}
Current Performance:
- STR Revenue: $${finalSTRRevenue.toLocaleString()}
- MTR Revenue: $${finalMTRRevenue.toLocaleString()}
- Total Bookings: ${totalBookings}
- Occupancy Rate: ${occupancyRate}%
- Average Rating: ${averageRating ? averageRating.toFixed(2) : "No reviews yet"}

Generate a JSON response with these sections. For demand drivers, use REAL upcoming events in the ${city} area with ACTUAL future dates in YYYY-MM-DD format:

{
  "comparableProperties": [
    {
      "name": "Comparable property name",
      "area": "Specific area/neighborhood in ${city}",
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
      "event": "Specific event name with venue location",
      "date": "YYYY-MM-DD format - MUST be after ${currentDate.toISOString().split('T')[0]}",
      "impact": "Expected rate increase and demand level",
      "category": "Sports" | "Music" | "Festival" | "Business" | "Seasonal" | "World Cup",
      "venue": "Venue name and location",
      "distance": "Distance from property"
    }
  ],
  "strengthsForArea": [
    "Bullet point about why this location is strong"
  ]
}

CRITICAL for demandDrivers - INCLUDE THESE MAJOR EVENTS:

1. **FIFA WORLD CUP 2026** (MOST IMPORTANT - Atlanta is a host city):
   - Multiple games at Mercedes-Benz Stadium June-July 2026
   - Expected 400%+ rate increases during match days
   - Include at least 2-3 World Cup related entries

2. **Major Metro Atlanta Events to include**:
   - SEC Championship (December, Mercedes-Benz Stadium)
   - Chick-fil-A Peach Bowl (December 30-31, Mercedes-Benz Stadium)
   - Dragon Con (Labor Day weekend, Downtown Atlanta - 85,000+ attendees)
   - Shaky Knees Music Festival (May, Central Park Atlanta)
   - Music Midtown (September, Piedmont Park)
   - Atlanta Dogwood Festival (April, Piedmont Park)
   - Atlanta Pride Festival (October, Piedmont Park)
   - Taste of Atlanta (October, Midtown)
   - Atlanta Jazz Festival (May, Piedmont Park - FREE, 150,000+ attendees)

3. **Sports - include home games**:
   - Atlanta Falcons (NFL) - Mercedes-Benz Stadium
   - Atlanta Hawks (NBA) - State Farm Arena  
   - Atlanta United (MLS) - Mercedes-Benz Stadium
   - Atlanta Braves (MLB) - Truist Park (Cobb County)

4. **Business/Conference Events**:
   - Georgia World Congress Center events
   - Tech conferences, trade shows

5. **Local city festivals** near the property's specific location

For each event include:
- Exact venue name and city/neighborhood
- How far it is from the property (approximate distance)
- Why it's relevant to their property's location

Generate 8-10 demand drivers with emphasis on World Cup 2026 and major crowd drivers.
Generate 4-5 comparable properties.
Generate 3-4 future opportunities.
Generate 4-5 location strengths specific to the property's neighborhood.`;
    }

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a real estate market analyst. Always respond with valid JSON only, no markdown. IMPORTANT: All numbers must be raw integers or decimals without commas or formatting (e.g., use 4500 not 4,500)." },
          { role: "user", content: aiPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2500,
        response_format: { type: "json_object" },
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error("OpenAI API error:", errorText);
      throw new Error("Failed to generate AI insights");
    }

    const openaiData = await openaiResponse.json();
    const aiContent = openaiData.choices[0]?.message?.content || "{}";
    
    // Parse AI response with robust error handling
    let aiInsights;
    try {
      // Remove any markdown code blocks if present
      let cleanContent = aiContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      
      // Fix common JSON issues: remove commas from numbers (e.g., "4,500" -> "4500")
      // Match numbers with commas that are NOT in strings (basic fix)
      cleanContent = cleanContent.replace(/:\s*(\d{1,3}),(\d{3})/g, ': $1$2');
      cleanContent = cleanContent.replace(/:\s*(\d{1,3}),(\d{3}),(\d{3})/g, ': $1$2$3');
      
      aiInsights = JSON.parse(cleanContent);
      console.log("Successfully parsed AI insights");
    } catch (parseError) {
      console.error("Failed to parse AI response, using fallback:", parseError);
      // Provide comprehensive fallback data
      aiInsights = {
        comparableProperties: [
          {
            name: "Similar Property in Area",
            area: city,
            distance: "< 3 miles",
            bedrooms: compData?.bedrooms || 4,
            bathrooms: compData?.bathrooms || 3,
            nightlyRate: 280,
            occupancy: 75,
            avgMonthly: 5500,
            platform: "Airbnb"
          }
        ],
        marketMetrics: { 
          areaOccupancy: 75, 
          avgNightlyRate: 280, 
          avgMonthlyRate: 5500,
          yoyGrowth: 8, 
          marketTrend: "stable" 
        },
        futureOpportunities: [
          {
            title: "FIFA World Cup 2026",
            timeframe: "June-July 2026",
            description: "Atlanta is a host city for the FIFA World Cup 2026. Expect massive demand.",
            potentialImpact: "300-400% rate increases during match days"
          }
        ],
        demandDrivers: [
          {
            event: "FIFA World Cup 2026 - Atlanta Host City",
            date: "2026-06-15",
            impact: "Unprecedented demand expected for all accommodation types",
            category: "World Cup"
          },
          {
            event: "SEC Championship",
            date: `${currentYear + 1}-12-07`,
            impact: "Major college football event draws 75,000+ fans",
            category: "Sports"
          },
          {
            event: "Dragon Con",
            date: `${currentYear + 1}-09-01`,
            impact: "85,000+ attendees flood downtown Atlanta",
            category: "Festival"
          }
        ],
        strengthsForArea: [
          "Proximity to major Atlanta attractions and venues",
          "Easy access to highways and public transit",
          "Growing demand for vacation rentals in this area"
        ],
        mtrDemandSources: isMTROnly ? [
          {
            source: "Corporate Relocations",
            description: "Fortune 500 companies relocating employees",
            typicalStay: "30-90 days",
            demandLevel: "High"
          },
          {
            source: "Healthcare Travelers",
            description: "Travel nurses and medical professionals",
            typicalStay: "8-13 weeks",
            demandLevel: "High"
          },
          {
            source: "Insurance Placements",
            description: "Families displaced due to home repairs",
            typicalStay: "30-90 days",
            demandLevel: "Medium"
          }
        ] : []
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
