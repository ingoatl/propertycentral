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
    const { action, currentMessage, contactName, conversationContext, messageType, leadId, ownerId } = await req.json();

    console.log("AI Message Assistant request:", { action, contactName, messageType, leadId, ownerId });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch full conversation context if leadId or ownerId provided
    let fullContext = conversationContext || "";
    let commHistory = "";
    
    if (leadId) {
      // Fetch lead data
      const { data: lead } = await supabase
        .from("leads")
        .select("*")
        .eq("id", leadId)
        .single();
      
      if (lead) {
        fullContext = `Lead: ${lead.name}\nProperty: ${lead.property_address || "N/A"}\nStage: ${lead.stage}`;
        if (lead.ai_summary) fullContext += `\nNotes: ${lead.ai_summary}`;
      }

      // Fetch communications
      const { data: comms } = await supabase
        .from("lead_communications")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (comms && comms.length > 0) {
        commHistory = "\n\nRECENT MESSAGES:\n";
        for (const c of comms.slice(0, 5)) {
          const dir = c.direction === "outbound" ? "SENT" : "RECEIVED";
          const preview = (c.body || "").substring(0, 150);
          commHistory += `[${dir}]: ${preview}${preview.length >= 150 ? "..." : ""}\n`;
          
          if (c.transcript) {
            commHistory += `[CALL TRANSCRIPT]: ${c.transcript.substring(0, 200)}...\n`;
          }
        }
      }
    } else if (ownerId) {
      // Fetch owner data
      const { data: owner } = await supabase
        .from("property_owners")
        .select("*, properties(*)")
        .eq("id", ownerId)
        .single();
      
      if (owner) {
        fullContext = `Owner: ${owner.name}\nProperties: ${owner.properties?.map((p: any) => p.name || p.address).join(", ") || "N/A"}`;
      }

      // Fetch communications
      const { data: comms } = await supabase
        .from("lead_communications")
        .select("*")
        .eq("owner_id", ownerId)
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (comms && comms.length > 0) {
        commHistory = "\n\nRECENT MESSAGES:\n";
        for (const c of comms.slice(0, 5)) {
          const dir = c.direction === "outbound" ? "SENT" : "RECEIVED";
          const preview = (c.body || "").substring(0, 150);
          commHistory += `[${dir}]: ${preview}${preview.length >= 150 ? "..." : ""}\n`;
        }
      }
    }

    const firstName = contactName?.split(" ")[0] || "there";

    let systemPrompt = `You are a professional property management assistant for PeachHaus Group helping compose ${messageType === "sms" ? "SMS messages" : "emails"}.

${humanLikeGuidelines}

CONTEXT:
Contact: ${contactName || "Unknown"} (use "${firstName}")
${fullContext}
${commHistory}

${messageType === "sms" ? "Keep SMS under 160 characters when possible, max 320." : "Keep emails concise - 2-3 paragraphs max."}`;

    let userPrompt = "";

    switch (action) {
      case "generate":
        userPrompt = `Generate a professional ${messageType === "sms" ? "SMS" : "email"} reply based on the conversation context.
${currentMessage ? `Current draft to improve: "${currentMessage}"` : "Create an appropriate response based on the context."}
Be helpful, specific, and natural-sounding.`;
        break;

      case "improve":
        userPrompt = `Improve this message while keeping the same meaning. Make it clearer, more natural, and more effective:
"${currentMessage}"`;
        break;

      case "shorter":
        userPrompt = `Make this message shorter and more concise while keeping the key information:
"${currentMessage}"
${messageType === "sms" ? "Target under 160 characters." : ""}`;
        break;

      case "professional":
        userPrompt = `Rewrite this message in a more polished, professional tone while keeping it warm:
"${currentMessage}"`;
        break;

      case "friendly":
        userPrompt = `Rewrite this message in a warmer, friendlier tone while keeping it professional:
"${currentMessage}"`;
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

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
        max_tokens: messageType === "sms" ? 100 : 500,
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
      const errorText = await response.text();
      console.error("AI gateway error:", errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const generatedMessage = data.choices?.[0]?.message?.content?.trim();

    if (!generatedMessage) {
      throw new Error("No message generated");
    }

    console.log("Generated message:", generatedMessage.substring(0, 100) + "...");

    return new Response(
      JSON.stringify({ message: generatedMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("AI Message Assistant error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
