import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, channel = "all" } = await req.json();

    console.log("Analyze tone request:", { userId, channel });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all outbound emails and SMS
    const emailQuery = supabase
      .from("lead_communications")
      .select("id, body, subject, created_at, communication_type")
      .eq("direction", "outbound")
      .in("communication_type", ["email"])
      .order("created_at", { ascending: false })
      .limit(100);

    const smsQuery = supabase
      .from("lead_communications")
      .select("id, body, created_at, communication_type")
      .eq("direction", "outbound")
      .eq("communication_type", "sms")
      .order("created_at", { ascending: false })
      .limit(200);

    const [emailResult, smsResult] = await Promise.all([
      emailQuery,
      smsQuery
    ]);

    const emails = emailResult.data || [];
    const smss = smsResult.data || [];

    console.log(`Found ${emails.length} emails and ${smss.length} SMS messages`);

    if (emails.length === 0 && smss.length === 0) {
      return new Response(
        JSON.stringify({ error: "No sent messages found to analyze" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build sample text for analysis
    const emailSamples = emails
      .filter(e => e.body && e.body.length > 50)
      .slice(0, 30)
      .map(e => `EMAIL:\nSubject: ${e.subject || 'No subject'}\n${e.body}`)
      .join("\n\n---\n\n");

    const smsSamples = smss
      .filter(s => s.body && s.body.length > 20)
      .slice(0, 50)
      .map(s => `SMS: ${s.body}`)
      .join("\n\n");

    const analysisPrompt = `Analyze the following sent messages to extract the writer's unique tone of voice, writing patterns, and communication style. This will be used to generate future messages that match their authentic voice.

${channel === "email" || channel === "all" ? `\n=== EMAIL SAMPLES (${emails.length} total) ===\n${emailSamples}` : ""}

${channel === "sms" || channel === "all" ? `\n=== SMS SAMPLES (${smss.length} total) ===\n${smsSamples}` : ""}

Analyze and return a JSON object with:
{
  "formality_level": "casual" | "professional" | "formal",
  "avg_sentence_length": number (approximate words per sentence),
  "uses_contractions": boolean,
  "punctuation_style": string (describe their punctuation habits),
  "common_greetings": string[] (exact greetings they use, max 5),
  "common_closings": string[] (exact closings they use, max 5),
  "signature_phrases": string[] (unique phrases they repeat, max 10),
  "avoided_phrases": string[] (common phrases they never use, max 5),
  "typical_email_length": number (average word count),
  "typical_sms_length": number (average character count),
  "paragraph_style": "short_punchy" | "longer_detailed",
  "question_frequency": "low" | "medium" | "high",
  "exclamation_frequency": "low" | "medium" | "high",
  "emoji_usage": "none" | "occasional" | "frequent",
  "tone_summary": string (2-3 sentences describing their unique voice),
  "writing_dna": {
    "voice_characteristics": string[] (3-5 key traits),
    "sentence_starters": string[] (common ways they start sentences),
    "transition_words": string[] (words they use to connect ideas),
    "cta_style": string (how they typically ask for action),
    "warmth_indicators": string[] (phrases that show personality)
  },
  "sample_messages": string[] (3-5 best examples that capture their voice)
}

Focus on patterns that make their writing UNIQUE - not generic professional writing, but their specific voice.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-preview",
        messages: [
          { 
            role: "system", 
            content: "You are an expert writing analyst. Analyze the provided messages to extract the unique writing patterns, tone, and voice of the author. Return only valid JSON." 
          },
          { role: "user", content: analysisPrompt },
        ],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content?.trim() || "";

    // Clean markdown if present
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let toneProfile;
    try {
      toneProfile = JSON.parse(content);
    } catch (parseError) {
      console.error("Failed to parse tone analysis:", content);
      throw new Error("Failed to parse AI response");
    }

    // Store/update the tone profile
    const profileData = {
      user_id: userId || null,
      channel,
      formality_level: toneProfile.formality_level,
      avg_sentence_length: toneProfile.avg_sentence_length,
      uses_contractions: toneProfile.uses_contractions,
      punctuation_style: toneProfile.punctuation_style,
      common_greetings: toneProfile.common_greetings,
      common_closings: toneProfile.common_closings,
      signature_phrases: toneProfile.signature_phrases,
      avoided_phrases: toneProfile.avoided_phrases,
      typical_email_length: toneProfile.typical_email_length,
      typical_sms_length: toneProfile.typical_sms_length,
      paragraph_style: toneProfile.paragraph_style,
      question_frequency: toneProfile.question_frequency,
      exclamation_frequency: toneProfile.exclamation_frequency,
      emoji_usage: toneProfile.emoji_usage,
      tone_summary: toneProfile.tone_summary,
      writing_dna: toneProfile.writing_dna,
      sample_messages: toneProfile.sample_messages,
      analyzed_email_count: emails.length,
      analyzed_sms_count: smss.length,
      last_analyzed_at: new Date().toISOString(),
    };

    // Upsert the profile
    const { data: existing } = await supabase
      .from("user_tone_profiles")
      .select("id")
      .eq("channel", channel)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("user_tone_profiles")
        .update(profileData)
        .eq("id", existing.id);
    } else {
      await supabase
        .from("user_tone_profiles")
        .insert(profileData);
    }

    console.log("Tone analysis complete:", toneProfile.tone_summary);

    return new Response(
      JSON.stringify({ 
        success: true, 
        profile: toneProfile,
        analyzed: {
          emails: emails.length,
          sms: smss.length
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Analyze tone error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
