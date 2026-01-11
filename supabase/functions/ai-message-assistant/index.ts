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

// Scheduling link for discovery calls
const SCHEDULING_LINK = "https://propertycentral.lovable.app/book-discovery-call";

// Company knowledge base with psychology-informed communication guidance
const companyKnowledge = `
COMPANY: PeachHaus Group
BUSINESS: Mid-term rental property management in Atlanta, GA

SCHEDULING LINK: ${SCHEDULING_LINK}
- ALWAYS include this link when suggesting a call or deeper conversation
- Present it as a convenience, not a sales tactic

FREE INCOME ANALYSIS OFFER (ALWAYS MENTION!):
- We provide a FREE rental income analysis for any property
- Shows projected income for ALL 3 rental types:
  1. Short-term (Airbnb, 1-29 nights)
  2. Mid-term (30-365 days - our specialty)
  3. Long-term (12+ month leases)
- To create the analysis, we need their:
  1. Property address (required)
  2. Email address (to send the report, especially if they texted)
- ALWAYS offer this to new leads or interested owners
- Say: "Would you like a free income analysis? Just need your address and email to send it over!"

KEY SERVICES:
- Mid-term rental management (30+ day stays)
- Property onboarding and setup
- Guest communication and support
- Cleaning and maintenance coordination
- Owner financial reporting

PRICING & POLICIES:
- Management fee: Typically 15-20% of rental income
- Minimum stay: 30 days
- Security deposit: Usually equal to one month's rent
- Cleaning: Professional cleaning between guests

CONTACT INFO:
- Email: info@peachhausgroup.com
- Office hours: Monday-Friday 9am-6pm EST

BRAND VOICE & PSYCHOLOGY PRINCIPLES:
1. RECIPROCITY: Lead with value - offer the FREE income analysis first!
2. SOCIAL PROOF: Reference "many Atlanta property owners" when relevant
3. LIKING: Use their name, acknowledge their specific situation
4. AUTHORITY: Position PeachHaus as trusted experts, not salespeople
5. COMMITMENT: Reference their interest to reinforce engagement

COMMUNICATION STRATEGY:
- If they texted: Ask for their email so we can send the income analysis
- If we don't have address: Ask for it to create the analysis
- Always offer the free analysis before pushing for a call
- The income analysis is our primary value-add for new leads

TONE GUIDELINES (based on communication psychology):
- Sound like a trusted advisor helping them, not selling to them
- Acknowledge emotions - if they sounded stressed or excited, reflect that
- Use "we" and "together" to create partnership feeling
- Be specific - vague messages feel impersonal
- End with clarity - they should know exactly what to do next

AFTER SOMEONE CALLS IN OR TEXTS:
- Thank them for reaching out (reciprocity)
- Acknowledge what they're interested in (active listening)
- Offer the free income analysis if they haven't received one
- Ask for address + email if we don't have them
- If they need to speak with someone, invite them to schedule: ${SCHEDULING_LINK}
- If it sounded urgent, offer to have someone call back quickly
- Make them feel their inquiry is valued and will be handled

COMMON TOPICS:
- Move-in/move-out procedures
- Maintenance requests
- Booking inquiries
- Document collection for owner onboarding
- Monthly owner statements
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      action, 
      currentMessage, 
      contactName, 
      conversationContext, 
      messageType, 
      leadId, 
      ownerId,
      includeCompanyKnowledge 
    } = await req.json();

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
    let leadData: any = null;
    let ownerData: any = null;
    let discoveryCallsData: any[] = [];
    
    if (leadId) {
      // Fetch lead data
      const { data: lead } = await supabase
        .from("leads")
        .select("*")
        .eq("id", leadId)
        .single();
      
      leadData = lead;
      
      if (lead) {
        fullContext = `Lead: ${lead.name}\nPhone: ${lead.phone || "N/A"}\nEmail: ${lead.email || "N/A"}\nProperty: ${lead.property_address || "N/A"}\nStage: ${lead.stage}`;
        if (lead.ai_summary) fullContext += `\nNotes: ${lead.ai_summary}`;
        if (lead.move_in_date) fullContext += `\nMove-in: ${lead.move_in_date}`;
        if (lead.budget) fullContext += `\nBudget: $${lead.budget}`;
      }

      // Fetch communications - get MORE history for better context
      const { data: comms } = await supabase
        .from("lead_communications")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(25);
      
      if (comms && comms.length > 0) {
        commHistory = "\n\nFULL CONVERSATION HISTORY (newest first):\n";
        for (const c of comms) {
          const dir = c.direction === "outbound" ? "WE SENT" : "THEY REPLIED";
          const type = c.communication_type?.toUpperCase() || "MSG";
          const preview = (c.body || "").substring(0, 300);
          commHistory += `[${dir} - ${type}]: ${preview}${preview.length >= 300 ? "..." : ""}\n`;
          
          if (c.transcript) {
            commHistory += `[CALL TRANSCRIPT]: ${c.transcript.substring(0, 500)}...\n`;
          }
        }
      }

      // Fetch discovery calls for this lead
      const { data: calls } = await supabase
        .from("discovery_calls")
        .select("*")
        .eq("lead_id", leadId)
        .order("scheduled_at", { ascending: false })
        .limit(5);
      
      if (calls && calls.length > 0) {
        discoveryCallsData = calls;
        commHistory += "\n\nSCHEDULED CALLS:\n";
        for (const call of calls) {
          commHistory += `- ${call.status}: ${call.scheduled_at} (${call.meeting_type || "discovery"})\n`;
        }
      }
    } else if (ownerId) {
      // Fetch owner data
      const { data: owner } = await supabase
        .from("property_owners")
        .select("*, properties(*)")
        .eq("id", ownerId)
        .single();
      
      ownerData = owner;
      
      if (owner) {
        fullContext = `Owner: ${owner.name}\nEmail: ${owner.email || "N/A"}\nPhone: ${owner.phone || "N/A"}\nProperties: ${owner.properties?.map((p: any) => p.name || p.address).join(", ") || "N/A"}`;
      }

      // Fetch communications
      const { data: comms } = await supabase
        .from("lead_communications")
        .select("*")
        .eq("owner_id", ownerId)
        .order("created_at", { ascending: false })
        .limit(25);
      
      if (comms && comms.length > 0) {
        commHistory = "\n\nFULL CONVERSATION HISTORY (newest first):\n";
        for (const c of comms) {
          const dir = c.direction === "outbound" ? "WE SENT" : "THEY REPLIED";
          const type = c.communication_type?.toUpperCase() || "MSG";
          const preview = (c.body || "").substring(0, 300);
          commHistory += `[${dir} - ${type}]: ${preview}${preview.length >= 300 ? "..." : ""}\n`;
        }
      }
    }

    // If conversationContext was passed directly (from UI), use it
    if (conversationContext && !commHistory) {
      commHistory = "\n\nCONVERSATION CONTEXT:\n" + conversationContext;
    }

    const firstName = contactName?.split(" ")[0] || "there";

    // DEEP CONVERSATION ANALYSIS
    const hasOutboundCall = commHistory.includes("[WE SENT - CALL]") || commHistory.includes("CALL TRANSCRIPT");
    const hasInboundCall = commHistory.includes("[THEY REPLIED - CALL]");
    const hasCompletedDiscoveryCall = discoveryCallsData.some(c => c.status === "completed" || c.status === "done");
    
    // Also detect mentions of having had a call in the conversation text
    const conversationLower = commHistory.toLowerCase();
    const mentionedCall = conversationLower.includes("we already") && (
      conversationLower.includes("call") || conversationLower.includes("meeting") || 
      conversationLower.includes("spoke") || conversationLower.includes("talked") ||
      conversationLower.includes("video") || conversationLower.includes("met")
    ) || conversationLower.includes("already spoke") || conversationLower.includes("already talked") ||
    conversationLower.includes("already had a call") || conversationLower.includes("already did a") ||
    conversationLower.includes("we spoke") || conversationLower.includes("we talked") ||
    conversationLower.includes("after our call") || conversationLower.includes("from our call");
    
    const hasPhoneCall = hasOutboundCall || hasInboundCall || hasCompletedDiscoveryCall || mentionedCall;
    const hasTheyReplied = commHistory.includes("[THEY REPLIED");
    const hasWeSent = commHistory.includes("[WE SENT");
    const isFirstContact = !hasWeSent;
    const hasPropertyAddress = leadData?.property_address || ownerData?.properties?.some((p: any) => p.address);
    const hasEmail = leadData?.email || ownerData?.email;
    
    // Check what's been discussed already
    const alreadyOfferedIncomeReport = conversationLower.includes("income analysis") || 
                                        conversationLower.includes("income report") ||
                                        conversationLower.includes("what your property can earn");
    const alreadyAskedForAddress = conversationLower.includes("address") && hasWeSent;
    const alreadyAskedForEmail = conversationLower.includes("email") && hasWeSent;
    const hasScheduledCall = discoveryCallsData.some(c => c.status === "scheduled" || c.status === "confirmed");
    const isExistingOwner = ownerData !== null;
    
    // Check if they're referring to something from a previous call
    const referencingPreviousCall = mentionedCall;
    
    // Check if we already sent a scheduling link
    const alreadySentSchedulingLink = conversationLower.includes("propertycentral.lovable.app/book") ||
                                       conversationLower.includes("pick a time") ||
                                       conversationLower.includes("schedule a call") && hasWeSent;
    
    // Determine communication count
    const ourMessages = (commHistory.match(/\[WE SENT/g) || []).length;
    const theirMessages = (commHistory.match(/\[THEY REPLIED/g) || []).length;
    const conversationCount = ourMessages + theirMessages;
    
    // Determine if this is a new lead vs ongoing conversation
    const isNewConversation = conversationCount <= 2;
    const isOngoingConversation = conversationCount > 2;

    // Build system prompt with optional company knowledge
    let systemPrompt = `You are a professional property management assistant for PeachHaus Group helping compose ${messageType === "sms" ? "SMS messages" : "emails"}.

