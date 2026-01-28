import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Designer presentation slide scripts
const DESIGNER_SLIDES: Record<string, string> = {
  "title": "Welcome. PeachHaus has partnered with Handy Honey to offer you something special: professional design and staging services that transform your property into a booking magnet.",
  "meet-ilana": "Meet Ilana Weismark, the creative force behind Handy Honey. With 15 years of home staging experience, Ilana specializes in transforming rental properties into stunning spaces that command premium rates. Her motto? Sweet fixes without the nagging. She handles everything from design to installation, so you don't have to lift a finger.",
  "why-design": "In today's competitive rental market, first impressions are everything. Properties with professional staging command 20 to 40 percent higher nightly rates and receive three times more listing clicks. Design isn't an expense. It's an investment with measurable returns.",
  "process": "Ilana's process is simple and stress-free. It starts with a consultation walkthrough, followed by a custom design plan with budget options. She handles all sourcing, coordinates installation, and delivers your property photo-ready. Average timeline is 2 to 6 weeks depending on scope.",
  "case-whitehurst": "Take a look at Whitehurst in Marietta. This property received a complete transformation with an investment of 30 to 40 thousand dollars. The result? A stunning, modern space that photographs beautifully and attracts premium guests. You can verify this listing live on Airbnb.",
  "case-southvale": "Southvale started as an empty shell. With a 25 thousand dollar investment in 2025, Ilana transformed it into a cohesive, guest-focused retreat. Notice the modern aesthetic, the coordinated furnishings, and the attention to detail that makes guests feel at home.",
  "case-justice": "Justice is a perfect example of high-impact design on a modest budget. Just 23 thousand dollars in 2024 created this warm, inviting living space. The stone fireplace becomes a stunning focal point, and the color coordination throughout creates a memorable guest experience.",
  "case-lakewood": "Lakewood shows what's possible with smart design choices. An investment of 23 thousand dollars in 2024 turned empty rooms into warm, cozy spaces with a functional layout. Twin beds maximize flexibility for different guest configurations.",
  "case-brushy": "Brushy underwent a complete renovation, transforming from a construction zone into an elegant home. For 23 thousand dollars in 2024, Ilana created photo-ready spaces with natural elements and inviting atmospheres that photograph beautifully.",
  "case-tolani": "To Lani proves that thoughtful design doesn't require a massive budget. With just 20 thousand dollars in 2023, Ilana created this stunning bedroom with a signature accent wall, curated artwork, and cohesive styling that consistently earns five-star reviews.",
  "investment": "Investment levels range from 5 thousand for a room refresh, to 10 thousand for full staging from scratch, up to 20 to 40 thousand for a premium overhaul. Design fees cover consultation, sourcing, project management, and installation. Furniture is purchased separately at cost with no markups.",
  "faq": "Common questions: Projects typically take 2 to 6 weeks. You don't need to be present during installation. Ilana can work with your existing furniture or recommend replacements. And most owners recoup their investment within 6 to 12 months.",
  "closing": "Ready to transform your property? Schedule a free consultation with Ilana to discuss your vision. She handles everything, coordinating directly with PeachHaus. Call 770-312-6723 or visit handyhoney.net. Design is not just an expense. It's an investment with measurable ROI.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!ELEVENLABS_API_KEY) {
      throw new Error("ELEVENLABS_API_KEY is not configured");
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Use Sarah voice (female, warm, professional)
    const voiceId = "EXAVITQu4vr4xnSDxMaL";
    const results: Array<{ slideId: string; success: boolean; error?: string }> = [];
    
    const { slideId } = await req.json().catch(() => ({}));
    
    // Generate for specific slide or all slides
    const slidesToGenerate = slideId 
      ? { [slideId]: DESIGNER_SLIDES[slideId] }
      : DESIGNER_SLIDES;

    for (const [id, text] of Object.entries(slidesToGenerate)) {
      if (!text) continue;
      
      console.log(`Generating audio for slide: ${id}`);
      
      try {
        // Call ElevenLabs TTS API
        const response = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
          {
            method: "POST",
            headers: {
              "xi-api-key": ELEVENLABS_API_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text,
              model_id: "eleven_multilingual_v2",
              voice_settings: {
                stability: 0.6,
                similarity_boost: 0.75,
                style: 0.3,
                use_speaker_boost: true,
              },
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`ElevenLabs error for ${id}:`, response.status, errorText);
          results.push({ slideId: id, success: false, error: `TTS failed: ${response.status}` });
          continue;
        }

        const audioBuffer = await response.arrayBuffer();
        const audioData = new Uint8Array(audioBuffer);
        
        // Upload to Supabase Storage
        const storagePath = `presentation-audio/designer/${id}.mp3`;
        const { error: uploadError } = await supabase.storage
          .from("message-attachments")
          .upload(storagePath, audioData, {
            contentType: "audio/mpeg",
            upsert: true,
          });

        if (uploadError) {
          console.error(`Storage error for ${id}:`, uploadError);
          results.push({ slideId: id, success: false, error: uploadError.message });
        } else {
          console.log(`Successfully uploaded: ${storagePath}`);
          results.push({ slideId: id, success: true });
        }
        
        // Small delay between API calls to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`Error processing ${id}:`, error);
        results.push({ 
          slideId: id, 
          success: false, 
          error: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return new Response(
      JSON.stringify({
        message: `Generated ${successCount} audio files, ${failCount} failed`,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Generation error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
