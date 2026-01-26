import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContextRequest {
  contactType: 'lead' | 'owner' | 'vendor' | 'other';
  contactId: string;
  incomingMessage?: string;
  messageType: 'sms' | 'email';
  // NEW: Accept the full conversation thread directly from frontend as backup
  conversationThread?: Array<{
    direction: string;
    body: string;
    created_at: string;
    type?: string;
    subject?: string;
  }>;
  // NEW: Additional identifiers for fallback lookup
  ghlContactId?: string;
  contactPhone?: string;
  contactEmail?: string;
}

interface QuestionItem {
  text: string;
  answered: boolean;
  answer?: string;
  askedAt: string;
}

interface PromiseItem {
  text: string;
  fulfilled: boolean;
  madeAt: string;
  dueDate?: string;
}

interface ThreadAnalysis {
  questions: QuestionItem[];
  ourPromises: PromiseItem[];
  topicThreads: string[];
  sentimentTrajectory: 'improving' | 'stable' | 'declining';
  lastInboundSentiment: string;
  conversationPhase: string;
  messageCount: number;
}

interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  category: string;
  subcategory?: string;
  keywords: string[];
  priority: number;
  referral_link?: string;
  relevanceScore?: number;
}

interface ContactProfile {
  name: string;
  email?: string;
  phone?: string;
  relationshipStage: string;
  communicationStyle: string;
  emotionalBaseline: string;
  preferredChannel: string;
  painPoints: string[];
  interests: string[];
}

interface ToneProfile {
  formality: string;
  avgSentenceLength: number;
  useContractions: boolean;
  exclamationFrequency: string;
  emojiUsage: string;
  avoidedPhrases: string[];
  commonClosings: string[];
  sampleMessages: string[];
}

interface FinancialContext {
  monthlyRevenue?: number;
  occupancyRate?: number;
  lastStatementDate?: string;
  outstandingBalance?: number;
}

interface ContextPackage {
  contactProfile: ContactProfile;
  toneProfile: ToneProfile;
  threadAnalysis: ThreadAnalysis;
  relevantKnowledge: KnowledgeEntry[];
  memories: string[];
  financialContext?: FinancialContext;
  recentMessages: Array<{ direction: string; content: string; timestamp: string }>;
  metadata: {
    contextGatheredAt: string;
    messageType: string;
    totalContextItems: number;
  };
}

