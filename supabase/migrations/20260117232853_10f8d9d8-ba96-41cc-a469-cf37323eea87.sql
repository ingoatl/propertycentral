-- Create company knowledge base table
CREATE TABLE public.company_knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  subcategory TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  keywords TEXT[] DEFAULT '{}',
  use_in_contexts TEXT[] DEFAULT '{all}',
  priority INTEGER DEFAULT 50,
  is_active BOOLEAN DEFAULT true,
  referral_link TEXT,
  source TEXT DEFAULT 'manual',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create knowledge response examples table
CREATE TABLE public.knowledge_response_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_id UUID REFERENCES public.company_knowledge_base(id) ON DELETE CASCADE,
  question_pattern TEXT NOT NULL,
  ideal_response TEXT NOT NULL,
  context_type TEXT DEFAULT 'all',
  rating INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create AI response feedback table for learning
CREATE TABLE public.ai_response_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_response TEXT,
  edited_response TEXT,
  edit_type TEXT,
  knowledge_used JSONB,
  context_json JSONB,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_response_examples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_response_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies - authenticated users can read all knowledge
CREATE POLICY "Authenticated users can read knowledge"
ON public.company_knowledge_base FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert knowledge"
ON public.company_knowledge_base FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update knowledge"
ON public.company_knowledge_base FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete knowledge"
ON public.company_knowledge_base FOR DELETE
TO authenticated
USING (true);

-- Response examples policies
CREATE POLICY "Authenticated users can read examples"
ON public.knowledge_response_examples FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can manage examples"
ON public.knowledge_response_examples FOR ALL
TO authenticated
USING (true);

-- Feedback policies
CREATE POLICY "Authenticated users can read feedback"
ON public.ai_response_feedback FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert feedback"
ON public.ai_response_feedback FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_knowledge_category ON public.company_knowledge_base(category);
CREATE INDEX idx_knowledge_active ON public.company_knowledge_base(is_active);
CREATE INDEX idx_knowledge_priority ON public.company_knowledge_base(priority DESC);
CREATE INDEX idx_knowledge_keywords ON public.company_knowledge_base USING GIN(keywords);

-- Create updated_at trigger
CREATE TRIGGER update_company_knowledge_base_updated_at
BEFORE UPDATE ON public.company_knowledge_base
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed initial knowledge from PeachHausGroup.com analysis
INSERT INTO public.company_knowledge_base (category, subcategory, title, content, keywords, priority, source) VALUES
-- Services
('services', 'mid-term', 'Mid-Term Rental Management', 'We specialize in 30-365 day stays with premium tenants: traveling professionals, corporate relocations, insurance placements. Our mid-term rentals average 90-day stays and generate +40% income compared to traditional long-term rentals. We handle everything from tenant screening to move-out inspections.', ARRAY['mid-term', 'mtr', 'furnished', 'corporate', 'extended stay', '30 days', 'monthly'], 90, 'website_import'),

('services', 'short-term', 'Short-Term Rental Management', 'Full-service short-term rental management with dynamic pricing, professional photography, and 24/7 guest support. We optimize for maximum revenue while maintaining exceptional guest experiences - over 1,400 five-star reviews across our portfolio.', ARRAY['str', 'short-term', 'airbnb', 'vrbo', 'vacation rental'], 85, 'website_import'),

('services', 'hybrid', 'Hybrid Rental Strategy', 'Our hybrid approach combines the best of both worlds - short-term rentals during peak seasons for maximum revenue, transitioning to mid-term corporate tenants during slower periods. This strategy often outperforms pure STR or LTR by 30-50%.', ARRAY['hybrid', 'flexible', 'seasonal', 'strategy'], 80, 'website_import'),

-- Pricing
('pricing', 'fees', 'Management Fees', 'Our management fee is 20-25% of collected rent, which covers full-service management including: guest/tenant communication, cleaning coordination, maintenance oversight, dynamic pricing, and 24/7 support. No upfront costs - we only get paid when you do.', ARRAY['fees', 'cost', 'price', 'percentage', 'management fee', 'how much', 'pricing'], 95, 'website_import'),

('pricing', 'value', 'Performance-Based Value', 'Our performance-based pricing means we''re incentivized to maximize your returns. Most owners see a 30-45% increase in net income even after our fees because we optimize pricing, reduce vacancy, and handle everything professionally.', ARRAY['value', 'worth it', 'expensive', 'roi', 'return'], 90, 'website_import'),

-- Insurance & Referrals
('referrals', 'insurance', 'Insurance Recommendation', 'For mid-term and short-term rental insurance, we recommend Proper Insurance - they specialize in STR/MTR coverage and understand the unique risks. They offer comprehensive policies that cover income loss, liability, and property damage. We can help coordinate with your existing homeowner''s insurance as well.', ARRAY['insurance', 'coverage', 'liability', 'protect', 'policy', 'proper insurance'], 95, 'manual'),