${humanLikeGuidelines}

${includeCompanyKnowledge ? companyKnowledge : ""}

CONTACT INFO:
Name: ${contactName || "Unknown"} (use "${firstName}" when addressing them)
${fullContext}
${commHistory}

CRITICAL CONVERSATION ANALYSIS:
- Has there been a phone call/video meeting? ${hasPhoneCall ? "YES - we've actually talked before" : "NO - ONLY text/email, no actual call yet"}
- Total conversation messages: ${conversationCount} (our: ${ourMessages}, their: ${theirMessages})
- Is this a new conversation? ${isNewConversation ? "YES" : "NO - ongoing"}
- Is this an existing property owner? ${isExistingOwner ? "YES - do NOT offer income report" : "NO - potential new client"}

CRITICAL RESPONSE RULES - FOLLOW EXACTLY:
1. **READ THEIR MESSAGE FIRST** - What exactly did they ask for? Reply to THAT, not something else.
2. **NO "GREAT CHATTING"** unless you see "[WE SENT - CALL]" or "CALL TRANSCRIPT" in the history - otherwise NO ACTUAL CALL HAPPENED
3. For a NEW inbound message: Say "Thanks for reaching out!" or "Hi [Name]!" - NOT "great chatting"
4. **ANSWER THEIR ACTUAL QUESTION** - If they asked for referrals, provide referrals. If they asked about pricing, address pricing.
5. Be SPECIFIC - reference the exact thing they mentioned (property address, what they need, etc.)
6. ${messageType === "sms" ? "Keep SMS under 200 characters when possible, max 300." : "Keep emails concise."}
7. Never add sales pitches if they asked for something specific - just help them
8. Sign off as: "- Ingo @ PeachHaus Group"`;

    // DETECT SPECIFIC REQUEST TYPES from the most recent inbound message
    const lastInboundMessage = currentMessage || "";
    const lastMsgLower = lastInboundMessage.toLowerCase();
    
    const isAskingForReferrals = lastMsgLower.includes("referral") || lastMsgLower.includes("recommend") || lastMsgLower.includes("who do you use");
    const isAskingForInsurance = lastMsgLower.includes("insurance");
    const isAskingQuestion = lastMsgLower.includes("?") || lastMsgLower.includes("how") || lastMsgLower.includes("what") || lastMsgLower.includes("when");
    const isProvidingInfo = lastMsgLower.includes("my address") || lastMsgLower.includes("my email") || lastMsgLower.includes("here") || /\d{4,5}\s+\w+/.test(lastMsgLower);

    let specificRequestContext = "";
    if (isAskingForReferrals && isAskingForInsurance) {
      specificRequestContext = `

