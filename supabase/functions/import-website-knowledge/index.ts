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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) throw new Error("Unauthorized");

    // PeachHausGroup.com knowledge - pre-extracted content
    // In production, you'd use a web scraping service like Firecrawl
    const websiteKnowledge = [
      {
        category: "services",
        subcategory: "overview",
        title: "Full-Service Property Management",
        content: "PeachHaus Group provides full-service property management for short-term, mid-term, and long-term rentals in Metro Atlanta. We handle everything from listing creation and guest communication to cleaning, maintenance, and financial reporting. Our hands-off approach means property owners spend less than 30 minutes per month on their rental.",
        keywords: ["full-service", "property management", "hands-off", "atlanta", "metro atlanta"],
        priority: 85,
      },
      {
        category: "services",
        subcategory: "mid-term",
        title: "Mid-Term Rental Expertise",
        content: "Our mid-term rental program (30-365 day stays) connects your property with premium tenants including traveling nurses, corporate relocations, film industry professionals, and insurance displacement families. Average stay is 90 days with 40% higher income compared to traditional long-term leases. We maintain relationships with major corporations and insurance carriers for consistent tenant flow.",
        keywords: ["mid-term", "mtr", "30 days", "corporate housing", "traveling nurse", "insurance", "furnished"],
        priority: 90,
      },
      {
        category: "company",
        subcategory: "reputation",
        title: "Proven Track Record",
        content: "With over 1,400 five-star reviews, $2.2M+ in annual owner earnings, 98% client retention rate, and 92% average occupancy, PeachHaus Group has established itself as Atlanta's premier rental management company. Our response time averages under 30 minutes for guest inquiries.",
        keywords: ["reviews", "five star", "track record", "reputation", "occupancy", "retention"],
        priority: 80,
      },
      {
        category: "pricing",
        subcategory: "structure",
        title: "Transparent Pricing Structure",
        content: "Our management fee is 20-25% of collected rent with no upfront costs or hidden fees. This covers: professional photography, dynamic pricing optimization, 24/7 guest support, cleaning coordination, maintenance oversight, and detailed monthly reporting. We only earn when you earn - true performance-based pricing.",
        keywords: ["pricing", "fees", "cost", "percentage", "20%", "25%", "no upfront"],
        priority: 95,
      },
      {
        category: "services",
        subcategory: "guest-screening",
        title: "Rigorous Guest Screening",
        content: "Every guest and tenant undergoes thorough screening including identity verification, background checks, and booking history review. Our $3M comprehensive insurance policy provides protection against property damage. We also collect security deposits and have a damage guarantee program.",
        keywords: ["screening", "background check", "insurance", "security deposit", "damage", "protection"],
        priority: 85,
      },
      {
        category: "services",
        subcategory: "technology",
        title: "Technology-Driven Management",
        content: "We use smart home technology including smart locks, noise monitors, and occupancy sensors to ensure property protection. Our dynamic pricing algorithm analyzes market data daily to optimize your rates. Owners have 24/7 access to performance dashboards and financial reports.",
        keywords: ["technology", "smart home", "smart lock", "pricing", "dashboard", "reports"],
        priority: 75,
      },
    ];

    // Check for existing entries to avoid duplicates
    const { data: existingEntries } = await supabase
      .from("company_knowledge_base")
      .select("title")
      .eq("source", "website_import");

    const existingTitles = new Set(existingEntries?.map(e => e.title) || []);

    // Filter out duplicates
    const newEntries = websiteKnowledge.filter(k => !existingTitles.has(k.title));

    if (newEntries.length === 0) {
      return new Response(
        JSON.stringify({ message: "All website knowledge already imported", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert new knowledge entries
    const { error: insertError } = await supabase
      .from("company_knowledge_base")
      .insert(
        newEntries.map(k => ({
          ...k,
          source: "website_import",
          use_in_contexts: ["all"],
          is_active: true,
          created_by: user.id,
        }))
      );

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ 
        message: "Website knowledge imported successfully",
        count: newEntries.length 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error importing website knowledge:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
