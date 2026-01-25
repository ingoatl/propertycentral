import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Scheduling link for discovery calls
const SCHEDULING_LINK = "https://propertycentral.lovable.app/book-discovery-call";

// ==========================================
// PEACHHAUS COMPANY KNOWLEDGE BASE
// ==========================================
const companyKnowledge = `
COMPANY: PeachHaus Group
WEBSITE: www.peachhausgroup.com
BUSINESS: Premium mid-term rental property management in Atlanta, Georgia

DISCOVERY CALL BOOKING LINK: ${SCHEDULING_LINK}
- Use this link when scheduling calls with leads or owners
- Present it as a helpful next step, not pushy sales

KEY SERVICES:
1. Mid-Term Rental Management (30-365 day stays)
   - Full-service property management
   - Guest screening and placement
   - 24/7 guest support
   - Professional cleaning coordination
   - Maintenance management

2. Owner Reports & Statements
   - Monthly income/expense reports sent to owners
   - Year-to-date performance summaries
   - Detailed transaction breakdowns
   - Reports are delivered via email as PDFs

3. Property Onboarding
   - Professional photography
   - Listing optimization
   - Pricing strategy
   - Market analysis

CONTACT INFO:
- Email: info@peachhausgroup.com
- Website: www.peachhausgroup.com
- Phone: (404) 800-5932
- Office hours: Monday-Friday 9am-6pm EST

BRAND VOICE:
- Professional yet warm
- Knowledgeable and trustworthy
- Atlanta local expertise
- Solutions-focused
- Relationship-driven
- NOT pushy or sales-y
`;

// ==========================================
// INTELLIGENT INTENT DETECTION PATTERNS
// ==========================================
interface DetectedIntent {
  // Meeting/Call Related
  wantsLiveDiscussion: boolean;
  wantsToScheduleCall: boolean;
  wantsCallback: boolean;
  mentionsCall: boolean;
  
  // Report/Document Related
  asksAboutReports: boolean;
  asksAboutStatements: boolean;
  wantsToReviewNumbers: boolean;
  mentionsIncome: boolean;
  
  // Question Types
  isQuestion: boolean;
  askingHow: boolean;
  askingWhen: boolean;
  askingWhy: boolean;
  
  // Emotional/Urgency
  isUrgent: boolean;
  isFrustrated: boolean;
  isThankful: boolean;
  isConfused: boolean;
  
  // Owner Financial
  isPaymentInquiry: boolean;
  isPaymentConfirmation: boolean;
  isPaymentIssue: boolean;
  isPayoutInquiry: boolean;
  isCardUpdate: boolean;
  
  // Action Requests
  wantsUpdate: boolean;
  wantsConfirmation: boolean;
  needsHelp: boolean;
  
  // Summary
  primaryIntent: string;
  suggestedAction: string;
}

