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

    console.log("Summarize conversation request:", { leadId, ownerId, contactPhone, contactEmail });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let communications: any[] = [];
    let contactName = "Contact";
    let contactType = "unknown";
    let searchPhone: string | null = null;
    let searchEmail: string | null = null;

    // First, determine the contact info we're working with
    if (leadId) {
      const { data: lead } = await supabase
        .from("leads")
        .select("name, phone, email")
        .eq("id", leadId)
        .single();
      if (lead) {
        contactName = lead.name || "Lead";
        contactType = "lead";
        searchPhone = lead.phone;
        searchEmail = lead.email;
      }
    } else if (ownerId) {
      const { data: owner } = await supabase
        .from("property_owners")
        .select("name, phone, email")
        .eq("id", ownerId)
        .single();
      if (owner) {
        contactName = owner.name || "Owner";
        contactType = "owner";
        searchPhone = owner.phone;
        searchEmail = owner.email;
      }
    } else if (contactPhone) {
      searchPhone = contactPhone;
      contactName = `Phone ${contactPhone}`;
      contactType = "external_phone";
      
      // Try to find name from matching lead
      const { data: matchingLead } = await supabase
        .from("leads")
        .select("name")
        .eq("phone", contactPhone)
        .maybeSingle();
      if (matchingLead?.name) {
        contactName = matchingLead.name;
      }
    } else if (contactEmail) {
      searchEmail = contactEmail;
      contactName = contactEmail;
      contactType = "external_email";
      
      // Try to find name from matching lead
      const { data: matchingLead } = await supabase
        .from("leads")
        .select("name")
        .eq("email", contactEmail)
        .maybeSingle();
      if (matchingLead?.name) {
        contactName = matchingLead.name;
      }
    } else {
      return new Response(
        JSON.stringify({ 
          error: "No contact identifier provided. Need leadId, ownerId, contactPhone, or contactEmail.",
          success: false
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Searching for communications with:", { searchPhone, searchEmail, leadId, ownerId });

    // Now fetch ALL communications - don't filter by lead_id/owner_id restrictions
    // This captures all messages for this contact regardless of how they were linked
    const { data: allComms, error: commsError } = await supabase
      .from("lead_communications")
      .select("id, direction, body, subject, communication_type, created_at, transcript, metadata, lead_id, owner_id, call_recording_url")
      .order("created_at", { ascending: true });

    if (commsError) {
      console.error("Error fetching communications:", commsError);
      throw new Error("Failed to fetch communications");
    }

    console.log("Total communications in database:", allComms?.length || 0);

    // Filter to find all messages related to this contact
    const normalizePhone = (phone: string | null) => {
      if (!phone) return "";
      return phone.replace(/\D/g, "").slice(-10); // Last 10 digits
    };

    const searchPhoneNormalized = normalizePhone(searchPhone);
    const searchEmailLower = searchEmail?.toLowerCase();

    communications = (allComms || []).filter(comm => {
      // Direct match by lead_id or owner_id
      if (leadId && comm.lead_id === leadId) return true;
      if (ownerId && comm.owner_id === ownerId) return true;

      // Match by phone number in metadata
      if (searchPhoneNormalized) {
        const fromNum = normalizePhone(comm.metadata?.from_number || "");
        const toNum = normalizePhone(comm.metadata?.to_number || "");
        const metaPhone = normalizePhone(comm.metadata?.phone || "");
        
        if (fromNum === searchPhoneNormalized || 
            toNum === searchPhoneNormalized ||
            metaPhone === searchPhoneNormalized) {
          return true;
        }
      }

      // Match by email in metadata
      if (searchEmailLower) {
        const fromEmail = (comm.metadata?.from_email || "").toLowerCase();
        const toEmail = (comm.metadata?.to_email || "").toLowerCase();
        const metaEmail = (comm.metadata?.email || "").toLowerCase();
        
        if (fromEmail === searchEmailLower || 
            toEmail === searchEmailLower ||
            metaEmail === searchEmailLower) {
          return true;
        }
      }

      return false;
    });

    console.log("Matched communications:", communications.length);

    if (!communications || communications.length < 1) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No messages found to summarize",
          messageCount: 0,
          debug: { searchPhone, searchEmail, leadId, ownerId }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build conversation thread for summarization - include ALL content types
    let thread = "";
    let contentCount = 0;
    
    for (const comm of communications) {
      const sender = comm.direction === "inbound" ? contactName : "PeachHaus";
      const commType = comm.communication_type?.toUpperCase() || "MSG";
      
      // Gather all available content
      let content = "";
      
      // Prioritize transcript for calls
      if (comm.transcript && comm.transcript.trim()) {
        content = comm.transcript.trim();
      } else if (comm.body && comm.body.trim()) {
        content = comm.body.trim();
      } else if (comm.subject && comm.subject.trim()) {
        content = comm.subject.trim();
      }
      
      // Add note about recording if available but no transcript
      if (!content && comm.call_recording_url) {
        content = "[Call recording available - no transcript]";
      }
      
      if (content) {
        // Truncate very long messages to prevent token overflow
        if (content.length > 1000) {
          content = content.substring(0, 1000) + "...";
        }
        thread += `[${sender} - ${commType}]: ${content}\n\n`;
        contentCount++;
      }
    }

    console.log("Content items for summary:", contentCount);

    if (contentCount < 1) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No message content found to summarize",
          messageCount: communications.length,
          contentCount: 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate summary using AI
    const summaryPrompt = `Summarize this conversation in exactly 3 concise bullet points:

1. What they want/need
2. What we've told them  
3. What action is pending (if any)

CONVERSATION (${contentCount} messages):
${thread}

RULES:
- Be specific and actionable
- Use their name "${contactName}" where relevant
- If no action pending, say "No pending action"
- Each bullet should be 1-2 sentences max
- Write in present tense
- Include details from calls, SMS, and emails

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
        max_tokens: 500,
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
        contact_phone: contactPhone || searchPhone || null,
        contact_email: contactEmail || searchEmail || null,
        contact_name: contactName,
        note: summary,
        is_ai_generated: true,
        summary_type: "thread_summary",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error storing summary:", insertError);
    }

    console.log("Summary generated for:", contactName, "with", communications.length, "messages");

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        messageCount: communications.length,
        contentCount,
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
