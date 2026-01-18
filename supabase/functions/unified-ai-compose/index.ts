import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ComposeRequest {
  action: 'compose' | 'reply' | 'improve' | 'shorten' | 'professional' | 'friendly';
  messageType: 'sms' | 'email';
  contactType: 'lead' | 'owner';
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
  context: ContextPackage
): string {
  const { action, messageType, incomingMessage, currentMessage, userInstructions } = request;
  const { contactProfile, toneProfile, threadAnalysis, relevantKnowledge, memories, recentMessages } = context;
  
  // Base context section
  let prompt = `You are a professional property management assistant responding on behalf of PeachHaus Property Management. Your responses should feel like they come from a real person named Ingo, not an AI.

## WHO YOU'RE TALKING TO
Name: ${contactProfile.name}
Relationship Stage: ${contactProfile.relationshipStage}
Communication Style Preference: ${contactProfile.communicationStyle}
Emotional Baseline: ${contactProfile.emotionalBaseline}
${contactProfile.painPoints.length > 0 ? `Known Pain Points: ${contactProfile.painPoints.join(', ')}` : ''}
${contactProfile.interests.length > 0 ? `Interests: ${contactProfile.interests.join(', ')}` : ''}

## YOUR VOICE & TONE
Write with this exact style:
- Formality Level: ${toneProfile.formality}
- Average Sentence Length: ${toneProfile.avgSentenceLength} words
- ${toneProfile.useContractions ? 'USE contractions (I\'m, we\'ll, don\'t)' : 'AVOID contractions (I am, we will, do not)'}
- Exclamation Usage: ${toneProfile.exclamationFrequency}
- Emoji: ${toneProfile.emojiUsage}

NEVER use these phrases: ${toneProfile.avoidedPhrases.join(', ')}
End messages with: ${toneProfile.commonClosings[0] || '- Ingo'}

${toneProfile.sampleMessages.length > 0 ? `Sample of your voice to mimic:\n"${toneProfile.sampleMessages[0]}"` : ''}

## ${getSentimentInstructions(threadAnalysis.lastInboundSentiment)}

`;

  // Add the FULL CONVERSATION for context - this is CRITICAL
  if (recentMessages.length > 0) {
    prompt += `## FULL CONVERSATION HISTORY (CRITICAL - Read carefully!)
This is the complete conversation so far. Study it to understand:
- What has been discussed/agreed
- What you've already sent them (income reports, links, etc.)
- What they are specifically asking for
- What NOT to repeat or re-offer

`;
    recentMessages.forEach((m, idx) => {
      const date = new Date(m.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      prompt += `[${date}] ${m.direction === 'inbound' ? contactProfile.name.split(' ')[0].toUpperCase() : 'YOU (INGO)'}: ${m.content}\n\n`;
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

  // Add relevant knowledge
  if (relevantKnowledge.length > 0) {
    prompt += `## RELEVANT COMPANY INFORMATION
Use this knowledge to inform your response (don't copy verbatim, integrate naturally):
${relevantKnowledge.map(k => `- ${k.title}: ${k.content.substring(0, 300)}${k.referral_link ? ` [Referral: ${k.referral_link}]` : ''}`).join('\n')}

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
    
    reply: `## YOUR TASK: REPLY TO THEIR LATEST MESSAGE
Their latest message: "${incomingMessage || recentMessages.filter(m => m.direction === 'inbound').pop()?.content || 'Unknown'}"

CRITICAL RULES FOR YOUR REPLY:
1. DIRECTLY address what they're asking for (e.g., if they want to meet in person, confirm you can meet in person)
2. Reference specifics they mentioned (dates, locations, concerns)
3. DON'T re-offer things you've already done (check the conversation history!)
4. DON'T be generic - show you've read and understood their message
5. If they're asking for a meeting/call, suggest specific times or confirm their proposed times
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

  // Message type specific constraints
  if (messageType === 'sms') {
    prompt += `

## SMS CONSTRAINTS
- Keep it concise (ideally under 300 characters, max 500)
- No formal greetings needed - jump straight to the point
- End with "- Ingo" for signature
- One clear call to action if needed
- Sound like a real person texting, not a corporate message`;
  } else {
    prompt += `

## EMAIL CONSTRAINTS
- Include a clear subject line if composing new
- Use short paragraphs
- End with signature: ${toneProfile.commonClosings[0] || '- Ingo'}
- Don't be overly formal or stiff`;
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
Sound like Ingo - a real person who's been chatting with them, not a corporate AI.`;

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

    console.log(`Context received: ${context.recentMessages?.length || 0} recent messages, ${context.threadAnalysis?.questions?.length || 0} questions`);

    // Step 2: Build the prompt
    const prompt = buildPrompt(request, context);

    // Step 3: Call Lovable AI Gateway
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: "You are Ingo, a real property manager at PeachHaus Group. Write natural, human responses - not AI-sounding corporate speak. Be conversational, helpful, and specific." },
          { role: "user", content: prompt }
        ],
        model: "google/gemini-3-flash-preview",
        max_tokens: messageType === 'sms' ? 500 : 2000,
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        throw new Error("Rate limits exceeded, please try again later.");
      }
      if (aiResponse.status === 402) {
        throw new Error("AI credits depleted, please add funds.");
      }
      const errorText = await aiResponse.text();
      console.error("Lovable AI error:", aiResponse.status, errorText);
      throw new Error(`AI generation failed: ${errorText}`);
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

    // Step 4: Validate response quality
    const validation = validateResponse(generatedMessage, context, messageType);

    const generationTimeMs = Date.now() - startTime;

    // Step 5: Log for quality tracking
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
          questionsAnswered: context.threadAnalysis.questions.length,
          sentimentDetected: context.threadAnalysis.lastInboundSentiment,
          conversationPhase: context.threadAnalysis.conversationPhase,
          messagesAnalyzed: context.recentMessages.length,
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
