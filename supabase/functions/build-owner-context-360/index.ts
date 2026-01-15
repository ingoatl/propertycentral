import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

interface OwnerFinancialContext {
  hasPaymentMethod: boolean;
  paymentMethodType: "card" | "bank" | null;
  paymentMethodBrand: string | null;
  paymentMethodLast4: string | null;
  paymentMethodCount: number;
  hasOutstandingCharges: boolean;
  outstandingAmount: number;
  outstandingChargesCount: number;
  oldestUnpaidDate: string | null;
  unpaidCharges: Array<{
    id: string;
    amount: number;
    description: string;
    charge_date: string;
  }>;
  lastPaymentDate: string | null;
  lastPaymentAmount: number | null;
  totalPaidThisYear: number;
  paymentHistoryStatus: "excellent" | "good" | "late" | "delinquent" | "new";
  paymentCount: number;
  pendingPayoutAmount: number;
  pendingPayoutCount: number;
  lastPayoutDate: string | null;
  lastPayoutAmount: number | null;
  financialHealthScore: "excellent" | "good" | "attention_needed" | "critical";
  financialHealthDetails: string;
  cardExpiringSoon: boolean;
  cardExpMonth: number | null;
  cardExpYear: number | null;
}

interface Owner360Context {
  owner: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    service_type: string | null;
    created_at: string;
  };
  portfolio: {
    property_count: number;
    properties: Array<{
      id: string;
      name: string;
      address: string;
      management_fee_percentage: number | null;
      status: string | null;
    }>;
    total_monthly_revenue: number;
    avg_occupancy: number;
  };
  financial: {
    ytd_revenue: number;
    ytd_expenses: number;
    ytd_net: number;
    pending_payouts: number;
    last_payout_date: string | null;
    last_payout_amount: number | null;
    // New enhanced financial context
    hasPaymentMethod: boolean;
    paymentMethodType: "card" | "bank" | null;
    paymentMethodBrand: string | null;
    paymentMethodLast4: string | null;
    hasOutstandingCharges: boolean;
    outstandingAmount: number;
    outstandingChargesCount: number;
    oldestUnpaidDate: string | null;
    financialHealthScore: "excellent" | "good" | "attention_needed" | "critical";
    financialHealthDetails: string;
    cardExpiringSoon: boolean;
    totalPaidThisYear: number;
    paymentHistoryStatus: "excellent" | "good" | "late" | "delinquent" | "new";
  };
  communications: {
    total_messages: number;
    sms_count: number;
    email_count: number;
    call_count: number;
    last_contact_date: string | null;
    avg_response_time_hours: number | null;
    mood_score: number;
    mood_label: "positive" | "neutral" | "negative";
  };
  alerts: Array<{
    type: "warning" | "info" | "success";
    icon: string;
    message: string;
    priority: number;
  }>;
  tasks: {
    pending_count: number;
    overdue_count: number;
    pending_tasks: Array<{
      title: string;
      due_date: string | null;
      priority: string;
    }>;
  };
  bookings: {
    upcoming_turnovers: number;
    next_turnover_date: string | null;
    active_bookings: number;
    upcoming_checkouts: Array<{
      property_name: string;
      checkout_date: string;
    }>;
  };
  utility_anomalies: Array<{
    property_name: string;
    utility_type: string;
    change_percent: number;
    current_amount: number;
    previous_amount: number;
  }>;
  ai_summary: string | null;
  generated_at: string;
}