THEY ARE ASKING FOR: Insurance referrals specifically.
YOUR RESPONSE SHOULD: 
- Acknowledge you'll get them those insurance referrals
- Say you'll look into it or send them over
- If you don't have their email, ask for it to send the list
- DO NOT pitch income reports or other services - just answer their question`;
    } else if (isAskingForReferrals) {
      specificRequestContext = `

THEY ARE ASKING FOR: Vendor/service referrals.
YOUR RESPONSE SHOULD:
- Acknowledge what referrals they need
- Say you'll gather and send them
- Ask for email if you need to send a list`;
    } else if (isProvidingInfo) {
      specificRequestContext = `

THEY ARE PROVIDING INFO: They're giving you their details.
YOUR RESPONSE SHOULD:
- Thank them for the info
- Tell them what happens next
- Be action-oriented`;
    }

    let userPrompt = "";

    switch (action) {
      case "generate_contextual_reply":
        // Build smart instructions based on what's been discussed
        let incomeReportInstruction = "";
        
        // If they're asking for something specific, don't push income reports
        if (isAskingForReferrals || isAskingQuestion) {
          incomeReportInstruction = "They asked a SPECIFIC question - ANSWER IT FIRST. Don't push income reports unless it's directly relevant.";
        } else if (isExistingOwner) {
          incomeReportInstruction = "This is an EXISTING PROPERTY OWNER - do NOT offer income analysis.";
        } else if (alreadyOfferedIncomeReport) {
          incomeReportInstruction = "We already offered the income analysis. Don't repeat.";
        } else if (isNewConversation && !isAskingForReferrals && !isAskingQuestion) {
          incomeReportInstruction = "Offer a FREE income analysis if it fits naturally.";
        } else {
          incomeReportInstruction = "Continue the natural conversation flow.";
        }

        userPrompt = `Generate a warm, professional SMS reply.

