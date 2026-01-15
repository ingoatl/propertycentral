import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Advanced conversational UX guidelines for human-like AI communication
const humanLikeGuidelines = `
PROFESSIONAL COMMUNICATION ASSISTANT - STRICT RULES:

RULE 1: CONTEXT FIRST - ALWAYS
- Read and directly respond to THEIR MOST RECENT MESSAGE - this is your primary focus
- Consider the FULL conversation history to avoid repeating information or making irrelevant suggestions
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
- NEVER claim something was "promised," "attached," "discussed," or "sent" unless the conversation history proves it
- NEVER reference a call that didn't happen
- NEVER say "As promised" or "Great speaking with you earlier" unless there's evidence of that
- If you don't know something, DON'T make it up

RULE 4: TONE & STYLE
- Sound like a real, attentive human who actually read their message
- Professional, calm, and helpful - NEVER salesy
- Match the client's tone and level of formality
- Keep responses concise but thoughtful

RULE 5: ACTION-ORIENTED BUT RESPECTFUL
- Acknowledge what they ACTUALLY said (be specific)
- Address their ACTUAL concerns clearly
- Offer the next logical step WITHOUT pressure
- If they need time, give them time gracefully

RULE 6: CHANNEL AWARENESS
- Emails: clear paragraphs, polite closing, 2-3 short paragraphs max
- SMS: short, friendly, direct - 160 chars ideal, 280 max

BANNED PHRASES (sound robotic/corporate):
❌ "Just checking in" / "Just wanted to touch base"
❌ "I hope this email finds you well"
❌ "Please don't hesitate to reach out"
❌ "At your earliest convenience"
❌ "Per our conversation" / "As per your request"
❌ "As promised" (unless you actually promised something)
❌ "Great speaking with you earlier" (unless you actually spoke)
❌ "We apologize for any inconvenience"
❌ "Thank you for your patience"
❌ "It would be my pleasure to assist you"

NATURAL ALTERNATIVES:
Instead of → Use:
"I apologize for the delay" → "Sorry for the slow reply"
"Please find attached" → "I've attached" or "Here's"
"Do not hesitate to contact me" → "Just let me know"
"I would like to inform you" → "Wanted to let you know"
"Thank you for reaching out" → "Thanks for the message" or skip it entirely

RESPONSE STRUCTURE BY WHAT THEY SAID:
- Question → Answer it directly first

RULE 7: FINANCIAL STATUS AWARENESS (FOR OWNERS ONLY)
- If owner has outstanding balance AND mentions payment:
  → Acknowledge the balance naturally: "I see the $X balance from [date]..."
  → If they say they paid: "Let me check on that payment..."
  
- If owner has NO payment method AND asks about charges:
  → Gently guide: "I'll need to set up a card on file first. I can send you a secure link."
  → NEVER assume they have a card if they don't

- If owner asks about payouts with pending amount:
  → Be specific: "You have $X pending, scheduled for..."
  
RULE 8: OWNER INTENT-BASED RESPONSES
- Payment confirmation ("I just paid"):
  → Check actual payment status before confirming
  → If no recent payment found: "Let me verify that - which method did you use?"
  
- Payment inquiry ("how much do I owe"):
  → Provide exact balance with breakdown if possible
  
- Payout inquiry ("when will I get paid"):
  → Reference actual pending amounts and schedule
  
- Card update request:
  → Offer to send a secure update link
- Concern → Acknowledge it specifically
- Information shared (HOA doc, insurance research) → Thank them, confirm you received it
- Need more time → Respect it gracefully
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
            const grouped: Record<string, string[]> = {};
            
            for (const m of memories) {
              const category = m.metadata?.category || "general";
              const memory = m.memory || m.text || m.content;
              if (memory) {
                if (!grouped[category]) grouped[category] = [];
                grouped[category].push(memory);
              }
            }
            
            for (const [category, items] of Object.entries(grouped)) {
              for (const item of items) {
                contactMemories += `- ${item}\n`;
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
          const lead = comm.leads as { id: string; name: string; phone: string | null; email: string | null; property_address: string | null; stage: string; ai_summary: string | null };
          contactName = lead.name?.split(" ")[0] || "there";
          fullContext = `Lead: ${lead.name}\nPhone: ${lead.phone || "N/A"}\nEmail: ${lead.email || "N/A"}\nProperty: ${lead.property_address || "N/A"}\nStage: ${lead.stage}`;
          if (lead.ai_summary) fullContext += `\nNotes: ${lead.ai_summary}`;
        } else if (comm.property_owners) {
          const owner = comm.property_owners as { id: string; name: string; email: string | null; phone: string | null };
          contactName = owner.name?.split(" ")[0] || "there";
        fullContext = `Owner: ${owner.name}\nEmail: ${owner.email || "N/A"}\nPhone: ${owner.phone || "N/A"}`;
        
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
            
            // Payment method status
            if (finContext.hasPaymentMethod) {
              fullContext += `\n✅ Card on file: ${finContext.paymentMethodBrand || finContext.paymentMethodType} ending in ${finContext.paymentMethodLast4}`;
              if (finContext.cardExpiringSoon) {
                fullContext += ` (⚠️ EXPIRING ${finContext.cardExpMonth}/${finContext.cardExpYear})`;
              }
            } else {
              fullContext += `\n⚠️ NO PAYMENT METHOD ON FILE - If they mention payments, guide them to set up a card`;
            }
            
            // Outstanding charges
            if (finContext.hasOutstandingCharges) {
              fullContext += `\n⚠️ Outstanding balance: $${finContext.outstandingAmount.toFixed(2)}`;
              if (finContext.oldestUnpaidDate) {
                fullContext += ` (since ${finContext.oldestUnpaidDate})`;
              }
              fullContext += `\n→ If they ask about payments, acknowledge the outstanding balance`;
            } else {
              fullContext += `\n✅ No outstanding charges - account is current`;
            }
            
            // Pending payouts
            if (finContext.pendingPayoutAmount > 0) {
              fullContext += `\n💰 Pending payout: $${finContext.pendingPayoutAmount.toFixed(2)}`;
            }
            
            // Payment history
            if (finContext.lastPaymentDate) {
              fullContext += `\nLast payment: $${finContext.lastPaymentAmount} on ${new Date(finContext.lastPaymentDate).toLocaleDateString()}`;
            }
            
            // Financial health
            fullContext += `\nAccount status: ${finContext.financialHealthScore.toUpperCase()}`;
            if (finContext.financialHealthDetails) {
              fullContext += ` - ${finContext.financialHealthDetails}`;
            }
            
            fullContext += "\n--- END FINANCIAL STATUS ---";
            
            console.log("Financial context loaded for owner:", owner.id, "Health:", finContext.financialHealthScore);
          }
        } catch (finError) {
          console.error("Error fetching financial context:", finError);
        }
      }
      }
    }

    // Fetch recent conversation history
    const historyQuery = supabase
      .from("lead_communications")
      .select("direction, body, communication_type, created_at")
      .order("created_at", { ascending: false })
      .limit(15);

    if (leadId) {
      historyQuery.eq("lead_id", leadId);
    } else if (ownerId) {
      historyQuery.eq("owner_id", ownerId);
    } else if (contactPhone) {
      // For external contacts, match by phone in metadata
      historyQuery.contains("metadata", { unmatched_phone: contactPhone });
    }

    const { data: recentComms } = await historyQuery;

    if (recentComms && recentComms.length > 0) {
      commHistory = "\n\nCONVERSATION HISTORY (newest first):\n";
      for (const c of recentComms) {
        const dir = c.direction === "outbound" ? "WE SENT" : "THEY REPLIED";
        const preview = (c.body || "").substring(0, 200);
        commHistory += `[${dir}]: ${preview}${preview.length >= 200 ? "..." : ""}\n`;
      }
    }

    // Analyze the inbound message for context
    const msgLower = (inboundMessage || "").toLowerCase();
    const isQuestion = msgLower.includes("?") || msgLower.startsWith("how") || msgLower.startsWith("what") || msgLower.startsWith("when") || msgLower.startsWith("can");
    const isUrgent = msgLower.includes("urgent") || msgLower.includes("asap") || msgLower.includes("emergency") || msgLower.includes("immediately");
    const isFrustrated = msgLower.includes("still waiting") || msgLower.includes("no response") || msgLower.includes("frustrated") || msgLower.includes("disappointed");
    const isThankYou = msgLower.includes("thank") || msgLower.includes("appreciate") || msgLower.includes("great job");
    
    // Owner-specific intent patterns
    const isPaymentInquiry = msgLower.includes("payment") || msgLower.includes("charge") || msgLower.includes("bill") || 
                             msgLower.includes("invoice") || msgLower.includes("fee") || msgLower.includes("cost") || 
                             msgLower.includes("how much") || msgLower.includes("owe");
    const isPaymentConfirmation = msgLower.includes("paid") || msgLower.includes("sent") || msgLower.includes("transfer") || 
                                  msgLower.includes("completed") || msgLower.includes("done paying");
    const isPaymentIssue = msgLower.includes("declined") || msgLower.includes("failed") || msgLower.includes("error") || 
                           msgLower.includes("wrong charge") || msgLower.includes("overcharg") || msgLower.includes("dispute");
    const isPayoutInquiry = msgLower.includes("payout") || msgLower.includes("distribution") || msgLower.includes("when") && 
                            (msgLower.includes("paid") || msgLower.includes("get my money")) || msgLower.includes("deposit");
    const isCardUpdate = msgLower.includes("update") && msgLower.includes("card") || msgLower.includes("new card") || 
                         msgLower.includes("change") && msgLower.includes("payment") || msgLower.includes("expired");
    
    const ownerFinancialIntent = {
      isPaymentInquiry,
      isPaymentConfirmation,
      isPaymentIssue,
      isPayoutInquiry,
      isCardUpdate,
      hasFinancialIntent: isPaymentInquiry || isPaymentConfirmation || isPaymentIssue || isPayoutInquiry || isCardUpdate,
    };

    // Determine contract status from context
    const isLead = fullContext.includes("Stage:") && !fullContext.includes("Stage: signed") && !fullContext.includes("Stage: active");
    const hasNotSignedContract = isLead || (!fullContext.includes("Owner:") && !fullContext.includes("Stage: signed"));
    
    // Build system prompt
    const systemPrompt = `You are an experienced property manager at PeachHaus Group, a premium mid-term rental management company in Atlanta. You're composing a ${messageType === "email" ? "email" : "text message"} reply.

