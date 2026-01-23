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

    console.log("=== Intel Watchdog Starting ===");
    const runAt = new Date().toISOString();
    const issues: string[] = [];
    let overallStatus: "healthy" | "warning" | "error" = "healthy";
    const details: Record<string, any> = {};

    // ========== CHECK 1: Gmail OAuth Token Health ==========
    console.log("Checking Gmail OAuth token health...");
    
    const { data: gmailTokens, error: tokenError } = await supabase
      .from("gmail_oauth_tokens")
      .select("id, user_id, expires_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(5);

    if (tokenError) {
      console.error("Error checking Gmail tokens:", tokenError);
      issues.push("Failed to check Gmail token status");
      overallStatus = "error";
    } else if (!gmailTokens || gmailTokens.length === 0) {
      issues.push("No Gmail OAuth tokens configured");
      overallStatus = "warning";
    } else {
      const now = new Date();
      const validTokens = gmailTokens.filter(t => new Date(t.expires_at) > now);
      const expiredTokens = gmailTokens.filter(t => new Date(t.expires_at) <= now);
      
      details.gmailTokens = {
        total: gmailTokens.length,
        valid: validTokens.length,
        expired: expiredTokens.length,
        latestUpdate: gmailTokens[0]?.updated_at,
      };
      
      if (validTokens.length === 0) {
        issues.push("All Gmail tokens are expired - email scanning may fail");
        overallStatus = "error";
      } else if (expiredTokens.length > 0) {
        issues.push(`${expiredTokens.length} Gmail token(s) expired`);
        overallStatus = "warning";
      }
      
      console.log(`Gmail tokens: ${validTokens.length} valid, ${expiredTokens.length} expired`);
    }

    // ========== CHECK 2: Email Scanning Health ==========
    console.log("Checking email scan health...");
    
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: recentScans, error: scanError } = await supabase
      .from("email_scan_log")
      .select("*")
      .gte("scan_date", twentyFourHoursAgo)
      .order("scan_date", { ascending: false });

    if (scanError) {
      console.error("Error checking email scans:", scanError);
      issues.push("Failed to check email scan status");
      overallStatus = "error";
    } else if (!recentScans || recentScans.length === 0) {
      issues.push("No email scans in past 24 hours");
      overallStatus = overallStatus === "error" ? "error" : "warning";
    } else {
      const successfulScans = recentScans.filter(s => s.scan_status === "completed");
      const failedScans = recentScans.filter(s => s.scan_status !== "completed");
      
      details.emailScans = {
        total: recentScans.length,
        successful: successfulScans.length,
        failed: failedScans.length,
        totalEmailsProcessed: successfulScans.reduce((sum, s) => sum + (s.emails_processed || 0), 0),
        totalInsightsGenerated: successfulScans.reduce((sum, s) => sum + (s.insights_generated || 0), 0),
      };
      
      if (failedScans.length > successfulScans.length) {
        issues.push(`More failed scans (${failedScans.length}) than successful (${successfulScans.length})`);
        overallStatus = overallStatus === "error" ? "error" : "warning";
      }
      
      console.log(`Email scans: ${successfulScans.length} successful, ${failedScans.length} failed`);
    }

    // ========== CHECK 3: Owner Email Detection ==========
    console.log("Checking owner email detection...");
    
    // Get all property owner emails
    const { data: owners } = await supabase
      .from("property_owners")
      .select("id, email, name");
    
    const ownerEmails = new Set((owners || []).map(o => o.email?.toLowerCase()).filter(Boolean));
    
    // Get recent email insights from known owners
    const { data: recentInsights } = await supabase
      .from("email_insights")
      .select("id, sender_email, owner_id, created_at")
      .gte("created_at", twentyFourHoursAgo);
    
    const ownerEmailsDetected = (recentInsights || []).filter(i => 
      i.owner_id || ownerEmails.has(i.sender_email?.toLowerCase())
    );
    
    details.ownerEmails = {
      totalInsightsProcessed: recentInsights?.length || 0,
      ownerEmailsDetected: ownerEmailsDetected.length,
      knownOwnerCount: ownerEmails.size,
    };
    
    console.log(`Owner emails: ${ownerEmailsDetected.length} detected from ${ownerEmails.size} known owners`);

    // ========== CHECK 4: Pending Task Confirmations ==========
    console.log("Checking pending task confirmations...");
    
    const { data: pendingConfirmations } = await supabase
      .from("pending_task_confirmations")
      .select("id, status, created_at, expires_at")
      .eq("status", "pending");
    
    const expiredConfirmations = (pendingConfirmations || []).filter(c => 
      c.expires_at && new Date(c.expires_at) < new Date()
    );
    
    details.taskConfirmations = {
      pending: pendingConfirmations?.length || 0,
      expired: expiredConfirmations.length,
    };
    
    if (expiredConfirmations.length > 0) {
      issues.push(`${expiredConfirmations.length} expired task confirmations need attention`);
      overallStatus = overallStatus === "error" ? "error" : "warning";
    }
    
    console.log(`Task confirmations: ${pendingConfirmations?.length || 0} pending, ${expiredConfirmations.length} expired`);

    // ========== CHECK 5: Owner Conversation Analysis ==========
    console.log("Checking owner conversation analysis...");
    
    const { data: recentConversations } = await supabase
      .from("owner_conversations")
      .select("id, status, created_at")
      .gte("created_at", twentyFourHoursAgo);
    
    const pendingAnalysis = (recentConversations || []).filter(c => c.status === "pending");
    const analyzedConversations = (recentConversations || []).filter(c => c.status === "analyzed");
    const failedAnalysis = (recentConversations || []).filter(c => c.status === "failed" || c.status === "error");
    
    details.ownerConversations = {
      total: recentConversations?.length || 0,
      analyzed: analyzedConversations.length,
      pending: pendingAnalysis.length,
      failed: failedAnalysis.length,
    };
    
    if (pendingAnalysis.length > 5) {
      issues.push(`${pendingAnalysis.length} owner conversations stuck in pending`);
      overallStatus = overallStatus === "error" ? "error" : "warning";
    }
    
    if (failedAnalysis.length > 0) {
      issues.push(`${failedAnalysis.length} owner conversation analyses failed`);
      overallStatus = overallStatus === "error" ? "error" : "warning";
    }
    
    console.log(`Owner conversations: ${analyzedConversations.length} analyzed, ${pendingAnalysis.length} pending, ${failedAnalysis.length} failed`);

    // ========== CHECK 6: FormSubmit Email Detection ==========
    console.log("Checking FormSubmit email detection...");
    
    const { data: formSubmitInsights } = await supabase
      .from("email_insights")
      .select("id, sender_email, subject, created_at")
      .gte("created_at", twentyFourHoursAgo)
      .ilike("sender_email", "%formsubmit%");
    
    details.formSubmitEmails = {
      count: formSubmitInsights?.length || 0,
      subjects: (formSubmitInsights || []).map(i => i.subject).slice(0, 5),
    };
    
    console.log(`FormSubmit emails detected: ${formSubmitInsights?.length || 0}`);

    // ========== CHECK 7: Lead Communication Processing ==========
    console.log("Checking lead communication processing...");
    
    const { data: recentLeadComms } = await supabase
      .from("lead_communications")
      .select("id, direction, communication_type, created_at")
      .gte("created_at", twentyFourHoursAgo);
    
    const inboundComms = (recentLeadComms || []).filter(c => c.direction === "inbound");
    
    details.leadCommunications = {
      total: recentLeadComms?.length || 0,
      inbound: inboundComms.length,
      byType: {
        sms: (recentLeadComms || []).filter(c => c.communication_type === "sms").length,
        call: (recentLeadComms || []).filter(c => c.communication_type === "call").length,
        email: (recentLeadComms || []).filter(c => c.communication_type === "email").length,
      },
    };
    
    console.log(`Lead communications: ${recentLeadComms?.length || 0} total, ${inboundComms.length} inbound`);

    // ========== CHECK 8: Marketing Activity Sync ==========
    console.log("Checking marketing activity sync...");
    
    const { data: recentMarketingActivities } = await supabase
      .from("owner_marketing_activities")
      .select("id, property_id, synced_at, source_project")
      .gte("synced_at", twentyFourHoursAgo);

    const { data: allProperties } = await supabase
      .from("properties")
      .select("id, name")
      .is("offboarded_at", null);

    const propertiesWithMarketing = new Set(
      (recentMarketingActivities || []).map(a => a.property_id)
    );

    details.marketingSync = {
      activitiesSynced: recentMarketingActivities?.length || 0,
      propertiesWithActivities: propertiesWithMarketing.size,
      totalProperties: allProperties?.length || 0,
      sources: [...new Set((recentMarketingActivities || []).map(a => a.source_project))],
    };

    if (recentMarketingActivities?.length === 0) {
      issues.push("No marketing activities synced in past 24 hours");
      overallStatus = overallStatus === "error" ? "error" : "warning";
    }

    console.log(`Marketing sync: ${recentMarketingActivities?.length || 0} activities, ${propertiesWithMarketing.size} properties`);

    // ========== CHECK 9: Guest Screening Health ==========
    console.log("Checking guest screening health...");
    
    const { data: recentScreenings } = await supabase
      .from("guest_screenings")
      .select("id, property_id, screening_status, screening_provider")
      .gte("created_at", twentyFourHoursAgo);

    const { data: orphanedScreeningInsights } = await supabase
      .from("email_insights")
      .select("id")
      .eq("category", "guest_screening")
      .is("property_id", null)
      .gte("created_at", twentyFourHoursAgo);

    details.guestScreenings = {
      total: recentScreenings?.length || 0,
      byStatus: {
        passed: (recentScreenings || []).filter(s => s.screening_status === "passed").length,
        failed: (recentScreenings || []).filter(s => s.screening_status === "failed").length,
        pending: (recentScreenings || []).filter(s => s.screening_status === "pending").length,
      },
      orphanedEmails: orphanedScreeningInsights?.length || 0,
    };

    if (orphanedScreeningInsights && orphanedScreeningInsights.length > 0) {
      issues.push(`${orphanedScreeningInsights.length} screening emails without property match`);
      overallStatus = overallStatus === "error" ? "error" : "warning";
    }

    console.log(`Guest screenings: ${recentScreenings?.length || 0} total, ${orphanedScreeningInsights?.length || 0} orphaned`);

    // ========== Auto-approve Expired Confirmations ==========
    if (expiredConfirmations.length > 0) {
      console.log(`Auto-approving ${expiredConfirmations.length} expired confirmations...`);
      
      const { error: updateError } = await supabase
        .from("pending_task_confirmations")
        .update({
          status: "auto_approved",
          updated_at: new Date().toISOString(),
        })
        .in("id", expiredConfirmations.map(c => c.id));
      
      if (updateError) {
        console.error("Failed to auto-approve expired confirmations:", updateError);
        issues.push("Failed to auto-approve expired confirmations");
      } else {
        console.log(`Auto-approved ${expiredConfirmations.length} confirmations`);
      }
    }

    // ========== Log Watchdog Results ==========
    const { error: logError } = await supabase
      .from("watchdog_logs")
      .insert({
        run_at: runAt,
        check_type: "intel_system",
        status: overallStatus,
        details,
        emails_scanned: details.emailScans?.totalEmailsProcessed || 0,
        owner_emails_detected: details.ownerEmails?.ownerEmailsDetected || 0,
        tasks_extracted: details.taskConfirmations?.pending || 0,
        tasks_confirmed: 0,
        issues_found: issues.length > 0 ? issues : null,
      });
    
    if (logError) {
      console.error("Failed to log watchdog results:", logError);
    }

    console.log("=== Intel Watchdog Complete ===");
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
    console.error("Watchdog error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