async function analyzeCommunicationMood(
  communications: Array<{ body: string; direction: string }>
): Promise<{ score: number; label: "positive" | "neutral" | "negative" }> {
  // Simple keyword-based sentiment analysis
  const positiveKeywords = ["thank", "great", "excellent", "appreciate", "love", "happy", "perfect", "wonderful", "awesome", "good"];
  const negativeKeywords = ["issue", "problem", "concern", "unhappy", "disappointed", "frustrated", "angry", "wrong", "bad", "complaint"];

  let positiveCount = 0;
  let negativeCount = 0;

  for (const comm of communications.slice(0, 10)) {
    const text = comm.body?.toLowerCase() || "";
    for (const word of positiveKeywords) {
      if (text.includes(word)) positiveCount++;
    }
    for (const word of negativeKeywords) {
      if (text.includes(word)) negativeCount++;
    }
  }

  const total = positiveCount + negativeCount;
  if (total === 0) return { score: 0.5, label: "neutral" };

  const score = positiveCount / total;
  const label = score > 0.6 ? "positive" : score < 0.4 ? "negative" : "neutral";

  return { score: Math.round(score * 100) / 100, label };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ownerId, forceRefresh = false } = await req.json();

    if (!ownerId) {
      throw new Error("ownerId is required");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const { data: cached } = await supabase
        .from("owner_context_cache")
        .select("context_data, expires_at")
        .eq("owner_id", ownerId)
        .maybeSingle();

      if (cached && new Date(cached.expires_at) > new Date()) {
        console.log("Returning cached owner context for:", ownerId);
        return new Response(JSON.stringify(cached.context_data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    console.log("Building fresh owner 360 context for:", ownerId);

    // 1. Fetch owner data
    const { data: owner, error: ownerError } = await supabase
      .from("property_owners")
      .select("*")
      .eq("id", ownerId)
      .single();

    if (ownerError || !owner) {
      throw new Error("Owner not found");
    }

    // 2. Fetch properties
    const { data: properties } = await supabase
      .from("properties")
      .select("id, name, address, management_fee_percentage, status")
      .eq("owner_id", ownerId);

    // 2.5 Fetch enhanced financial context
    let financialContext: OwnerFinancialContext | null = null;
    try {
      const finResponse = await fetch(`${SUPABASE_URL}/functions/v1/get-owner-financial-context`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ ownerId }),
      });
      
      if (finResponse.ok) {
        financialContext = await finResponse.json();
        console.log("Financial context fetched for owner:", ownerId, "Health:", financialContext?.financialHealthScore);
      }
    } catch (finError) {
      console.error("Error fetching financial context:", finError);
    }

    // 3. Fetch communications (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: communications } = await supabase
      .from("lead_communications")
      .select("id, communication_type, direction, body, created_at")
      .eq("owner_id", ownerId)
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("created_at", { ascending: false });

    // 4. Fetch expenses (YTD)
    const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();
    const propertyIds = properties?.map((p) => p.id) || [];

    let ytdExpenses = 0;
    if (propertyIds.length > 0) {
      const { data: expenses } = await supabase
        .from("expenses")
        .select("amount")
        .in("property_id", propertyIds)
        .gte("date", yearStart.split("T")[0]);

      ytdExpenses = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
    }

    // 5. Fetch distributions/payouts
    const { data: distributions } = await supabase
      .from("owner_distributions")
      .select("amount, created_at, status")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false });

    const lastPayout = distributions?.find((d) => d.status === "paid");
    const pendingPayouts = distributions
      ?.filter((d) => d.status === "pending")
      .reduce((sum, d) => sum + (d.amount || 0), 0) || 0;

    // 6. Fetch tasks
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, due_date, priority, status")
      .in("property_id", propertyIds)
      .in("status", ["pending", "in_progress"]);

    const pendingTasks = tasks?.filter((t) => t.status === "pending") || [];
    const overdueTasks = tasks?.filter(
      (t) => t.due_date && new Date(t.due_date) < new Date()
    ) || [];

    // 7. Fetch bookings (upcoming)
    const today = new Date().toISOString().split("T")[0];
    const twoWeeksFromNow = new Date();
    twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);

    const { data: bookings } = await supabase
      .from("mid_term_bookings")
      .select("id, property_id, check_out, properties(name)")
      .in("property_id", propertyIds)
      .gte("check_out", today)
      .lte("check_out", twoWeeksFromNow.toISOString().split("T")[0])
      .order("check_out", { ascending: true });

    // 8. Check for utility anomalies (last 2 months comparison)
    const utilityAnomalies: Owner360Context["utility_anomalies"] = [];
    // Simplified - would need actual utility data comparison

    // 9. Calculate communication stats
    const smsCount = communications?.filter((c) => c.communication_type === "sms").length || 0;
    const emailCount = communications?.filter((c) => c.communication_type === "email").length || 0;
    const callCount = communications?.filter((c) => c.communication_type === "call").length || 0;
    const lastContact = communications?.[0]?.created_at || null;

    // 10. Analyze mood
    const moodAnalysis = await analyzeCommunicationMood(communications || []);

    // 11. Build alerts
    const alerts: Owner360Context["alerts"] = [];

    // Overdue tasks alert
    if (overdueTasks.length > 0) {
      alerts.push({
        type: "warning",
        icon: "📋",
        message: `${overdueTasks.length} overdue task${overdueTasks.length > 1 ? "s" : ""} need attention`,
        priority: 1,
      });
    }

    // Financial alerts from enhanced context
    if (financialContext) {
      // No payment method is critical
      if (!financialContext.hasPaymentMethod) {
        alerts.push({
          type: "warning",
          icon: "💳",
          message: "No payment method on file",
          priority: 1,
        });
      }
      
      // Card expiring soon
      if (financialContext.cardExpiringSoon) {
        alerts.push({
          type: "warning",
          icon: "⚠️",
          message: `Card expires ${financialContext.cardExpMonth}/${financialContext.cardExpYear}`,
          priority: 2,
        });
      }
      
      // Outstanding balance
      if (financialContext.hasOutstandingCharges) {
        const severity = financialContext.paymentHistoryStatus === "delinquent" ? "warning" : "info";
        alerts.push({
          type: severity,
          icon: "💰",
          message: `$${financialContext.outstandingAmount.toLocaleString()} outstanding balance`,
          priority: financialContext.paymentHistoryStatus === "delinquent" ? 1 : 3,
        });
      }
      
      // Account health critical
      if (financialContext.financialHealthScore === "critical") {
        alerts.push({
          type: "warning",
          icon: "🚨",
          message: "Account needs immediate attention",
          priority: 1,
        });
      }
    }

    // Upcoming turnovers
    if (bookings && bookings.length > 0) {
      const thisWeek = bookings.filter((b) => {
        const checkout = new Date(b.check_out);
        const weekFromNow = new Date();
        weekFromNow.setDate(weekFromNow.getDate() + 7);
        return checkout <= weekFromNow;
      });

      if (thisWeek.length > 0) {
        alerts.push({
          type: "info",
          icon: "📅",
          message: `${thisWeek.length} turnover${thisWeek.length > 1 ? "s" : ""} this week`,
          priority: 2,
        });
      }
    }

    // Pending payouts (use enhanced context if available)
    const actualPendingPayouts = financialContext?.pendingPayoutAmount || pendingPayouts;
    if (actualPendingPayouts > 0) {
      alerts.push({
        type: "info",
        icon: "💰",
        message: `$${actualPendingPayouts.toLocaleString()} pending payout`,
        priority: 3,
      });
    }

    // Utility anomalies
    for (const anomaly of utilityAnomalies) {
      if (anomaly.change_percent > 30) {
        alerts.push({
          type: "warning",
          icon: "⚡",
          message: `${anomaly.utility_type} spike at ${anomaly.property_name} (+${anomaly.change_percent}%)`,
          priority: 1,
        });
      }
    }

    // Communication mood
    if (moodAnalysis.label === "negative") {
      alerts.push({
        type: "warning",
        icon: "💬",
        message: "Recent communications show concerns - may need attention",
        priority: 1,
      });
    }

    // Sort alerts by priority
    alerts.sort((a, b) => a.priority - b.priority);

    // 12. Calculate revenue (simplified - would need actual booking revenue)
    const ytdRevenue = 0; // Would calculate from actual reconciliation data

    // Build the context object
    const context: Owner360Context = {
      owner: {
        id: owner.id,
        name: owner.name,
        email: owner.email,
        phone: owner.phone,
        service_type: owner.service_type,
        created_at: owner.created_at,
      },
      portfolio: {
        property_count: properties?.length || 0,
        properties: properties?.map((p) => ({
          id: p.id,
          name: p.name,
          address: p.address,
          management_fee_percentage: p.management_fee_percentage,
          status: p.status,
        })) || [],
        total_monthly_revenue: 0, // Would calculate from actual data
        avg_occupancy: 0, // Would calculate from bookings
      },
      financial: {
        ytd_revenue: ytdRevenue,
        ytd_expenses: ytdExpenses,
        ytd_net: ytdRevenue - ytdExpenses,
        pending_payouts: financialContext?.pendingPayoutAmount || pendingPayouts,
        last_payout_date: financialContext?.lastPayoutDate || lastPayout?.created_at || null,
        last_payout_amount: financialContext?.lastPayoutAmount || lastPayout?.amount || null,
        // Enhanced financial context
        hasPaymentMethod: financialContext?.hasPaymentMethod || false,
        paymentMethodType: financialContext?.paymentMethodType || null,
        paymentMethodBrand: financialContext?.paymentMethodBrand || null,
        paymentMethodLast4: financialContext?.paymentMethodLast4 || null,
        hasOutstandingCharges: financialContext?.hasOutstandingCharges || false,
        outstandingAmount: financialContext?.outstandingAmount || 0,
        outstandingChargesCount: financialContext?.outstandingChargesCount || 0,
        oldestUnpaidDate: financialContext?.oldestUnpaidDate || null,
        financialHealthScore: financialContext?.financialHealthScore || "good",
        financialHealthDetails: financialContext?.financialHealthDetails || "",
        cardExpiringSoon: financialContext?.cardExpiringSoon || false,
        totalPaidThisYear: financialContext?.totalPaidThisYear || 0,
        paymentHistoryStatus: financialContext?.paymentHistoryStatus || "new",
      },
      communications: {
        total_messages: (communications?.length || 0),
        sms_count: smsCount,
        email_count: emailCount,
        call_count: callCount,
        last_contact_date: lastContact,
        avg_response_time_hours: null, // Would calculate
        mood_score: moodAnalysis.score,
        mood_label: moodAnalysis.label,
      },
      alerts,
      tasks: {
        pending_count: pendingTasks.length,
        overdue_count: overdueTasks.length,
        pending_tasks: pendingTasks.slice(0, 5).map((t) => ({
          title: t.title,
          due_date: t.due_date,
          priority: t.priority,
        })),
      },
      bookings: {
        upcoming_turnovers: bookings?.length || 0,
        next_turnover_date: bookings?.[0]?.check_out || null,
        active_bookings: 0, // Would calculate
        upcoming_checkouts: bookings?.slice(0, 5).map((b) => ({
          property_name: (b.properties as any)?.name || "Unknown",
          checkout_date: b.check_out,
        })) || [],
      },
      utility_anomalies: utilityAnomalies,
      ai_summary: null,
      generated_at: new Date().toISOString(),
    };

    // 13. Generate AI summary if we have the API key
    if (LOVABLE_API_KEY && alerts.length > 0) {
      try {
        const summaryPrompt = `Generate a brief, friendly 2-3 sentence summary for a property management team about this owner's current status:

Owner: ${owner.name}
Properties: ${properties?.length || 0}
Recent mood from communications: ${moodAnalysis.label}
Alerts:
${alerts.map((a) => `- ${a.icon} ${a.message}`).join("\n")}
Pending tasks: ${pendingTasks.length}
Upcoming turnovers: ${bookings?.length || 0}

Keep it concise and actionable. Start with the owner's name.`;

        const aiResponse = await fetch("https://api.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-5-mini",
            messages: [
              { role: "system", content: "You are a helpful property management assistant. Be concise and professional." },
              { role: "user", content: summaryPrompt },
            ],
            max_tokens: 150,
            temperature: 0.7,
          }),
        });

        if (aiResponse.ok) {
          const aiResult = await aiResponse.json();
          context.ai_summary = aiResult.choices?.[0]?.message?.content || null;
        }
      } catch (aiError) {
        console.error("AI summary generation failed:", aiError);
      }
    }

    // 14. Cache the result
    await supabase
      .from("owner_context_cache")
      .upsert(
        {
          owner_id: ownerId,
          context_data: context,
          generated_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours
        },
        { onConflict: "owner_id" }
      );

    console.log("Owner 360 context built successfully for:", owner.name);

    return new Response(JSON.stringify(context), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error building owner 360 context:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
