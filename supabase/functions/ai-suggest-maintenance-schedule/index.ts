import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { propertyId } = await req.json();

    if (!propertyId) {
      throw new Error("propertyId is required");
    }

    console.log(`Generating AI maintenance schedule suggestions for property: ${propertyId}`);

    // Fetch property data
    const { data: property, error: propError } = await supabase
      .from("properties")
      .select("id, name, address, created_at, property_type")
      .eq("id", propertyId)
      .single();

    if (propError || !property) {
      throw new Error("Property not found");
    }

    // Fetch maintenance templates
    const { data: templates, error: templatesError } = await supabase
      .from("preventive_maintenance_templates")
      .select("*")
      .eq("is_active", true);

    if (templatesError) throw templatesError;

    // Fetch existing schedules for this property
    const { data: existingSchedules } = await supabase
      .from("property_maintenance_schedules")
      .select("template_id, next_due_at, last_completed_at")
      .eq("property_id", propertyId);

    // Fetch upcoming bookings to avoid conflicts
    const today = new Date().toISOString().split("T")[0];
    const threeMonthsOut = new Date();
    threeMonthsOut.setMonth(threeMonthsOut.getMonth() + 3);
    const futureDate = threeMonthsOut.toISOString().split("T")[0];

    const { data: bookings } = await supabase
      .from("ownerrez_bookings")
      .select("arrival_date, departure_date")
      .eq("property_id", propertyId)
      .gte("departure_date", today)
      .lte("arrival_date", futureDate)
      .in("status", ["confirmed", "arrived"]);

    // Calculate property age in years
    const propertyCreated = new Date(property.created_at);
    const propertyAgeYears = Math.floor(
      (Date.now() - propertyCreated.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    );

    // Build context for AI
    const existingScheduleMap = new Map(
      existingSchedules?.map(s => [s.template_id, s]) || []
    );

    const bookedDates = new Set<string>();
    bookings?.forEach(b => {
      const start = new Date(b.arrival_date);
      const end = new Date(b.departure_date);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        bookedDates.add(d.toISOString().split("T")[0]);
      }
    });

    // Build AI prompt
    const templateContext = templates?.map(t => {
      const existing = existingScheduleMap.get(t.id);
      return {
        id: t.id,
        name: t.name,
        category: t.category,
        frequency_months: t.frequency_months,
        preferred_months: t.preferred_months,
        requires_vacancy: t.requires_vacancy,
        estimated_cost_range: `$${t.estimated_cost_low || 0}-$${t.estimated_cost_high || 500}`,
        last_completed: existing?.last_completed_at || "Never",
        already_scheduled: existing?.next_due_at || null
      };
    });

    const prompt = `You are a property maintenance expert. Analyze this property and suggest optimal maintenance scheduling.

PROPERTY INFO:
- Name: ${property.name}
- Address: ${property.address}
- Location: Atlanta, GA (hot humid summers, mild winters)
- Age: ${propertyAgeYears} years under management
- Type: ${property.property_type || "Short-term rental"}

UPCOMING BOOKED DATES (unavailable for maintenance):
${Array.from(bookedDates).slice(0, 30).join(", ") || "No upcoming bookings"}

MAINTENANCE TEMPLATES TO EVALUATE:
${JSON.stringify(templateContext, null, 2)}

TODAY'S DATE: ${today}

INSTRUCTIONS:
1. For each template, suggest an optimal next maintenance date
2. Consider:
   - Atlanta's climate (AC critical May-September, heating check November)
   - Seasonal best practices (HVAC tune-ups in spring/fall)
   - Tasks requiring vacancy should avoid booked dates
   - Property age (older = more frequent checks)
   - Cluster compatible tasks on the same day to minimize disruption
3. Assign priority: "high" (safety/HVAC before peak season), "medium" (routine), "low" (cosmetic/optional)

Return JSON:
{
  "suggestions": [
    {
      "template_id": "uuid",
      "template_name": "name",
      "category": "category",
      "recommended_date": "YYYY-MM-DD",
      "priority": "high|medium|low",
      "reasoning": "Brief explanation",
      "frequency_months": number
    }
  ],
  "cluster_opportunity": "Optional: suggest tasks that could be done same day",
  "property_insights": "1-2 sentence summary of property maintenance priorities"
}`;

    // Call Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.log("No LOVABLE_API_KEY, returning default suggestions");
      return new Response(JSON.stringify(getDefaultSuggestions(templates || [], bookedDates)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a property maintenance scheduling expert. Return only valid JSON." },
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI API error:", aiResponse.status);
      return new Response(JSON.stringify(getDefaultSuggestions(templates || [], bookedDates)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON from response
    let result;
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      result = JSON.parse(jsonMatch[1].trim());
    } catch (parseErr) {
      console.error("Failed to parse AI response:", parseErr);
      result = getDefaultSuggestions(templates || [], bookedDates);
    }

    console.log(`Generated ${result.suggestions?.length || 0} maintenance suggestions`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in ai-suggest-maintenance-schedule:", error);
    return new Response(
      JSON.stringify({ error: error.message, suggestions: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function getDefaultSuggestions(templates: any[], bookedDates: Set<string>) {
  const today = new Date();
  
  const suggestions = templates.map(t => {
    // Calculate next date based on frequency
    let nextDate = new Date(today);
    nextDate.setMonth(nextDate.getMonth() + 1);
    
    // Prefer specific months if set
    if (t.preferred_months?.length > 0) {
      const currentMonth = today.getMonth() + 1;
      const nextPreferred = t.preferred_months.find((m: number) => m >= currentMonth) || t.preferred_months[0];
      nextDate = new Date(today.getFullYear(), nextPreferred - 1, 15);
      if (nextDate < today) {
        nextDate.setFullYear(nextDate.getFullYear() + 1);
      }
    }
    
    // Avoid booked dates if requires vacancy
    if (t.requires_vacancy) {
      let dateStr = nextDate.toISOString().split("T")[0];
      let attempts = 0;
      while (bookedDates.has(dateStr) && attempts < 14) {
        nextDate.setDate(nextDate.getDate() + 1);
        dateStr = nextDate.toISOString().split("T")[0];
        attempts++;
      }
    }
    
    // Determine priority based on category
    let priority: "high" | "medium" | "low" = "medium";
    if (["hvac", "safety", "electrical"].includes(t.category)) {
      priority = "high";
    } else if (["cleaning", "exterior"].includes(t.category)) {
      priority = "low";
    }
    
    return {
      template_id: t.id,
      template_name: t.name,
      category: t.category,
      recommended_date: nextDate.toISOString().split("T")[0],
      priority,
      reasoning: `Scheduled based on ${t.frequency_months}-month frequency`,
      frequency_months: t.frequency_months
    };
  });

  return {
    suggestions,
    property_insights: "Default scheduling applied. AI insights unavailable.",
    cluster_opportunity: null
  };
}
