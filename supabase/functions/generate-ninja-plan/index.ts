import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NinjaFocusItem {
  priority: "critical" | "high" | "medium";
  action: string;
  reason: string;
  source: "email" | "task" | "call" | "system";
  link?: string;
}

interface NinjaPlan {
  greeting: string;
  topPriorities: NinjaFocusItem[];
  quickWins: NinjaFocusItem[];
  proactiveSuggestions: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date().toISOString().split("T")[0];
    const now = new Date();
    const hour = now.getHours();

    // Fetch data in parallel
    const [
      emailInsightsResult,
      overdueTasksResult,
      discoveryCallsResult,
      ownerCallsResult,
      visitsResult,
    ] = await Promise.all([
      // Email insights requiring action
      supabase
        .from("email_insights")
        .select("id, subject, summary, sender_email, priority, sentiment, category, suggested_actions")
        .eq("action_required", true)
        .eq("status", "new")
        .order("created_at", { ascending: false })
        .limit(10),
      
      // Overdue tasks
      supabase
        .from("onboarding_tasks")
        .select("id, title, category, due_date, property_id")
        .eq("status", "pending")
        .lt("due_date", today)
        .order("due_date", { ascending: true })
        .limit(20),
      
      // Discovery calls today
      supabase
        .from("discovery_calls")
        .select("id, scheduled_at, lead_id, meeting_type, leads(name, email)")
        .gte("scheduled_at", `${today}T00:00:00`)
        .lt("scheduled_at", `${today}T23:59:59`)
        .eq("status", "scheduled"),
      
      // Owner calls today
      supabase
        .from("owner_calls")
        .select("id, scheduled_at, owner_id, topic, property_owners(name, email)")
        .gte("scheduled_at", `${today}T00:00:00`)
        .lt("scheduled_at", `${today}T23:59:59`)
        .in("status", ["scheduled", "confirmed"]),
      
      // Property visits today
      supabase
        .from("visits")
        .select("id, date, time, property_id, purpose, properties(name)")
        .eq("date", today),
    ]);

    // Build context for AI
    const emailInsights = emailInsightsResult.data || [];
    const overdueTasks = overdueTasksResult.data || [];
    const discoveryCalls = discoveryCallsResult.data || [];
    const ownerCalls = ownerCallsResult.data || [];
    const visits = visitsResult.data || [];

    // Build email summaries for AI context
    const emailSummaries = emailInsights
      .map((e, i) => `${i + 1}. [${e.priority?.toUpperCase() || "MEDIUM"}] ${e.subject}\n   Sentiment: ${e.sentiment || "neutral"}\n   Summary: ${e.summary}`)
      .join("\n\n");

