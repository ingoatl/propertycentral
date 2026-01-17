import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Advanced conversational UX guidelines for human-like email communication
const humanLikeGuidelines = `
PROFESSIONAL COMMUNICATION ASSISTANT - STRICT RULES:

RULE 1: CONTEXT FIRST - ALWAYS
- Read and directly respond to THEIR MOST RECENT MESSAGE - this is your primary focus
- Consider the FULL email thread history to avoid repeating information or making irrelevant suggestions
- Never reference things they didn't mention (calls, attachments, promises, meetings)
- If they mentioned a specific topic (insurance, HOA docs, contracts), address THAT specifically

RULE 2: LEAD STAGE AWARENESS - CRITICAL
- If client is a LEAD who has NOT signed a contract:
  → You MAY suggest a call IF it's relevant to their message
  → Be helpful and informative, not pushy
- If client is reviewing documents, insurance, or contracts:
  → DO NOT push a call unless THEY request it
  → Focus on answering their questions and giving them time
- Once a contract is SIGNED (owner status):
  → NEVER suggest sales-style calls
  → Be a helpful partner, not a salesperson

RULE 3: NO ASSUMPTIONS - EVER
- NEVER claim something was "promised," "attached," "discussed," or "sent" unless the email thread proves it
- NEVER reference a call that didn't happen
- NEVER say "As promised" or "Great speaking with you earlier" unless there's evidence of that
- If you don't know something, DON'T make it up

RULE 4: TONE & STYLE
- Sound like a real, attentive human who actually read their email
- Professional, calm, and helpful - NEVER salesy
- Match the client's tone and level of formality
- Keep responses concise but thoughtful

RULE 5: ACTION-ORIENTED BUT RESPECTFUL
- Acknowledge what they ACTUALLY said (be specific)
- Address their ACTUAL concerns clearly
- Offer the next logical step WITHOUT pressure
- If they need time (to review insurance, documents), give them time gracefully

BANNED PHRASES (sound robotic/corporate):
❌ "Just checking in" / "Just wanted to touch base"
❌ "I hope this email finds you well"
❌ "Please don't hesitate to reach out"
❌ "At your earliest convenience"
❌ "Per our conversation" / "As per your request"
❌ "As promised" (unless you actually promised something in the thread)
❌ "Great speaking with you earlier" (unless you actually spoke)
❌ "I've attached" (unless you're actually attaching something)
❌ "We apologize for any inconvenience"
❌ "Thank you for your patience"

NATURAL ALTERNATIVES:
Instead of → Use:
"I apologize for the delay" → "Sorry for the slow reply"
"Please find attached" → Only say this if actually attaching
"Do not hesitate to contact me" → "Just let me know"

RESPONSE STRUCTURE BASED ON THEIR EMAIL:
- They need time to review something → Respect that, don't rush them
- They're looking into insurance/documents → Offer to help but don't push
- They asked a question → Answer it directly
- They're sending something → Thank them, confirm you'll watch for it
`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contactEmail, contactName, currentSubject, incomingEmailBody, userInstructions, senderUserId } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

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
        // Extract name from email if no first_name
        const emailName = profile.email.split('@')[0];
        senderName = emailName.charAt(0).toUpperCase() + emailName.slice(1);
      }
    }
    console.log("Using sender name:", senderName);

    // Fetch user's tone profile for personalized writing style
    let toneProfile: any = null;
    if (senderUserId) {
      const { data: profile } = await supabase
        .from("user_tone_profiles")
        .select("*")
        .eq("user_id", senderUserId)
        .maybeSingle();
      
      if (profile) {
        toneProfile = profile;
        console.log("Found tone profile:", {
          formality: profile.formality_level,
          emoji: profile.emoji_usage,
          analyzed_emails: profile.analyzed_email_count
        });
      }
    }

    // Extract specific questions from the incoming email
    let extractedQuestions: string[] = [];
    if (incomingEmailBody) {
      // Find all sentences ending with ?
      const questionMatches = incomingEmailBody.match(/[^.!?\n]*\?/g);
      if (questionMatches) {
        extractedQuestions = questionMatches.map((q: string) => q.trim()).filter((q: string) => q.length > 5);
        console.log("Extracted questions from email:", extractedQuestions);
      }
    }

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
              content: `You are an email analyst. Analyze the email and determine its intent.
              
CRITICAL RULES FOR INTENT DETECTION:
- If the email contains ANY question mark (?) or asks for information/recommendations/advice, intent MUST be "question"
- Examples of questions: "Do you recommend...", "What do you suggest...", "Can you tell me...", "How does...", "Which...", "What about..."
- Only use "general" if there's truly no question or specific request
- Be accurate with unsubscribe requests, complaints, and declines` 
            },
            { role: "user", content: `Analyze this email. Look carefully for any questions:\n\n${incomingEmailBody.substring(0, 1500)}` }
          ],
          tools: [{
            type: "function",
            function: {
              name: "analyze_email",
              description: "Analyze the email's sentiment, intent, and urgency. If the email asks ANY question, set intent to 'question'.",
              parameters: {
                type: "object",
                properties: {
                  has_question: {
                    type: "boolean",
                    description: "TRUE if the email contains any question mark or asks for information, recommendations, or advice"
                  },
                  sentiment: { 
                    type: "string", 
                    enum: ["positive", "negative", "neutral", "frustrated", "grateful", "confused"],
                    description: "The emotional tone of the email"
                  },
                  intent: { 
                    type: "string", 
                    enum: ["unsubscribe", "complaint", "question", "inquiry", "schedule_meeting", "pricing_request", "decline", "follow_up", "general", "thank_you"],
                    description: "The primary purpose. MUST be 'question' if has_question is true"
                  },
                  urgency: { 
                    type: "string", 
                    enum: ["high", "medium", "low"],
                    description: "How urgent the response needs to be"
                  },
                  extracted_questions: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of specific questions asked in the email"
                  }
                },
                required: ["has_question", "sentiment", "intent", "urgency"]
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
            // Force intent to "question" if has_question is true
            if (analysis.has_question) {
              intent = "question";
            } else {
              intent = analysis.intent || "general";
            }
            urgency = analysis.urgency || "medium";
            
            // Merge AI-extracted questions with regex-extracted ones
            if (analysis.extracted_questions && Array.isArray(analysis.extracted_questions)) {
              for (const q of analysis.extracted_questions) {
                if (q && !extractedQuestions.includes(q)) {
                  extractedQuestions.push(q);
                }
              }
            }
            
            console.log("Email analysis:", { sentiment, intent, urgency, has_question: analysis.has_question, extractedQuestions });
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
    let financialContext = '';
    
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

      // Fetch financial context for owner
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        
        const finResponse = await fetch(`${supabaseUrl}/functions/v1/get-owner-financial-context`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ ownerId: ownerData.id }),
        });

        if (finResponse.ok) {
          const finData = await finResponse.json();
          if (finData) {
            financialContext = '\n\nOWNER FINANCIAL STATUS:';
            
            if (finData.hasPaymentMethod) {
              financialContext += `\n✅ Card on file: ${finData.paymentMethodType || 'card'} ending in ${finData.paymentMethodLast4 || '****'}`;
              if (finData.cardExpiringSoon) {
                financialContext += ` (⚠️ EXPIRES SOON)`;
              }
            } else {
              financialContext += '\n⚠️ NO PAYMENT METHOD ON FILE - If they mention payments, guide them to set up a card';
            }
            
            if (finData.hasOutstandingCharges) {
              financialContext += `\n⚠️ Outstanding balance: $${finData.outstandingAmount?.toFixed(2) || '0.00'} (since ${finData.oldestUnpaidDate || 'N/A'})`;
              financialContext += '\n→ If they ask about payments, acknowledge the outstanding balance';
            } else {
              financialContext += '\n✅ No outstanding charges - account is current';
            }
            
            if (finData.pendingPayoutAmount && finData.pendingPayoutAmount > 0) {
              financialContext += `\n💰 Pending payout: $${finData.pendingPayoutAmount.toFixed(2)}`;
            }
            
            if (finData.lastPaymentDate) {
              financialContext += `\nLast payment: $${finData.lastPaymentAmount || 0} on ${finData.lastPaymentDate}`;
            }
            
            financialContext += `\n📊 Financial health: ${finData.financialHealthScore || 'unknown'}`;
          }
        }
      } catch (finError) {
        console.error("Error fetching financial context:", finError);
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
    } else {
      // No owner or lead data - this is an external contact or new inquiry
      propertyContext = `\n\nCONTACT STATUS: External contact / New inquiry
This person is not yet in our system as a lead or owner. Respond professionally and helpfully.
If they're asking about property management services, be informative and welcoming.`;
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
        
      case 'question':
        intentGuidance = `
INTENT DETECTED: QUESTION / INQUIRY
- YOUR #1 PRIORITY: Answer their specific question(s) in your FIRST paragraph
- Be SPECIFIC and HELPFUL - give real answers, not vague responses
- Common topic guidance:
  * INSURANCE: Recommend Proper Insurance (properinsurance.com) for STR/MTR, or CBIZ for comprehensive landlord policies
  * HOA DOCS: Explain what documents you need (CC&Rs, bylaws, rental restrictions) and why
  * PRICING: Our fee is typically 20-25% of collected rent for full-service management
  * CONTRACTS: Be direct about terms, timeline, or any questions they have
- After answering their question, you can add brief context if needed
- Only suggest a call if it would genuinely help AND they haven't signed a contract`;
        break;
        
      default:
        intentGuidance = '';
    }

    // Determine if they've signed a contract
    const hasSignedContract = isOwner || (leadData?.status === 'signed' || leadData?.status === 'active' || leadData?.status === 'converted');
    
    // Build tone instructions if tone profile exists
    let toneInstructions = "";
    if (toneProfile) {
      const greetings = Array.isArray(toneProfile.common_greetings) ? toneProfile.common_greetings.join(", ") : "";
      const closings = Array.isArray(toneProfile.common_closings) ? toneProfile.common_closings.join(", ") : "";
      const signaturePhrases = Array.isArray(toneProfile.signature_phrases) ? toneProfile.signature_phrases.join(", ") : "";
      
      toneInstructions = `
WRITE IN THIS EXACT VOICE (learned from the user's past messages):
- FORMALITY: ${toneProfile.formality_level || "professional"}
- PUNCTUATION STYLE: ${toneProfile.punctuation_style || "standard"}
- EMOJI USAGE: ${toneProfile.emoji_usage || "none"}
- AVG SENTENCE LENGTH: ${toneProfile.avg_sentence_length || 15} words
${greetings ? `- USE THESE GREETINGS: ${greetings}` : ""}
${closings ? `- USE THESE CLOSINGS: ${closings}` : ""}
${signaturePhrases ? `- SIGNATURE PHRASES TO USE: ${signaturePhrases}` : ""}

CRITICAL: Match the writing style above exactly. This is how ${senderName} actually writes.
`;
    }

    // Build question-answering priority section with topic knowledge
    let questionAnsweringSection = "";
    if (extractedQuestions.length > 0) {
      // Detect topics from questions to provide relevant knowledge
      const questionsLower = extractedQuestions.map(q => q.toLowerCase()).join(" ");
      let topicKnowledge = "";
      
      if (questionsLower.includes("insurance")) {
        topicKnowledge = `
INSURANCE KNOWLEDGE (use this to answer):
- For medium-term rental insurance, we recommend:
  * Proper Insurance (properinsurance.com) - specializes in STR/MTR coverage, excellent for furnished rentals
  * CBIZ - good for comprehensive landlord policies
  * Some owners add a landlord endorsement to their existing homeowner's insurance
- Each property is different, so we'd want to understand their specific situation
- We can help coordinate with their insurance provider if needed`;
      } else if (questionsLower.includes("hoa") || questionsLower.includes("documents")) {
        topicKnowledge = `
HOA/DOCUMENTS KNOWLEDGE (use this to answer):
- HOA documents we typically need: CC&Rs, bylaws, and any rental restrictions
- We review these to ensure the property qualifies for our program
- Some HOAs have minimum lease term requirements we need to work around`;
      } else if (questionsLower.includes("price") || questionsLower.includes("cost") || questionsLower.includes("fee")) {
        topicKnowledge = `
PRICING KNOWLEDGE (use this to answer):
- Our management fee is typically 20-25% of collected rent
- This covers full-service management: guest communication, cleaning coordination, maintenance
- No hidden fees - we're transparent about costs`;
      }
      
      questionAnsweringSection = `
⚠️ CRITICAL - ANSWER THESE QUESTIONS FIRST (this is your #1 job):
${extractedQuestions.map((q, i) => `${i + 1}. "${q}"`).join("\n")}
${topicKnowledge}

RULES FOR ANSWERING:
- Your FIRST paragraph MUST directly answer the question(s) above
- Be SPECIFIC - give real recommendations, real answers, real information
- DO NOT give a generic "we offer property management services" pitch
- If they asked "Do you recommend X?" → Give an actual recommendation or explain your approach
- Answer the question FIRST, then you can add brief context if needed
`;
      console.log("[Suggest Email Reply] Question section built with topic knowledge:", topicKnowledge ? "Yes" : "No");
    }

    const systemPrompt = `You are writing an email reply for PeachHaus Group, a premium property management company in Atlanta. Your goal is to sound like a real, thoughtful human - not a corporate AI.

${humanLikeGuidelines}
${toneInstructions}

CONTEXT:
- Sender Sentiment: ${sentiment}
- Email Intent: ${intent}
- Urgency: ${urgency}
- Contract Status: ${hasSignedContract ? "SIGNED (Owner/Client)" : "NOT SIGNED (Lead)"}
${isOwner ? `- This is a VIP PROPERTY OWNER - be a helpful partner, not salesy` : `- This is a LEAD - be welcoming but respect their pace`}
${intentGuidance}
${actionContext}
${questionAnsweringSection}

CRITICAL RULES:
1. READ THEIR EMAIL CAREFULLY - respond to what they ACTUALLY said
2. ${extractedQuestions.length > 0 ? "ANSWER THEIR SPECIFIC QUESTIONS FIRST - this is your #1 priority" : "Respond to their main point directly"}
3. If they mentioned needing time (for insurance, document review, etc.) - RESPECT that, don't push
4. If they're sending something (HOA doc) - acknowledge you'll look for it
5. NEVER claim something was "promised," "attached," or "discussed" unless the email thread proves it
6. ${hasSignedContract ? "DO NOT suggest sales calls - they're already a client" : "Only suggest a call if it's genuinely helpful to their situation and they haven't signed yet"}

STRUCTURE:
- Start with "Hi [FirstName]," 
- ${extractedQuestions.length > 0 ? "First paragraph = DIRECT answer to their question(s)" : "First sentence = direct response to what they asked/said"}
- ${intent === 'unsubscribe' || intent === 'decline' || intent === 'thank_you' ? '2-3 sentences MAX' : '2-3 short paragraphs MAX'}
- End with an appropriate response to their situation
- Sign off naturally with: "Best,\n${senderName}"

YOUR NAME FOR SIGNING: ${senderName}`;

    // Add user instructions context if provided
    const instructionsContext = userInstructions 
      ? `\n\nUSER'S INSTRUCTIONS FOR THIS REPLY (FOLLOW THESE):\n"${userInstructions}"\n\nIncorporate the above instructions naturally into your response.`
      : "";

    const userPrompt = `Contact: ${contactName} (${contactEmail})
${currentSubject ? `Subject: ${currentSubject}` : ''}
${propertyContext}

${incomingEmailBody ? `EMAIL THEY SENT (READ THIS CAREFULLY):
${incomingEmailBody.substring(0, 2000)}` : ''}

${historyContext ? `PREVIOUS EMAIL HISTORY:\n${historyContext}` : 'No previous email history.'}
${instructionsContext}

CRITICAL: ${userInstructions ? 'FOLLOW THE USER\'S INSTRUCTIONS above - incorporate their key points naturally.' : 'Your reply must directly address what they said in their email above.'} If they mentioned:
- Needing time to look into insurance → Thank them, tell them to take their time
- Looking for a document to forward → Acknowledge you'll watch for it
- Visiting your city → Mention it if appropriate

Draft a reply that shows you actually read their email. Start with "Hi ${contactName?.split(' ')[0] || 'there'}," and end with "Best,\\n${senderName}"`;

    console.log("Generating AI email suggestion for:", contactEmail, "isOwner:", isOwner, "intent:", intent, "sentiment:", sentiment, "senderName:", senderName);

    // Try multiple models with fallback
    // Use Pro model for better reasoning and context understanding
    const models = ["google/gemini-3-flash-preview", "google/gemini-2.5-flash", "google/gemini-2.5-pro"];
    let suggestedReply = "";
    let lastError = "";

    for (const model of models) {
      try {
        console.log(`[Suggest Email Reply] Trying model: ${model}`);
        
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
            max_tokens: intent === 'unsubscribe' || intent === 'decline' || intent === 'thank_you' ? 200 : 500,
            temperature: 0.7,
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
          console.error(`[Suggest Email Reply] ${model} error:`, response.status, errorText);
          lastError = errorText;
          continue;
        }

        const data = await response.json();
        suggestedReply = data.choices?.[0]?.message?.content?.trim() || "";
        
        if (suggestedReply) {
          console.log(`[Suggest Email Reply] Success with ${model}:`, suggestedReply.substring(0, 100));
          break;
        } else {
          console.warn(`[Suggest Email Reply] ${model} returned empty content`);
          lastError = "Empty response from AI";
        }
      } catch (modelError) {
        console.error(`[Suggest Email Reply] ${model} exception:`, modelError);
        lastError = modelError instanceof Error ? modelError.message : "Unknown error";
      }
    }

    // If all models failed, generate a fallback response
    if (!suggestedReply) {
      console.warn(`[Suggest Email Reply] All models failed. Last error: ${lastError}. Generating fallback.`);
      const firstName = contactName?.split(' ')[0] || 'there';
      suggestedReply = `Hi ${firstName},

Thank you for reaching out. I wanted to follow up on your message and see how I can help.

Please let me know if you have any questions or if there's anything else I can assist with.

Best,
${senderName}`;
    }

    console.log("Generated suggestion successfully, isOwner:", isOwner, "intent:", intent);

    // Generate a contextual subject line if needed (not a reply)
    let suggestedSubject = "";
    if (!currentSubject && suggestedReply) {
      try {
        const subjectResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
                content: "Generate a short, professional email subject line (max 50 chars). Return ONLY the subject line, no quotes or explanation." 
              },
              { 
                role: "user", 
                content: `Generate a subject for this email:\n\n${suggestedReply.substring(0, 500)}` 
              },
            ],
            max_tokens: 50,
            temperature: 0.5,
          }),
        });

        if (subjectResponse.ok) {
          const subjectData = await subjectResponse.json();
          suggestedSubject = subjectData.choices?.[0]?.message?.content?.trim() || "";
          console.log("Generated subject:", suggestedSubject);
        }
      } catch (subjectError) {
        console.error("Failed to generate subject:", subjectError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        suggestion: suggestedReply,
        suggestedSubject: suggestedSubject || undefined,
        emailHistory: emailHistory.length,
        isOwner,
        analysis: { sentiment, intent, urgency },
        hasQuestions: extractedQuestions.length > 0,
        questions: extractedQuestions,
        hasToneProfile: !!toneProfile
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
