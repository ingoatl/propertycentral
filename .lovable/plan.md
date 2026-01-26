
# Fair Housing Compliance & AI Reliability Enhancement Plan

## Executive Summary

This plan implements three critical systems:
1. **Fair Housing Compliance Layer** - AI-powered screening of all outbound messages against Fair Housing Act rules
2. **Georgia Real Estate License Compliance** - Validation that operations managers can send specific message types under GA law
3. **Self-Healing AI Watchdog** - Prevents edge function failures and auto-recovers from errors

---

## Part 1: Fair Housing Compliance System

### Background Research

The **Fair Housing Act** prohibits discrimination in housing-related communications based on 7 protected classes:
- Race
- Color
- National Origin
- Religion
- Sex (including gender identity and sexual orientation)
- Familial Status (families with children under 18)
- Disability

### Prohibited Language Categories

Messages will be screened for:

| Category | Examples to Block |
|----------|------------------|
| **Race/Color** | "no Section 8", "professionals only", neighborhood demographics |
| **National Origin** | "must speak English", "Americans only", citizenship requirements |
| **Religion** | "Christian community", "near churches", religious holidays as criteria |
| **Sex/Gender** | "perfect for single men", gender-specific pronouns for property |
| **Familial Status** | "adult community", "no children", "quiet building", school references as negative |
| **Disability** | "must be able to climb stairs", "no wheelchairs", mental health references |

### Implementation: Compliance Validation Edge Function

**New file: `supabase/functions/validate-fair-housing/index.ts`**

```text
POST /validate-fair-housing
{
  "message": "The message to validate",
  "messageType": "sms" | "email",
  "senderRole": "admin" | "operations_manager" | "agent",
  "recipientType": "lead" | "owner" | "tenant" | "vendor"
}

Response:
{
  "compliant": true | false,
  "issues": [
    {
      "phrase": "detected phrase",
      "category": "familial_status",
      "severity": "block" | "warn",
      "suggestion": "alternative phrasing"
    }
  ],
  "riskScore": 0-100,
  "canSend": true | false
}
```

### Detection Strategy

1. **Keyword Pattern Matching** - Fast first-pass filter for known prohibited terms
2. **AI Context Analysis** - Lovable AI analyzes message context for subtle discrimination
3. **Phrase Substitution Suggestions** - Provides compliant alternatives when possible

---

## Part 2: Georgia Real Estate License Compliance

### Background Research

Under **Georgia Code Title 43, Chapter 40** and GREC rules:

| Communication Type | Broker Only | Operations Manager Allowed |
|-------------------|-------------|---------------------------|
| **Property marketing** | Requires licensure | Yes, if under broker supervision |
| **Lease negotiations** | Broker oversight needed | Yes, for existing clients |
| **Maintenance coordination** | N/A | Yes |
| **Owner financial discussions** | Broker/licensee | With broker approval |
| **Rental pricing discussions** | Licensee required | Must defer to broker |

### Implementation: Sender Authorization Check

The compliance layer will validate:
1. **Message topic classification** - Uses AI to detect if message involves licensed activities
2. **Sender role verification** - Checks if current user has appropriate role
3. **Escalation routing** - Flags messages that require broker review

### New Database Table: `compliance_message_log`

