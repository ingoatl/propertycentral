import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Human-like writing guidelines
const humanLikeGuidelines = `
WRITING STYLE RULES:
1. Write like you talk - use contractions (I'm, we'll, you're, don't)
2. Be direct - get to the point immediately
3. Sound warm and genuine, not robotic
4. Use specific details over generic statements

PHRASES TO NEVER USE:
- "Just checking in" or "Just wanted to touch base"
- "I hope this finds you well"
- "Please don't hesitate to reach out"
- "At your earliest convenience"

FOR SMS:
- Under 160 chars ideal, max 320
- Lead with the important info
- One clear call-to-action
- Casual but professional
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { communicationId, leadId, ownerId, contactPhone, contactEmail, messageType } = await req.json();

    console.log("Generate draft reply request:", { communicationId, leadId, ownerId, messageType });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if draft already exists for this communication
    if (communicationId) {
      const { data: existingDraft } = await supabase
        .from("ai_draft_replies")
        .select("id")
        .eq("communication_id", communicationId)
        .eq("status", "pending")
        .maybeSingle();

      if (existingDraft) {
        console.log("Draft already exists for this communication");
        return new Response(
          JSON.stringify({ success: true, message: "Draft already exists", draftId: existingDraft.id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Fetch the communication that needs a reply
    let inboundMessage = "";
    let contactName = "there";
    let fullContext = "";
    let commHistory = "";

    if (communicationId) {
      const { data: comm } = await supabase
        .from("lead_communications")
        .select("*, leads(id, name, phone, email, property_address, stage, ai_summary), property_owners(id, name, email, phone)")
        .eq("id", communicationId)
        .single();

      if (comm) {
        inboundMessage = comm.body || "";
        
        if (comm.leads) {
          const lead = comm.leads as { id: string; name: string; phone: string | null; email: string | null; property_address: string | null; stage: string; ai_summary: string | null };
          contactName = lead.name?.split(" ")[0] || "there";
          fullContext = `Lead: ${lead.name}\nPhone: ${lead.phone || "N/A"}\nEmail: ${lead.email || "N/A"}\nProperty: ${lead.property_address || "N/A"}\nStage: ${lead.stage}`;
          if (lead.ai_summary) fullContext += `\nNotes: ${lead.ai_summary}`;
        } else if (comm.property_owners) {
          const owner = comm.property_owners as { id: string; name: string; email: string | null; phone: string | null };
          contactName = owner.name?.split(" ")[0] || "there";
          fullContext = `Owner: ${owner.name}\nEmail: ${owner.email || "N/A"}\nPhone: ${owner.phone || "N/A"}`;
        }
      }
    }

    // Fetch recent conversation history
    const historyQuery = supabase
      .from("lead_communications")
      .select("direction, body, communication_type, created_at")
      .order("created_at", { ascending: false })
      .limit(15);

    if (leadId) {
      historyQuery.eq("lead_id", leadId);
    } else if (ownerId) {
      historyQuery.eq("owner_id", ownerId);
    } else if (contactPhone) {
      // For external contacts, match by phone in metadata
      historyQuery.contains("metadata", { unmatched_phone: contactPhone });
    }

    const { data: recentComms } = await historyQuery;

    if (recentComms && recentComms.length > 0) {
      commHistory = "\n\nCONVERSATION HISTORY (newest first):\n";
      for (const c of recentComms) {
        const dir = c.direction === "outbound" ? "WE SENT" : "THEY REPLIED";
        const preview = (c.body || "").substring(0, 200);
        commHistory += `[${dir}]: ${preview}${preview.length >= 200 ? "..." : ""}\n`;
      }
    }

    // Build system prompt
    const systemPrompt = `You are a professional property management assistant for PeachHaus Group helping compose ${messageType === "email" ? "email" : "SMS"} replies.

${humanLikeGuidelines}

CONTACT INFO:
Name: ${contactName}
${fullContext}
${commHistory}

CRITICAL RULES:
1. Reply DIRECTLY to what they said - be helpful and specific
2. Keep it SHORT - ${messageType === "sms" ? "under 160 characters ideal, max 200" : "2-3 sentences max"}
3. Sound like a real person, not a business script
4. DO NOT suggest scheduling calls or meetings unless they asked
5. DO NOT offer income analysis or reports
6. Just be helpful and answer their question
7. Sign off as: "- Ingo"`;

    const userPrompt = `Generate a warm, human ${messageType === "email" ? "email" : "SMS"} reply to this message:

"${inboundMessage}"

Write ONLY the reply text. Keep it natural and helpful. ${messageType === "sms" ? "Under 160 characters ideal." : ""}`;

    // Call AI to generate draft
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: messageType === "sms" ? 150 : 400,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    let draftContent = data.choices?.[0]?.message?.content?.trim();

    if (!draftContent) {
      throw new Error("No draft generated");
    }

    // Clean up - remove quotes if wrapped
    if (draftContent.startsWith('"') && draftContent.endsWith('"')) {
      draftContent = draftContent.slice(1, -1);
    }

    // Calculate confidence based on context availability
    let confidenceScore = 0.7; // Base confidence
    if (commHistory.length > 100) confidenceScore += 0.1; // Has conversation history
    if (fullContext.length > 50) confidenceScore += 0.1; // Has contact context
    if (inboundMessage.length > 20) confidenceScore += 0.1; // Clear message to reply to
    confidenceScore = Math.min(confidenceScore, 0.99);

    // Store the draft
    const { data: newDraft, error: insertError } = await supabase
      .from("ai_draft_replies")
      .insert({
        communication_id: communicationId || null,
        lead_id: leadId || null,
        owner_id: ownerId || null,
        contact_phone: contactPhone || null,
        contact_email: contactEmail || null,
        draft_content: draftContent,
        message_type: messageType || "sms",
        confidence_score: confidenceScore,
        status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error storing draft:", insertError);
      throw insertError;
    }

    console.log("Draft generated successfully:", newDraft.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        draftId: newDraft.id,
        draftContent,
        confidenceScore,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error generating draft reply:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
