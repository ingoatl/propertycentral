import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to format date nicely
const formatDate = (dateStr: string | null) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
    let leadData: any = null;
    let ownerData: any = null;
    let propertyData: any = null;
    let discoveryCallData: any = null;
    let timelineData: any[] = [];
    let onboardingData: any = null;

    // First, determine the contact info we're working with AND fetch full context
    if (leadId) {
      // Fetch comprehensive lead data
      const { data: lead } = await supabase
        .from("leads")
        .select(`
          id, name, phone, email, stage, property_address, property_type,
          opportunity_source, opportunity_value, notes, tags, 
          ai_summary, ai_next_action, ai_qualification_score,
          last_contacted_at, last_response_at, follow_up_paused,
          owner_id, project_id, inspection_date, created_at
        `)
        .eq("id", leadId)
        .single();
      
      if (lead) {
        leadData = lead;
        contactName = lead.name || "Lead";
        contactType = "lead";
        searchPhone = lead.phone;
        searchEmail = lead.email;

        // Check if they're also an owner (already converted)
        if (lead.owner_id) {
          const { data: owner } = await supabase
            .from("property_owners")
            .select("id, name, service_type, has_payment_method, created_at")
            .eq("id", lead.owner_id)
            .single();
          if (owner) {
            ownerData = owner;
          }
        } else if (lead.email || lead.phone) {
          // Check by email/phone match
          let ownerQuery = supabase.from("property_owners").select("id, name, service_type, has_payment_method, created_at");
          if (lead.email) {
            ownerQuery = ownerQuery.eq("email", lead.email);
          } else if (lead.phone) {
            ownerQuery = ownerQuery.eq("phone", lead.phone);
          }
          const { data: matchedOwner } = await ownerQuery.maybeSingle();
          if (matchedOwner) {
            ownerData = matchedOwner;
          }
        }

        // Fetch property info if owner exists
        if (ownerData?.id) {
          const { data: props } = await supabase
            .from("properties")
            .select("id, name, address, status, created_at")
            .eq("owner_id", ownerData.id)
            .limit(3);
          if (props?.length) {
            propertyData = props;
          }
        }

        // Fetch discovery calls
        const { data: discoveryCalls } = await supabase
          .from("discovery_calls")
          .select("id, scheduled_at, status, meeting_notes, service_interest, rental_strategy")
          .eq("lead_id", leadId)
          .order("scheduled_at", { ascending: false })
          .limit(2);
        if (discoveryCalls?.length) {
          discoveryCallData = discoveryCalls;
        }

        // Fetch onboarding project if exists
        if (lead.project_id) {
          const { data: project } = await supabase
            .from("onboarding_projects")
            .select("id, status, phase, percent_complete, go_live_date")
            .eq("id", lead.project_id)
            .single();
          if (project) {
            onboardingData = project;
          }
        }

        // Fetch recent timeline events
        const { data: timeline } = await supabase
          .from("lead_timeline")
          .select("id, event_type, description, created_at")
          .eq("lead_id", leadId)
          .order("created_at", { ascending: false })
          .limit(5);
        if (timeline?.length) {
          timelineData = timeline;
        }
      }
    } else if (ownerId) {
      const { data: owner } = await supabase
        .from("property_owners")
        .select("id, name, phone, email, service_type, has_payment_method, created_at")
        .eq("id", ownerId)
        .single();
      if (owner) {
        ownerData = owner;
        contactName = owner.name || "Owner";
        contactType = "owner";
        searchPhone = owner.phone;
        searchEmail = owner.email;

        // Fetch properties for this owner
        const { data: props } = await supabase
          .from("properties")
          .select("id, name, address, status, created_at")
          .eq("owner_id", ownerId)
          .limit(3);
        if (props?.length) {
          propertyData = props;
        }
      }
    } else if (contactPhone) {
      searchPhone = contactPhone;
      contactName = `Phone ${contactPhone}`;
      contactType = "external_phone";
      
      // Try to find full lead data
      const { data: matchingLead } = await supabase
        .from("leads")
        .select("id, name, stage, property_address, notes, owner_id")
        .eq("phone", contactPhone)
        .maybeSingle();
      if (matchingLead) {
        leadData = matchingLead;
        contactName = matchingLead.name || contactName;
        
        if (matchingLead.owner_id) {
          const { data: owner } = await supabase
            .from("property_owners")
            .select("id, name, service_type, has_payment_method")
            .eq("id", matchingLead.owner_id)
            .single();
          if (owner) ownerData = owner;
        }
      }
    } else if (contactEmail) {
      searchEmail = contactEmail;
      contactName = contactEmail;
      contactType = "external_email";
      
      // Try to find full lead data
      const { data: matchingLead } = await supabase
        .from("leads")
        .select("id, name, stage, property_address, notes, owner_id")
        .eq("email", contactEmail)
        .maybeSingle();
      if (matchingLead) {
        leadData = matchingLead;
        contactName = matchingLead.name || contactName;
        
        if (matchingLead.owner_id) {
          const { data: owner } = await supabase
            .from("property_owners")
            .select("id, name, service_type, has_payment_method")
            .eq("id", matchingLead.owner_id)
            .single();
          if (owner) ownerData = owner;
        }
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
      .select("id, direction, body, subject, communication_type, created_at, metadata, lead_id, owner_id, call_recording_url")
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

      const meta = comm.metadata || {};
      const ghlData = meta.ghl_data || {};

      // Match by phone number in metadata - check multiple possible locations
      if (searchPhoneNormalized) {
        const phonesToCheck = [
          meta.from_number,
          meta.to_number,
          meta.phone,
          meta.contactPhone,
          ghlData.contactPhone,
          ghlData.from,
          ghlData.to,
        ];
        
        for (const phone of phonesToCheck) {
          if (phone && normalizePhone(phone) === searchPhoneNormalized) {
            return true;
          }
        }
      }

      // Match by email in metadata - check multiple possible locations
      if (searchEmailLower) {
        const emailsToCheck = [
          meta.from_email,
          meta.to_email,
          meta.email,
          meta.contactEmail,
          ghlData.contactEmail,
          ghlData.from,
          ghlData.to,
        ];
        
        for (const email of emailsToCheck) {
          if (email && email.toLowerCase() === searchEmailLower) {
            return true;
          }
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
      
      // Use body as main content
      if (comm.body && comm.body.trim()) {
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

    // Build context summary for AI
    let contextInfo = "";
    
    // Lead/Owner status context
    if (leadData) {
      const stageLabels: Record<string, string> = {
        new_lead: "New Lead",
        discovery_scheduled: "Discovery Call Scheduled",
        discovery_completed: "Discovery Call Completed",
        proposal_sent: "Proposal Sent",
        contract_signed: "Contract Signed",
        onboarding: "In Onboarding",
        ops_handoff: "Operations Handoff (Active Client)"
      };
      contextInfo += `\n[LEAD STATUS]: Stage: ${stageLabels[leadData.stage] || leadData.stage}`;
      if (leadData.property_address) contextInfo += `, Property: ${leadData.property_address}`;
      if (leadData.property_type) contextInfo += ` (${leadData.property_type})`;
      if (leadData.notes) contextInfo += `\nNotes: ${leadData.notes.substring(0, 200)}`;
    }
    
    if (ownerData) {
      contextInfo += `\n[OWNER STATUS]: ${contactName} IS ALREADY A CLIENT/OWNER`;
      if (ownerData.service_type) contextInfo += `, Service: ${ownerData.service_type}`;
      if (ownerData.has_payment_method) contextInfo += ` (Payment method on file)`;
    }
    
    if (propertyData?.length) {
      contextInfo += `\n[PROPERTIES]: ${propertyData.map((p: any) => p.address || p.name).join(", ")}`;
    }
    
    if (discoveryCallData?.length) {
      const call = discoveryCallData[0];
      contextInfo += `\n[DISCOVERY CALL]: ${call.status} on ${formatDate(call.scheduled_at)}`;
      if (call.meeting_notes) contextInfo += `. Notes: ${call.meeting_notes.substring(0, 150)}`;
    }
    
    if (onboardingData) {
      contextInfo += `\n[ONBOARDING]: ${onboardingData.phase || "In Progress"}, ${onboardingData.percent_complete || 0}% complete`;
      if (onboardingData.go_live_date) contextInfo += `, Go-live: ${formatDate(onboardingData.go_live_date)}`;
    }
    
    if (timelineData?.length) {
      contextInfo += `\n[RECENT EVENTS]: `;
      contextInfo += timelineData.slice(0, 3).map((t: any) => `${t.event_type}: ${t.description}`).join("; ");
    }

    // Generate summary using AI with comprehensive prompt
    const summaryPrompt = `You are analyzing a conversation thread for a property management company (PeachHaus).

CONTACT CONTEXT:
Name: ${contactName}
Type: ${contactType}${contextInfo}

CONVERSATION THREAD (${contentCount} messages, newest last):
${thread}

GENERATE A COMPREHENSIVE SUMMARY with these 5 sections:

1. **Client Status**: Is this person a lead or already a signed client/owner? What stage are they in?

2. **What They Need**: What is this person looking for or asking about? Be specific about their property, situation, concerns.

3. **What We've Communicated**: Key information we've provided - pricing discussed, documents requested, instructions given, deadlines mentioned.

4. **Outstanding Items**: What are WE waiting on from them? (documents, responses, decisions) What are THEY waiting on from us?

5. **Recommended Action**: What should we do next? Be specific and actionable. If no action needed, explain why.

IMPORTANT RULES:
- If they're already an owner/client, make that VERY CLEAR upfront
- Include specific details: property addresses, dates, amounts, document names
- Note any insurance docs, smart lock codes, or onboarding items mentioned
- If they confirmed something (like "Submitted" or "Thank you"), note it
- Be concise but thorough - each section 1-2 sentences
- Write in present tense, use their name "${contactName}"

Return the 5 sections with the bold headers as shown above.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a thorough business conversation analyst. Provide actionable, specific summaries that help the team understand the full picture of each client relationship." },
          { role: "user", content: summaryPrompt },
        ],
        max_tokens: 800,
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