```sql
CREATE TABLE compliance_message_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID,
  original_message TEXT NOT NULL,
  message_type TEXT NOT NULL,
  sender_user_id UUID REFERENCES auth.users(id),
  sender_role TEXT,
  recipient_type TEXT,
  
  -- Fair Housing Analysis
  fh_compliant BOOLEAN NOT NULL,
  fh_risk_score INTEGER,
  fh_issues JSONB DEFAULT '[]',
  fh_blocked_phrases TEXT[],
  
  -- GA License Compliance
  ga_compliant BOOLEAN NOT NULL,
  requires_broker_review BOOLEAN DEFAULT false,
  topic_classification TEXT,
  
  -- Action taken
  action_taken TEXT CHECK (action_taken IN ('sent', 'blocked', 'modified', 'escalated')),
  modified_message TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Part 3: Self-Healing AI Watchdog

### Problem Analysis

The user reported an edge function error during AI response generation. Common failure modes:
1. **Rate limiting (429)** - Too many requests to Lovable AI
2. **Credit depletion (402)** - AI usage exceeded
3. **Timeout** - Long-running AI requests
4. **Context engine failure** - Missing or invalid contact data
5. **Network issues** - Transient connectivity problems

### Solution: AI Reliability Watchdog

**New file: `supabase/functions/ai-reliability-watchdog/index.ts`**

This watchdog will:

1. **Monitor AI Response Quality table** for failed generations
2. **Retry failed requests** with exponential backoff
3. **Circuit breaker pattern** to prevent cascade failures
4. **Automatic degradation** to simpler prompts when complex ones fail
5. **Alert on persistent failures** via team notifications

### Self-Healing Mechanisms

```text
┌─────────────────────────────────────────────────────────────┐
│                    AI REQUEST FLOW                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Message Input                                              │
│       │                                                     │
│       ▼                                                     │
│  ┌──────────────────┐                                       │
│  │ Fair Housing     │ ──Block──> Return Error               │
│  │ Compliance Check │                                       │
│  └────────┬─────────┘                                       │
│           │ Pass                                            │
│           ▼                                                 │
│  ┌──────────────────┐                                       │
│  │ GA License       │ ──Escalate──> Route to Broker        │
│  │ Authorization    │                                       │
│  └────────┬─────────┘                                       │
│           │ Authorized                                      │
│           ▼                                                 │
│  ┌──────────────────┐                                       │
│  │ Circuit Breaker  │ ──Open──> Use Cached/Template        │
│  │ Check            │                                       │
│  └────────┬─────────┘                                       │
│           │ Closed                                          │
│           ▼                                                 │
│  ┌──────────────────┐     ┌──────────────────┐             │
│  │ Primary AI Call  │ ──Fail──> Retry Queue  │             │
│  │ (gemini-3-flash) │          │              │             │
│  └────────┬─────────┘          │              │             │
│           │ Success            │ Retry        │             │
│           │                    ▼              │             │
│           │            ┌──────────────────┐   │             │
│           │            │ Fallback AI Call │   │             │
│           │            │ (simpler prompt) │   │             │
│           │            └────────┬─────────┘   │             │
│           │                     │             │             │
│           ▼                     ▼             │             │
│  ┌──────────────────────────────────────────┐│             │
│  │           Compliance Validation          ││             │
│  │      (re-check generated response)       ││             │
│  └────────────────────┬─────────────────────┘│             │
│                       │                       │             │
│                       ▼                       │             │
│                  Send Message                 │             │
│                                               │             │
└─────────────────────────────────────────────────────────────┘
```

### Circuit Breaker State Table

```sql
CREATE TABLE ai_circuit_breaker (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT UNIQUE NOT NULL,
  state TEXT CHECK (state IN ('closed', 'open', 'half_open')) DEFAULT 'closed',
  failure_count INTEGER DEFAULT 0,
  last_failure_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  half_open_at TIMESTAMPTZ,
  failure_threshold INTEGER DEFAULT 5,
  reset_timeout_seconds INTEGER DEFAULT 60,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Part 4: Integration with Existing Message Flow

### Modified Message Sending Flow

All message sending functions will be updated to include compliance checks:

**Files to modify:**
- `supabase/functions/ghl-send-sms/index.ts`
- `supabase/functions/send-lead-email/index.ts`
- `supabase/functions/unified-ai-compose/index.ts`

### Pre-Send Validation Hook

```typescript
// Before sending any message:
const compliance = await validateCompliance({
  message: messageContent,
  messageType: 'sms',
  senderUserId: userId,
  recipientType: contactType
});

if (!compliance.canSend) {
  if (compliance.requiresBrokerReview) {
    // Queue for broker approval
    await queueForBrokerReview(messageContent, compliance);
    return { success: false, reason: 'requires_broker_review' };
  }
  
  // Return with violations
  return { 
    success: false, 
    reason: 'compliance_violation',
    issues: compliance.issues,
    suggestions: compliance.suggestions
  };
}
```

### Frontend Warning UI

When compliance issues are detected, the UI will show:

```text
┌─────────────────────────────────────────────────────┐
│  ⚠️ Fair Housing Compliance Alert                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Your message contains language that may violate    │
│  the Fair Housing Act:                              │
│                                                     │
│  ❌ "no children" → familial status discrimination  │
│                                                     │
│  Suggested alternative:                             │
│  ✓ "All applicants welcome"                         │
│                                                     │
│  ┌────────────┐  ┌────────────────────────────┐    │
│  │  Edit      │  │  Request Broker Review     │    │
│  └────────────┘  └────────────────────────────┘    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Part 5: Watchdog Dashboard Integration

### New Admin Panel Section

Add compliance monitoring to the existing `SystemHealthPanel.tsx`:

```text
┌─────────────────────────────────────────────────────────────┐
│  System Health                                              │
├─────────────────────────────────────────────────────────────┤
│  [Integrations] [Email] [Finance] [Visits] [Partner]        │
│                                                             │
│  + [Compliance] ← NEW TAB                                   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Fair Housing Compliance          Last 24h            │   │
│  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │   │
│  │ Messages Scanned: 247                                │   │
│  │ Blocked: 3  │  Modified: 12  │  Escalated: 1        │   │
│  │                                                      │   │
│  │ Most Common Issues:                                  │   │
│  │ • "quiet building" (familial status) - 8 times      │   │
│  │ • "professionals" (race/income proxy) - 4 times     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ AI Service Health                 ● Healthy         │   │
│  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │   │
│  │ Circuit Breaker: CLOSED                              │   │
│  │ Success Rate: 99.2%                                  │   │
│  │ Avg Response Time: 2.3s                              │   │
│  │ Failed (auto-recovered): 2                           │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Summary

### New Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/validate-fair-housing/index.ts` | Fair Housing compliance validation |
| `supabase/functions/ai-reliability-watchdog/index.ts` | Self-healing AI monitoring |
| `src/components/admin/ComplianceWatchdogCard.tsx` | Dashboard for compliance monitoring |
| `src/components/communications/ComplianceAlert.tsx` | UI warning for violations |
| `src/lib/compliance/fairHousingRules.ts` | Prohibited phrase patterns |

### Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/ghl-send-sms/index.ts` | Add pre-send compliance check |
| `supabase/functions/send-lead-email/index.ts` | Add pre-send compliance check |
| `supabase/functions/unified-ai-compose/index.ts` | Add circuit breaker, retry logic, compliance validation |
| `src/components/admin/SystemHealthPanel.tsx` | Add Compliance tab |
| `src/components/communications/SendSMSDialog.tsx` | Show compliance warnings |
| `src/components/communications/ComposeEmailDialog.tsx` | Show compliance warnings |

### Database Migrations

1. Create `compliance_message_log` table
2. Create `ai_circuit_breaker` table
3. Add compliance-related columns to `watchdog_logs`

---

## Technical Details

### Fair Housing Prohibited Patterns

```typescript
// src/lib/compliance/fairHousingRules.ts
export const FAIR_HOUSING_PATTERNS = {
  familial_status: [
    { pattern: /\b(no|not? allow(ed)?|without) (kids?|children|minors?|families)\b/i, severity: 'block' },
    { pattern: /\b(adult[s]? only|seniors? only|55\+|over 55)\b/i, severity: 'warn', context: 'May be valid for HOPA-qualified communities' },
    { pattern: /\bquiet (building|community|neighborhood)\b/i, severity: 'warn' },
    { pattern: /\b(school|playground) (district|nearby)\b/i, severity: 'context', note: 'OK for marketing, not for screening' },
  ],
  race_color: [
    { pattern: /\bno section ?8\b/i, severity: 'block', note: 'Disparate impact on protected classes' },
    { pattern: /\b(professionals? only|executive|white[- ]collar)\b/i, severity: 'warn' },
  ],
  national_origin: [
    { pattern: /\b(must|need to|required) speak english\b/i, severity: 'block' },
    { pattern: /\b(americans?|citizens?) only\b/i, severity: 'block' },
    { pattern: /\b(no|without) (immigrants?|foreigners?)\b/i, severity: 'block' },
  ],
  religion: [
    { pattern: /\b(christian|muslim|jewish|catholic|protestant) (community|neighborhood|values)\b/i, severity: 'block' },
  ],
  disability: [
    { pattern: /\b(must|able to|can) (walk|climb|use stairs)\b/i, severity: 'block' },
    { pattern: /\bno (wheelchair|disability|handicap)\b/i, severity: 'block' },
    { pattern: /\bmental(ly)? (ill|health|stable)\b/i, severity: 'warn' },
  ],
  sex_gender: [
    { pattern: /\b(perfect for|ideal for|great for) (single )?(men|women|guys?|girls?|ladies|gentlemen)\b/i, severity: 'block' },
    { pattern: /\b(man|woman|male|female) only\b/i, severity: 'block' },
  ],
};
```

### AI Circuit Breaker Logic

```typescript
async function checkCircuitBreaker(serviceName: string): Promise<{
  canProceed: boolean;
  state: 'closed' | 'open' | 'half_open';
}> {
  const { data: breaker } = await supabase
    .from('ai_circuit_breaker')
    .select('*')
    .eq('service_name', serviceName)
    .single();
  
  if (!breaker) {
    return { canProceed: true, state: 'closed' };
  }
  
  const now = new Date();
  
  if (breaker.state === 'open') {
    const openedAt = new Date(breaker.opened_at);
    const elapsedSeconds = (now.getTime() - openedAt.getTime()) / 1000;
    
    if (elapsedSeconds >= breaker.reset_timeout_seconds) {
      // Move to half-open, allow one request
      await supabase
        .from('ai_circuit_breaker')
        .update({ state: 'half_open', half_open_at: now.toISOString() })
        .eq('id', breaker.id);
      
      return { canProceed: true, state: 'half_open' };
    }
    
    return { canProceed: false, state: 'open' };
  }
  
  return { canProceed: true, state: breaker.state };
}
```

### Error Recovery in unified-ai-compose

```typescript
// Enhanced error handling with retry and fallback
try {
  const aiResponse = await fetchWithRetry(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: { ... },
      body: JSON.stringify({ ... }),
    },
    { maxRetries: 3, backoffMs: 1000 }
  );
  
  // Success - update circuit breaker
  await recordSuccess('unified-ai-compose');
  
} catch (error) {
  // Record failure
  await recordFailure('unified-ai-compose', error);
  
  // Check if circuit should open
  const shouldOpen = await shouldOpenCircuit('unified-ai-compose');
  if (shouldOpen) {
    await openCircuit('unified-ai-compose');
  }
  
  // Attempt fallback
  return await generateFallbackResponse(context, messageType);
}
```

---

## Testing Plan

1. **Fair Housing Detection Tests**
   - Test each protected class pattern
   - Verify false positive handling
   - Test edge cases (legitimate uses)

2. **GA License Compliance Tests**
   - Test message topic classification
   - Verify escalation routing
   - Test broker approval workflow

3. **AI Reliability Tests**
   - Simulate rate limiting (429)
   - Simulate credit depletion (402)
   - Test circuit breaker state transitions
   - Verify retry logic with exponential backoff

---

## Rollout Plan

1. **Phase 1**: Deploy compliance validation function (monitor-only mode)
2. **Phase 2**: Enable warnings in UI (no blocking)
3. **Phase 3**: Enable blocking for high-severity violations
4. **Phase 4**: Add broker escalation workflow
5. **Phase 5**: Deploy AI watchdog with auto-recovery
