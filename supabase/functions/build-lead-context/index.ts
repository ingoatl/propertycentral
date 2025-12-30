import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface LeadContext {
  lead: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    property_address: string | null;
    property_type: string | null;
    stage: string;
    notes: string | null;
    tags: string[] | null;
    created_at: string;
    last_contacted_at: string | null;
    last_response_at: string | null;
  };
  communication_history: {
    total_emails_sent: number;
    total_sms_sent: number;
    total_calls_made: number;
    emails_opened: number;
    last_response_type: string | null;
    last_response_date: string | null;
    days_since_last_contact: number | null;
    days_since_last_response: number | null;
  };
  discovery_call: {
    scheduled_at: string | null;
    status: string | null;
    duration_minutes: number | null;
    meeting_notes: string | null;
  } | null;
  timeline_summary: {
    key_events: Array<{
      action: string;
      details: string | null;
      created_at: string;
    }>;
    stage_changes: Array<{
      from_stage: string | null;
      to_stage: string | null;
      changed_at: string;
    }>;
  };
  engagement_level: "high" | "medium" | "low" | "unresponsive";
  personalization_hints: string[];
}

function calculateEngagementLevel(
  daysSinceResponse: number | null,
  totalResponses: number,
  emailsOpened: number
): "high" | "medium" | "low" | "unresponsive" {
  if (daysSinceResponse === null || daysSinceResponse > 14) {
    return totalResponses === 0 ? "unresponsive" : "low";
  }
  if (daysSinceResponse <= 2 && totalResponses > 0) return "high";
  if (daysSinceResponse <= 7) return "medium";
  return "low";
}

function generatePersonalizationHints(context: Partial<LeadContext>): string[] {
  const hints: string[] = [];

  // Based on engagement
  if (context.engagement_level === "high") {
    hints.push("Lead is highly engaged - match their enthusiasm");
  } else if (context.engagement_level === "low") {
    hints.push("Lead has been quiet - be understanding and not pushy");
  } else if (context.engagement_level === "unresponsive") {
    hints.push("Haven't heard back - acknowledge the gap warmly");
  }

  // Based on discovery call
  if (context.discovery_call?.meeting_notes) {
    hints.push(`Reference discovery call notes: ${context.discovery_call.meeting_notes.substring(0, 200)}`);
  }

  // Based on property
  if (context.lead?.property_type) {
    hints.push(`Property type: ${context.lead.property_type} - tailor messaging accordingly`);
  }

  // Based on communication history
  if (context.communication_history?.total_emails_sent && context.communication_history.total_emails_sent > 3) {
    hints.push("Multiple emails sent - vary the approach");
  }

  // Based on timeline
  if (context.timeline_summary?.key_events?.length) {
    const recentEvents = context.timeline_summary.key_events.slice(0, 3);
    recentEvents.forEach(event => {
      if (event.action.includes("call")) {
        hints.push(`Recent call activity: ${event.action}`);
      }
      if (event.action.includes("response") || event.action.includes("replied")) {
        hints.push("Lead has been responsive - acknowledge their engagement");
      }
    });
  }

  return hints;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leadId } = await req.json();

    if (!leadId) {
      throw new Error("leadId is required");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch lead data
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      throw new Error(`Lead not found: ${leadError?.message}`);
    }

    // Fetch communications
    const { data: communications } = await supabase
      .from("lead_communications")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });

    // Fetch discovery calls
    const { data: discoveryCalls } = await supabase
      .from("discovery_calls")
      .select("*")
      .eq("lead_id", leadId)
      .order("scheduled_at", { ascending: false })
      .limit(1);

    // Fetch timeline
    const { data: timeline } = await supabase
      .from("lead_timeline")
      .select("action, details, created_at, from_stage, to_stage")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(20);

    // Calculate communication stats
    const emailsSent = communications?.filter(c => c.communication_type === "email" && c.direction === "outbound").length || 0;
    const smsSent = communications?.filter(c => c.communication_type === "sms" && c.direction === "outbound").length || 0;
    const callsMade = communications?.filter(c => c.communication_type === "call").length || 0;
    const emailsOpened = communications?.filter(c => c.communication_type === "email" && c.opened_at).length || 0;
    
    // Find last inbound response
    const lastInbound = communications?.find(c => c.direction === "inbound");
    const lastResponseType = lastInbound?.communication_type || null;
    const lastResponseDate = lastInbound?.created_at || lead.last_response_at;

    // Calculate days since last contact/response
    const now = new Date();
    const daysSinceLastContact = lead.last_contacted_at 
      ? Math.floor((now.getTime() - new Date(lead.last_contacted_at).getTime()) / (1000 * 60 * 60 * 24))
      : null;
    const daysSinceLastResponse = lastResponseDate
      ? Math.floor((now.getTime() - new Date(lastResponseDate).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    // Get discovery call info
    const discoveryCall = discoveryCalls?.[0] ? {
      scheduled_at: discoveryCalls[0].scheduled_at,
      status: discoveryCalls[0].status,
      duration_minutes: discoveryCalls[0].duration_minutes,
      meeting_notes: discoveryCalls[0].meeting_notes,
    } : null;

    // Build timeline summary
    const keyEvents = timeline?.filter(t => !t.from_stage && !t.to_stage).map(t => ({
      action: t.action,
      details: t.details,
      created_at: t.created_at,
    })) || [];

    const stageChanges = timeline?.filter(t => t.from_stage || t.to_stage).map(t => ({
      from_stage: t.from_stage,
      to_stage: t.to_stage,
      changed_at: t.created_at,
    })) || [];

    // Calculate engagement level
    const totalResponses = communications?.filter(c => c.direction === "inbound").length || 0;
    const engagementLevel = calculateEngagementLevel(daysSinceLastResponse, totalResponses, emailsOpened);

    // Build context object
    const context: LeadContext = {
      lead: {
        id: lead.id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        property_address: lead.property_address,
        property_type: lead.property_type,
        stage: lead.stage,
        notes: lead.notes,
        tags: lead.tags,
        created_at: lead.created_at,
        last_contacted_at: lead.last_contacted_at,
        last_response_at: lead.last_response_at,
      },
      communication_history: {
        total_emails_sent: emailsSent,
        total_sms_sent: smsSent,
        total_calls_made: callsMade,
        emails_opened: emailsOpened,
        last_response_type: lastResponseType,
        last_response_date: lastResponseDate,
        days_since_last_contact: daysSinceLastContact,
        days_since_last_response: daysSinceLastResponse,
      },
      discovery_call: discoveryCall,
      timeline_summary: {
        key_events: keyEvents,
        stage_changes: stageChanges,
      },
      engagement_level: engagementLevel,
      personalization_hints: [],
    };

    // Generate personalization hints
    context.personalization_hints = generatePersonalizationHints(context);

    console.log(`Built context for lead ${leadId}:`, {
      engagement: engagementLevel,
      emailsSent,
      smsSent,
      callsMade,
      hasDiscoveryCall: !!discoveryCall,
      hintsCount: context.personalization_hints.length,
    });

    return new Response(JSON.stringify(context), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error building lead context:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
