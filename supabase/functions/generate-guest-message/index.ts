import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MessageRequest {
  guestName: string;
  propertyName: string;
  monthlyRent?: number;
  startDate?: string;
  endDate?: string;
  messageType: 'check_in' | 'check_out' | 'maintenance' | 'payment' | 'general' | 'custom';
  customDescription?: string;
  tone?: 'friendly' | 'professional' | 'casual';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: MessageRequest = await req.json();
    const {
      guestName,
      propertyName,
      monthlyRent,
      startDate,
      endDate,
      messageType,
      customDescription,
      tone = 'friendly'
    } = request;

    // Build context for the AI
    const firstName = guestName.split(' ')[0];
    
    // If custom description is provided, always use it as the base context
    const hasCustomContext = customDescription && customDescription.trim().length > 0;
    
    // System prompt for refining user's message
    const systemPrompt = `You are a property management assistant for PeachHaus Group, a premium property management company.

IMPORTANT CONTEXT:
- These are mid-term rental GUESTS (30+ day stays), NOT traditional tenants
- Use hospitality language - "stay", "guest", "accommodation" - NOT "rent", "tenant", "lease"
- Be warm, professional, and service-oriented like a boutique hotel
- Keep messages concise for SMS (under 300 characters ideal, max 480)
- Always sign off with "- PeachHaus" or similar

TONE: ${tone === 'professional' ? 'More formal and business-like' : tone === 'casual' ? 'Very casual and friendly' : 'Warm and welcoming but professional'}

Guest Name: ${guestName}
Property: ${propertyName}
${startDate ? `Stay Start: ${startDate}` : ''}
${endDate ? `Stay End: ${endDate}` : ''}
${monthlyRent ? `Monthly Rate: $${monthlyRent.toLocaleString()}` : ''}

MESSAGE TYPE: ${messageType}

YOUR TASK: Take the user's message idea below and refine it into a polished, warm, professional SMS message.
- Keep the core meaning and intent
- Add warmth and professionalism
- Make it sound natural, not robotic
- Keep it concise for SMS

Generate ONLY the refined message text, no explanations or alternatives.`;

    const userPrompt = hasCustomContext 
      ? `Refine this message for ${firstName}: "${customDescription}"`
      : `Generate a ${messageType} message for ${firstName} at ${propertyName}.`;

    // Call OpenAI via Lovable AI
    const response = await fetch("https://ijsxcaaqphaciaenlegl.supabase.co/functions/v1/ai-assistant", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        model: "openai/gpt-5-mini",
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      // Fallback to a template-based message
      const fallbackMessages: Record<string, string> = {
        check_in: `Hi ${firstName}! Welcome to ${propertyName}. We hope you're settling in well. Please let us know if you need anything at all. - PeachHaus`,
        check_out: `Hi ${firstName}, we hope you enjoyed your stay at ${propertyName}! We'd love to hear about your experience. Safe travels! - PeachHaus`,
        maintenance: `Hi ${firstName}, just checking in on ${propertyName}. Is everything working well? Let us know if anything needs attention. - PeachHaus`,
        payment: `Hi ${firstName}, friendly reminder that your monthly accommodation payment${monthlyRent ? ` of $${monthlyRent.toLocaleString()}` : ''} is coming up. Let us know if you have any questions! - PeachHaus`,
        general: `Hi ${firstName}! Just checking in to see how everything is going at ${propertyName}. We're here if you need anything! - PeachHaus`,
        custom: `Hi ${firstName}, ${customDescription || 'hope all is well at ' + propertyName}. - PeachHaus`,
      };

      return new Response(
        JSON.stringify({
          message: fallbackMessages[messageType] || fallbackMessages.general,
          generated: false,
          fallback: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const data = await response.json();
    const generatedMessage = data.choices?.[0]?.message?.content || data.content || data.message;

    return new Response(
      JSON.stringify({
        message: generatedMessage.trim(),
        generated: true,
        fallback: false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error generating guest message:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
