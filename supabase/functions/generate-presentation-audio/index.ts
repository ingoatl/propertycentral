import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Voice IDs
const SARAH_VOICE = "EXAVITQu4vr4xnSDxMaL"; // Female, warm
const BRIAN_VOICE = "nPczCjzI2devNBz1zQrb"; // Male, professional

// All presentation slides with their scripts
const ONBOARDING_SLIDES = [
  { id: "title", script: "Welcome to PeachHaus Property Management. Where exceptional hospitality meets profitable returns.", voiceId: BRIAN_VOICE },
  { id: "founders", script: "Meet Anja and Ingo, the dynamic team behind PeachHaus. Anja is a licensed Georgia real estate broker, Airbnb coach, and hospitality design expert who has grown over two million dollars in short-term rental bookings. She's also the author of The Hybrid Rental Strategy, our proven approach where we focus on mid-term rentals first and fill in the gaps with short-term stays where allowed. Ingo brings over thirty years of entrepreneurship experience with ten years specifically in the real estate and property management space. Together they've built PeachHaus to combine old-world hospitality with modern revenue optimization.", voiceId: BRIAN_VOICE },
  { id: "promise", script: "Our promise is simple: maximize your rental income while protecting your investment. We handle everything so you can enjoy passive income without the stress.", voiceId: BRIAN_VOICE },
  { id: "numbers", script: "The numbers speak for themselves. With over fourteen hundred five-star Airbnb reviews, our properties consistently outperform market averages with higher occupancy rates and premium nightly rates.", voiceId: BRIAN_VOICE },
  { id: "problem", script: "We understand the challenges of property management: inconsistent income, guest issues, maintenance headaches. PeachHaus solves these problems with technology-driven solutions and hands-on care.", voiceId: BRIAN_VOICE },
  { id: "strategies", script: "Our three-pronged approach combines short-term vacation rentals, mid-term corporate housing, and hybrid strategies to maximize your returns year-round.", voiceId: BRIAN_VOICE },
  { id: "revenue", script: "See the difference professional management makes. Our owners typically earn 30 to 50 percent more compared to self-management or traditional long-term rentals.", voiceId: BRIAN_VOICE },
  { id: "corporate", script: "Access our exclusive corporate network. We partner with Fortune 500 companies, film productions, and relocating professionals who need premium accommodations.", voiceId: BRIAN_VOICE },
  { id: "case-woodland", script: "Woodland Lane transformed from an underperforming rental into a top-earning property, generating over 15 thousand dollars monthly through our hybrid strategy.", voiceId: BRIAN_VOICE },
  { id: "case-berkley", script: "The Berkley exemplifies our corporate housing expertise. With direct corporate contracts, this property maintains 90 percent occupancy at premium rates.", voiceId: BRIAN_VOICE },
  { id: "case-lavish", script: "Lavish Living showcases the luxury short-term rental potential. With professional photography and marketing, bookings increased by 200 percent within three months.", voiceId: BRIAN_VOICE },
  { id: "apart", script: "What sets us apart? 24/7 guest support, dynamic pricing optimization, professional photography, and complete transparency through our owner portal.", voiceId: BRIAN_VOICE },
  { id: "testimonials", script: "Don't just take our word for it. Our property owners consistently praise our communication, professionalism, and ability to maximize their rental income.", voiceId: BRIAN_VOICE },
  { id: "portal", script: "Access everything from your owner portal. Real-time earnings, booking calendars, expense tracking, and maintenance updates all in one place.", voiceId: BRIAN_VOICE },
  { id: "timeline", script: "Getting started is easy. From initial consultation to your first booking, our streamlined onboarding takes just two to four weeks.", voiceId: BRIAN_VOICE },
  { id: "how", script: "Our process is designed for simplicity. We handle property setup, professional photography, listing optimization, and guest management from day one.", voiceId: BRIAN_VOICE },
  { id: "pricing", script: "Our pricing is straightforward and aligned with your success. We only succeed when you succeed, with competitive management fees and no hidden costs.", voiceId: BRIAN_VOICE },
  { id: "closing", script: "Ready to maximize your property's potential? Schedule a discovery call today and let's discuss how PeachHaus can transform your rental income.", voiceId: BRIAN_VOICE },
];

