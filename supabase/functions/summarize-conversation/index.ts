import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leadId, ownerId, contactPhone, contactEmail } = await req.json();

    console.log("Summarize conversation request:", { leadId, ownerId, contactPhone });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch conversation history - support all contact types
    let communications: any[] = [];
    let contactName = "Contact";
    let contactType = "external";

    if (leadId) {
      const { data } = await supabase
        .from("lead_communications")
        .select("id, direction, body, subject, communication_type, created_at, transcript")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: true });
      communications = data || [];
      
      const { data: lead } = await supabase
        .from("leads")
        .select("name, phone, email")
        .eq("id", leadId)
        .single();
      if (lead) {
        contactName = lead.name || "Lead";
        contactType = "lead";
      }
    } else if (ownerId) {
      const { data } = await supabase
        .from("lead_communications")
        .select("id, direction, body, subject, communication_type, created_at, transcript")
        .eq("owner_id", ownerId)
        .order("created_at", { ascending: true });
      communications = data || [];
      
      const { data: owner } = await supabase
        .from("property_owners")
        .select("name, phone, email")
        .eq("id", ownerId)
        .single();
      if (owner) {
        contactName = owner.name || "Owner";
        contactType = "owner";
      }
    } else if (contactPhone) {
      // External conversation by phone - query using JSONB containment
      const normalizedPhone = contactPhone.replace(/\D/g, "");
      const phoneVariants = [
        contactPhone,
        `+${normalizedPhone}`,
        `+1${normalizedPhone}`,
        normalizedPhone,
      ];
      
      // Query all communications that have this phone in metadata
      const { data } = await supabase
        .from("lead_communications")
        .select("id, direction, body, subject, communication_type, created_at, transcript, metadata")
        .is("lead_id", null)
        .is("owner_id", null)
        .order("created_at", { ascending: true });
      
      // Filter by phone in metadata
      communications = (data || []).filter(comm => {
        const fromNum = comm.metadata?.from_number || "";
        const toNum = comm.metadata?.to_number || "";
        return phoneVariants.some(pv => fromNum.includes(pv) || toNum.includes(pv) || pv.includes(fromNum) || pv.includes(toNum));
      });
      
      contactName = `Phone ${contactPhone}`;
      contactType = "external_phone";
      
      // Try to find name from any matching lead
      const { data: matchingLead } = await supabase
        .from("leads")
        .select("name")
        .eq("phone", contactPhone)
        .maybeSingle();
      if (matchingLead?.name) {
        contactName = matchingLead.name;
      }
    } else if (contactEmail) {
      // External conversation by email
      const { data } = await supabase
        .from("lead_communications")
        .select("id, direction, body, subject, communication_type, created_at, transcript, metadata")
        .is("lead_id", null)
        .is("owner_id", null)
        .order("created_at", { ascending: true });
      
      // Filter by email in metadata or subject
      communications = (data || []).filter(comm => {
        const fromEmail = comm.metadata?.from_email || "";
        const toEmail = comm.metadata?.to_email || "";
        return fromEmail.includes(contactEmail) || toEmail.includes(contactEmail) || 
               (comm.subject && comm.subject.includes(contactEmail));
      });
      
      contactName = contactEmail;
      contactType = "external_email";
      
      // Try to find name from any matching lead
      const { data: matchingLead } = await supabase
        .from("leads")
        .select("name")
        .eq("email", contactEmail)
        .maybeSingle();
      if (matchingLead?.name) {
        contactName = matchingLead.name;
      }
    } else {
      // No identifier provided - return helpful error
      return new Response(
        JSON.stringify({ 
          error: "No contact identifier provided. Need leadId, ownerId, contactPhone, or contactEmail.",
          success: false
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!communications || communications.length < 3) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Not enough messages to summarize (minimum 3 required)",
          messageCount: communications?.length || 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build conversation thread for summarization
    let thread = "";
    for (const comm of communications) {
      const sender = comm.direction === "inbound" ? contactName : "PeachHaus";
      const content = comm.transcript || comm.body || comm.subject || "";
      if (content.trim()) {
        const type = comm.communication_type?.toUpperCase() || "MSG";
        thread += `[${sender} - ${type}]: ${content.trim()}\n\n`;
      }
    }

    // Generate summary using AI
    const summaryPrompt = `Summarize this conversation in exactly 3 concise bullet points:

1. What they want/need
2. What we've told them  
3. What action is pending (if any)

CONVERSATION:
${thread}

RULES:
- Be specific and actionable
- Use their name "${contactName}" where relevant
- If no action pending, say "No pending action"
- Each bullet should be 1-2 sentences max
- Write in present tense

Return ONLY the 3 bullet points, nothing else.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a concise business conversation summarizer. Return only the requested format." },
          { role: "user", content: summaryPrompt },
        ],
        max_tokens: 300,
        temperature: 0.3,
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
    let summary = data.choices?.[0]?.message?.content?.trim();

    if (!summary) {
      throw new Error("No summary generated");
    }

    // Store the summary in conversation_notes
    const { data: savedNote, error: insertError } = await supabase
      .from("conversation_notes")
      .insert({
        lead_id: leadId || null,
        owner_id: ownerId || null,
        contact_phone: contactPhone || null,
        contact_email: contactEmail || null,
        contact_name: contactName,
        note: summary,
        is_ai_generated: true,
        summary_type: "thread_summary",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error storing summary:", insertError);
      // Still return the summary even if storage fails
    }

    console.log("Summary generated for:", contactName);

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        messageCount: communications.length,
        contactName,
        contactType,
        noteId: savedNote?.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error summarizing conversation:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
