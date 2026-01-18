import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Advanced conversational UX guidelines for human-like AI communication
const humanLikeGuidelines = `
CONVERSATIONAL INTELLIGENCE FRAMEWORK:

1. CONTEXT-FIRST RESPONSE DESIGN:
   - Their MOST RECENT message is the priority - address it directly
   - Thread history informs your response but doesn't replace addressing the current ask
   - Detect emotional undertones: frustration, excitement, confusion, urgency
   - Mirror their energy appropriately

2. CHANNEL-ADAPTIVE COMMUNICATION:
   FOR SMS:
   - 160 characters ideal, 280 absolute max
   - Action/answer first, context second
   - One clear next step per message
   - Casual punctuation - periods can feel abrupt, use line breaks
   - Emoji only if they use them (🏠 👍 ✓)
   - Sound like texting a trusted colleague
   
   FOR EMAIL:
   - "Hi [Name]," opening - skip "Dear" and "Hello"
   - First sentence = direct response
   - 2-3 short paragraphs max
   - Clear next step at the end
   - Natural close: Thanks, Best, Talk soon

3. BANNED PHRASES:
   ❌ "Just checking in" / "Just wanted to touch base"
   ❌ "I hope this finds you well"
   ❌ "Please don't hesitate to reach out"
   ❌ "At your earliest convenience"
   ❌ "Per our conversation"
   ❌ "Moving forward"
   ❌ "We apologize for any inconvenience"

4. NATURAL ALTERNATIVES:
   "I apologize for the delay" → "Sorry for the slow reply"
   "Please find attached" → "Here's"
   "Do not hesitate to contact me" → "Just let me know"
   "I would like to inform you" → "Wanted to let you know"
`;

// Scheduling link for discovery calls
const SCHEDULING_LINK = "https://propertycentral.lovable.app/book-discovery-call";