const OWNER_PORTAL_SLIDES = [
  { id: "intro", script: "Welcome to PeachHaus... We're so glad you're here. Let us show you how we take care of your investment — and keep you completely informed, every step of the way.", voiceId: SARAH_VOICE },
  { id: "overview", script: "Here's your dashboard... Everything you need to know about your property — revenue, occupancy, and guest ratings — all in real-time. And every month, you'll receive a personalized audio recap, just like the sample you can play above. It's delivered right to your phone, so you never miss an update.", voiceId: SARAH_VOICE },
  { id: "insights", script: "Know exactly how your property stacks up against the competition. Our market intelligence reveals revenue opportunities, tracks demand-driving events, and powers dynamic pricing through PriceLabs.", voiceId: SARAH_VOICE },
  { id: "bookings", script: "Always know who's staying at your property. Our visual calendar shows every reservation with guest details and revenue forecasts for upcoming stays.", voiceId: SARAH_VOICE },
  { id: "statements", script: "Transparent financials you can access anytime. Download your monthly statements with gross and net earnings clearly broken down.", voiceId: SARAH_VOICE },
  { id: "expenses", script: "No hidden fees... ever. Every dollar is documented with vendor names and receipt attachments. Filter by category to understand exactly where your money goes.", voiceId: SARAH_VOICE },
  { id: "messages", script: "Every conversation, in one place. SMS, emails, voicemails, and video updates. Listen to recordings from your property manager and never miss an important update.", voiceId: SARAH_VOICE },
  { id: "repairs", script: "Stay in control of maintenance. Any repair over five hundred dollars requires your approval before work begins... And you'll also see predictive maintenance tasks scheduled for your property — things like HVAC servicing and gutter cleaning — all planned ahead of time.", voiceId: SARAH_VOICE },
  { id: "screenings", script: "Peace of mind, built in. Every single guest is verified before they arrive — ID check, background screening, and watchlist review. This process has reduced property damage claims by forty-seven percent.", voiceId: SARAH_VOICE },
  { id: "marketing", script: "See exactly how we're promoting your investment. View social media posts, platform distribution across Airbnb, VRBO, and corporate housing, and track our marketing activities in real-time.", voiceId: SARAH_VOICE },
  { id: "communication", script: "We believe communication with your property manager should be effortless. That's why you can leave a voicemail, send a text, schedule a video call, or call us directly — right from your dashboard. This level of access is rare in our industry, and we're proud to offer it.", voiceId: SARAH_VOICE },
  { id: "closing", script: "Ready to experience true transparency? Explore our demo portal, or schedule a call with our team today. We'd love to show you more.", voiceId: SARAH_VOICE },
];

async function generateAudio(text: string, voiceId: string): Promise<ArrayBuffer | null> {
  if (!ELEVENLABS_API_KEY) {
    console.error("ELEVENLABS_API_KEY not configured");
    return null;
  }

  try {
    console.log(`Generating audio for voice ${voiceId}, text length: ${text.length}`);
    
    // Using multilingual_v2 for highest quality (stored audio, no real-time needed)
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
      console.error(`ElevenLabs error: ${response.status}`, errorText);
      return null;
    }

    return await response.arrayBuffer();
  } catch (error) {
    console.error("Audio generation error:", error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { presentation, slideId, forceRegenerate } = await req.json();
    
    const slides = presentation === "onboarding" ? ONBOARDING_SLIDES : OWNER_PORTAL_SLIDES;
    const bucketPath = `presentation-audio/${presentation}`;
    
    // If specific slideId provided, only generate that one
    const slidesToGenerate = slideId 
      ? slides.filter(s => s.id === slideId)
      : slides;
    
    const results: { id: string; url: string | null; error?: string }[] = [];
    
    for (const slide of slidesToGenerate) {
      const filePath = `${bucketPath}/${slide.id}.mp3`;
      
      // Check if file already exists (unless force regenerate)
      if (!forceRegenerate) {
        const { data: existingFile } = await supabase.storage
          .from("message-attachments")
          .list(bucketPath, { search: `${slide.id}.mp3` });
        
        if (existingFile && existingFile.length > 0) {
          const { data: urlData } = supabase.storage
            .from("message-attachments")
            .getPublicUrl(filePath);
          
          console.log(`File already exists: ${slide.id}`);
          results.push({ id: slide.id, url: urlData.publicUrl });
          continue;
        }
      }
      
      // Generate audio
      const audioBuffer = await generateAudio(slide.script, slide.voiceId);
      
      if (!audioBuffer) {
        results.push({ id: slide.id, url: null, error: "Failed to generate audio" });
        continue;
      }
      
      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("message-attachments")
        .upload(filePath, audioBuffer, {
          contentType: "audio/mpeg",
          upsert: true,
        });
      
      if (uploadError) {
        console.error(`Upload error for ${slide.id}:`, uploadError);
        results.push({ id: slide.id, url: null, error: uploadError.message });
        continue;
      }
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from("message-attachments")
        .getPublicUrl(filePath);
      
      console.log(`Successfully generated and uploaded: ${slide.id}`);
      results.push({ id: slide.id, url: urlData.publicUrl });
    }
    
    return new Response(JSON.stringify({ 
      success: true, 
      generated: results.filter(r => r.url).length,
      failed: results.filter(r => !r.url).length,
      results 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
