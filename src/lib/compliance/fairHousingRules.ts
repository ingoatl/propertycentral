// Fair Housing Act Compliance Rules
// Based on 7 protected classes under the Fair Housing Act

export interface CompliancePattern {
  pattern: RegExp;
  severity: 'block' | 'warn' | 'context';
  category: string;
  suggestion?: string;
  note?: string;
}

export interface ComplianceIssue {
  phrase: string;
  category: string;
  severity: 'block' | 'warn' | 'context';
  suggestion: string;
  note?: string;
}

export const FAIR_HOUSING_PATTERNS: Record<string, CompliancePattern[]> = {
  familial_status: [
    { 
      pattern: /\b(no|not? allow(ed)?|without|don'?t want) (kids?|children|minors?|families)\b/i, 
      severity: 'block',
      category: 'familial_status',
      suggestion: 'All applicants are welcome to apply'
    },
    { 
      pattern: /\b(adult[s]? only|seniors? only|55\+|over 55|65\+)\b/i, 
      severity: 'warn',
      category: 'familial_status',
      note: 'May be valid for HOPA-qualified communities only',
      suggestion: 'Verify HOPA qualification before using this language'
    },
    { 
      pattern: /\bquiet (building|community|neighborhood|complex)\b/i, 
      severity: 'warn',
      category: 'familial_status',
      suggestion: 'Peaceful community or well-maintained property'
    },
    { 
      pattern: /\b(no pets|pet[- ]?free).*(no kids|no children)/i, 
      severity: 'block',
      category: 'familial_status',
      suggestion: 'Remove reference to children'
    },
    {
      pattern: /\bperfect for (couples?|singles?|retirees?)\b/i,
      severity: 'warn',
      category: 'familial_status',
      suggestion: 'Perfect for anyone seeking comfortable living'
    }
  ],
  
  race_color: [
    { 
      pattern: /\bno section ?8\b/i, 
      severity: 'block',
      category: 'race_color',
      note: 'Disparate impact on protected classes',
      suggestion: 'We evaluate all applications based on rental criteria'
    },
    { 
      pattern: /\b(professionals? only|executive|white[- ]?collar)\b/i, 
      severity: 'warn',
      category: 'race_color',
      suggestion: 'Income verification required - specify actual requirements'
    },
    {
      pattern: /\b(exclusive|upscale|elite) (neighborhood|community|area)\b/i,
      severity: 'warn',
      category: 'race_color',
      suggestion: 'Well-maintained community'
    },
    {
      pattern: /\bintegrated (neighborhood|community)\b/i,
      severity: 'warn',
      category: 'race_color',
      suggestion: 'Diverse community'
    }
  ],
  
  national_origin: [
    { 
      pattern: /\b(must|need to|required to) speak english\b/i, 
      severity: 'block',
      category: 'national_origin',
      suggestion: 'Remove language requirements unless required by law'
    },
    { 
      pattern: /\b(americans?|citizens?|us citizens?) only\b/i, 
      severity: 'block',
      category: 'national_origin',
      suggestion: 'All qualified applicants welcome'
    },
    { 
      pattern: /\b(no|without) (immigrants?|foreigners?|aliens?)\b/i, 
      severity: 'block',
      category: 'national_origin',
      suggestion: 'Remove nationality references'
    },
    {
      pattern: /\b(english[- ]speaking|speak english)\b/i,
      severity: 'warn',
      category: 'national_origin',
      suggestion: 'Communication in English available'
    },
    {
      pattern: /\b(birth certificate|citizenship|green card|visa) required\b/i,
      severity: 'warn',
      category: 'national_origin',
      note: 'May be needed for legal verification but use cautiously',
      suggestion: 'Government-issued ID required'
    }
  ],
  
  religion: [
    { 
      pattern: /\b(christian|muslim|jewish|catholic|protestant|hindu|buddhist) (community|neighborhood|values|family)\b/i, 
      severity: 'block',
      category: 'religion',
      suggestion: 'Remove religious references'
    },
    {
      pattern: /\b(near|close to|walking distance) (church|mosque|synagogue|temple)\b/i,
      severity: 'context',
      category: 'religion',
      note: 'OK for describing location, not for marketing to specific groups'
    },
    {
      pattern: /\b(no|without) (religious|church|worship)\b/i,
      severity: 'block',
      category: 'religion',
      suggestion: 'Remove religious references'
    }
  ],
  
  disability: [
    { 
      pattern: /\b(must|able to|can|need to) (walk|climb|use stairs|carry|lift)\b/i, 
      severity: 'block',
      category: 'disability',
      suggestion: 'Property features: [describe accessibility features]'
    },
    { 
      pattern: /\bno (wheelchair|disability|handicap|disabled)\b/i, 
      severity: 'block',
      category: 'disability',
      suggestion: 'Reasonable accommodations available upon request'
    },
    { 
      pattern: /\bmental(ly)? (ill|health|stable|sound)\b/i, 
      severity: 'warn',
      category: 'disability',
      suggestion: 'Remove mental health references'
    },
    {
      pattern: /\b(sober|drug[- ]?free|no addicts?)\b/i,
      severity: 'warn',
      category: 'disability',
      note: 'Recovery status may be protected',
      suggestion: 'Standard background check required'
    },
    {
      pattern: /\bphysically fit\b/i,
      severity: 'block',
      category: 'disability',
      suggestion: 'Remove physical requirements'
    }
  ],
  
  sex_gender: [
    { 
      pattern: /\b(perfect for|ideal for|great for) (single )?(men|women|guys?|girls?|ladies|gentlemen|males?|females?)\b/i, 
      severity: 'block',
      category: 'sex_gender',
      suggestion: 'Perfect for anyone seeking quality housing'
    },
    { 
      pattern: /\b(man|woman|male|female|men|women) only\b/i, 
      severity: 'block',
      category: 'sex_gender',
      suggestion: 'All qualified applicants welcome'
    },
    {
      pattern: /\b(bachelor|bachelorette) pad\b/i,
      severity: 'warn',
      category: 'sex_gender',
      suggestion: 'Studio apartment or one-bedroom unit'
    },
    {
      pattern: /\b(master|man cave)\b/i,
      severity: 'context',
      category: 'sex_gender',
      note: 'Architectural terms may be acceptable in context',
      suggestion: 'Primary suite or bonus room'
    }
  ]
};

// GA Real Estate License Topics
export const GA_LICENSE_TOPICS = {
  requires_broker: [
    /\b(negotiate|negotiating|negotiation)\b/i,
    /\b(rental price|rent amount|pricing|rate adjustment)\b/i,
    /\b(lease terms?|contract terms?|agreement terms?)\b/i,
    /\b(security deposit|earnest money)\b/i,
    /\b(commission|fee structure|management fee)\b/i,
  ],
  requires_oversight: [
    /\b(property value|market analysis|valuation)\b/i,
    /\b(investment advice|financial recommendation)\b/i,
    /\b(legal advice|legal matter)\b/i,
  ],
  operations_allowed: [
    /\b(maintenance|repair|cleaning|inspection)\b/i,
    /\b(check[- ]?in|check[- ]?out|arrival|departure)\b/i,
    /\b(amenities|features|parking|utilities)\b/i,
    /\b(schedule|appointment|booking confirmation)\b/i,
    /\b(thank you|welcome|follow[- ]?up)\b/i,
  ]
};

export function validateFairHousing(message: string): {
  compliant: boolean;
  issues: ComplianceIssue[];
  riskScore: number;
} {
  const issues: ComplianceIssue[] = [];
  let riskScore = 0;
  
  const lowerMessage = message.toLowerCase();
  
  for (const [category, patterns] of Object.entries(FAIR_HOUSING_PATTERNS)) {
    for (const { pattern, severity, suggestion, note } of patterns) {
      const match = message.match(pattern);
      if (match) {
        issues.push({
          phrase: match[0],
          category,
          severity,
          suggestion: suggestion || 'Review and revise this language',
          note
        });
        
        // Calculate risk score
        if (severity === 'block') riskScore += 40;
        else if (severity === 'warn') riskScore += 20;
        else riskScore += 10;
      }
    }
  }
  
  return {
    compliant: !issues.some(i => i.severity === 'block'),
    issues,
    riskScore: Math.min(100, riskScore)
  };
}

export function classifyMessageTopic(message: string): {
  classification: 'operations' | 'requires_broker' | 'requires_oversight';
  requiresBrokerReview: boolean;
  matchedTopics: string[];
} {
  const matchedTopics: string[] = [];
  
  // Check if message requires broker
  for (const pattern of GA_LICENSE_TOPICS.requires_broker) {
    if (pattern.test(message)) {
      matchedTopics.push('requires_broker');
    }
  }
  
  // Check if message requires oversight
  for (const pattern of GA_LICENSE_TOPICS.requires_oversight) {
    if (pattern.test(message)) {
      matchedTopics.push('requires_oversight');
    }
  }
  
  // Check if operations-allowed
  for (const pattern of GA_LICENSE_TOPICS.operations_allowed) {
    if (pattern.test(message)) {
      matchedTopics.push('operations');
    }
  }
  
  // Determine classification
  if (matchedTopics.includes('requires_broker')) {
    return {
      classification: 'requires_broker',
      requiresBrokerReview: true,
      matchedTopics
    };
  }
  
  if (matchedTopics.includes('requires_oversight')) {
    return {
      classification: 'requires_oversight',
      requiresBrokerReview: true,
      matchedTopics
    };
  }
  
  return {
    classification: 'operations',
    requiresBrokerReview: false,
    matchedTopics
  };
}
