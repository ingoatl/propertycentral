import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fair Housing Prohibited Patterns
const FAIR_HOUSING_PATTERNS = {
  familial_status: [
    { pattern: /\b(no|not? allow(ed)?|without|don'?t want) (kids?|children|minors?|families)\b/i, severity: 'block', suggestion: 'All applicants are welcome to apply' },
    { pattern: /\b(adult[s]? only|seniors? only|55\+|over 55|65\+)\b/i, severity: 'warn', suggestion: 'Verify HOPA qualification' },
    { pattern: /\bquiet (building|community|neighborhood|complex)\b/i, severity: 'warn', suggestion: 'Peaceful community' },
    { pattern: /\bperfect for (couples?|singles?|retirees?)\b/i, severity: 'warn', suggestion: 'Perfect for anyone seeking comfortable living' }
  ],
  race_color: [
    { pattern: /\bno section ?8\b/i, severity: 'block', suggestion: 'We evaluate all applications based on rental criteria' },
    { pattern: /\b(professionals? only|executive|white[- ]?collar)\b/i, severity: 'warn', suggestion: 'Income verification required' },
    { pattern: /\b(exclusive|upscale|elite) (neighborhood|community)\b/i, severity: 'warn', suggestion: 'Well-maintained community' }
  ],
  national_origin: [
    { pattern: /\b(must|need to|required to) speak english\b/i, severity: 'block', suggestion: 'Remove language requirements' },
    { pattern: /\b(americans?|citizens?|us citizens?) only\b/i, severity: 'block', suggestion: 'All qualified applicants welcome' },
    { pattern: /\b(no|without) (immigrants?|foreigners?|aliens?)\b/i, severity: 'block', suggestion: 'Remove nationality references' }
  ],
  religion: [
    { pattern: /\b(christian|muslim|jewish|catholic|protestant|hindu|buddhist) (community|neighborhood|values)\b/i, severity: 'block', suggestion: 'Remove religious references' }
  ],
  disability: [
    { pattern: /\b(must|able to|can|need to) (walk|climb|use stairs|carry|lift)\b/i, severity: 'block', suggestion: 'Describe accessibility features instead' },
    { pattern: /\bno (wheelchair|disability|handicap|disabled)\b/i, severity: 'block', suggestion: 'Reasonable accommodations available' },
    { pattern: /\bmental(ly)? (ill|health|stable|sound)\b/i, severity: 'warn', suggestion: 'Remove mental health references' },
    { pattern: /\bphysically fit\b/i, severity: 'block', suggestion: 'Remove physical requirements' }
  ],
  sex_gender: [
    { pattern: /\b(perfect for|ideal for|great for) (single )?(men|women|guys?|girls?|ladies|gentlemen)\b/i, severity: 'block', suggestion: 'Perfect for anyone seeking quality housing' },
    { pattern: /\b(man|woman|male|female|men|women) only\b/i, severity: 'block', suggestion: 'All qualified applicants welcome' }
  ]
};

// GA License Topic Patterns
const GA_LICENSE_TOPICS = {
  requires_broker: [
    /\b(negotiate|negotiating|negotiation)\b/i,
    /\b(rental price|rent amount|pricing|rate adjustment)\b/i,
    /\b(lease terms?|contract terms?)\b/i,
    /\b(security deposit|earnest money)\b/i,
    /\b(commission|management fee)\b/i
  ],
  requires_oversight: [
    /\b(property value|market analysis|valuation)\b/i,
    /\b(investment advice|financial recommendation)\b/i,
    /\b(legal advice|legal matter)\b/i
  ]
};

interface ValidationResult {
  compliant: boolean;
  issues: Array<{
    phrase: string;
    category: string;
    severity: string;
    suggestion: string;
  }>;
  riskScore: number;
  canSend: boolean;
  requiresBrokerReview: boolean;
  topicClassification: string;
}

function validateMessage(message: string, senderRole: string): ValidationResult {
  const issues: ValidationResult['issues'] = [];
  let riskScore = 0;
  let requiresBrokerReview = false;
  let topicClassification = 'operations';

  // Fair Housing Check
  for (const [category, patterns] of Object.entries(FAIR_HOUSING_PATTERNS)) {
    for (const { pattern, severity, suggestion } of patterns) {
      const match = message.match(pattern);
      if (match) {
        issues.push({
          phrase: match[0],
          category,
          severity,
          suggestion
        });
        if (severity === 'block') riskScore += 40;
        else if (severity === 'warn') riskScore += 20;
      }
    }
  }

  // GA License Check (for non-admin/broker roles)
  if (senderRole === 'operations_manager' || senderRole === 'agent') {
    for (const pattern of GA_LICENSE_TOPICS.requires_broker) {
      if (pattern.test(message)) {
        requiresBrokerReview = true;
        topicClassification = 'requires_broker';
        break;
      }
    }
    
    if (!requiresBrokerReview) {
      for (const pattern of GA_LICENSE_TOPICS.requires_oversight) {
        if (pattern.test(message)) {
          requiresBrokerReview = true;
          topicClassification = 'requires_oversight';
          break;
        }
      }
    }
  }

  const hasBlockingIssue = issues.some(i => i.severity === 'block');
  
  return {
    compliant: !hasBlockingIssue,
    issues,
    riskScore: Math.min(100, riskScore),
    canSend: !hasBlockingIssue && !requiresBrokerReview,
    requiresBrokerReview,
    topicClassification
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, messageType, senderRole, recipientType, senderUserId, logResult } = await req.json();

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = validateMessage(message, senderRole || 'user');

    // Log to compliance table if requested
    if (logResult) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      await supabase.from('compliance_message_log').insert({
        original_message: message,
        message_type: messageType || 'sms',
        sender_user_id: senderUserId,
        sender_role: senderRole,
        recipient_type: recipientType,
        fh_compliant: result.compliant,
        fh_risk_score: result.riskScore,
        fh_issues: result.issues,
        fh_blocked_phrases: result.issues.filter(i => i.severity === 'block').map(i => i.phrase),
        ga_compliant: !result.requiresBrokerReview,
        requires_broker_review: result.requiresBrokerReview,
        topic_classification: result.topicClassification,
        action_taken: result.canSend ? 'sent' : (result.requiresBrokerReview ? 'escalated' : 'blocked')
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        ...result
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Validation error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Validation failed',
        compliant: true, // Default to compliant on error to not block
        canSend: true,
        issues: [],
        riskScore: 0
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
