import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Scheduling link for discovery calls
const SCHEDULING_LINK = "https://propertycentral.lovable.app/book-discovery-call";

// Company knowledge base - comprehensive information about PeachHaus Group
const companyKnowledge = `
COMPANY: PeachHaus Group
WEBSITE: www.peachhausgroup.com
BUSINESS: Premium mid-term rental property management in Atlanta, Georgia

DISCOVERY CALL BOOKING LINK: ${SCHEDULING_LINK}
- Include this link when appropriate to schedule a call
- Present it as a helpful next step, not pushy sales

FREE INCOME ANALYSIS OFFER (ALWAYS MENTION THIS!):
- We provide a FREE rental income analysis for any property
- Shows projected income across ALL 3 rental types:
  1. Short-term (Airbnb-style, 1-29 night stays)
  2. Mid-term (30-365 day stays - our specialty)
  3. Long-term (traditional 12+ month leases)
- This helps owners make informed decisions about their rental strategy
- To create the analysis, we need:
  1. Property address (required)
  2. Email address (to send the report)
- ALWAYS offer this when speaking with new leads or interested property owners
- Frame it as: "Would you like a free income analysis showing what your property could earn?"

KEY SERVICES:
1. Mid-Term Rental Management (30-365 day stays)
   - Full-service property management
   - Guest screening and placement
   - 24/7 guest support
   - Professional cleaning coordination
   - Maintenance management

2. Property Onboarding
   - Professional photography
   - Listing optimization
   - Pricing strategy
   - Market analysis

3. Owner Services
   - Monthly financial reporting
   - Owner portal access
   - Tax document preparation
   - Transparent expense tracking

TARGET CLIENTS:
- Corporate housing needs
- Traveling nurses & healthcare professionals
- Insurance displacement (temporary housing)
- Relocating professionals
- Extended business travelers

COMPETITIVE ADVANTAGES:
- Specialized in mid-term rentals (unique niche)
- Local Atlanta market expertise
- Higher quality guests than short-term
- Less wear and tear on properties
- Consistent monthly income
- Hands-off experience for owners
- FREE income analysis for prospective clients

PRICING STRUCTURE:
- Management fee: Typically 15-20% of rental income
- No hidden fees
- Transparent expense reporting
- Professional cleaning between guests (billed at cost)

SERVICE AREAS:
- Atlanta Metro Area
- Buckhead
- Midtown
- Sandy Springs
- Dunwoody
- Decatur
- Alpharetta

CONTACT INFO:
- Email: info@peachhausgroup.com
- Website: www.peachhausgroup.com
- Office hours: Monday-Friday 9am-6pm EST

BRAND VOICE:
- Professional yet warm
- Knowledgeable and trustworthy
- Atlanta local expertise
- Solutions-focused
- Relationship-driven
- Not pushy or sales-y

PSYCHOLOGY-BASED COMMUNICATION PRINCIPLES:
1. RECIPROCITY: Lead with value (offer the free income analysis!)
2. SOCIAL PROOF: Reference "many Atlanta property owners" or success stories
3. LIKING: Personalize, use their name, acknowledge their specific situation
4. AUTHORITY: Position as trusted advisors and experts, not salespeople
5. SCARCITY: Mention limited availability for new properties when relevant
6. CONSISTENCY: Reference previous conversations or expressed interests

COMMUNICATION STRATEGY:
- If they texted and we don't have their email: Ask for it to send the income analysis
- If we don't have the property address: Ask for it to create the analysis
- Always offer value first before asking for a call
- The free income analysis is our primary lead magnet

COMMON OWNER QUESTIONS:
- How do you find tenants? (Corporate partnerships, healthcare networks, online platforms)
- What's included in management? (Everything - hands-off experience)
- How are guests screened? (Background checks, employment verification, references)
- What about damage? (Security deposits, guest insurance, thorough inspections)
- How do you handle maintenance? (Network of trusted vendors, owner approval for large expenses)
`;

// Email writing guidelines
const emailGuidelines = `
EMAIL WRITING RULES:
1. Keep emails concise - 2-3 short paragraphs max
2. Lead with the most important information
3. Use contractions (I'm, we'll, you're) - sound human
4. Be warm but professional
5. End with a clear call-to-action
6. Include the booking link naturally when suggesting a call

PHRASES TO AVOID:
- "I hope this email finds you well"
- "Just checking in"
- "Please don't hesitate to reach out"
- "At your earliest convenience"
- "Touching base"
- "Per our conversation"

GOOD ALTERNATIVES:
- "Thanks for reaching out about..."
- "I wanted to follow up on..."
- "Looking forward to chatting more"
- "Let's set up a quick call"
- "Happy to answer any questions"

STRUCTURE:
1. Opening: Acknowledge them/their situation specifically
2. Body: Provide value, answer questions, or share relevant info
3. Call-to-action: Clear next step (often scheduling a call)
4. Signature: Warm but professional

SIGNATURE FORMAT:
Best,
[First Name]
PeachHaus Group
www.peachhausgroup.com
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipientName, recipientEmail, context, includeCalendarLink } = await req.json();

    console.log("AI Compose Email request:", { recipientName, recipientEmail, contextLength: context?.length });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const firstName = recipientName?.split(" ")[0] || "there";

    const systemPrompt = `You are an expert email writer for PeachHaus Group, a premium mid-term rental property management company in Atlanta.

${companyKnowledge}

${emailGuidelines}

Your task is to compose a professional, warm, and effective email based on the context provided.
The email should feel personal and human, not like a template.
${includeCalendarLink ? `When appropriate, naturally include the discovery call scheduling link: ${SCHEDULING_LINK}` : ""}

You must respond with a JSON object containing:
- "subject": A compelling, specific email subject line (under 60 characters)
- "body": The full email body text

Do not include "Subject:" or "Body:" labels in your response. Just the JSON object.`;

    const userPrompt = `Write an email to ${recipientName || "the recipient"} (email: ${recipientEmail || "unknown"}).

Context: ${context}

First name to use in greeting: ${firstName}

Remember to:
- Be warm and professional
- Reference their specific situation from the context
- Include the scheduling link if suggesting a call
- Keep it concise (2-3 paragraphs)
- End with a clear next step

Respond with JSON format: {"subject": "...", "body": "..."}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 1000,
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
      const errorText = await response.text();
      console.error("AI gateway error:", errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    let generatedContent = data.choices?.[0]?.message?.content?.trim();

    if (!generatedContent) {
      throw new Error("No content generated");
    }

    // Parse the JSON response
    // Remove markdown code blocks if present
    generatedContent = generatedContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    let parsed;
    try {
      parsed = JSON.parse(generatedContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", generatedContent);
      // Try to extract subject and body manually
      const subjectMatch = generatedContent.match(/"subject":\s*"([^"]+)"/);
      const bodyMatch = generatedContent.match(/"body":\s*"([\s\S]+?)"\s*}/);
      
      if (subjectMatch && bodyMatch) {
        parsed = {
          subject: subjectMatch[1],
          body: bodyMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"'),
        };
      } else {
        throw new Error("Could not parse AI response");
      }
    }

    console.log("Generated email:", { subject: parsed.subject, bodyLength: parsed.body?.length });

    return new Response(
      JSON.stringify({
        subject: parsed.subject || "Follow up from PeachHaus Group",
        body: parsed.body || "",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("AI Compose Email error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
