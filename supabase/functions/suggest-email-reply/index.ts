import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Advanced conversational UX guidelines for human-like email communication
const humanLikeGuidelines = `
CONVERSATIONAL INTELLIGENCE FRAMEWORK:

1. CONTEXT-AWARE REPLY DESIGN:
   - Analyze the sender's MOST RECENT message - this is what needs addressing
   - Review email thread history to understand the relationship and what's been discussed
   - Detect their emotional state: frustrated, excited, confused, neutral, or in a hurry
   - Match their communication style - if they're formal, be professional; if casual, be warm

2. EMAIL-SPECIFIC COMMUNICATION PATTERNS:
   - Open with their first name: "Hi [Name]," (not "Dear" unless they used it)
   - First sentence = direct response to their main point
   - Structure: Answer → Context (if needed) → Next Step
   - Keep paragraphs to 2-3 sentences max
   - Use white space - dense paragraphs feel overwhelming
   - Close naturally: "Thanks," "Best," "Talk soon" - not "Sincerely" or "Regards"

3. TONE CALIBRATION BY CONTACT TYPE:
   Property Owners (VIPs):
   - Partnership language: "Here's what I'm handling..." not "We will process..."
   - Proactive updates even when not asked
   - Acknowledge their investment and time
   - Be thorough but efficient
   
   Leads (Prospective Clients):
   - Welcoming and helpful, never pushy
   - Answer their question completely before any soft pitch
   - Make next steps clear and easy
   - Build trust through competence, not promises
   
   General Inquiries:
   - Helpful and efficient
   - Clear information without fluff
   - Professional but human

4. BANNED PHRASES (robotic/corporate):
   ❌ "I hope this email finds you well"
   ❌ "Per our conversation" / "As per your request"  
   ❌ "Please don't hesitate to reach out"
   ❌ "At your earliest convenience"
   ❌ "We apologize for any inconvenience"
   ❌ "Thank you for your patience"
   ❌ "Moving forward" / "Going forward"
   ❌ "Circle back" / "Touch base" / "Synergy" / "Leverage"
   ❌ "It would be my pleasure"
   ❌ Excessive exclamation points (max 1 per email)

5. NATURAL ALTERNATIVES:
   Instead of → Use:
   "I apologize for the delay" → "Sorry for the slow reply"
   "Please find attached" → "I've attached" or "Here's"
   "Do not hesitate to contact me" → "Just let me know"
   "I would like to inform you" → "Wanted to let you know"
   "As previously discussed" → "Like we talked about"
   "We appreciate your business" → Skip it or be specific about what you appreciate

6. RESPONSE STRUCTURE BY DETECTED INTENT:
   Question → Answer first line, details after
   Complaint → Empathy + ownership + specific action + timeline
   Request → Confirm + action + when they'll hear back
   Thank You → Brief acknowledgment, don't over-respond
   Decline/Unsubscribe → Graceful exit in 2-3 sentences max
   Scheduling → Specific options or booking link immediately
`;

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

    // Step 1: Analyze sentiment and intent of the incoming email
    let sentiment = "neutral";
    let intent = "general";
    let urgency = "medium";

    if (incomingEmailBody) {
      console.log("Analyzing email sentiment and intent...");
      
      const analysisResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { 
              role: "system", 
              content: "You are an email analyst. Analyze the email and return structured data about its sentiment, intent, and urgency. Be accurate - unsubscribe requests, complaints, and declines should be identified." 
            },
            { role: "user", content: `Analyze this email:\n\n${incomingEmailBody.substring(0, 1500)}` }
          ],
          tools: [{
            type: "function",
            function: {
              name: "analyze_email",
              description: "Analyze the email's sentiment, intent, and urgency",
              parameters: {
                type: "object",
                properties: {
                  sentiment: { 
                    type: "string", 
                    enum: ["positive", "negative", "neutral", "frustrated", "grateful", "confused"],
                    description: "The emotional tone of the email"
                  },
                  intent: { 
                    type: "string", 
                    enum: ["unsubscribe", "complaint", "question", "inquiry", "schedule_meeting", "pricing_request", "decline", "follow_up", "general", "thank_you"],
                    description: "The primary purpose of the email"
                  },
                  urgency: { 
                    type: "string", 
                    enum: ["high", "medium", "low"],
                    description: "How urgent the response needs to be"
                  }
                },
                required: ["sentiment", "intent", "urgency"]
              }
            }
          }],
          tool_choice: { type: "function", function: { name: "analyze_email" } }
        }),
      });

      if (analysisResponse.ok) {
        const analysisData = await analysisResponse.json();
        const toolCall = analysisData.choices?.[0]?.message?.tool_calls?.[0];
        if (toolCall?.function?.arguments) {
          try {
            const analysis = JSON.parse(toolCall.function.arguments);
            sentiment = analysis.sentiment || "neutral";
            intent = analysis.intent || "general";
            urgency = analysis.urgency || "medium";
            console.log("Email analysis:", { sentiment, intent, urgency });
          } catch (e) {
            console.error("Failed to parse analysis:", e);
          }
        }
      }
    }

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

    // Build intent-specific system prompt
    let intentGuidance = '';
    
    switch (intent) {
      case 'unsubscribe':
        intentGuidance = `
INTENT DETECTED: UNSUBSCRIBE REQUEST
- Keep response to 2-3 sentences MAX
- Immediately acknowledge and confirm you'll remove them
- Apologize briefly and sincerely
- DO NOT try to convince them to stay
- DO NOT ask why they want to unsubscribe
- DO NOT mention any benefits or offers

Example tone: "Got it - I've removed you from our list. Sorry for any bother, and thanks for letting me know."`;
        break;
        
      case 'complaint':
        intentGuidance = `
INTENT DETECTED: COMPLAINT (Sentiment: ${sentiment})
- Lead with genuine empathy - acknowledge their frustration
- Take responsibility, don't be defensive
- Offer a specific solution or clear next step
- Keep it personal, not corporate
- If you can't solve it immediately, explain exactly what you'll do and when

Example tone: "I completely understand why you're frustrated - that's not the experience we want anyone to have. Here's what I'm going to do to fix this..."`;
        break;
        
      case 'decline':
        intentGuidance = `
INTENT DETECTED: DECLINE/NOT INTERESTED
- Keep response to 2-3 sentences MAX
- Accept gracefully without pushback
- Thank them genuinely for their time
- Leave door open with one brief line, but don't push
- DO NOT list benefits or try to change their mind

Example tone: "Totally understand - thanks for taking the time to look into it. If things change down the road, just give me a shout."`;
        break;
        
      case 'pricing_request':
        intentGuidance = `
INTENT DETECTED: PRICING REQUEST
- Be transparent and direct about pricing
- If you have specific numbers, share them
- Explain value without being salesy
- Suggest a call to discuss their specific needs`;
        break;
        
      case 'schedule_meeting':
        intentGuidance = `
INTENT DETECTED: WANTS TO SCHEDULE MEETING
- If you have a meeting link, share it immediately
- Offer 2-3 specific time options if possible
- Make it easy for them to confirm`;
        break;
        
      case 'thank_you':
        intentGuidance = `
INTENT DETECTED: THANK YOU / GRATITUDE
- Keep response brief and warm
- Match their positive energy without being over-the-top
- 2-3 sentences max`;
        break;
        
      default:
        intentGuidance = '';
    }

    const systemPrompt = `You are writing an email reply for PeachHaus Group, a premium property management company in Atlanta. Your goal is to sound like a real, thoughtful human - not a corporate AI.

${humanLikeGuidelines}

CONTEXT:
- Sender Sentiment: ${sentiment}
- Email Intent: ${intent}
- Urgency: ${urgency}
${isOwner ? `- This is a VIP PROPERTY OWNER - prioritize their needs, be warm and proactive.` : `- This is a LEAD - be welcoming, guide them naturally toward next steps.`}
${intentGuidance}
${actionContext}

STRUCTURE:
- Start with "Hi [FirstName]," 
- Get to the point in the first sentence
- ${intent === 'unsubscribe' || intent === 'decline' || intent === 'thank_you' ? '2-3 sentences MAX' : '2-3 short paragraphs MAX'}
- End with a clear next step (if appropriate)
- Sign off naturally: "Best," or "Thanks," or just your name

REMEMBER: Write like a friendly colleague, not a corporation.`;

    const userPrompt = `Contact: ${contactName} (${contactEmail})
${currentSubject ? `Subject: ${currentSubject}` : ''}
${propertyContext}

${incomingEmailBody ? `EMAIL THEY SENT:
${incomingEmailBody.substring(0, 2000)}` : ''}

${historyContext ? `PREVIOUS EMAIL HISTORY:\n${historyContext}` : 'No previous email history.'}

Draft a reply. Start with "Hi ${contactName?.split(' ')[0] || 'there'},"`;

    console.log("Generating AI email suggestion for:", contactEmail, "isOwner:", isOwner, "intent:", intent, "sentiment:", sentiment);

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
        max_tokens: intent === 'unsubscribe' || intent === 'decline' || intent === 'thank_you' ? 150 : 400,
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

    console.log("Generated suggestion successfully, isOwner:", isOwner, "intent:", intent);

    return new Response(
      JSON.stringify({ 
        success: true, 
        suggestion: suggestedReply,
        emailHistory: emailHistory.length,
        isOwner,
        analysis: { sentiment, intent, urgency }
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
