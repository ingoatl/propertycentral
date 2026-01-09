import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { contactEmail, contactName, currentSubject, incomingEmailBody } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch previous email communications with this contact
    let emailHistory: any[] = [];
    
    // Get from lead_communications if we have emails there
    const { data: leadComms } = await supabase
      .from("lead_communications")
      .select("direction, subject, body, created_at, leads!inner(email)")
      .eq("communication_type", "email")
      .order("created_at", { ascending: false })
      .limit(10);

    if (leadComms) {
      emailHistory = leadComms
        .filter((c: any) => c.leads?.email?.toLowerCase() === contactEmail?.toLowerCase())
        .map((c: any) => ({
          direction: c.direction,
          subject: c.subject,
          body: c.body?.substring(0, 500),
          date: c.created_at
        }));
    }

    // Build context from email history
    const historyContext = emailHistory.length > 0 
      ? emailHistory.map(e => 
          `[${e.direction === 'outbound' ? 'SENT' : 'RECEIVED'}] Subject: ${e.subject}\n${e.body}`
        ).join('\n\n---\n\n')
      : 'No previous email history with this contact.';

    const systemPrompt = `You are a professional email assistant for PeachHaus Group, a property management company in Atlanta, Georgia.

Your task is to draft a professional, warm, and helpful email reply.

Guidelines:
- Be professional but friendly
- Keep responses concise and to the point
- Focus on being helpful and addressing their needs
- Use a conversational yet professional tone
- Don't include a signature (it will be added automatically)
- Don't include greeting like "Dear" - start with "Hi [FirstName],"
- End with "Best regards" or similar

About PeachHaus Group:
- Property management company specializing in short-term and mid-term rentals
- Based in Atlanta, Georgia
- Known for personalized service and attention to detail`;

    const userPrompt = `Contact: ${contactName} (${contactEmail})
${currentSubject ? `Subject: ${currentSubject}` : ''}

${incomingEmailBody ? `Email they sent:
${incomingEmailBody}` : ''}

Previous email history with this contact:
${historyContext}

Please draft a professional reply email. Start with "Hi ${contactName?.split(' ')[0] || 'there'},"`;

    console.log("Generating AI email suggestion for:", contactEmail);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Failed to generate AI response");
    }

    const data = await response.json();
    const suggestedReply = data.choices?.[0]?.message?.content || "";

    console.log("Generated suggestion successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        suggestion: suggestedReply,
        emailHistory: emailHistory.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in suggest-email-reply:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
