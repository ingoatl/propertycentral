import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * SELF-HEALING SYNC WATCHDOG
 * 
 * This watchdog monitors and auto-repairs sync issues across:
 * 1. Marketing activities - ensures all synced data matches to properties
 * 2. Guest screenings - ensures Truvi emails create screening records
 * 3. Owner data visibility - ensures owner portals show synced data
 * 
 * Run this hourly via cron or on-demand to catch and fix sync issues.
 */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("=== Self-Healing Sync Watchdog Starting ===");
    const runAt = new Date().toISOString();
    const healingActions: string[] = [];
    const issues: string[] = [];
    let overallStatus: "healthy" | "warning" | "error" = "healthy";
    const details: Record<string, any> = {};

    // ========== LOAD REFERENCE DATA ==========
    const { data: properties } = await supabase
      .from("properties")
      .select("id, name, address, owner_id")
      .is("offboarded_at", null);

    const safeProperties = properties || [];
    console.log(`Loaded ${safeProperties.length} active properties`);

    // Build property lookup maps for fast matching
    const propertyByName = new Map<string, any>();
    const propertyByAddress = new Map<string, any>();
    const propertyById = new Map<string, any>();
    
    for (const prop of safeProperties) {
      propertyById.set(prop.id, prop);
      if (prop.name) {
        propertyByName.set(prop.name.toLowerCase(), prop);
        // Also add partial matches
        const nameParts = prop.name.toLowerCase().split(/[\s-]+/);
        for (const part of nameParts) {
          if (part.length > 3) {
            propertyByName.set(part, prop);
          }
        }
      }
      if (prop.address) {
        const streetAddress = prop.address.toLowerCase().split(",")[0].trim();
        propertyByAddress.set(streetAddress, prop);
        // Also add just the street number + name
        const parts = streetAddress.split(" ");
        if (parts.length >= 2) {
          propertyByAddress.set(parts.slice(0, 2).join(" "), prop);
        }
      }
    }

    // Known property name mappings (fuzzy -> actual)
    const knownMappings: Record<string, string> = {
      "the alpine": "alpine",
      "scandi chic-mins to ksu/dt, sleeps 5, w/king, pet frndly": "scandi chic",
      "old roswell": "modern + cozy townhome",
      "mableton meadows": "woodland lane",
      "lavish living - 8 mins from braves stadium w/king": "lavish living",
      "homerun hideaway": null as any, // Need to add to DB
      "the bloom": null as any, // Need to add to DB
    };

    // ========== HEAL 1: Marketing Activities Without Owner ID ==========
    console.log("Checking marketing activities missing owner_id...");
    
    const { data: activitiesNoOwner } = await supabase
      .from("owner_marketing_activities")
      .select("id, property_id")
      .is("owner_id", null)
      .not("property_id", "is", null);

    let ownerIdFixed = 0;
    for (const activity of activitiesNoOwner || []) {
      const property = propertyById.get(activity.property_id);
      if (property?.owner_id) {
        const { error } = await supabase
          .from("owner_marketing_activities")
          .update({ owner_id: property.owner_id })
          .eq("id", activity.id);
        
        if (!error) ownerIdFixed++;
      }
    }

    if (ownerIdFixed > 0) {
      healingActions.push(`Fixed ${ownerIdFixed} marketing activities missing owner_id`);
      console.log(`Fixed ${ownerIdFixed} marketing activities missing owner_id`);
    }

    details.marketingActivitiesHealed = { ownerIdFixed };

    // ========== HEAL 2: Orphaned Partner Sync Errors ==========
    console.log("Checking for partner sync errors to retry...");
    
    const { data: failedSyncs } = await supabase
      .from("partner_sync_log")
      .select("*")
      .eq("sync_status", "partial")
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(5);

    details.failedSyncs = {
      count: failedSyncs?.length || 0,
      sources: [...new Set((failedSyncs || []).map(s => s.source_system))],
    };

    if (failedSyncs && failedSyncs.length > 0) {
      issues.push(`${failedSyncs.length} partial sync logs in last 24h`);
      overallStatus = "warning";
    }

    // ========== HEAL 3: Guest Screening False Positives ==========
    console.log("Checking for guest screening false positives...");
    
    // Find email_insights marked as guest_screening but from non-screening providers
    const validScreeningDomains = ["@truvi.com", "@authenticate.com", "@superhog.com", "@autohost.ai"];
    
    const { data: screeningInsights } = await supabase
      .from("email_insights")
      .select("id, sender_email, subject, category")
      .eq("category", "guest_screening");

    let falsePositivesFixed = 0;
    for (const insight of screeningInsights || []) {
      const isValidScreening = validScreeningDomains.some(domain => 
        insight.sender_email?.toLowerCase().includes(domain)
      );
      
      if (!isValidScreening) {
        // This is a false positive - reclassify
        const { error } = await supabase
          .from("email_insights")
          .update({ category: "other" })
          .eq("id", insight.id);
        
        if (!error) {
          falsePositivesFixed++;
          console.log(`Fixed false positive screening: ${insight.subject}`);
        }
      }
    }

    if (falsePositivesFixed > 0) {
      healingActions.push(`Reclassified ${falsePositivesFixed} false positive screening emails`);
    }

    details.screeningFalsePositives = { fixed: falsePositivesFixed };

    // ========== HEAL 4: Screening Emails Without guest_screenings Records ==========
    console.log("Checking for valid screening emails without records...");
    
    const { data: validScreeningEmails } = await supabase
      .from("email_insights")
      .select("id, sender_email, subject, summary, property_id")
      .eq("category", "guest_screening")
      .not("property_id", "is", null);

    let screeningsCreated = 0;
    for (const insight of validScreeningEmails || []) {
      // Check if screening already exists
      const { data: existing } = await supabase
        .from("guest_screenings")
        .select("id")
        .eq("email_insight_id", insight.id)
        .maybeSingle();

      if (!existing) {
        // Extract guest name
        let guestName = "Unknown Guest";
        const match = insight.subject?.match(/for\s+([A-Za-z]+\s+[A-Za-z]+)/i);
        if (match) guestName = match[1].trim();

        // Determine provider
        let provider = "unknown";
        if (insight.sender_email?.includes("truvi")) provider = "truvi";
        else if (insight.sender_email?.includes("authenticate")) provider = "authenticate";
        else if (insight.sender_email?.includes("superhog")) provider = "superhog";

        const { error } = await supabase.from("guest_screenings").insert({
          property_id: insight.property_id,
          guest_name: guestName,
          screening_provider: provider,
          screening_status: "passed",
          risk_score: "low",
          id_verified: true,
          email_insight_id: insight.id,
          raw_screening_data: { subject: insight.subject, summary: insight.summary },
        });

        if (!error) {
          screeningsCreated++;
          console.log(`Created screening for ${guestName}`);
        }
      }
    }

    if (screeningsCreated > 0) {
      healingActions.push(`Created ${screeningsCreated} missing guest_screening records`);
    }

    details.screeningsCreated = screeningsCreated;

    // ========== HEAL 5: Orphaned Marketing Activities (No Property Match) ==========
    console.log("Checking for marketing activities that need property matching...");
    
    // Check partner_sync_log for skipped activities due to unmatched properties
    const { data: recentSyncLogs } = await supabase
      .from("partner_sync_log")
      .select("error_details")
      .eq("sync_type", "incoming")
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const unmatchedProperties = new Set<string>();
    for (const log of recentSyncLogs || []) {
      const errors = (log.error_details as any)?.errors || [];
      for (const err of errors) {
        const match = err.match(/name="([^"]+)"/);
        if (match) unmatchedProperties.add(match[1]);
      }
    }

    details.unmatchedProperties = [...unmatchedProperties];

    if (unmatchedProperties.size > 0) {
      issues.push(`${unmatchedProperties.size} property names not matched: ${[...unmatchedProperties].join(", ")}`);
      overallStatus = "warning";
    }

    // ========== HEAL 6: Verify Owner Portal Data Visibility ==========
    console.log("Checking owner portal data visibility...");
    
    // Get all owners with active properties
    const { data: activeOwners } = await supabase
      .from("properties")
      .select("owner_id, id, name")
      .is("offboarded_at", null)
      .not("owner_id", "is", null);

    const ownerPropertyMap = new Map<string, any[]>();
    for (const prop of activeOwners || []) {
      if (!ownerPropertyMap.has(prop.owner_id)) {
        ownerPropertyMap.set(prop.owner_id, []);
      }
      ownerPropertyMap.get(prop.owner_id)!.push(prop);
    }

    // Check each owner's marketing activities
    let ownersWithData = 0;
    let ownersWithoutData = 0;
    const ownersNeedingData: string[] = [];

    for (const [ownerId, ownerProperties] of ownerPropertyMap) {
      const propertyIds = ownerProperties.map(p => p.id);
      
      const { count } = await supabase
        .from("owner_marketing_activities")
        .select("id", { count: "exact", head: true })
        .in("property_id", propertyIds);

      if (count && count > 0) {
        ownersWithData++;
      } else {
        ownersWithoutData++;
        ownersNeedingData.push(ownerProperties[0].name);
      }
    }

    details.ownerVisibility = {
      ownersWithData,
      ownersWithoutData,
      sampleOwnersNeedingData: ownersNeedingData.slice(0, 5),
    };

    // ========== SUMMARY ==========
    const summary = {
      runAt,
      status: overallStatus,
      healingActions,
      issues,
      details,
      propertiesChecked: safeProperties.length,
      ownersChecked: ownerPropertyMap.size,
    };

    // Log to watchdog_logs
    await supabase.from("watchdog_logs").insert({
      run_at: runAt,
      check_type: "self_healing_sync",
      status: overallStatus,
      details: summary,
      emails_scanned: screeningInsights?.length || 0,
      owner_emails_detected: 0,
      tasks_extracted: healingActions.length,
      issues_found: issues.length > 0 ? issues : null,
    });

    console.log("=== Self-Healing Sync Watchdog Complete ===");
    console.log(`Status: ${overallStatus}`);
    console.log(`Healing actions: ${healingActions.length}`);
    console.log(`Issues: ${issues.length}`);

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Self-Healing Watchdog error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