    // Build task summary
    const tasksByCategory = overdueTasks.reduce((acc: Record<string, number>, task: any) => {
      const cat = task.category || "Other";
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {});

    const taskSummary = Object.entries(tasksByCategory)
      .map(([cat, count]) => `${cat}: ${count}`)
      .join(", ");

    // Generate greeting based on time
    let greeting = "Good morning";
    if (hour >= 12 && hour < 17) greeting = "Good afternoon";
    if (hour >= 17) greeting = "Good evening";

    // Build AI prompt
    const prompt = `You are a property management efficiency expert and coach. Based on the following data, create a prioritized daily action plan for a property manager.

## Today's Context:
- Time: ${greeting.replace("Good ", "")}
- Overdue tasks: ${overdueTasks.length} total (${taskSummary || "none"})
- Emails requiring action: ${emailInsights.length}
- Scheduled discovery calls: ${discoveryCalls.length}
- Scheduled owner calls: ${ownerCalls.length}
- Property visits: ${visits.length}

## Email Insights Requiring Action:
${emailSummaries || "No urgent emails"}

## Overdue Tasks by Category:
${taskSummary || "No overdue tasks"}

## Guidelines:
1. Prioritize revenue-impacting items (owner calls, booking issues)
2. Address urgent maintenance before it escalates
3. Suggest proactive owner communication based on email sentiment
4. Include quick wins that can be completed in 5 minutes
5. Be specific and actionable - no vague suggestions

Return ONLY a valid JSON object (no markdown, no code blocks) with this structure:
{
  "greeting": "A personalized, motivating greeting for the day",
  "topPriorities": [
    {
      "priority": "critical" | "high" | "medium",
      "action": "Specific action to take",
      "reason": "Why this matters",
      "source": "email" | "task" | "call" | "system"
    }
  ],
  "quickWins": [
    {
      "priority": "medium",
      "action": "Quick task description",
      "reason": "Impact of completing",
      "source": "task" | "system"
    }
  ],
  "proactiveSuggestions": [
    "Strategic suggestion 1",
    "Strategic suggestion 2"
  ]
}

Limit to 3 topPriorities, 2 quickWins, and 2 proactiveSuggestions.`;

    // Call AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    let plan: NinjaPlan;

    if (LOVABLE_API_KEY) {
      try {
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: "You are a property management efficiency expert. Return only valid JSON." },
              { role: "user", content: prompt },
            ],
            temperature: 0.7,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content || "";
          
          // Parse JSON from response (handle potential markdown wrapping)
          let jsonStr = content;
          if (content.includes("```json")) {
            jsonStr = content.split("```json")[1].split("```")[0].trim();
          } else if (content.includes("```")) {
            jsonStr = content.split("```")[1].split("```")[0].trim();
          }
          
          plan = JSON.parse(jsonStr);
        } else {
          throw new Error("AI response not ok");
        }
      } catch (aiError) {
        console.error("AI generation failed, using fallback:", aiError);
        plan = generateFallbackPlan(greeting, emailInsights, overdueTasks, discoveryCalls, ownerCalls, visits);
      }
    } else {
      plan = generateFallbackPlan(greeting, emailInsights, overdueTasks, discoveryCalls, ownerCalls, visits);
    }

    return new Response(JSON.stringify({ success: true, plan }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating ninja plan:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function generateFallbackPlan(
  greeting: string,
  emailInsights: any[],
  overdueTasks: any[],
  discoveryCalls: any[],
  ownerCalls: any[],
  visits: any[]
): NinjaPlan {
  const topPriorities: NinjaFocusItem[] = [];
  const quickWins: NinjaFocusItem[] = [];
  const proactiveSuggestions: string[] = [];

  // Add owner calls as critical
  if (ownerCalls.length > 0) {
    topPriorities.push({
      priority: "critical",
      action: `Prepare for ${ownerCalls.length} owner call${ownerCalls.length > 1 ? "s" : ""} today`,
      reason: "Owner relationships drive retention and referrals",
      source: "call",
    });
  }

  // Add discovery calls
  if (discoveryCalls.length > 0) {
    topPriorities.push({
      priority: "high",
      action: `${discoveryCalls.length} discovery call${discoveryCalls.length > 1 ? "s" : ""} scheduled - review lead profiles`,
      reason: "New business opportunities",
      source: "call",
    });
  }

  // Add urgent emails
  const urgentEmails = emailInsights.filter((e) => e.priority === "high" || e.sentiment === "negative");
  if (urgentEmails.length > 0) {
    topPriorities.push({
      priority: "critical",
      action: `Address ${urgentEmails.length} urgent email${urgentEmails.length > 1 ? "s" : ""} requiring attention`,
      reason: urgentEmails[0]?.summary || "Time-sensitive communication",
      source: "email",
    });
  }

  // Add overdue tasks as quick wins
  if (overdueTasks.length > 0) {
    quickWins.push({
      priority: "medium",
      action: `Clear ${Math.min(overdueTasks.length, 3)} overdue tasks`,
      reason: "Reduce backlog and prevent escalation",
      source: "task",
    });
  }

  // Add property visits
  if (visits.length > 0) {
    quickWins.push({
      priority: "medium",
      action: `Confirm ${visits.length} property visit${visits.length > 1 ? "s" : ""} for today`,
      reason: "Ensure smooth on-site operations",
      source: "system",
    });
  }

  // Proactive suggestions
  if (emailInsights.some((e) => e.sentiment === "positive")) {
    proactiveSuggestions.push("Positive sentiment detected in recent emails - good time to ask for referrals");
  }
  proactiveSuggestions.push("Review this week's owner communications for follow-up opportunities");

  return {
    greeting: `${greeting}! Here's your focused plan for today.`,
    topPriorities: topPriorities.slice(0, 3),
    quickWins: quickWins.slice(0, 2),
    proactiveSuggestions: proactiveSuggestions.slice(0, 2),
  };
}
