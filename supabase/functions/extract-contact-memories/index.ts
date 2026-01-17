import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Memory extraction categories
const MEMORY_CATEGORIES = [
  "preference", // Communication preferences, timing preferences
  "fact", // Factual info about them (property details, family, pets)
  "concern", // Things they've expressed concern about
  "request", // Things they've asked for or need
  "personality", // Personality traits, communication style
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { communicationId, leadId, ownerId, contactPhone, forceExtract } = await req.json();

    console.log("Extract contact memories request:", { communicationId, leadId, ownerId });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const MEM0_API_KEY = Deno.env.get("MEM0_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Build contact identifier for Mem0
    let contactIdentifier = "";
    let contactName = "Unknown";
    let contactType = "unknown";

    if (leadId) {
      const { data: lead } = await supabase
        .from("leads")
        .select("name, phone, email")
        .eq("id", leadId)
        .single();
      
      if (lead) {
        contactIdentifier = `lead_${leadId}`;
        contactName = lead.name || "Unknown Lead";
        contactType = "lead";
      }
    } else if (ownerId) {
      const { data: owner } = await supabase
        .from("property_owners")
        .select("name, phone, email")
        .eq("id", ownerId)
        .single();
      
      if (owner) {
        contactIdentifier = `owner_${ownerId}`;
        contactName = owner.name || "Unknown Owner";
        contactType = "owner";
      }
    } else if (contactPhone) {
      contactIdentifier = `phone_${contactPhone.replace(/[^0-9]/g, "")}`;
      contactType = "external";
    }

    if (!contactIdentifier) {
      throw new Error("No valid contact identifier found");
    }

    // Fetch recent communications to extract memories from
    let query = supabase
      .from("lead_communications")
      .select("id, body, subject, direction, communication_type, created_at, transcript, metadata")
      .order("created_at", { ascending: false })
      .limit(20);

    if (leadId) {
      query = query.eq("lead_id", leadId);
    } else if (ownerId) {
      query = query.eq("owner_id", ownerId);
    }

    const { data: communications } = await query;

    if (!communications || communications.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No communications to extract from", memories: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build conversation text for analysis
    let conversationText = "";
    for (const comm of communications.slice(0, 15)) {
      const dir = comm.direction === "inbound" ? `${contactName}` : "PeachHaus";
      const content = comm.body || comm.transcript || comm.subject || "";
      if (content.trim()) {
        conversationText += `${dir}: ${content.trim()}\n\n`;
      }
    }

    // Use AI to extract key facts and preferences
    const extractionPrompt = `Analyze this conversation and extract KEY FACTS about the contact "${contactName}".

CONVERSATION:
${conversationText}

Extract 3-7 specific, useful memories. Focus on:
1. PREFERENCES: How they prefer to communicate (text vs email, time of day, etc.)
2. FACTS: Property details, family situation, pets, occupation, location
3. CONCERNS: Things they've worried about or mentioned issues with
4. REQUESTS: Things they've asked for that may be ongoing
5. PERSONALITY: Communication style, formality level, patience level

Return as JSON array:
[
  {
    "category": "preference|fact|concern|request|personality",
    "memory": "Specific, actionable memory in third person (e.g., 'Prefers text over email' or 'Has two dogs named Max and Luna')",
    "confidence": 0.0-1.0,
    "source_quote": "Brief quote from conversation that supports this memory"
  }
]

RULES:
- Be SPECIFIC and ACTIONABLE - no vague memories
- Third person (e.g., "They prefer..." not "I prefer...")
- Only extract things actually said, not assumptions
- Skip generic or obvious things
- Focus on what would help personalize future conversations

Return ONLY the JSON array, no explanation.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-preview",
        messages: [
          { role: "system", content: "You are a memory extraction assistant. Extract key facts and preferences from conversations. Return valid JSON only." },
          { role: "user", content: extractionPrompt },
        ],
        max_tokens: 1000,
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI extraction error:", await aiResponse.text());
      throw new Error("Failed to extract memories from AI");
    }

    const aiData = await aiResponse.json();
    let extractedText = aiData.choices?.[0]?.message?.content?.trim() || "[]";
    
    // Clean up JSON response
    if (extractedText.startsWith("```json")) {
      extractedText = extractedText.replace(/```json\n?/g, "").replace(/```\n?/g, "");
    }
    if (extractedText.startsWith("```")) {
      extractedText = extractedText.replace(/```\n?/g, "");
    }

    let extractedMemories: Array<{
      category: string;
      memory: string;
      confidence: number;
      source_quote?: string;
    }> = [];

    try {
      extractedMemories = JSON.parse(extractedText);
    } catch (e) {
      console.error("Failed to parse extracted memories:", extractedText);
      extractedMemories = [];
    }

    // Filter valid memories
    extractedMemories = extractedMemories.filter(
      (m) => m.memory && m.memory.length > 10 && m.confidence >= 0.5
    );

    console.log(`Extracted ${extractedMemories.length} memories for ${contactIdentifier}`);

    // Store memories in Mem0 if API key is available
    if (MEM0_API_KEY && extractedMemories.length > 0) {
      try {
        // Convert to Mem0 format and add
        for (const memory of extractedMemories) {
          const mem0Response = await fetch("https://api.mem0.ai/v1/memories/", {
            method: "POST",
            headers: {
              "Authorization": `Token ${MEM0_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messages: [
                { role: "user", content: `Remember this about ${contactName}: ${memory.memory}` },
                { role: "assistant", content: `I'll remember that ${memory.memory}` },
              ],
              user_id: contactIdentifier,
              metadata: {
                category: memory.category,
                contact_name: contactName,
                contact_type: contactType,
                confidence: memory.confidence,
                extracted_at: new Date().toISOString(),
              },
            }),
          });

          if (!mem0Response.ok) {
            console.error("Mem0 storage error:", await mem0Response.text());
          }
        }
        console.log(`Stored ${extractedMemories.length} memories in Mem0`);
      } catch (e) {
        console.error("Mem0 storage error:", e);
      }
    }

    // Also store locally in metadata for quick access
    const memoryMetadata = {
      memories: extractedMemories,
      extracted_at: new Date().toISOString(),
      contact_identifier: contactIdentifier,
    };

    // Update the most recent communication with memory metadata
    if (communications[0]) {
      await supabase
        .from("lead_communications")
        .update({
          metadata: {
            ...((communications[0].metadata as object) || {}),
            contact_memories: memoryMetadata,
          },
        })
        .eq("id", communications[0].id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        contactIdentifier,
        memories: extractedMemories,
        memoryCount: extractedMemories.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error extracting memories:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
