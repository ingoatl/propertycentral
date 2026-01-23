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

    console.log("=== Screening Watchdog Starting ===");
    const runAt = new Date().toISOString();
    const issues: string[] = [];
    let overallStatus: "healthy" | "warning" | "error" = "healthy";
    const details: Record<string, any> = {};
    
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // ========== LOAD ALL PROPERTIES ==========
    const { data: properties } = await supabase
      .from("properties")
      .select("id, name, address")
      .is("offboarded_at", null);

    const safeProperties = properties || [];
    console.log(`Loaded ${safeProperties.length} active properties`);

    // ========== CHECK 1: Find Orphaned Screening Emails ==========
    console.log("Checking for orphaned screening emails...");
    
    const { data: orphanedInsights } = await supabase
      .from("email_insights")
      .select("*")
      .eq("category", "guest_screening")
      .is("property_id", null)
      .gte("created_at", twentyFourHoursAgo);

    details.orphanedScreenings = {
      count: orphanedInsights?.length || 0,
      subjects: (orphanedInsights || []).map(i => i.subject).slice(0, 5),
    };

    if (orphanedInsights && orphanedInsights.length > 0) {
      console.log(`Found ${orphanedInsights.length} orphaned screening emails - attempting to match...`);
      issues.push(`${orphanedInsights.length} screening emails without property match`);
      overallStatus = "warning";

      let matchedCount = 0;
      let createdScreenings = 0;

      for (const insight of orphanedInsights) {
        const body = (insight.summary || "").toLowerCase();
        const subject = (insight.subject || "").toLowerCase();
        const combinedText = `${subject} ${body}`;

        // Enhanced address extraction for Truvi emails
        // Pattern: "stay at [ADDRESS] from [DATES]"
        const stayAtPattern = /stay at\s+(\d+\s+[\w\s]+(?:ct|st|ave|rd|dr|ln|way|blvd|circle|court|terrace|place|drive))/i;
        const stayAtMatch = combinedText.match(stayAtPattern);
        
        let matchedProperty = null;

        if (stayAtMatch) {
          const extractedAddress = stayAtMatch[1].toLowerCase().trim();
          console.log(`Extracted address from "stay at": ${extractedAddress}`);

          for (const prop of safeProperties) {
            if (!prop.address) continue;
            const propAddressLower = prop.address.toLowerCase();
            const propStreetAddress = propAddressLower.split(",")[0].trim();

            // Check if extracted address is contained in property address
            if (propStreetAddress.includes(extractedAddress) || 
                extractedAddress.includes(propStreetAddress)) {
              matchedProperty = prop;
              console.log(`Matched by "stay at" address: ${prop.name}`);
              break;
            }
          }
        }

        // Fallback: Try matching by street number + name parts
        if (!matchedProperty) {
          for (const prop of safeProperties) {
            if (!prop.address) continue;
            
            const streetAddress = prop.address.toLowerCase().split(",")[0].trim();
            const streetParts = streetAddress.split(" ");
            
            if (streetParts.length >= 2) {
              // Try matching street number + first word of street name
              const streetNumber = streetParts[0];
              const streetName = streetParts.slice(1, 3).join(" ");
              
              if (combinedText.includes(streetNumber) && 
                  combinedText.includes(streetName.split(" ")[0])) {
                matchedProperty = prop;
                console.log(`Matched by street parts: ${prop.name}`);
                break;
              }
            }
          }
        }

        // Fallback: Try matching by property name
        if (!matchedProperty) {
          for (const prop of safeProperties) {
            if (!prop.name) continue;
            
            const propNameLower = prop.name.toLowerCase();
            if (combinedText.includes(propNameLower)) {
              matchedProperty = prop;
              console.log(`Matched by property name: ${prop.name}`);
              break;
            }
          }
        }

        // Update the email_insight with matched property
        if (matchedProperty) {
          const { error: updateError } = await supabase
            .from("email_insights")
            .update({ property_id: matchedProperty.id })
            .eq("id", insight.id);

          if (!updateError) {
            matchedCount++;
            console.log(`Updated insight ${insight.id} with property ${matchedProperty.name}`);

            // Extract guest name from subject
            let guestName = "Unknown Guest";
            const guestNamePatterns = [
              /guest verification completed for\s+([A-Za-z]+\s+[A-Za-z]+)/i,
              /verification completed for\s+([A-Za-z]+\s+[A-Za-z]+)/i,
              /for\s+([A-Za-z]+\s+[A-Za-z]+)/i,
            ];
            for (const pattern of guestNamePatterns) {
              const match = insight.subject?.match(pattern);
              if (match) {
                guestName = match[1].trim();
                break;
              }
            }

            // Check if screening already exists
            const { data: existingScreening } = await supabase
              .from("guest_screenings")
              .select("id")
              .eq("email_insight_id", insight.id)
              .maybeSingle();

            if (!existingScreening) {
              // Create guest_screening record
              const { error: screeningError } = await supabase
                .from("guest_screenings")
                .insert({
                  property_id: matchedProperty.id,
                  guest_name: guestName,
                  screening_provider: "truvi",
                  screening_status: "passed",
                  risk_score: "low",
                  id_verified: true,
                  email_insight_id: insight.id,
                  raw_screening_data: { subject: insight.subject, summary: insight.summary },
                });

              if (!screeningError) {
                createdScreenings++;
                console.log(`Created screening record for ${guestName} at ${matchedProperty.name}`);
              } else {
                console.error("Failed to create screening:", screeningError);
              }
            }
          }
        }
      }

      details.orphanedScreenings.matched = matchedCount;
      details.orphanedScreenings.screeningsCreated = createdScreenings;
      
      if (matchedCount > 0) {
        console.log(`Successfully matched ${matchedCount} orphaned screenings, created ${createdScreenings} records`);
      }
    }

    // ========== CHECK 2: Screening Emails Without guest_screenings Records ==========
    console.log("Checking for screening emails missing guest_screenings records...");
    
    const { data: screeningInsights } = await supabase
      .from("email_insights")
      .select("id, property_id, subject, summary")
      .eq("category", "guest_screening")
      .not("property_id", "is", null)
      .gte("created_at", twentyFourHoursAgo);

    let missingScreeningsCount = 0;
    for (const insight of screeningInsights || []) {
      const { data: existingScreening } = await supabase
        .from("guest_screenings")
        .select("id")
        .eq("email_insight_id", insight.id)
        .maybeSingle();

      if (!existingScreening) {
        missingScreeningsCount++;
        
        // Extract guest name
        let guestName = "Unknown Guest";
        const match = insight.subject?.match(/for\s+([A-Za-z]+\s+[A-Za-z]+)/i);
        if (match) guestName = match[1].trim();

        // Create the missing record
        await supabase.from("guest_screenings").insert({
          property_id: insight.property_id,
          guest_name: guestName,
          screening_provider: "truvi",
          screening_status: "passed",
          risk_score: "low",
          id_verified: true,
          email_insight_id: insight.id,
          raw_screening_data: { subject: insight.subject, summary: insight.summary },
        });
      }
    }

    details.missingScreeningsCreated = missingScreeningsCount;
    if (missingScreeningsCount > 0) {
      console.log(`Created ${missingScreeningsCount} missing guest_screenings records`);
    }

    // ========== CHECK 3: Recent Screening Stats ==========
    const { data: recentScreenings } = await supabase
      .from("guest_screenings")
      .select("id, property_id, screening_status, screening_provider")
      .gte("created_at", twentyFourHoursAgo);

    details.recentScreenings = {
      total: recentScreenings?.length || 0,
      byStatus: {
        passed: (recentScreenings || []).filter(s => s.screening_status === "passed").length,
        failed: (recentScreenings || []).filter(s => s.screening_status === "failed").length,
        pending: (recentScreenings || []).filter(s => s.screening_status === "pending").length,
        flagged: (recentScreenings || []).filter(s => s.screening_status === "flagged").length,
      },
      byProvider: {
        truvi: (recentScreenings || []).filter(s => s.screening_provider === "truvi").length,
        other: (recentScreenings || []).filter(s => s.screening_provider !== "truvi").length,
      },
    };

    console.log(`Recent screenings: ${recentScreenings?.length || 0} total`);

    // ========== Log Watchdog Results ==========
    const { error: logError } = await supabase
      .from("watchdog_logs")
      .insert({
        run_at: runAt,
        check_type: "screening_sync",
        status: overallStatus,
        details,
        emails_scanned: orphanedInsights?.length || 0,
        owner_emails_detected: details.orphanedScreenings?.matched || 0,
        tasks_extracted: details.missingScreeningsCreated || 0,
        issues_found: issues.length > 0 ? issues : null,
      });

    if (logError) {
      console.error("Failed to log watchdog results:", logError);
    }

    console.log("=== Screening Watchdog Complete ===");
    console.log(`Status: ${overallStatus}`);
    console.log(`Issues: ${issues.length > 0 ? issues.join(", ") : "None"}`);

    return new Response(
      JSON.stringify({
        success: true,
        runAt,
        status: overallStatus,
        issues,
        details,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Screening Watchdog error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