THEIR MESSAGE (RESPOND TO THIS):
"${currentMessage || "See conversation history"}"

${specificRequestContext}

RESPONSE RULES:
1. **ANSWER WHAT THEY ASKED** - If they asked for insurance referrals, say you'll get them. If they asked a question, answer it.
2. ${hasPhoneCall ? "We talked before - skip pleasantries" : "NO phone call yet - say 'Hi ${firstName}!' or 'Thanks for reaching out!' - NEVER 'great chatting'"}
3. Be specific - mention the exact thing they asked about
4. ${incomeReportInstruction}
5. Keep it SHORT - under 200 characters if possible
6. Sound human, not like AI
7. End with: "- Ingo @ PeachHaus Group"

Generate ONLY the reply text, nothing else.`;
        break;

      case "generate":
        userPrompt = `Generate a professional ${messageType === "sms" ? "SMS" : "email"} reply.
${currentMessage ? `Current draft: "${currentMessage}"` : "Create an appropriate response."}

Include scheduling link when suggesting a call: ${SCHEDULING_LINK}
Be warm, specific, and action-oriented. Make them feel valued.`;
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
        max_tokens: messageType === "sms" ? 150 : 500,
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
    let generatedMessage = data.choices?.[0]?.message?.content?.trim();

    if (!generatedMessage) {
      throw new Error("No message generated");
    }

    // Clean up the message - remove quotes if wrapped
    if (generatedMessage.startsWith('"') && generatedMessage.endsWith('"')) {
      generatedMessage = generatedMessage.slice(1, -1);
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
