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

    // Fetch lead info
    const { data: leadData } = await supabase
      .from("leads")
      .select("id, name, email, phone, status, property_address, notes, property_type")
      .ilike("email", `%${contactEmail?.split('@')[0]}%`)
      .limit(1)
      .maybeSingle();

    // Build context
    const historyContext = emailHistory.length > 0 
      ? emailHistory.map(e => 
          `[${e.direction === 'outbound' ? 'SENT' : 'RECEIVED'}] Subject: ${e.subject}\n${e.body}`
        ).join('\n\n---\n\n')
      : '';

    // Build property/owner context
    let propertyContext = '';
    let isOwner = false;
    
    if (ownerData) {
      isOwner = true;
      propertyContext = `\n\nCONTACT STATUS: This is an existing property owner.`;
      
      if (ownerData.properties && ownerData.properties.length > 0) {
        const props = ownerData.properties as any[];
        propertyContext += `\n\nPROPERTIES THEY OWN:`;
        for (const prop of props) {
          propertyContext += `\n- ${prop.name || prop.address} (Status: ${prop.status || 'Active'})`;
          if (prop.onboarding_projects && prop.onboarding_projects.length > 0) {
            const project = prop.onboarding_projects[0];
            propertyContext += `\n  Onboarding: ${project.status} - ${project.progress_percentage || 0}% complete, Phase: ${project.current_phase || 'Unknown'}`;
            
            // Determine what they need to do next based on onboarding status
            if (project.status === 'in_progress') {
              propertyContext += `\n  IMPORTANT: They are actively onboarding. Check what documents/items are still pending before suggesting they complete onboarding.`;
            } else if (project.status === 'completed') {
              propertyContext += `\n  Their onboarding is COMPLETE - do NOT suggest completing onboarding forms.`;
            }
          }
        }
      }
    } else if (leadData) {
      propertyContext = `\n\nCONTACT STATUS: This is a lead (potential client).`;
      propertyContext += `\nLead Status: ${leadData.status || 'New'}`;
      if (leadData.property_address) {
        propertyContext += `\nProperty of Interest: ${leadData.property_address}`;
      }
      if (leadData.notes) {
        propertyContext += `\nNotes: ${leadData.notes}`;
      }
    }

    const systemPrompt = `You are a professional email assistant for PeachHaus Group, a premium property management company in Atlanta, Georgia.

Your task is to draft a polished, professional, and warm email reply.

CRITICAL GUIDELINES:
- Write in a highly professional yet personable tone
- Be thorough and detailed - aim for 4-6 paragraphs for owners, 3-4 for leads
- Address their specific inquiry or concern directly
- Show genuine care and attention to their needs
- Use proper business email formatting
- Don't include a signature (it will be added automatically)
- Start with "Hi [FirstName]," 
- End with "Best regards" or "Warm regards"

${isOwner ? `IMPORTANT - This is a PROPERTY OWNER:
- Be extra attentive and service-oriented
- They are a valued client - treat them accordingly
- Reference their specific property/situation when relevant
- Be proactive in offering assistance
- If they completed an onboarding step, acknowledge it and guide them to the NEXT step
- DO NOT suggest completing tasks they have already done` : `This is a LEAD (potential client):
- Be welcoming and informative
- Focus on the value PeachHaus provides
- Encourage next steps in the sales process`}

ABOUT PEACHHAUS GROUP:
- Premium property management specializing in short-term and mid-term rentals
- Based in Atlanta, Georgia  
- Known for white-glove service and attention to detail
- We handle everything: marketing, guest communication, maintenance, cleaning, owner reporting`;

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
        max_tokens: 1000,
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
