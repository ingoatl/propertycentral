import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ComposeRequest {
  action: 'compose' | 'reply' | 'improve' | 'shorten' | 'professional' | 'friendly';
  messageType: 'sms' | 'email';
  contactType: 'lead' | 'owner' | 'vendor' | 'other';
  contactId: string;
  currentMessage?: string;
  incomingMessage?: string;
  userInstructions?: string;
  includeCalendarLink?: boolean;
  includeIncomeOffer?: boolean;
  subject?: string;
  // NEW: Accept the full conversation thread directly
  conversationThread?: Array<{
    direction: string;
    body: string;
    created_at: string;
    type?: string;
    subject?: string;
  }>;
  // NEW: Additional identifiers for context lookup
  ghlContactId?: string;
  contactPhone?: string;
  contactEmail?: string;
}

interface ContextPackage {
  contactProfile: {
    name: string;
    email?: string;
    phone?: string;
    relationshipStage: string;
    communicationStyle: string;
    emotionalBaseline: string;
    preferredChannel: string;
    painPoints: string[];
    interests: string[];
  };
  toneProfile: {
    formality: string;
    avgSentenceLength: number;
    useContractions: boolean;
    exclamationFrequency: string;
    emojiUsage: string;
    avoidedPhrases: string[];
    commonClosings: string[];
    sampleMessages: string[];
  };
  threadAnalysis: {
    questions: Array<{ text: string; answered: boolean }>;
    ourPromises: Array<{ text: string; fulfilled: boolean }>;
    sentimentTrajectory: string;
    lastInboundSentiment: string;
    conversationPhase: string;
    messageCount: number;
  };
  relevantKnowledge: Array<{
    title: string;
    content: string;
    category: string;
    referral_link?: string;
  }>;
  memories: string[];
  financialContext?: {
    monthlyRevenue?: number;
    occupancyRate?: number;
  };
  recentMessages: Array<{ direction: string; content: string; timestamp: string }>;
}

// Get sentiment-specific instructions
function getSentimentInstructions(sentiment: string): string {
  const instructions: Record<string, string> = {
    frustrated: `EMOTIONAL APPROACH - They seem frustrated:
- START with acknowledgment: "I completely understand" or "I hear you"
- Skip pleasantries, get straight to the solution
- Be concrete and specific about what you'll do
- End with a clear timeline or next step
- Keep it brief - they don't want fluff`,
    
    confused: `EMOTIONAL APPROACH - They seem confused:
- Use simple, clear language
- Break things into numbered steps if needed
- Offer to explain more or hop on a quick call
- Avoid jargon or assumptions
- Be patient and thorough`,
    
    grateful: `EMOTIONAL APPROACH - They're being appreciative:
- Keep your response brief and warm
- Don't over-explain or add unnecessary info
- Match their positive energy
- A simple "Happy to help!" tone works great`,
    
    excited: `EMOTIONAL APPROACH - They're excited:
- Match their enthusiasm appropriately
- Use their energy to move things forward
- Keep momentum going with next steps
- It's okay to be a bit more casual`,
    
    cautious: `EMOTIONAL APPROACH - They seem hesitant or concerned:
- Provide extra detail and reassurance
- Acknowledge their concerns directly
- No pressure or urgency
- Offer alternatives or flexibility
- Show that you understand meeting in person is important to them`,
    
    neutral: `EMOTIONAL APPROACH - Standard helpful tone:
- Be warm and professional
- Focus on being helpful and clear
- Anticipate follow-up questions`,
  };
  
  return instructions[sentiment] || instructions.neutral;
}