// Company knowledge base - clean, no auto-suggestions
const companyKnowledge = `
COMPANY: PeachHaus Group
BUSINESS: Mid-term rental property management in Atlanta, GA

CRITICAL INSTRUCTION - READ THIS:
- DO NOT automatically suggest scheduling calls
- DO NOT automatically offer income analysis
- The user has BUTTONS for these - they will add them manually
- Your job is to write clean, human, helpful responses
- Just answer what they asked, nothing more

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
1. LIKING: Use their name, acknowledge their specific situation
2. AUTHENTICITY: Sound like a real person, not a script
3. SPECIFICITY: Reference exact things they mentioned
4. CLARITY: They should know exactly what to do next

TONE GUIDELINES:
- Sound like a trusted advisor helping them
- Acknowledge emotions - if they sounded stressed or excited, reflect that
- Be specific - vague messages feel impersonal
- NO sales pitches, NO upselling, NO suggesting calls or income reports unless they asked
- Just be helpful and human

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
      includeCompanyKnowledge,
      userInstructions,
      senderUserId
    } = await req.json();

    console.log("AI Message Assistant request:", { action, contactName, messageType, leadId, ownerId, hasUserInstructions: !!userInstructions });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const MEM0_API_KEY = Deno.env.get("MEM0_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch sender's name from profiles table
    let senderName = "The PeachHaus Team";
    if (senderUserId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, email")
        .eq("id", senderUserId)
        .single();
      
      if (profile?.first_name) {
        senderName = profile.first_name;
      } else if (profile?.email) {
        const emailName = profile.email.split('@')[0];
        senderName = emailName.charAt(0).toUpperCase() + emailName.slice(1);
      }
    }
    console.log("Using sender name:", senderName);

    // ==============================
    // FETCH COMPANY KNOWLEDGE BASE
    // ==============================
    let knowledgeBaseContext = "";
    try {
      const contextType = messageType === "sms" ? "sms" : "email";
      const { data: knowledgeEntries } = await supabase
        .from("company_knowledge_base")
        .select("category, title, content, keywords, referral_link, priority")
        .eq("is_active", true)
        .or(`use_in_contexts.cs.{${contextType}},use_in_contexts.cs.{all}`)
        .order("priority", { ascending: false })
        .limit(15);

      if (knowledgeEntries && knowledgeEntries.length > 0) {
        knowledgeBaseContext = "\n\n=== COMPANY KNOWLEDGE BASE (USE THIS TO ANSWER QUESTIONS) ===\n";
        for (const entry of knowledgeEntries) {
          knowledgeBaseContext += `\n### ${entry.title} [${entry.category}]\n${entry.content}`;
          if (entry.referral_link) {
            knowledgeBaseContext += `\n📎 REFERRAL LINK: ${entry.referral_link}`;
          }
          knowledgeBaseContext += "\n";
        }
        knowledgeBaseContext += "\n=== END KNOWLEDGE BASE ===\n";
        console.log(`Loaded ${knowledgeEntries.length} knowledge entries for message assistant`);
      }
    } catch (kbError) {
      console.error("Error fetching knowledge base:", kbError);
    }

    // Fetch full conversation context if leadId or ownerId provided
    let fullContext = conversationContext || "";
    let commHistory = "";
    let leadData: any = null;
    let ownerData: any = null;
    let discoveryCallsData: any[] = [];
    let contactMemories = "";

    // Build contact identifier and fetch memories from Mem0
    let contactIdentifier = "";
    if (leadId) {
      contactIdentifier = `lead_${leadId}`;
    } else if (ownerId) {
      contactIdentifier = `owner_${ownerId}`;
    }

    // Fetch memories from Mem0 if available
    if (MEM0_API_KEY && contactIdentifier) {
      try {
        const mem0Response = await fetch(`https://api.mem0.ai/v1/memories/?user_id=${encodeURIComponent(contactIdentifier)}&limit=20`, {
          method: "GET",
          headers: {
            "Authorization": `Token ${MEM0_API_KEY}`,
            "Content-Type": "application/json",
          },
        });

        if (mem0Response.ok) {
          const mem0Data = await mem0Response.json();
          const memories = mem0Data.results || mem0Data || [];
          
          if (memories.length > 0) {
            contactMemories = "\n\nREMEMBERED CONTEXT ABOUT THIS CONTACT (from previous conversations):\n";
            const grouped: Record<string, string[]> = {};
            
            for (const m of memories) {
              const category = m.metadata?.category || "general";
              const memory = m.memory || m.text || m.content;
              if (memory) {
                if (!grouped[category]) grouped[category] = [];
                grouped[category].push(memory);
              }
            }
            
            const categoryLabels: Record<string, string> = {
              preference: "Their Preferences",
              fact: "Key Facts",
              concern: "Concerns They've Raised",
              request: "Outstanding Requests",
              personality: "Communication Style",
              general: "Notes",
            };

            for (const [category, items] of Object.entries(grouped)) {
              contactMemories += `\n${categoryLabels[category] || category}:\n`;
              for (const item of items) {
                contactMemories += `- ${item}\n`;
              }
            }
            
            contactMemories += "\nUSE THIS CONTEXT TO PERSONALIZE YOUR RESPONSE - but don't explicitly mention you 'remember' things.\n";
            console.log(`Loaded ${memories.length} memories for ${contactIdentifier}`);
          }
        }
      } catch (e) {
        console.error("Error fetching memories from Mem0:", e);
      }
    }
    
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

      // Fetch financial context for owner (multi-dimensional awareness)
      try {
        const finResponse = await fetch(`${supabaseUrl}/functions/v1/get-owner-financial-context`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ ownerId }),
        });

        if (finResponse.ok) {
          const finData = await finResponse.json();
          if (finData) {
            fullContext += '\n\nOWNER FINANCIAL STATUS:';
            
            if (finData.hasPaymentMethod) {
              fullContext += `\n✅ Card on file: ${finData.paymentMethodType || 'card'} ending in ${finData.paymentMethodLast4 || '****'}`;
              if (finData.cardExpiringSoon) {
                fullContext += ` (⚠️ EXPIRES SOON - proactively mention updating)`;
              }
            } else {
              fullContext += '\n⚠️ NO PAYMENT METHOD ON FILE - If they mention payments, guide them to set up a card';
            }
            
            if (finData.hasOutstandingCharges) {
              fullContext += `\n⚠️ Outstanding balance: $${finData.outstandingAmount?.toFixed(2) || '0.00'} (since ${finData.oldestUnpaidDate || 'N/A'})`;
              fullContext += '\n→ If they ask about payments, acknowledge the outstanding balance';
            } else {
              fullContext += '\n✅ No outstanding charges - account is current';
            }
            
            if (finData.pendingPayoutAmount && finData.pendingPayoutAmount > 0) {
              fullContext += `\n💰 Pending payout: $${finData.pendingPayoutAmount.toFixed(2)}`;
              if (finData.lastPayoutDate) {
                fullContext += ` (last payout: ${finData.lastPayoutDate})`;
              }
            }
            
            if (finData.lastPaymentDate) {
              fullContext += `\nLast payment received: $${finData.lastPaymentAmount || 0} on ${finData.lastPaymentDate}`;
            }
            
            fullContext += `\n📊 Financial health: ${finData.financialHealthScore || 'unknown'}`;
            
            console.log("Added financial context for owner:", { 
              hasPaymentMethod: finData.hasPaymentMethod,
              outstandingAmount: finData.outstandingAmount,
              healthScore: finData.financialHealthScore 
            });
          }
        }
      } catch (finError) {
        console.error("Error fetching financial context:", finError);
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

    // Build system prompt with optional company knowledge, memories, AND knowledge base
    let systemPrompt = `You are a professional property management assistant for PeachHaus Group helping compose ${messageType === "sms" ? "SMS messages" : "emails"}.

${humanLikeGuidelines}

${includeCompanyKnowledge ? companyKnowledge : ""}
${knowledgeBaseContext}
${contactMemories}

IMPORTANT: When answering questions, ALWAYS check the COMPANY KNOWLEDGE BASE above for accurate information and referral links. Include referral links naturally when recommending services.

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
8. Sign off as: "- ${senderName}"`;

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
        // If user provided instructions, incorporate them prominently
        const instructionsContext = userInstructions 
          ? `\n\nUSER'S INSTRUCTIONS FOR THIS REPLY (FOLLOW THESE):\n"${userInstructions}"\n\nIncorporate the above instructions naturally into your response.`
          : "";
        
        userPrompt = `Generate a warm, human ${messageType === "sms" ? "SMS" : "email"} reply.

THEIR MESSAGE (RESPOND TO THIS):
"${currentMessage || "See conversation history"}"

${specificRequestContext}
${instructionsContext}

CRITICAL RULES:
1. ${userInstructions ? "FOLLOW THE USER'S INSTRUCTIONS above - incorporate their key points naturally" : "**JUST ANSWER THEIR QUESTION** - Be helpful and direct"}
2. ${hasPhoneCall ? "We talked before - skip pleasantries, be direct" : "Say 'Hi ${firstName}!' or 'Hey!' - NEVER 'great chatting'"}
3. Be specific - mention the exact thing they asked about
4. **DO NOT** suggest scheduling a call (unless user instructions say to)
5. **DO NOT** offer income analysis or reports (unless user instructions say to)
6. **DO NOT** pitch any services
7. Just be helpful, human, and to-the-point
8. Keep it SHORT - ${messageType === "sms" ? "under 160 characters ideal" : "2-3 sentences"}
9. Sound like a real person texting, not a business
10. End with: "- Ingo"

Generate ONLY the reply text, nothing else.`;
        break;

      case "generate":
        userPrompt = `Generate a professional ${messageType === "sms" ? "SMS" : "email"} reply.
${currentMessage ? `Current draft: "${currentMessage}"` : "Create an appropriate response."}

Be warm, specific, and action-oriented. DO NOT suggest calls or income analysis - just respond naturally.`;
        break;

      case "improve":
        userPrompt = `Transform this voice-dictated message into a polished, professional ${messageType === "sms" ? "SMS" : "email"}.

VOICE DICTATION (may be rough/informal):
"${currentMessage}"

CRITICAL TRANSFORMATION RULES:
1. **CONVERT 3RD PERSON TO 1ST PERSON** - If they say "tell him I need..." → write "I need..."
   - "let her know that..." → "Just wanted to let you know that..."
   - "ask them if..." → "Could you..."
   - "tell him we can..." → "We can..."
   - "say I'm available..." → "I'm available..."
   - "respond saying..." → [just the response directly]

2. **FIX SPEECH PATTERNS** - Remove filler words (um, uh, like, you know, basically)
3. **WRITE IN FIRST PERSON** - The message is FROM the user TO the recipient
4. **MAINTAIN THE INTENT** - Keep the core message and meaning
5. **MATCH USER'S TONE** - If casual, stay casual. If professional, stay professional.
6. **ADDRESS RECIPIENT NATURALLY** - Start with "Hi ${firstName}!" or just dive into the message
7. ${messageType === "sms" ? "Keep under 300 characters" : "Keep concise - 2-3 short paragraphs max"}

OUTPUT: The polished message ONLY, written in first person as if from the sender to "${firstName || "the recipient"}". No quotes, no explanation.`;
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

    // Try primary model first (Gemini 3 Pro for better context understanding), then fallback
    const models = ["google/gemini-3-pro-preview", "google/gemini-3-flash-preview", "google/gemini-2.5-flash"];
    let generatedMessage = "";
    let lastError = "";

    for (const model of models) {
      try {
        console.log(`[AI Message Assistant] Trying model: ${model}`);
        console.log(`[AI Message Assistant] User prompt preview: ${userPrompt.substring(0, 200)}...`);
        
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            max_tokens: messageType === "sms" ? 200 : 600,
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
          console.error(`[AI Message Assistant] ${model} error:`, errorText);
          lastError = errorText;
          continue; // Try next model
        }

        const data = await response.json();
        console.log(`[AI Message Assistant] Raw AI response:`, JSON.stringify(data).substring(0, 500));
        
        generatedMessage = data.choices?.[0]?.message?.content?.trim();
        
        if (generatedMessage) {
          console.log(`[AI Message Assistant] Success with ${model}`);
          break; // Success, exit loop
        } else {
          console.warn(`[AI Message Assistant] ${model} returned empty content`);
          lastError = "Empty response from AI";
        }
      } catch (modelError) {
        console.error(`[AI Message Assistant] ${model} exception:`, modelError);
        lastError = modelError instanceof Error ? modelError.message : "Unknown error";
      }
    }

    // If all models failed, generate a fallback response
    if (!generatedMessage) {
      console.warn(`[AI Message Assistant] All models failed, generating fallback response. Last error: ${lastError}`);
      
      // Generate a context-aware fallback instead of throwing an error
      if (messageType === "sms") {
        generatedMessage = `Hi ${firstName}! Thanks for reaching out. How can I help you today?`;
      } else {
        generatedMessage = `Hi ${firstName},\n\nThank you for your message. I wanted to follow up and see how I can assist you.\n\nPlease let me know if you have any questions.\n\nBest regards`;
      }
    }

    // Clean up the message - remove quotes if wrapped
    if (generatedMessage.startsWith('"') && generatedMessage.endsWith('"')) {
      generatedMessage = generatedMessage.slice(1, -1);
    }

    console.log("[AI Message Assistant] Final generated message:", generatedMessage.substring(0, 100) + "...");

    return new Response(
      JSON.stringify({ message: generatedMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[AI Message Assistant] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // Even on error, return a usable fallback message (use generic since messageType may not be in scope)
    const fallbackMessage = "Hi! Thanks for reaching out. How can I help?";
    
    return new Response(
      JSON.stringify({ 
        message: fallbackMessage, 
        warning: `AI generation failed: ${errorMessage}. Using fallback message.` 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