// Extract questions from a message
function extractQuestions(message: string): string[] {
  const questions: string[] = [];
  
  // Direct question marks
  const questionMarkMatches = message.match(/[^.!?]*\?/g) || [];
  questions.push(...questionMarkMatches.map(q => q.trim()));
  
  // Implicit questions (statements that need answers)
  const implicitPatterns = [
    /I('m| am) (wondering|curious|not sure|confused) (about |if |whether |why |how |what )[^.!?]+[.!]?/gi,
    /can you (tell|explain|clarify|help|let me know)[^.!?]+[.!?]?/gi,
    /I('d| would) (like|love|want) to (know|understand|learn)[^.!?]+[.!?]?/gi,
    /what('s| is| are) (the|your|our)[^.!?]+[.!?]?/gi,
    /how (do|does|can|would|should|much|many|long)[^.!?]+[.!?]?/gi,
  ];
  
  for (const pattern of implicitPatterns) {
    const matches = message.match(pattern) || [];
    questions.push(...matches.map(q => q.trim()));
  }
  
  // Deduplicate and clean
  return [...new Set(questions)].filter(q => q.length > 10);
}

// Extract promises we made in our messages
function extractPromises(message: string): string[] {
  const promises: string[] = [];
  
  const promisePatterns = [
    /I('ll| will) [^.!?]+[.!?]/gi,
    /we('ll| will) [^.!?]+[.!?]/gi,
    /I('m| am) going to [^.!?]+[.!?]/gi,
    /let me [^.!?]+[.!?]/gi,
    /I can (get|send|check|follow up|reach out)[^.!?]+[.!?]/gi,
    /expect (this|it|that|to hear|an update)[^.!?]+[.!?]/gi,
  ];
  
  for (const pattern of promisePatterns) {
    const matches = message.match(pattern) || [];
    promises.push(...matches.map(p => p.trim()));
  }
  
  return [...new Set(promises)];
}

// Extract action requests (what they want us to do)
function extractActionRequests(message: string): string[] {
  const actions: string[] = [];
  
  const actionPatterns = [
    /can we (meet|schedule|talk|discuss|call)[^.!?]*[.!?]?/gi,
    /I('d| would) (like|love|want) (to |you to )[^.!?]+[.!?]?/gi,
    /please [^.!?]+[.!?]/gi,
    /let('s| us) [^.!?]+[.!?]/gi,
    /can you [^.!?]+[.!?]/gi,
    /I need [^.!?]+[.!?]/gi,
    /meeting is [^.!?]+[.!?]/gi,
  ];
  
  for (const pattern of actionPatterns) {
    const matches = message.match(pattern) || [];
    actions.push(...matches.map(a => a.trim()));
  }
  
  return [...new Set(actions)];
}

// Detect sentiment of a message
function detectSentiment(message: string): string {
  const lowerMessage = message.toLowerCase();
  
  const frustratedIndicators = ['frustrated', 'annoyed', 'upset', 'disappointed', 'unacceptable', 'ridiculous', 'terrible', 'worst', 'never', 'always a problem', 'again?!', 'still waiting', 'no response'];
  const gratefulIndicators = ['thank', 'appreciate', 'grateful', 'awesome', 'amazing', 'great job', 'love it', 'perfect', 'excellent', 'wonderful'];
  const confusedIndicators = ['confused', 'don\'t understand', 'not sure', 'unclear', 'what do you mean', 'can you explain', 'lost', 'help me understand'];
  const excitedIndicators = ['excited', 'can\'t wait', 'looking forward', 'thrilled', 'pumped', '!!!', 'so happy', 'finally'];
  const cautiousIndicators = ['concerned', 'worried', 'hesitant', 'not certain', 'need to think', 'want to make sure', 'before I commit', 'vital', 'ensure'];
  
  const countMatches = (indicators: string[]) => 
    indicators.filter(i => lowerMessage.includes(i)).length;
  
  const scores = {
    frustrated: countMatches(frustratedIndicators),
    grateful: countMatches(gratefulIndicators),
    confused: countMatches(confusedIndicators),
    excited: countMatches(excitedIndicators),
    cautious: countMatches(cautiousIndicators),
  };
  
  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) return 'neutral';
  
  return Object.entries(scores).find(([_, score]) => score === maxScore)?.[0] || 'neutral';
}

// Score knowledge entries by relevance to the message
function scoreKnowledgeRelevance(message: string, entries: KnowledgeEntry[]): KnowledgeEntry[] {
  const messageLower = message.toLowerCase();
  const messageWords = new Set(messageLower.split(/\s+/).filter(w => w.length > 3));
  
  return entries.map(entry => {
    let score = 0;
    
    // Keyword matching (highest weight)
    if (entry.keywords) {
      for (const keyword of entry.keywords) {
        if (messageLower.includes(keyword.toLowerCase())) {
          score += 25;
        }
      }
    }
    
    // Title matching
    const titleWords = entry.title.toLowerCase().split(/\s+/);
    for (const word of titleWords) {
      if (messageLower.includes(word) && word.length > 3) {
        score += 15;
      }
    }
    
    // Content word overlap
    const contentWords = entry.content.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    const uniqueContentWords = [...new Set(contentWords)].slice(0, 50);
    let contentMatchCount = 0;
    for (const word of uniqueContentWords) {
      if (messageWords.has(word)) {
        contentMatchCount++;
      }
    }
    score += contentMatchCount * 3;
    
    // Priority boost
    score += (entry.priority || 0) * 5;
    
    // Referral link bonus for recommendation queries
    if (entry.referral_link && messageLower.match(/recommend|suggest|referral|who do you use|vendor|contractor/)) {
      score += 30;
    }
    
    // Category-specific boosts
    if (entry.category === 'pricing' && messageLower.match(/price|cost|fee|rate|charge|how much/)) {
      score += 20;
    }
    if (entry.category === 'services' && messageLower.match(/service|offer|provide|do you|can you/)) {
      score += 20;
    }
    if (entry.category === 'policies' && messageLower.match(/policy|rule|allow|permit|require/)) {
      score += 20;
    }
    
    return { ...entry, relevanceScore: score };
  })
  .filter(e => (e.relevanceScore || 0) > 10)
  .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
  .slice(0, 5);
}

// Analyze conversation thread
function analyzeThread(
  messages: Array<{ direction: string; content: string; created_at: string }>,
  incomingMessage?: string
): ThreadAnalysis {
  const questions: QuestionItem[] = [];
  const ourPromises: PromiseItem[] = [];
  const allTopics: string[] = [];
  const sentiments: string[] = [];
  
  // Analyze each message
  for (const msg of messages) {
    if (msg.direction === 'inbound') {
      // Extract questions from their messages
      const extractedQuestions = extractQuestions(msg.content);
      for (const q of extractedQuestions) {
        questions.push({
          text: q,
          answered: false, // Will check against our responses
          askedAt: msg.created_at,
        });
      }
      sentiments.push(detectSentiment(msg.content));
    } else {
      // Extract promises from our messages
      const extractedPromises = extractPromises(msg.content);
      for (const p of extractedPromises) {
        ourPromises.push({
          text: p,
          fulfilled: false, // Would need follow-up analysis
          madeAt: msg.created_at,
        });
      }
      
      // Check if our message answered any questions
      const msgLower = msg.content.toLowerCase();
      for (const q of questions) {
        if (!q.answered) {
          const qKeywords = q.text.toLowerCase().split(/\s+/).filter(w => w.length > 3);
          const matchCount = qKeywords.filter(kw => msgLower.includes(kw)).length;
          if (matchCount >= Math.min(2, qKeywords.length * 0.3)) {
            q.answered = true;
            q.answer = msg.content.substring(0, 200);
          }
        }
      }
    }
  }
  
  // Add questions from incoming message if provided
  if (incomingMessage) {
    const newQuestions = extractQuestions(incomingMessage);
    for (const q of newQuestions) {
      questions.push({
        text: q,
        answered: false,
        askedAt: new Date().toISOString(),
      });
    }
    sentiments.push(detectSentiment(incomingMessage));
  }
  
  // Calculate sentiment trajectory
  let sentimentTrajectory: 'improving' | 'stable' | 'declining' = 'stable';
  if (sentiments.length >= 3) {
    const recentSentiments = sentiments.slice(-3);
    const positiveCount = recentSentiments.filter(s => ['grateful', 'excited'].includes(s)).length;
    const negativeCount = recentSentiments.filter(s => ['frustrated', 'cautious'].includes(s)).length;
    
    if (positiveCount > negativeCount + 1) sentimentTrajectory = 'improving';
    else if (negativeCount > positiveCount + 1) sentimentTrajectory = 'declining';
  }
  
  // Determine conversation phase
  let conversationPhase = 'service';
  const allContent = messages.map(m => m.content.toLowerCase()).join(' ');
  if (allContent.includes('interested') || allContent.includes('learn more') || messages.length < 5) {
    conversationPhase = 'initial_inquiry';
  } else if (allContent.includes('price') || allContent.includes('cost') || allContent.includes('contract')) {
    conversationPhase = 'negotiation';
  } else if (allContent.includes('onboarding') || allContent.includes('getting started') || allContent.includes('setup')) {
    conversationPhase = 'onboarding';
  } else if (allContent.includes('meet') || allContent.includes('in person') || allContent.includes('walkthrough') || allContent.includes('see the place')) {
    conversationPhase = 'scheduling_meeting';
  }
  
  return {
    questions: questions.filter(q => !q.answered).slice(-5), // Keep only unanswered
    ourPromises: ourPromises.slice(-5),
    topicThreads: [...new Set(allTopics)].slice(0, 5),
    sentimentTrajectory,
    lastInboundSentiment: sentiments[sentiments.length - 1] || 'neutral',
    conversationPhase,
    messageCount: messages.length,
  };
}

// Helper to normalize phone numbers for matching
function normalizePhone(phone: string): string[] {
  if (!phone) return [];
  const digits = phone.replace(/\D/g, '');
  const variants: string[] = [digits];
  
  // If has country code (11 digits starting with 1)
  if (digits.length === 11 && digits.startsWith('1')) {
    variants.push(digits.slice(1)); // Without country code
    variants.push(`+${digits}`); // With + prefix
  }
  // If 10 digits (no country code)
  if (digits.length === 10) {
    variants.push(`1${digits}`); // Add country code
    variants.push(`+1${digits}`); // With + prefix
  }
  
  return variants;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { 
      contactType, 
      contactId, 
      incomingMessage, 
      messageType,
      conversationThread: providedThread,
      ghlContactId,
      contactPhone,
      contactEmail 
    }: ContextRequest = await req.json();

    if (!contactType || !contactId) {
      throw new Error("contactType and contactId are required");
    }

    console.log(`Gathering context for ${contactType} ${contactId}`);
    console.log(`Additional identifiers - GHL: ${ghlContactId}, Phone: ${contactPhone}, Email: ${contactEmail}`);
    console.log(`Provided thread has ${providedThread?.length || 0} messages`);

    // Parallel data fetching
    // Get contact details - handle lead, owner, vendor, or fallback to generic
    const getContactQuery = () => {
      if (contactType === 'lead') {
        return supabase.from('leads').select('*').eq('id', contactId).maybeSingle();
      } else if (contactType === 'owner') {
        return supabase.from('property_owners').select('*, properties(*)').eq('id', contactId).maybeSingle();
      } else if (contactType === 'vendor') {
        return supabase.from('vendors').select('*').eq('id', contactId).maybeSingle();
      } else {
        // For 'other' type, try to find by phone/email in various tables
        return supabase.from('leads').select('*').eq('id', contactId).maybeSingle();
      }
    };

    const [
      contactResult,
      knowledgeResult,
      intelligenceResult,
      toneResult,
      memoriesResult,
    ] = await Promise.all([
      // Get contact details based on type
      getContactQuery(),
      
      // Get knowledge base
      supabase
        .from('company_knowledge_base')
        .select('*')
        .eq('is_active', true)
        .order('priority', { ascending: false }),
      
      // Get existing intelligence
      supabase
        .from('contact_intelligence')
        .select('*')
        .eq('contact_type', contactType)
        .eq('contact_id', contactId)
        .single(),
      
      // Get tone profile
      supabase
        .from('user_tone_profiles')
        .select('*')
        .limit(1)
        .single(),
      
      // Get memories from conversation summaries
      supabase
        .from('conversation_summaries')
        .select('one_liner, key_points, action_items')
        .or(`lead_id.eq.${contactId},owner_id.eq.${contactId}`)
        .order('updated_at', { ascending: false })
        .limit(3),
    ]);

    // Multi-identifier message lookup
    let messages: Array<{ direction: string; content: string; created_at: string }> = [];
    
    // Strategy 1: If we have a provided thread from the frontend, use that as primary source
    if (providedThread && providedThread.length > 0) {
      console.log(`Using provided conversation thread with ${providedThread.length} messages`);
      messages = providedThread
        .filter(m => m.body && m.body.trim())
        .map(m => ({
          direction: m.direction,
          content: m.body,
          created_at: m.created_at,
        }));
    }
    
    // Strategy 2: Query database with multiple identifiers if we don't have enough messages
    if (messages.length < 5) {
      console.log(`Attempting database lookup with multiple identifiers...`);
      
      // Build OR conditions for all possible identifiers
      const orConditions: string[] = [];
      
      // Try lead_id / owner_id
      if (contactId) {
        if (contactType === 'lead') {
          orConditions.push(`lead_id.eq.${contactId}`);
        } else {
          orConditions.push(`owner_id.eq.${contactId}`);
        }
      }
      
      // Try ghl_contact_id
      if (ghlContactId) {
        orConditions.push(`ghl_contact_id.eq.${ghlContactId}`);
      }
      
      // Try phone matching
      if (contactPhone) {
        const phoneVariants = normalizePhone(contactPhone);
        for (const variant of phoneVariants) {
          orConditions.push(`contact_phone.eq.${variant}`);
          orConditions.push(`from_number.eq.${variant}`);
          orConditions.push(`to_number.eq.${variant}`);
        }
      }
      
      // Try email matching
      if (contactEmail) {
        orConditions.push(`contact_email.eq.${contactEmail}`);
      }
      
      if (orConditions.length > 0) {
        const { data: dbMessages, error: messagesError } = await supabase
          .from('lead_communications')
          .select('direction, body, created_at, communication_type')
          .or(orConditions.join(','))
          .order('created_at', { ascending: false })
          .limit(50);
        
        if (messagesError) {
          console.error("Error fetching messages:", messagesError);
        } else if (dbMessages && dbMessages.length > 0) {
          console.log(`Found ${dbMessages.length} messages from database`);
          const dbMapped = dbMessages.reverse().map(m => ({
            direction: m.direction,
            content: m.body || '',
            created_at: m.created_at,
          })).filter(m => m.content && m.content.trim());
          
          // Merge with provided thread (deduplicate by timestamp + content)
          const existingKeys = new Set(messages.map(m => `${m.created_at}-${m.content.substring(0, 50)}`));
          for (const msg of dbMapped) {
            const key = `${msg.created_at}-${msg.content.substring(0, 50)}`;
            if (!existingKeys.has(key)) {
              messages.push(msg);
            }
          }
        }
      }
    }
    
    // Sort messages chronologically
    messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    console.log(`Final message count: ${messages.length}`);

    const contact = contactResult.data;
    const knowledgeEntries = knowledgeResult.data || [];
    const existingIntelligence = intelligenceResult.data;
    const toneData = toneResult.data;
    const summaries = memoriesResult.data || [];

    // Build contact profile
    const contactProfile: ContactProfile = {
      name: contact?.name || contact?.full_name || 'Unknown',
      email: contact?.email || contactEmail,
      phone: contact?.phone || contactPhone,
      relationshipStage: existingIntelligence?.relationship_stage || 'initial',
      communicationStyle: existingIntelligence?.communication_style || 'unknown',
      emotionalBaseline: existingIntelligence?.emotional_baseline || 'neutral',
      preferredChannel: existingIntelligence?.preferred_channel || 'unknown',
      painPoints: existingIntelligence?.pain_points || [],
      interests: existingIntelligence?.interests || [],
    };

    // Build tone profile
    const toneProfile: ToneProfile = {
      formality: toneData?.formality || 'casual',
      avgSentenceLength: toneData?.avg_sentence_length || 12,
      useContractions: toneData?.use_contractions ?? true,
      exclamationFrequency: toneData?.exclamation_frequency || 'moderate',
      emojiUsage: toneData?.emoji_usage || 'mirror',
      avoidedPhrases: toneData?.avoided_phrases || ['just checking in', 'hope this finds you', 'per our conversation'],
      commonClosings: toneData?.common_closings || ['- Ingo', 'Best, Ingo'],
      sampleMessages: toneData?.sample_messages || [],
    };

    // Analyze conversation thread
    const threadAnalysis = analyzeThread(messages, incomingMessage);

    // Score and filter knowledge by relevance
    const relevantKnowledge = incomingMessage 
      ? scoreKnowledgeRelevance(incomingMessage, knowledgeEntries)
      : knowledgeEntries.slice(0, 5);

    // Extract memories from summaries
    const memories: string[] = [];
    for (const summary of summaries) {
      if (summary.one_liner) memories.push(summary.one_liner);
      if (summary.key_points) {
        const points = Array.isArray(summary.key_points) ? summary.key_points : [];
        memories.push(...points.map((p: any) => typeof p === 'string' ? p : p.point || ''));
      }
    }

    // Get financial context for owners
    let financialContext: FinancialContext | undefined;
    if (contactType === 'owner' && contact?.properties?.length > 0) {
      const propertyId = contact.properties[0].id;
      const { data: revenueData } = await supabase
        .from('monthly_revenue_summary')
        .select('total_revenue, occupancy_rate, month')
        .eq('property_id', propertyId)
        .order('month', { ascending: false })
        .limit(1)
        .single();
      
      if (revenueData) {
        financialContext = {
          monthlyRevenue: revenueData.total_revenue,
          occupancyRate: revenueData.occupancy_rate,
          lastStatementDate: revenueData.month,
        };
      }
    }

    // Build the context package
    const contextPackage: ContextPackage = {
      contactProfile,
      toneProfile,
      threadAnalysis,
      relevantKnowledge,
      memories: memories.filter(m => m).slice(0, 10),
      financialContext,
      recentMessages: messages.slice(-15).map(m => ({
        direction: m.direction,
        content: m.content.substring(0, 800),
        timestamp: m.created_at,
      })),
      metadata: {
        contextGatheredAt: new Date().toISOString(),
        messageType,
        totalContextItems: memories.length + relevantKnowledge.length + messages.length,
      },
    };

    // Update contact intelligence with latest analysis
    if (existingIntelligence) {
      await supabase
        .from('contact_intelligence')
        .update({
          sentiment_trajectory: threadAnalysis.sentimentTrajectory,
          last_sentiment: threadAnalysis.lastInboundSentiment,
          unanswered_questions: threadAnalysis.questions,
          our_promises: threadAnalysis.ourPromises,
          total_messages_received: messages.filter(m => m.direction === 'inbound').length,
          total_messages_sent: messages.filter(m => m.direction === 'outbound').length,
          last_analyzed_at: new Date().toISOString(),
        })
        .eq('id', existingIntelligence.id);
    } else {
      // Create new intelligence record
      await supabase
        .from('contact_intelligence')
        .insert({
          contact_type: contactType,
          contact_id: contactId,
          sentiment_trajectory: threadAnalysis.sentimentTrajectory,
          last_sentiment: threadAnalysis.lastInboundSentiment,
          unanswered_questions: threadAnalysis.questions,
          our_promises: threadAnalysis.ourPromises,
          total_messages_received: messages.filter(m => m.direction === 'inbound').length,
          total_messages_sent: messages.filter(m => m.direction === 'outbound').length,
          last_analyzed_at: new Date().toISOString(),
        });
    }

    console.log(`Context gathered: ${contextPackage.metadata.totalContextItems} items, ${contextPackage.recentMessages.length} recent messages`);

    return new Response(
      JSON.stringify({
        success: true,
        context: contextPackage,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in unified-context-engine:", error);
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
