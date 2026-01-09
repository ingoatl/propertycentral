import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contactEmail, contactName, currentSubject, incomingEmailBody } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch previous email communications with this contact
    let emailHistory: any[] = [];
    
    const { data: leadComms } = await supabase
      .from("lead_communications")
      .select("direction, subject, body, created_at, leads!inner(email)")
      .eq("communication_type", "email")
      .order("created_at", { ascending: false })
      .limit(10);

    if (leadComms) {
      emailHistory = leadComms
        .filter((c: any) => c.leads?.email?.toLowerCase() === contactEmail?.toLowerCase())
        .map((c: any) => ({
          direction: c.direction,
          subject: c.subject,
          body: c.body?.substring(0, 500),
          date: c.created_at
        }));
    }

    // Fetch property owner info and their properties
    const { data: ownerData } = await supabase
      .from("property_owners")
      .select(`
        id, name, email, phone,
        properties (
          id, name, address, status, property_type,
          onboarding_projects (
            id, status, progress_percentage, current_phase
          )
        )
      `)
      .ilike("email", `%${contactEmail?.split('@')[0]}%`)
      .limit(1)
      .maybeSingle();

    // Fetch lead info with discovery calls
    const { data: leadData } = await supabase
      .from("leads")
      .select(`
        id, name, email, phone, status, property_address, notes, property_type,
        discovery_calls (
          id, scheduled_at, status, google_meet_link, meeting_type
        )
      `)
      .ilike("email", `%${contactEmail?.split('@')[0]}%`)
      .limit(1)
      .maybeSingle();

    // Build context
    const historyContext = emailHistory.length > 0 
      ? emailHistory.map(e => 
          `[${e.direction === 'outbound' ? 'SENT' : 'RECEIVED'}] Subject: ${e.subject}\n${e.body}`
        ).join('\n\n---\n\n')
      : '';

    // Build property/owner context with actionable info
    let propertyContext = '';
    let isOwner = false;
    let meetingLink = '';
    let upcomingCall = null;
    
    if (ownerData) {
      isOwner = true;
      propertyContext = `\n\nCONTACT STATUS: PROPERTY OWNER (VIP - prioritize their needs)`;
      
      if (ownerData.phone) {
        propertyContext += `\nOwner Phone: ${ownerData.phone}`;
      }
      
      if (ownerData.properties && ownerData.properties.length > 0) {
        const props = ownerData.properties as any[];
        propertyContext += `\n\nPROPERTIES:`;
        for (const prop of props) {
          propertyContext += `\n- ${prop.name || prop.address} (${prop.status || 'Active'})`;
          if (prop.onboarding_projects?.[0]) {
            const project = prop.onboarding_projects[0];
            if (project.status === 'in_progress') {
              propertyContext += ` - Onboarding ${project.progress_percentage}% complete`;
            }
          }
        }
      }
    } else if (leadData) {
      propertyContext = `\n\nCONTACT STATUS: Lead (${leadData.status || 'New'})`;
      if (leadData.property_address) {
        propertyContext += `\nProperty: ${leadData.property_address}`;
      }
      if (leadData.phone) {
        propertyContext += `\nPhone: ${leadData.phone}`;
      }
      
      // Check for scheduled discovery calls
      if (leadData.discovery_calls && leadData.discovery_calls.length > 0) {
        const calls = leadData.discovery_calls as any[];
        const upcoming = calls.find((c: any) => 
          c.status === 'scheduled' && new Date(c.scheduled_at) > new Date()
        );
        if (upcoming) {
          upcomingCall = upcoming;
          meetingLink = upcoming.google_meet_link || '';
          const callDate = new Date(upcoming.scheduled_at);
          propertyContext += `\n\nSCHEDULED CALL: ${callDate.toLocaleDateString()} at ${callDate.toLocaleTimeString()}`;
          if (meetingLink) {
            propertyContext += `\nMeeting Link: ${meetingLink}`;
          }
        }
      }
    }

    // Detect if email mentions meetings/calls
    const emailLower = (incomingEmailBody || '').toLowerCase();
    const mentionsMeeting = emailLower.includes('call') || emailLower.includes('meet') || 
      emailLower.includes('schedule') || emailLower.includes('zoom') || 
      emailLower.includes('link') || emailLower.includes('join');

    let actionContext = '';
    if (mentionsMeeting && meetingLink) {
      actionContext = `\n\nACTION REQUIRED: They're asking about a meeting. Include this meeting link: ${meetingLink}`;
    } else if (mentionsMeeting && !meetingLink) {
      actionContext = `\n\nACTION: They mention a meeting but no link is scheduled. Suggest scheduling a call.`;
    }

    const systemPrompt = `You are a professional email assistant for PeachHaus Group, a premium property management company in Atlanta.

RULES:
- 2-3 short paragraphs MAX - be direct
- Address their MOST RECENT message first
- If they ask about a meeting/call and you have a link, INCLUDE IT
- If meeting info is provided, share date/time and link clearly
- Include clear next step
- Start with "Hi [FirstName]," end with "Best regards"
- No signature needed

${isOwner ? `VIP OWNER - prioritize their needs, be proactive.` : `LEAD - be welcoming, guide toward next step.`}
${actionContext}`;

    const userPrompt = `Contact: ${contactName} (${contactEmail})
${currentSubject ? `Subject: ${currentSubject}` : ''}
${propertyContext}

${incomingEmailBody ? `EMAIL THEY SENT:
${incomingEmailBody.substring(0, 2000)}` : ''}

${historyContext ? `PREVIOUS EMAIL HISTORY:\n${historyContext}` : 'No previous email history.'}

Please draft a professional, detailed reply. Be thorough and address all points they raised. Start with "Hi ${contactName?.split(' ')[0] || 'there'},"`;

    console.log("Generating AI email suggestion for:", contactEmail, "isOwner:", isOwner);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 400,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Failed to generate AI response");
    }

    const data = await response.json();
    const suggestedReply = data.choices?.[0]?.message?.content || "";

    console.log("Generated suggestion successfully, isOwner:", isOwner);

    return new Response(
      JSON.stringify({ 
        success: true, 
        suggestion: suggestedReply,
        emailHistory: emailHistory.length,
        isOwner 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in suggest-email-reply:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