-- Tenant Networks
('services', 'corporate', 'Corporate Tenant Network', 'Our Corporate Network includes film crews, healthcare professionals, executive relocations, and government contractors. These tenants average 90-day stays and typically pay 40% more than traditional long-term rent. They''re pre-vetted, reliable, and treat properties with respect.', ARRAY['corporate', 'professional', 'business', 'executive', 'relocation', 'film', 'healthcare'], 85, 'website_import'),

('services', 'insurance-placements', 'Insurance Displacement Placements', 'Our Insurance Network works directly with major carriers to place families displaced by fire, flood, or other covered events. Direct carrier billing, 24-hour placement capability, and families who are grateful for comfortable temporary housing. Average stays of 60-90 days.', ARRAY['insurance', 'displacement', 'fire', 'flood', 'carrier', 'claim'], 85, 'website_import'),

-- Trust & Credibility
('company', 'stats', 'Company Statistics', 'PeachHaus Group has earned over 1,400 five-star reviews, manages properties generating $2.2M+ in owner earnings annually, maintains 98% client retention, achieves 92% average occupancy, and responds to all inquiries in under 30 minutes.', ARRAY['reviews', 'stars', 'ratings', 'experience', 'track record', 'proven'], 80, 'website_import'),

-- Objection Handling
('objections', 'fees-expensive', 'Objection: Fees Too High', 'I understand the concern about fees. Here''s the thing - our approach actually nets you MORE income even after our 20-25% fee. Most owners see a 30-45% increase in total revenue because we optimize pricing daily, reduce vacancy to under 8%, and handle everything professionally. Would you like me to run a free income analysis for your specific property?', ARRAY['expensive', 'too much', 'high fees', 'cost too much', 'not worth'], 95, 'manual'),

('objections', 'property-damage', 'Objection: Property Damage Concerns', 'Great question - protecting your property is our top priority. We have a $3M comprehensive insurance policy, require security deposits, conduct thorough guest screening, and have a damage guarantee program. In 5+ years, we''ve had minimal damage claims, and when they occur, we handle everything. Your property is in better hands with professional management.', ARRAY['damage', 'break', 'destroy', 'risk', 'protect', 'insurance'], 90, 'manual'),

('objections', 'time-involved', 'Objection: Too Much Time/Effort', 'That''s exactly why owners hire us! With PeachHaus, your time commitment drops to less than 30 minutes per month - just reviewing statements and approving any major decisions. We handle all guest communication, maintenance coordination, cleaning schedules, and emergencies 24/7.', ARRAY['time', 'effort', 'busy', 'hassle', 'work', 'involvement'], 85, 'manual'),

-- Scripts & CTAs
('scripts', 'discovery-call', 'Discovery Call Booking', 'I''d love to discuss this in more detail and learn about your specific situation. Here''s my calendar to book a quick 15-minute discovery call: https://calendar.app.google/5Ci15QhKQqgLbGnX6', ARRAY['call', 'schedule', 'meet', 'discuss', 'talk', 'calendar'], 100, 'manual'),

('scripts', 'income-analysis', 'Free Income Analysis Offer', 'Would you like a free income analysis for your property? I can show you exactly what you could earn with our mid-term rental strategy vs traditional long-term leasing - no obligation, just real numbers based on your specific property and market.', ARRAY['income', 'analysis', 'earn', 'revenue', 'projection', 'estimate'], 95, 'manual'),

-- Contact Info
('company', 'contact', 'Contact Information', 'PeachHaus Group is based in Atlanta, Georgia. Best way to reach us: Phone/Text: (404) 369-1624, Email: hello@peachhausgroup.com, Website: peachhausgroup.com', ARRAY['contact', 'phone', 'email', 'reach', 'call'], 70, 'manual');

-- Insert some example responses
INSERT INTO public.knowledge_response_examples (knowledge_id, question_pattern, ideal_response, context_type) 
SELECT id, 'What are your management fees?', 'Our management fee is 20-25% of collected rent - and we only get paid when you do. That covers everything: guest communication, cleaning coordination, maintenance, dynamic pricing, and 24/7 support. Most owners actually see 30-45% more net income even after our fees because we optimize every aspect of the rental. Would you like me to run a free analysis for your property?', 'lead'
FROM public.company_knowledge_base WHERE title = 'Management Fees';

INSERT INTO public.knowledge_response_examples (knowledge_id, question_pattern, ideal_response, context_type)
SELECT id, 'Do you recommend any insurance?', 'Great question! For rental properties, I recommend looking into Proper Insurance - they specialize in short and mid-term rental coverage and really understand the unique risks involved. They can also coordinate with your existing homeowner''s policy. Want me to connect you with them?', 'owner'
FROM public.company_knowledge_base WHERE title = 'Insurance Recommendation';