${humanLikeGuidelines}

YOUR COMMUNICATION PERSONA:
- Name: Ingo
- Role: Property management professional who genuinely cares about both owners and guests
- Style: Warm, efficient, knowledgeable - like a trusted advisor, not a call center rep
- You remember details and follow through on commitments

CONTRACT STATUS CONTEXT:
${hasNotSignedContract ? "- This person has NOT signed a contract yet (LEAD)" : "- This is an existing client/owner (CONTRACT SIGNED)"}
${hasNotSignedContract ? "- You MAY suggest a call ONLY if it's directly relevant to their message and helpful" : "- DO NOT suggest sales calls - they're already a client"}

CURRENT CONVERSATION CONTEXT:
Contact Name: ${contactName}
${fullContext}
${commHistory}
${contactMemories}

MESSAGE ANALYSIS:
- Is this a question needing an answer? ${isQuestion ? "YES" : "NO"}
- Does this feel urgent? ${isUrgent ? "YES - prioritize speed and clarity" : "NO"}
- Is the sender frustrated? ${isFrustrated ? "YES - acknowledge their frustration with empathy, not scripted apologies" : "NO"}
- Is this expressing gratitude? ${isThankYou ? "YES - keep response brief and warm" : "NO"}
${ownerId ? `
OWNER FINANCIAL INTENT DETECTED:
- Asking about payment/charges? ${ownerFinancialIntent.isPaymentInquiry ? "YES - reference their actual balance" : "NO"}
- Claiming they paid? ${ownerFinancialIntent.isPaymentConfirmation ? "YES - verify before confirming" : "NO"}
- Payment issue/dispute? ${ownerFinancialIntent.isPaymentIssue ? "YES - be empathetic and investigative" : "NO"}
- Asking about payout? ${ownerFinancialIntent.isPayoutInquiry ? "YES - reference actual pending amounts" : "NO"}
- Wants to update card? ${ownerFinancialIntent.isCardUpdate ? "YES - offer to send secure link" : "NO"}
` : ""}