function detectIntent(message: string): DetectedIntent {
  const msgLower = message.toLowerCase();
  const msgClean = msgLower.replace(/[^\w\s]/g, ' ');
  
  // Meeting/Call Related Patterns
  const wantsLiveDiscussion = /\b(discuss live|talk live|speak live|meet live|live discussion|live chat|discuss this live|want to discuss|like to discuss|discuss.*live)\b/i.test(msgLower) ||
    /\b(yes.*(discuss|talk|call|chat|meet|speak))\b/i.test(msgLower) ||
    /\b(would like to (discuss|talk|chat|speak|meet))\b/i.test(msgLower) ||
    /\b(can we (discuss|talk|chat|speak|meet|hop on))\b/i.test(msgLower);
  
  const wantsToScheduleCall = /\b(schedule.*(call|meeting|chat)|set up.*(call|meeting|time)|book.*(call|time|meeting)|calendar invite|when.*available|what time works)\b/i.test(msgLower);
  
  const wantsCallback = /\b(call me|call back|give.*(call|ring)|reach me at|phone me)\b/i.test(msgLower);
  
  const mentionsCall = /\b(call|phone|meeting|zoom|video|chat live)\b/i.test(msgLower);
  
  // Report/Document Related
  const asksAboutReports = /\b(report|reports|income report|expense report|monthly report|statement|statements)\b/i.test(msgLower);
  const asksAboutStatements = /\b(statement|owner statement|monthly statement|income statement)\b/i.test(msgLower);
  const wantsToReviewNumbers = /\b(review.*(numbers|report|income|expenses)|go.*(over|through).*(numbers|report|income)|walk.*through|understand.*(numbers|report|income))\b/i.test(msgLower);
  const mentionsIncome = /\b(income|revenue|earnings|rent|rental income|profit|expenses)\b/i.test(msgLower);
  
  // Question Detection
  const isQuestion = msgLower.includes("?") || /^(how|what|when|where|why|who|can|could|would|is|are|do|does|did|will|should)\b/.test(msgClean);
  const askingHow = /\b(how (do|does|can|should|would|to))\b/i.test(msgLower);
  const askingWhen = /\b(when (will|can|do|does|should|is|are))\b/i.test(msgLower);
  const askingWhy = /\b(why (is|are|do|does|did|would|should|was|were))\b/i.test(msgLower);
  
  // Emotional/Urgency Detection
  const isUrgent = /\b(urgent|urgently|asap|immediately|emergency|right away|critical|time.sensitive)\b/i.test(msgLower);
  const isFrustrated = /\b(still waiting|no response|frustrated|disappointed|upset|unacceptable|haven't heard|what's going on|why haven't)\b/i.test(msgLower);
  const isThankful = /\b(thank|thanks|appreciate|grateful|great job|awesome|wonderful|excellent)\b/i.test(msgLower);
  const isConfused = /\b(confused|don't understand|not sure|unclear|explain|what does|what is this)\b/i.test(msgLower);
  
  // Owner Financial Intent
  const isPaymentInquiry = /\b(payment|charge|bill|invoice|fee|cost|how much|owe|balance|amount due)\b/i.test(msgLower);
  const isPaymentConfirmation = /\b(paid|sent payment|made payment|transferred|completed payment|just paid)\b/i.test(msgLower);
  const isPaymentIssue = /\b(declined|failed|error|wrong charge|overcharge|dispute|incorrect|issue with payment)\b/i.test(msgLower);
  const isPayoutInquiry = /\b(payout|distribution|my money|deposit|when.*paid|owner distribution|my payment)\b/i.test(msgLower);
  const isCardUpdate = /\b(update.*card|new card|change.*payment|expired.*card|update payment|change card)\b/i.test(msgLower);
  
  // Action Requests
  const wantsUpdate = /\b(update|status|progress|where are we|what's happening|any news|any update)\b/i.test(msgLower);
  const wantsConfirmation = /\b(confirm|confirmation|verify|make sure|can you confirm|is this right)\b/i.test(msgLower);
  const needsHelp = /\b(help|assist|support|need help|can you help|having trouble|problem)\b/i.test(msgLower);
  
  // Determine Primary Intent
  let primaryIntent = "general_response";
  let suggestedAction = "reply_normally";
  
  if (wantsLiveDiscussion || wantsToScheduleCall || wantsCallback) {
    primaryIntent = "wants_meeting";
    suggestedAction = "send_calendar_link";
  } else if (wantsToReviewNumbers && (asksAboutReports || mentionsIncome)) {
    primaryIntent = "wants_to_review_reports";
    suggestedAction = "offer_walkthrough_call";
  } else if (asksAboutReports || asksAboutStatements) {
    primaryIntent = "asking_about_reports";
    suggestedAction = "explain_reports_offer_call";
  } else if (isPaymentInquiry || isPaymentIssue) {
    primaryIntent = "payment_question";
    suggestedAction = "check_payment_status";
  } else if (isPayoutInquiry) {
    primaryIntent = "payout_question";
    suggestedAction = "check_payout_status";
  } else if (isCardUpdate) {
    primaryIntent = "card_update_request";
    suggestedAction = "send_payment_update_link";
  } else if (isUrgent) {
    primaryIntent = "urgent_matter";
    suggestedAction = "prioritize_response";
  } else if (isFrustrated) {
    primaryIntent = "frustrated_customer";
    suggestedAction = "empathize_then_solve";
  } else if (isQuestion) {
    primaryIntent = "asking_question";
    suggestedAction = "answer_directly";
  } else if (isThankful) {
    primaryIntent = "expressing_gratitude";
    suggestedAction = "acknowledge_warmly";
  }
  
  return {
    wantsLiveDiscussion,
    wantsToScheduleCall,
    wantsCallback,
    mentionsCall,
    asksAboutReports,
    asksAboutStatements,
    wantsToReviewNumbers,
    mentionsIncome,
    isQuestion,
    askingHow,
    askingWhen,
    askingWhy,
    isUrgent,
    isFrustrated,
    isThankful,
    isConfused,
    isPaymentInquiry,
    isPaymentConfirmation,
    isPaymentIssue,
    isPayoutInquiry,
    isCardUpdate,
    wantsUpdate,
    wantsConfirmation,
    needsHelp,
    primaryIntent,
    suggestedAction,
  };
}

// ==========================================
// INTELLIGENT RESPONSE GUIDELINES
// ==========================================
const humanLikeGuidelines = `
PROFESSIONAL COMMUNICATION ASSISTANT - INTELLIGENT RESPONSE SYSTEM

CRITICAL RULE: ACTUALLY READ AND UNDERSTAND THEIR MESSAGE
- Your #1 job is to respond to what they ACTUALLY said
- If they say "Yes I would like to discuss live" → OFFER TO SCHEDULE A CALL
- If they ask about reports → EXPLAIN and offer to walk through them
- NEVER give generic responses that ignore their specific request

RULE 1: INTENT-BASED RESPONSE MAPPING
When they want to talk/meet/discuss:
→ "Great! Here's my calendar link to book a time that works: ${SCHEDULING_LINK}"
→ Or: "Happy to chat! When works best for you? I can also send a calendar invite."

When they ask about reports/income/statements:
→ Acknowledge the reports are ready/sent
→ Offer to walk through them together: "Want to hop on a quick call to go through them?"

When they confirm something positive (yes, sounds good, looks great):
→ Move to the logical next step
→ Be proactive about what comes next

When they have questions:
→ Answer the question DIRECTLY first
→ Then offer additional help if needed

RULE 2: CONTEXT AWARENESS
- Read the FULL conversation history
- If we recently sent reports → acknowledge that context
- If there's been back-and-forth about a topic → continue that thread
- Never start fresh when there's existing context

RULE 3: LEAD vs OWNER AWARENESS
LEADS (not yet signed):
- Can suggest discovery calls when relevant
- Offer free income analysis
- Be helpful and informative

OWNERS (already signed):
- NEVER suggest sales calls
- Focus on service: reports, payouts, maintenance, etc.
- Proactively offer to explain or walk through things

RULE 4: TONE & STYLE
- Sound like a real human who actually read their message
- Use their name
- Be warm, efficient, direct
- Match their energy level

RULE 5: CHANNEL AWARENESS
- SMS: Short, direct, 160 chars ideal, 280 max
- Email: 2-3 short paragraphs max

RULE 6: FINANCIAL CONTEXT (FOR OWNERS)
- If they have outstanding balance → mention it when relevant
- If no payment method → guide them to set one up
- If asking about payouts → give specific amounts/dates
- NEVER guess numbers - use only what you're given

RULE 7: COMMON SENSE ACTIONS
When someone says they want to discuss something:
→ SCHEDULE A CALL (send calendar link or offer times)

When reports are mentioned and they want to review:
→ OFFER A WALKTHROUGH CALL

When they're confused:
→ EXPLAIN CLEARLY then offer to discuss live

When something is urgent:
→ ACKNOWLEDGE URGENCY and respond promptly

BANNED PHRASES:
❌ "Just checking in"
❌ "I hope this finds you well"
❌ "Please don't hesitate to reach out"
❌ "At your earliest convenience"
❌ "Per our conversation"
❌ Generic platitudes that ignore their specific message

REQUIRED: ALWAYS SIGN AS "- Ingo"
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { communicationId, leadId, ownerId, contactPhone, contactEmail, messageType } = await req.json();

    console.log("Generate draft reply request:", { communicationId, leadId, ownerId, messageType });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const MEM0_API_KEY = Deno.env.get("MEM0_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ==============================
    // FETCH COMPANY KNOWLEDGE BASE
    // ==============================
    let knowledgeBaseContext = "";
    try {
      const { data: knowledgeEntries } = await supabase
        .from("company_knowledge_base")
        .select("category, title, content, keywords, referral_link, priority")
        .eq("is_active", true)
        .or("use_in_contexts.cs.{email},use_in_contexts.cs.{all}")
        .order("priority", { ascending: false })
        .limit(15);

      if (knowledgeEntries && knowledgeEntries.length > 0) {
        knowledgeBaseContext = "\n\n=== COMPANY KNOWLEDGE BASE (USE THIS FOR ACCURATE RESPONSES) ===\n";
        for (const entry of knowledgeEntries) {
          knowledgeBaseContext += `\n### ${entry.title} [${entry.category}]\n${entry.content}`;
          if (entry.referral_link) {
            knowledgeBaseContext += `\n📎 REFERRAL LINK: ${entry.referral_link}`;
          }
          knowledgeBaseContext += "\n";
        }
        knowledgeBaseContext += "\n=== END KNOWLEDGE BASE ===\n";
        console.log(`Loaded ${knowledgeEntries.length} knowledge entries for draft generation`);
      }
    } catch (kbError) {
      console.error("Error fetching knowledge base:", kbError);
    }

    // Check if draft already exists for this communication
    if (communicationId) {
      const { data: existingDraft } = await supabase
        .from("ai_draft_replies")
        .select("id")
        .eq("communication_id", communicationId)
        .eq("status", "pending")
        .maybeSingle();

      if (existingDraft) {
        console.log("Draft already exists for this communication");
        return new Response(
          JSON.stringify({ success: true, message: "Draft already exists", draftId: existingDraft.id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Fetch the communication that needs a reply
    let inboundMessage = "";
    let contactName = "there";
    let fullContext = "";
    let commHistory = "";
    let contactMemories = "";
    let recentActivity = "";

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
        const mem0Response = await fetch(`https://api.mem0.ai/v1/memories/?user_id=${encodeURIComponent(contactIdentifier)}&limit=15`, {
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
            contactMemories = "\n\nREMEMBERED ABOUT THIS CONTACT:\n";
            for (const m of memories) {
              const memory = m.memory || m.text || m.content;
              if (memory) {
                contactMemories += `- ${memory}\n`;
              }
            }
            contactMemories += "\nUse this to personalize the response naturally.\n";
            console.log(`Loaded ${memories.length} memories for draft generation`);
          }
        }
      } catch (e) {
        console.error("Error fetching memories:", e);
      }
    }

    if (communicationId) {
      const { data: comm } = await supabase
        .from("lead_communications")
        .select("*, leads(id, name, phone, email, property_address, stage, ai_summary), property_owners(id, name, email, phone)")
        .eq("id", communicationId)
        .single();

      if (comm) {
        inboundMessage = comm.body || "";
        
        if (comm.leads) {
          const lead = comm.leads as any;
          contactName = lead.name?.split(" ")[0] || "there";
          fullContext = `Contact Type: LEAD (has NOT signed contract yet)\nName: ${lead.name}\nPhone: ${lead.phone || "N/A"}\nEmail: ${lead.email || "N/A"}\nProperty: ${lead.property_address || "N/A"}\nStage: ${lead.stage}`;
          if (lead.ai_summary) fullContext += `\nNotes: ${lead.ai_summary}`;
          
          // Fetch recent lead activities for context
          try {
            const { data: timeline } = await supabase
              .from("lead_timeline")
              .select("event_type, event_data, created_at")
              .eq("lead_id", lead.id)
              .order("created_at", { ascending: false })
              .limit(5);
            
            if (timeline && timeline.length > 0) {
              recentActivity = "\n\nRECENT ACTIVITY FOR THIS LEAD:\n";
              for (const event of timeline) {
                const eventDate = new Date(event.created_at).toLocaleDateString();
                if (event.event_type === "income_report_sent") {
                  recentActivity += `- ${eventDate}: Income/rental analysis report was SENT to them\n`;
                } else if (event.event_type === "discovery_call_scheduled") {
                  recentActivity += `- ${eventDate}: Discovery call was scheduled\n`;
                } else if (event.event_type === "email_sent") {
                  recentActivity += `- ${eventDate}: Email was sent\n`;
                } else if (event.event_type === "contract_sent") {
                  recentActivity += `- ${eventDate}: Contract was sent\n`;
                }
              }
            }
          } catch (e) {
            console.error("Error fetching lead timeline:", e);
          }
        } else if (comm.property_owners) {
          const owner = comm.property_owners as any;
          contactName = owner.name?.split(" ")[0] || "there";
          fullContext = `Contact Type: OWNER (already signed, is a client)\nName: ${owner.name}\nEmail: ${owner.email || "N/A"}\nPhone: ${owner.phone || "N/A"}`;
          
          // Fetch financial context for owners
          try {
            const financialResponse = await fetch(`${supabaseUrl}/functions/v1/get-owner-financial-context`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({ ownerId: owner.id }),
            });
            
            if (financialResponse.ok) {
              const finContext = await financialResponse.json();
              
              fullContext += "\n\n--- OWNER FINANCIAL STATUS ---";
              
              if (finContext.hasPaymentMethod) {
                fullContext += `\n✅ Card on file: ${finContext.paymentMethodBrand || finContext.paymentMethodType} ending in ${finContext.paymentMethodLast4}`;
                if (finContext.cardExpiringSoon) {
                  fullContext += ` (⚠️ EXPIRING ${finContext.cardExpMonth}/${finContext.cardExpYear})`;
                }
              } else {
                fullContext += `\n⚠️ NO PAYMENT METHOD ON FILE`;
              }
              
              if (finContext.hasOutstandingCharges) {
                fullContext += `\n⚠️ Outstanding balance: $${finContext.outstandingAmount.toFixed(2)}`;
              } else {
                fullContext += `\n✅ Account is current - no outstanding charges`;
              }
              
              if (finContext.pendingPayoutAmount > 0) {
                fullContext += `\n💰 Pending payout: $${finContext.pendingPayoutAmount.toFixed(2)}`;
              }
              
              if (finContext.lastPaymentDate) {
                fullContext += `\nLast payment: $${finContext.lastPaymentAmount} on ${new Date(finContext.lastPaymentDate).toLocaleDateString()}`;
              }
              
              fullContext += `\nAccount Health: ${finContext.financialHealthScore?.toUpperCase() || "UNKNOWN"}`;
              fullContext += "\n--- END FINANCIAL STATUS ---";
              
              console.log("Financial context loaded for owner:", owner.id);
            }
          } catch (finError) {
            console.error("Error fetching financial context:", finError);
          }
          
          // Fetch recent owner statements/reports
          try {
            const { data: recentReports } = await supabase
              .from("owner_statements")
              .select("statement_period, created_at")
              .eq("owner_id", owner.id)
              .order("created_at", { ascending: false })
              .limit(3);
            
            if (recentReports && recentReports.length > 0) {
              recentActivity = "\n\nRECENT REPORTS SENT TO THIS OWNER:\n";
              for (const report of recentReports) {
                const sentDate = new Date(report.created_at).toLocaleDateString();
                recentActivity += `- ${report.statement_period} statement sent on ${sentDate}\n`;
              }
            }
          } catch (e) {
            console.error("Error fetching owner statements:", e);
          }
        }
      }
    }

    // Fetch recent conversation history
    const historyQuery = supabase
      .from("lead_communications")
      .select("direction, body, communication_type, created_at, subject")
      .order("created_at", { ascending: false })
      .limit(15);

    if (leadId) {
      historyQuery.eq("lead_id", leadId);
    } else if (ownerId) {
      historyQuery.eq("owner_id", ownerId);
    } else if (contactPhone) {
      historyQuery.contains("metadata", { unmatched_phone: contactPhone });
    }

    const { data: recentComms } = await historyQuery;

    if (recentComms && recentComms.length > 0) {
      commHistory = "\n\nCONVERSATION HISTORY (newest first):\n";
      for (const c of recentComms) {
        const dir = c.direction === "outbound" ? "WE SENT" : "THEY REPLIED";
        const preview = (c.body || "").substring(0, 300);
        const subject = c.subject ? ` | Subject: ${c.subject}` : "";
        commHistory += `[${dir}${subject}]: ${preview}${preview.length >= 300 ? "..." : ""}\n`;
      }
    }

    // ==========================================
    // INTELLIGENT INTENT ANALYSIS
    // ==========================================
    const intent = detectIntent(inboundMessage);
    console.log("Detected intent:", intent.primaryIntent, "| Suggested action:", intent.suggestedAction);
    
    // Build intent-specific instructions
    let intentInstructions = "";
    
    if (intent.wantsLiveDiscussion || intent.wantsToScheduleCall || intent.wantsCallback) {
      intentInstructions = `
⚠️ CRITICAL: This person WANTS TO TALK/DISCUSS/MEET!
- They said they want to discuss live or talk
- YOUR RESPONSE MUST offer to schedule a call
- Include the calendar link: ${SCHEDULING_LINK}
- Example: "Great! Here's my calendar to book a time: ${SCHEDULING_LINK}"
- Or: "Happy to chat! When works for you? Or grab a time here: ${SCHEDULING_LINK}"
- DO NOT ignore their request for a conversation!`;
    } else if (intent.wantsToReviewNumbers || (intent.asksAboutReports && intent.mentionsIncome)) {
      intentInstructions = `
⚠️ IMPORTANT: They want to review/discuss reports or numbers.
- Acknowledge the reports if we sent them
- OFFER TO WALK THROUGH THE REPORTS ON A CALL
- Example: "Want to hop on a quick call to go through the numbers? Here's my calendar: ${SCHEDULING_LINK}"`;
    } else if (intent.asksAboutReports || intent.asksAboutStatements) {
      intentInstructions = `
This person is asking about reports/statements.
- Confirm if reports were sent (check recent activity)
- Offer to explain or walk through them
- If appropriate, suggest a call to review together`;
    } else if (intent.isFrustrated) {
      intentInstructions = `
⚠️ This person seems frustrated.
- Acknowledge their frustration genuinely (not with scripted apologies)
- Take ownership and provide a concrete next step
- Be proactive about solving their issue`;
    } else if (intent.isUrgent) {
      intentInstructions = `
This is marked as URGENT.
- Acknowledge the urgency
- Be direct and action-oriented
- Provide clear next steps immediately`;
    } else if (intent.isPaymentInquiry || intent.isPayoutInquiry) {
      intentInstructions = `
Financial question detected.
- Reference the EXACT numbers from the Financial Status section above
- Don't guess or make up amounts
- If you don't have the info, say you'll check and follow up`;
    }

    // Determine if this is a lead or owner
    const isOwner = fullContext.includes("Contact Type: OWNER");
    const isLead = fullContext.includes("Contact Type: LEAD");

    // Build the system prompt with knowledge base
    const systemPrompt = `You are Ingo, an experienced property manager at PeachHaus Group, a premium mid-term rental management company in Atlanta.

${companyKnowledge}
${knowledgeBaseContext}

IMPORTANT: When answering questions, ALWAYS check the COMPANY KNOWLEDGE BASE above for accurate information, referral links, and company policies. Include referral links naturally when recommending services.

${humanLikeGuidelines}

=====================
CURRENT SITUATION
=====================
${fullContext}
${recentActivity}
${commHistory}
${contactMemories}

=====================
INTENT ANALYSIS
=====================
Their primary intent: ${intent.primaryIntent}
Suggested action: ${intent.suggestedAction}
${intentInstructions}

=====================
RESPONSE REQUIREMENTS
=====================
1. Channel: ${messageType === "email" ? "EMAIL - 2-3 short paragraphs max" : "SMS - 160 chars ideal, 280 max"}
2. ${isOwner ? "This is an OWNER (existing client) - focus on service, NOT sales" : "This is a LEAD - be helpful, can suggest discovery calls"}
3. Address their SPECIFIC message - don't give generic responses
4. If they want to talk/meet → include the calendar link: ${SCHEDULING_LINK}
5. Sign as: "- Ingo"

WHAT NOT TO DO:
- NEVER ignore a request to talk/discuss/meet
- NEVER give a generic response that doesn't address their message
- NEVER claim something was "promised" or "discussed" unless history proves it
- NEVER use banned phrases like "just checking in" or "I hope this finds you well"
- NEVER guess financial numbers - only use what's in the context`;

    const userPrompt = `THEIR MESSAGE TO REPLY TO:
"${inboundMessage}"

Generate a natural, intelligent ${messageType === "email" ? "email" : "text message"} reply that DIRECTLY addresses what they said.
${intent.wantsLiveDiscussion || intent.wantsToScheduleCall ? `
REMEMBER: They want to discuss/talk/meet! YOUR RESPONSE MUST OFFER TO SCHEDULE A CALL with the calendar link!` : ""}

Write ONLY the reply text - no explanations or meta-commentary.`;

    // Call AI to generate draft
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
        max_tokens: messageType === "sms" ? 200 : 500,
        temperature: 0.6, // Slightly lower for more focused responses
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
    let draftContent = data.choices?.[0]?.message?.content?.trim();

    if (!draftContent) {
      throw new Error("No draft generated");
    }

    // Clean up - remove quotes if wrapped
    if (draftContent.startsWith('"') && draftContent.endsWith('"')) {
      draftContent = draftContent.slice(1, -1);
    }

    // Calculate confidence based on context and intent clarity
    let confidenceScore = 0.7;
    if (commHistory.length > 100) confidenceScore += 0.05;
    if (fullContext.length > 50) confidenceScore += 0.05;
    if (inboundMessage.length > 20) confidenceScore += 0.05;
    if (intent.primaryIntent !== "general_response") confidenceScore += 0.1; // Clear intent detected
    if (contactMemories.length > 0) confidenceScore += 0.05;
    confidenceScore = Math.min(confidenceScore, 0.95);

    // Store the draft with intent metadata
    const { data: newDraft, error: insertError } = await supabase
      .from("ai_draft_replies")
      .insert({
        communication_id: communicationId || null,
        lead_id: leadId || null,
        owner_id: ownerId || null,
        contact_phone: contactPhone || null,
        contact_email: contactEmail || null,
        draft_content: draftContent,
        message_type: messageType || "sms",
        confidence_score: confidenceScore,
        status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error storing draft:", insertError);
      throw insertError;
    }

    console.log("Draft generated successfully:", newDraft.id, "| Intent:", intent.primaryIntent);

    return new Response(
      JSON.stringify({ 
        success: true, 
        draftId: newDraft.id,
        draftContent,
        confidenceScore,
        detectedIntent: intent.primaryIntent,
        suggestedAction: intent.suggestedAction,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error generating draft reply:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