// Build the prompt for AI generation with FULL conversation context
function buildPrompt(
  request: ComposeRequest,
  context: ContextPackage,
  toneKnowledge?: Array<{ title: string; content: string }>
): string {
  const { action, messageType, incomingMessage, currentMessage, userInstructions } = request;
  const { contactProfile, toneProfile, threadAnalysis, relevantKnowledge, memories, recentMessages } = context;
  
  // Get first name for greetings
  const firstName = contactProfile.name.split(' ')[0] || 'there';
  
  // Determine recipient type for tone adaptation
  const isClient = true; // For leads/owners, use client style. For vendors, would use vendor style.
  
  // Base context section
  let prompt = `You are Ingo from PeachHaus Property Management. Your responses should feel like they come from a real person, not an AI.

## WHO YOU'RE TALKING TO
Name: ${contactProfile.name} (use "${firstName}" in greetings)
Relationship Stage: ${contactProfile.relationshipStage}
Communication Style Preference: ${contactProfile.communicationStyle}
Emotional Baseline: ${contactProfile.emotionalBaseline}
${contactProfile.painPoints.length > 0 ? `Known Pain Points: ${contactProfile.painPoints.join(', ')}` : ''}
${contactProfile.interests.length > 0 ? `Interests: ${contactProfile.interests.join(', ')}` : ''}

## INGO'S TONE OF VOICE - MANDATORY STYLE GUIDE
${toneKnowledge && toneKnowledge.length > 0 ? toneKnowledge.map(t => `### ${t.title}\n${t.content}`).join('\n\n') : `Primary tone: Professional, Detail-Oriented, and Proactive.

FOR CLIENTS:
- Welcoming, reassuring, and highly structured
- Summarize complex information in concise, bulleted recaps
- Use phrases like "Thank you again for taking the time to speak with us"
- Proactively address next steps or follow-up actions

SIGNATURE STYLE:
- SMS: Always end with "- Ingo"
- Email: End with "Best,\\nIngo\\nPeachHaus Group"
- NEVER use emojis`}

## YOUR VOICE & TONE - MATCH THIS EXACTLY
- Formality Level: ${toneProfile.formality}
- Average Sentence Length: ${toneProfile.avgSentenceLength} words
- ${toneProfile.useContractions ? 'USE contractions (I\'m, we\'ll, don\'t)' : 'AVOID contractions (I am, we will, do not)'}
- **ABSOLUTELY NO EMOJIS** - Never use any emoji, emoticon, or Unicode symbol

NEVER use these phrases: ${toneProfile.avoidedPhrases.join(', ')}

${toneProfile.sampleMessages.length > 0 ? `## SAMPLE MESSAGES - MATCH THIS VOICE EXACTLY
Here are examples of how Ingo actually writes. Study and mimic this style:
${toneProfile.sampleMessages.slice(0, 3).map((s, i) => `${i + 1}. "${s}"`).join('\n')}
` : ''}

## ${getSentimentInstructions(threadAnalysis.lastInboundSentiment)}

`;

  // Add the MOST RECENT MESSAGES FIRST - THIS IS WHAT WE'RE REPLYING TO
  const inboundMessages = recentMessages.filter(m => m.direction === 'inbound');
  const mostRecentInbound = inboundMessages.slice(-3).reverse(); // Last 3 inbound, newest first
  
  if (mostRecentInbound.length > 0) {
    prompt += `## >>> MOST RECENT MESSAGES - REPLY TO THESE! <<<
These are the LATEST messages from ${firstName}. Your reply MUST address these specifically:

`;
    mostRecentInbound.forEach((m, idx) => {
      const date = new Date(m.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      const priority = idx === 0 ? ' [LATEST - PRIMARY FOCUS]' : '';
      prompt += `>>> [${date}]${priority} ${firstName.toUpperCase()}: ${m.content}\n\n`;
    });
    prompt += '\n';
  }

  // Add earlier conversation for context
  if (recentMessages.length > 3) {
    prompt += `## EARLIER CONVERSATION CONTEXT
Review this history to understand what's been discussed/agreed, but focus your reply on the MOST RECENT messages above:

`;
    const earlierMessages = recentMessages.slice(0, -3);
    earlierMessages.forEach((m) => {
      const date = new Date(m.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      prompt += `[${date}] ${m.direction === 'inbound' ? firstName.toUpperCase() : 'YOU (INGO)'}: ${m.content.substring(0, 200)}${m.content.length > 200 ? '...' : ''}\n\n`;
    });
    prompt += '\n';
  }

  // Add questions to answer (critical)
  if (threadAnalysis.questions.length > 0) {
    prompt += `## UNANSWERED QUESTIONS - YOU MUST ADDRESS THESE
These are questions from their messages that haven't been answered yet:
${threadAnalysis.questions.map((q, i) => `${i + 1}. "${q.text}"`).join('\n')}

`;
  }

  // Add relevant knowledge - ALWAYS include if available
  if (relevantKnowledge.length > 0) {
    prompt += `## COMPANY KNOWLEDGE - USE THIS INFORMATION
You MUST incorporate this company knowledge into your response where relevant:
${relevantKnowledge.map(k => `
### ${k.title} (${k.category})
${k.content.substring(0, 400)}${k.referral_link ? `\nREFERRAL LINK TO INCLUDE: ${k.referral_link}` : ''}`).join('\n')}

`;
  }

  // Add memories
  if (memories.length > 0) {
    prompt += `## THINGS TO REMEMBER ABOUT THEM
${memories.slice(0, 5).map(m => `- ${m}`).join('\n')}

`;
  }

  // Add financial context for owners
  if (context.financialContext) {
    prompt += `## PROPERTY FINANCIAL CONTEXT
Monthly Revenue: $${context.financialContext.monthlyRevenue?.toLocaleString() || 'N/A'}
Occupancy Rate: ${context.financialContext.occupancyRate ? `${context.financialContext.occupancyRate}%` : 'N/A'}

`;
  }

  // Action-specific instructions - ENHANCED
  const actionInstructions: Record<string, string> = {
    compose: `## YOUR TASK: COMPOSE A NEW ${messageType.toUpperCase()}
Write a ${messageType === 'sms' ? 'concise SMS (under 300 characters ideally)' : 'professional email'} to ${contactProfile.name}.
${userInstructions ? `User's specific instructions: ${userInstructions}` : 'Write an appropriate message based on the context.'}`,
    
    reply: `## YOUR TASK: REPLY TO THEIR LATEST MESSAGE(S)
Focus on the >>> MOST RECENT MESSAGES <<< section above. That's what you're replying to.

CRITICAL RULES FOR YOUR REPLY:
1. DIRECTLY address what they're asking for in their LATEST messages
2. Reference specifics they mentioned (dates, locations, concerns, the garage issue, etc.)
3. DON'T re-offer things you've already done (check the earlier conversation context!)
4. DON'T be generic - show you've read and understood their SPECIFIC request
5. If they're asking you to do something, confirm you'll do it or explain why not
6. Keep it conversational and human
${userInstructions ? `\nAdditional instructions: ${userInstructions}` : ''}`,
    
    improve: `## YOUR TASK: IMPROVE THIS DRAFT
Current draft: "${currentMessage}"

Improve it to be more engaging, clearer, and match your voice profile while keeping the core message.`,
    
    shorten: `## YOUR TASK: SHORTEN THIS MESSAGE
Current message: "${currentMessage}"

Make it more concise while keeping all essential information. ${messageType === 'sms' ? 'Target under 300 characters.' : 'Cut unnecessary words and fluff.'}`,
    
    professional: `## YOUR TASK: MAKE THIS MORE PROFESSIONAL
Current message: "${currentMessage}"

Rewrite with a more formal, professional tone while keeping the same meaning.`,
    
    friendly: `## YOUR TASK: MAKE THIS WARMER
Current message: "${currentMessage}"

Rewrite with a warmer, more personable tone while keeping it professional.`,
  };

  prompt += actionInstructions[action] || actionInstructions.compose;

  // Message type specific constraints - UPDATED with greeting and formatting
  if (messageType === 'sms') {
    prompt += `

## SMS CONSTRAINTS
- **START with a brief greeting**: "Hi ${firstName}," or "Hey ${firstName}," 
- Keep it concise (ideally under 300 characters, max 500)
- Address their specific request or concern directly
- End with "- Ingo" signature
- Sound like a real person texting, not a corporate message
- **ABSOLUTELY NO EMOJIS - Never use any emoji characters**`;
  } else {
    prompt += `

## EMAIL CONSTRAINTS
- **START with greeting**: "Hi ${firstName},"
- Use 1-2 short paragraphs (3-4 sentences max each)
- Use line breaks between paragraphs for readability
- If action is needed, be specific about next steps
- End with professional signature:

Best,
Ingo
PeachHaus Group

- **ABSOLUTELY NO EMOJIS - Never use any emoji characters**`;
  }

  // Calendar link instruction
  if (request.includeCalendarLink) {
    prompt += `\n\nInclude this scheduling link naturally: https://propertycentral.lovable.app/book-discovery-call`;
  }

  // Final output format
  prompt += `

## OUTPUT FORMAT
${messageType === 'email' ? 'If this is a new email, start with "SUBJECT: " on its own line, then the body.' : ''}
Write ONLY the message content. No explanations, no "Here's the message:" prefix.
${messageType === 'sms' ? `Start with "Hi ${firstName}," or "Hey ${firstName},"` : `Start with "Hi ${firstName},"`}
Sound like Ingo - a real person who's been chatting with them, not a corporate AI.
**REMINDER: ABSOLUTELY NO EMOJIS EVER. Zero. None.**`;

  return prompt;
}

// Validate response quality
function validateResponse(
  response: string,
  context: ContextPackage,
  messageType: string
): { isValid: boolean; issues: string[]; score: number } {
  const issues: string[] = [];
  let score = 100;
  
  // Check for banned phrases
  const bannedPhrases = [
    'just checking in', 'hope this finds you', 'per our conversation',
    'don\'t hesitate', 'at your earliest convenience', 'touch base',
    'circle back', 'synergy', 'leverage', 'as mentioned',
    'I understand you\'re interested', 'I\'d love to help you',
  ];
  
  const responseLower = response.toLowerCase();
  for (const phrase of bannedPhrases) {
    if (responseLower.includes(phrase)) {
      issues.push(`Contains banned phrase: "${phrase}"`);
      score -= 10;
    }
  }
  
  // Check question coverage
  for (const q of context.threadAnalysis.questions) {
    const qKeywords = q.text.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const matchCount = qKeywords.filter(kw => responseLower.includes(kw)).length;
    if (matchCount < Math.min(2, qKeywords.length * 0.3)) {
      issues.push(`May not have answered: "${q.text.substring(0, 50)}..."`);
      score -= 15;
    }
  }
  
  // Check length for SMS
  if (messageType === 'sms' && response.length > 500) {
    issues.push('SMS is too long (over 500 characters)');
    score -= 10;
  }
  
  // Check for signature in email
  if (messageType === 'email' && !response.includes('- ') && !response.includes('Best,') && !response.includes('Thanks,')) {
    issues.push('Email may be missing signature');
    score -= 5;
  }
  
  return {
    isValid: issues.length === 0,
    issues,
    score: Math.max(0, score),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const request: ComposeRequest = await req.json();
    const { action, messageType, contactType, contactId, conversationThread, ghlContactId, contactPhone, contactEmail } = request;

    if (!contactType || !contactId || !messageType) {
      throw new Error("contactType, contactId, and messageType are required");
    }

    console.log(`Unified AI Compose: ${action} ${messageType} for ${contactType} ${contactId}`);
    console.log(`Conversation thread provided: ${conversationThread?.length || 0} messages`);

    // Step 1: Get unified context - pass the conversation thread for fallback
    const contextResponse = await fetch(
      `${supabaseUrl}/functions/v1/unified-context-engine`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          contactType,
          contactId,
          incomingMessage: request.incomingMessage,
          messageType,
          conversationThread, // Pass the thread for fallback
          ghlContactId,
          contactPhone,
          contactEmail,
        }),
      }
    );

    const contextResult = await contextResponse.json();
    if (!contextResult.success) {
      throw new Error(`Context gathering failed: ${contextResult.error}`);
    }

    const context: ContextPackage = contextResult.context;

    // Log context details for debugging
    console.log(`=== AI COMPOSE CONTEXT SUMMARY ===`);
    console.log(`Messages analyzed: ${context.recentMessages?.length || 0}`);
    console.log(`Unanswered questions: ${context.threadAnalysis?.questions?.length || 0}`);
    console.log(`Sentiment detected: ${context.threadAnalysis?.lastInboundSentiment || 'unknown'}`);
    console.log(`Conversation phase: ${context.threadAnalysis?.conversationPhase || 'unknown'}`);
    console.log(`Knowledge entries used: ${context.relevantKnowledge?.length || 0}`);
    if (context.relevantKnowledge?.length > 0) {
      console.log(`Knowledge topics: ${context.relevantKnowledge.map(k => k.title).join(', ')}`);
    }
    console.log(`Tone profile formality: ${context.toneProfile?.formality || 'unknown'}`);
    console.log(`Sample messages available: ${context.toneProfile?.sampleMessages?.length || 0}`);
    console.log(`================================`);

    // Step 2: Fetch Ingo's tone of voice from knowledge base
    const { data: toneKnowledge } = await supabase
      .from('company_knowledge_base')
      .select('title, content')
      .eq('category', 'tone')
      .eq('is_active', true)
      .order('priority', { ascending: false });
    
    console.log(`Tone knowledge entries loaded: ${toneKnowledge?.length || 0}`);

    // Step 3: Build the prompt with tone knowledge
    const prompt = buildPrompt(request, context, toneKnowledge || []);

    // Step 4: Check circuit breaker before calling AI
    const { data: circuitBreaker } = await supabase
      .from('ai_circuit_breaker')
      .select('*')
      .eq('service_name', 'unified-ai-compose')
      .maybeSingle();
    
    let canProceed = true;
    if (circuitBreaker?.state === 'open' && circuitBreaker.opened_at) {
      const openedAt = new Date(circuitBreaker.opened_at);
      const elapsedSeconds = (Date.now() - openedAt.getTime()) / 1000;
      if (elapsedSeconds < circuitBreaker.reset_timeout_seconds) {
        canProceed = false;
      } else {
        // Move to half-open
        await supabase
          .from('ai_circuit_breaker')
          .update({ state: 'half_open', half_open_at: new Date().toISOString() })
          .eq('service_name', 'unified-ai-compose');
      }
    }
    
    if (!canProceed) {
      console.log('[CircuitBreaker] Circuit is OPEN, using fallback response');
      // Return a graceful fallback
      return new Response(
        JSON.stringify({
          success: true,
          message: `Hi ${context.contactProfile.name.split(' ')[0]},\n\nThank you for reaching out. I'll get back to you shortly with a more detailed response.\n\n- Ingo`,
          subject: 'Following up',
          qualityScore: 50,
          validationIssues: ['Used fallback due to service recovery'],
          contextUsed: { memoriesCount: 0, knowledgeEntriesUsed: [], questionsAnswered: 0, sentimentDetected: 'neutral', conversationPhase: 'unknown' },
          metadata: { model: 'fallback', generationTimeMs: 0 },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 5: Call Lovable AI Gateway with retry logic
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let aiResponse: Response | null = null;
    let lastError: Error | null = null;
    const maxRetries = 3;
    const backoffMs = 1000;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${lovableApiKey}`,
          },
          body: JSON.stringify({
            messages: [
              { role: "system", content: "You are Ingo, a real property manager at PeachHaus Group. Write natural, human responses - never use emojis. Be conversational, helpful, and specific. Match the tone profile exactly." },
              { role: "user", content: prompt }
            ],
            model: "google/gemini-3-flash-preview",
            max_tokens: messageType === 'sms' ? 500 : 2000,
            temperature: 0.7,
          }),
        });

        if (aiResponse.ok) {
          // Success - record it
          await supabase
            .from('ai_circuit_breaker')
            .update({ 
              success_count: (circuitBreaker?.success_count || 0) + 1,
              last_success_at: new Date().toISOString(),
              state: circuitBreaker?.state === 'half_open' ? 'closed' : circuitBreaker?.state || 'closed',
              failure_count: circuitBreaker?.state === 'half_open' ? 0 : circuitBreaker?.failure_count || 0,
              updated_at: new Date().toISOString()
            })
            .eq('service_name', 'unified-ai-compose');
          break;
        }

        // Handle specific errors
        if (aiResponse.status === 429) {
          console.log(`[CircuitBreaker] Rate limited, attempt ${attempt + 1}/${maxRetries}`);
          const retryAfter = aiResponse.headers.get('Retry-After');
          const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : backoffMs * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        if (aiResponse.status === 402) {
          lastError = new Error("AI credits depleted, please add funds.");
          break;
        }

        const errorText = await aiResponse.text();
        lastError = new Error(`AI generation failed: ${errorText}`);

      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.error(`[CircuitBreaker] Attempt ${attempt + 1} failed:`, lastError.message);
        
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, backoffMs * Math.pow(2, attempt)));
        }
      }
    }

    if (!aiResponse || !aiResponse.ok) {
      // Record failure and potentially open circuit
      const newFailureCount = (circuitBreaker?.failure_count || 0) + 1;
      const shouldOpen = newFailureCount >= (circuitBreaker?.failure_threshold || 5);
      
      await supabase
        .from('ai_circuit_breaker')
        .update({ 
          failure_count: newFailureCount,
          last_failure_at: new Date().toISOString(),
          last_error_message: lastError?.message || 'Unknown error',
          state: shouldOpen ? 'open' : circuitBreaker?.state || 'closed',
          opened_at: shouldOpen ? new Date().toISOString() : circuitBreaker?.opened_at,
          updated_at: new Date().toISOString()
        })
        .eq('service_name', 'unified-ai-compose');
      
      throw lastError || new Error("AI generation failed after retries");
    }

    const aiResult = await aiResponse.json();
    let generatedMessage = aiResult.choices?.[0]?.message?.content || "";

    // Clean up the response
    generatedMessage = generatedMessage.trim();
    
    // Remove any meta-commentary the AI might add
    generatedMessage = generatedMessage.replace(/^(Here's|Here is|Sure,|Okay,|Of course)[^:]*:\s*/i, '');
    
    // Extract subject if email
    let subject = request.subject;
    if (messageType === 'email' && generatedMessage.startsWith('SUBJECT:')) {
      const lines = generatedMessage.split('\n');
      subject = lines[0].replace('SUBJECT:', '').trim();
      generatedMessage = lines.slice(1).join('\n').trim();
    }

    // Step 6: Validate response quality
    const validation = validateResponse(generatedMessage, context, messageType);

    const generationTimeMs = Date.now() - startTime;

    // Step 7: Log for quality tracking
    const authHeader = req.headers.get("authorization");
    let userId: string | null = null;
    if (authHeader) {
      try {
        const token = authHeader.replace("Bearer ", "");
        const { data: { user } } = await supabase.auth.getUser(token);
        userId = user?.id || null;
      } catch (e) {
        // Ignore auth errors
      }
    }

    await supabase.from('ai_response_quality').insert({
      contact_type: contactType,
      contact_id: contactId,
      message_type: messageType,
      incoming_message: request.incomingMessage,
      generated_response: generatedMessage,
      quality_score: validation.score,
      validation_issues: validation.issues,
      questions_detected: context.threadAnalysis.questions,
      knowledge_entries_used: context.relevantKnowledge.map(k => k.title),
      sentiment_detected: context.threadAnalysis.lastInboundSentiment,
      tone_profile_used: context.toneProfile,
      context_summary: {
        memoriesCount: context.memories.length,
        messagesAnalyzed: context.recentMessages.length,
        conversationPhase: context.threadAnalysis.conversationPhase,
      },
      model_used: 'google/gemini-3-flash-preview',
      generation_time_ms: generationTimeMs,
      user_id: userId,
    });

    console.log(`Generated response in ${generationTimeMs}ms with quality score ${validation.score}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: generatedMessage,
        subject,
        qualityScore: validation.score,
        validationIssues: validation.issues,
        contextUsed: {
          memoriesCount: context.memories.length,
          knowledgeEntriesUsed: context.relevantKnowledge.map(k => k.title),
          toneEntriesUsed: toneKnowledge?.map(t => t.title) || [],
          questionsAnswered: context.threadAnalysis.questions.length,
          sentimentDetected: context.threadAnalysis.lastInboundSentiment,
          conversationPhase: context.threadAnalysis.conversationPhase,
          messagesAnalyzed: context.recentMessages.length,
          relationshipStage: context.contactProfile.relationshipStage,
          toneFormality: context.toneProfile.formality,
        },
        metadata: {
          model: 'google/gemini-3-flash-preview',
          generationTimeMs,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in unified-ai-compose:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