RESPONSE REQUIREMENTS:
1. READ THEIR MESSAGE CAREFULLY - respond to what they ACTUALLY said
2. If they mentioned needing time (for insurance, review, etc.) - RESPECT that and don't rush them
3. If they mentioned sending something (HOA doc) - acknowledge you'll look for it
4. Reference specific details from their message to show you read it
5. ${messageType === "sms" ? "Keep under 160 characters ideal, 200 max" : "2-3 short paragraphs maximum"}
6. End with an appropriate response to their situation
7. Sign as: "- Ingo"
${ownerId && ownerFinancialIntent.hasFinancialIntent ? `
FINANCIAL RESPONSE GUIDANCE:
- Use the EXACT financial data from the "OWNER FINANCIAL STATUS" section above
- If they ask about balance, quote the actual amount
- If they claim payment, mention you'll verify (unless you see recent payment in status)
- For payout questions, reference the pending amount if any
- If no card on file and they need to pay, suggest setting one up
` : ""}

WHAT NOT TO DO:
- NEVER claim you "spoke earlier" or something was "promised" unless the history proves it
- NEVER suggest a call if they're reviewing documents and didn't ask for one
- Don't use placeholder text like "[specific detail]" - if you don't know, don't guess
- Don't start with "I" - vary your sentence openings
- Don't be pushy if they asked for time
${ownerId ? "- NEVER guess about payment amounts or dates - use ONLY what's in the financial status" : ""}`;

    const userPrompt = `THEIR MESSAGE TO REPLY TO:
"${inboundMessage}"

CRITICAL: Your reply must directly address what they said above. If they mentioned:
- Needing time to review insurance → Acknowledge this and give them that time
- Looking for a document to send → Thank them and say you'll look for it
- Visiting a city → Acknowledge the visit if appropriate

Generate a natural, human ${messageType === "email" ? "email" : "text message"} reply. Write ONLY the reply text - no explanations.`;

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
        max_tokens: messageType === "sms" ? 150 : 400,
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

    // Calculate confidence based on context availability
    let confidenceScore = 0.7; // Base confidence
    if (commHistory.length > 100) confidenceScore += 0.1; // Has conversation history
    if (fullContext.length > 50) confidenceScore += 0.1; // Has contact context
    if (inboundMessage.length > 20) confidenceScore += 0.1; // Clear message to reply to
    confidenceScore = Math.min(confidenceScore, 0.99);

    // Store the draft
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

    console.log("Draft generated successfully:", newDraft.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        draftId: newDraft.id,
        draftContent,
        confidenceScore,
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
