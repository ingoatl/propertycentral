-- Insert comprehensive Ingo Tone of Voice knowledge entries
-- Delete any existing tone entries first to avoid duplicates
DELETE FROM company_knowledge_base WHERE category = 'tone';

-- Main Tone of Voice Profile
INSERT INTO company_knowledge_base (category, subcategory, title, content, keywords, priority, is_active, use_in_contexts)
VALUES 
(
  'tone', 
  'voice-profile', 
  'Ingo Communication Tone of Voice',
  'Primary tone: Professional, Detail-Oriented, and Proactive. Adapts based on recipient.

FOR CLIENTS (Sales/Service):
- Welcoming, reassuring, and highly structured
- Summarize complex information in concise, bulleted recaps
- Use phrases like "Thank you again for taking the time to speak with us"
- Proactively address next steps or follow-up actions
- Be warm but professional

FOR VENDORS/SUPPORT:
- Direct, clear, and action-oriented
- Focus on problem resolution or transaction details
- Firm when requesting escalation: "please transfer me to a teammate"
- Specific when requesting action: "Please proceed accordingly"

SCHEDULING/QUICK CONFIRMATIONS:
- Concise and affirmative: "Yes Thursday at noon confirmed"

SIGNATURE STYLE:
- SMS: Always end with "- Ingo"
- Email: End with "Best, Ingo\nPeachHaus Group"
- NEVER use emojis - absolutely none',
  ARRAY['tone', 'voice', 'style', 'ingo', 'communication', 'professional'],
  100,
  true,
  ARRAY['all', 'email', 'sms']
),

-- Client Communication Style
(
  'tone',
  'client-style',
  'Client Communication Style',
  'When communicating with clients (leads, property owners, prospects):

GREETING: Start with "Hi [FirstName]," for both SMS and email
STRUCTURE: Use bulleted recaps for complex topics
PHRASES TO USE:
- "Thank you again for taking the time to speak with us"
- "Looking forward to working together"
- "Let me know if you have any questions"
- "Happy to help"

APPROACH:
- Be welcoming and reassuring
- Anticipate their concerns
- Provide clear next steps
- Be specific about timelines

AVOID:
- Generic corporate speak
- Over-promising
- Being pushy or salesy
- Using jargon without explanation',
  ARRAY['client', 'lead', 'owner', 'prospect', 'sales', 'service'],
  95,
  true,
  ARRAY['all', 'email', 'sms']
),

-- Vendor/Support Communication Style  
(
  'tone',
  'vendor-style',
  'Vendor and Support Communication Style',
  'When communicating with vendors, support teams, or service providers:

APPROACH:
- Direct, clear, and action-oriented
- Focus on problem resolution
- Be specific about what you need
- Set clear expectations

PHRASES TO USE:
- "Please proceed accordingly"
- "Please transfer me to a teammate who can help"
- "I need this resolved by [date]"
- "Can you confirm the following..."

ESCALATION:
- Be firm but professional when escalating
- Document the issue clearly
- Reference previous conversations
- State the business impact

TRANSACTIONS:
- Be specific about amounts, dates, and terms
- Confirm details in writing
- Follow up on commitments',
  ARRAY['vendor', 'support', 'provider', 'escalation', 'business'],
  90,
  true,
  ARRAY['all', 'email', 'sms']
),

-- Updated Fee Structure
(
  'pricing',
  'fee-structure',
  'PeachHaus Fee Structure',
  'Management Fees:
- Mid-Term Rentals (MTR): 18% of rental income (after platform fees)
- Hybrid Strategy (Mid-Term + Short-Term): 20% of rental income

Fixed Fees:
- One-time onboarding fee: $599

Other Costs:
- Cleaning fees: Pass-through expense (guest pays)
- Maintenance: Allowance limit up to $300, billed monthly

Example Client Response:
"There is 18% for Mid Term and 20% for Hybrid Management. Cleaning is a pass-through expense - the guest pays for it. For maintenance, we ask for an allowance to fix things up to $300."',
  ARRAY['fees', 'cost', 'price', 'percentage', 'management fee', 'pricing', '18%', '20%', 'onboarding'],
  100,
  true,
  ARRAY['all', 'email', 'sms']
),

-- Property Management Strategy
(
  'services',
  'rental-strategy',
  'Property Management Strategy - MTR vs Hybrid',
  'Primary Recommendation: Mid-Term Rentals (MTR)
- 1-6 month furnished stays
- Can generate +120% vs traditional Long-Term Rentals (LTR)
- 30+ day minimum stays
- Premium tenants: traveling professionals, corporate relocations, insurance placements

Alternative: Hybrid Strategy
- Combines Mid-Term + Short-Term rentals
- Short-term during peak seasons for maximum revenue
- Mid-term during slower periods for stability

Example Client Response:
"Primary recommendation: Mid-Term Rentals (30+ days). Estimated potential monthly revenue discussed: approximately $4,400"',
  ARRAY['mtr', 'mid-term', 'hybrid', 'strategy', 'rental', 'ltr', 'income', 'revenue'],
  95,
  true,
  ARRAY['all', 'email', 'sms']
),

-- Technology & Operations
(
  'services',
  'technology',
  'Technology and Operations',
  'Advanced Tools for Efficiency:

Revenue Management:
- AI-powered event pricing
- Tracking of events in your dashboard
- Dynamic pricing optimization

Maintenance:
- Predictive maintenance using AI
- Our tools predict things to fix before they break
- Proactive approach reduces emergency repairs

Example Client Response:
"We use AI-powered event pricing and tracking of events in your dashboard. For maintenance, we use predictive maintenance using AI where our tools predict things to fix before they break."',
  ARRAY['technology', 'ai', 'pricing', 'maintenance', 'dashboard', 'automation'],
  85,
  true,
  ARRAY['all', 'email', 'sms']
),

-- Contract Terms
(
  'policies',
  'contract-terms',
  'Contract Terms',
  'Standard Contract Terms:
- Initial term: 3 months
- After initial term: Converts to month-to-month
- Flexible exit provisions after initial period

Example Client Response:
"The contract is initially 3 months and turns into a month-to-month after."',
  ARRAY['contract', 'term', 'exit', 'month-to-month', 'agreement', 'duration'],
  90,
  true,
  ARRAY['all', 'email', 'sms']
),

-- Insurance Coordination
(
  'policies',
  'insurance',
  'Insurance Coordination',
  'Insurance Partners:
- Steadily Insurance
- Wister Insurance
- Specialized furnished-rental coverage

Key Information:
- PeachHaus should be added as additional insured on owner policies
- If added as Additional Insured on all client policies with Commercial Liability coverage, 75% discount on Liability portion of premium possible

Process:
- Coordinate with specialized furnished-rental insurance providers
- Help clients secure proper coverage
- Ensure PeachHaus is listed as additional insured',
  ARRAY['insurance', 'steadily', 'wister', 'additional insured', 'liability', 'coverage', 'policy'],
  85,
  true,
  ARRAY['all', 'email', 'sms']
);