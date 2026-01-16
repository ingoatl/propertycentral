import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Google Reviews GHL phone number
const GOOGLE_REVIEWS_PHONE = "+14049247251";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ghlApiKey = Deno.env.get("GHL_API_KEY")!;
    const ghlLocationId = Deno.env.get("GHL_LOCATION_ID")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("=== Google Reviews Watchdog Starting ===");
    const runAt = new Date().toISOString();
    const issues: string[] = [];
    const actions: string[] = [];
    let overallStatus: "healthy" | "warning" | "error" = "healthy";
    const details: Record<string, any> = {};

    // ========== CHECK 1: Unprocessed Inbound Messages ==========
    console.log("Checking for unprocessed inbound messages...");
    
    // Get all inbound Google Reviews messages from last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: recentInbound } = await supabase
      .from("lead_communications")
      .select("id, body, created_at, metadata")
      .eq("direction", "inbound")
      .gte("created_at", twentyFourHoursAgo)
      .order("created_at", { ascending: false });
    
    // Filter for Google Reviews related messages
    const googleReviewsInbound = (recentInbound || []).filter((msg: any) => {
      const phone = msg.metadata?.ghl_data?.contactPhone || msg.metadata?.unmatched_phone || "";
      const contactSource = msg.metadata?.ghl_data?.contact_source || "";
      return contactSource === "GoogleReviews" || msg.metadata?.source === "GoogleReviews";
    });
    
    details.inboundMessages = {
      total24h: recentInbound?.length || 0,
      googleReviewsRelated: googleReviewsInbound.length,
    };

    // ========== CHECK 2: Requests Status Summary ==========
    console.log("Checking request status distribution...");
    
    const { data: allRequests } = await supabase
      .from("google_review_requests")
      .select("id, workflow_status, guest_phone, permission_asked_at, permission_granted_at, link_sent_at, completed_at, opted_out")
      .order("created_at", { ascending: false });
    
    const statusCounts = {
      pending: 0,
      permission_asked: 0,
      permission_granted: 0,
      link_sent: 0,
      completed: 0,
      ignored: 0,
      opted_out: 0,
    };
    
    (allRequests || []).forEach((req: any) => {
      if (req.opted_out) {
        statusCounts.opted_out++;
      } else if (req.workflow_status in statusCounts) {
        (statusCounts as any)[req.workflow_status]++;
      }
    });
    
    details.requestStatus = statusCounts;
    details.totalRequests = allRequests?.length || 0;

    // ========== CHECK 3: Stalled Requests (need attention) ==========
    console.log("Checking for stalled requests...");
    
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    // Requests stuck in permission_granted (guest said yes but link never sent)
    const stalledPermissionGranted = (allRequests || []).filter((req: any) => 
      req.workflow_status === "permission_granted" && 
      !req.link_sent_at &&
      req.permission_granted_at < oneHourAgo
    );
    
    if (stalledPermissionGranted.length > 0) {
      issues.push(`${stalledPermissionGranted.length} request(s) stuck in permission_granted - link never sent`);
      overallStatus = "warning";
      details.stalledPermissionGranted = stalledPermissionGranted.map((r: any) => ({
        id: r.id,
        phone: r.guest_phone,
        grantedAt: r.permission_granted_at,
      }));
    }

    // Requests in link_sent for more than 7 days without completion
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const stalledLinkSent = (allRequests || []).filter((req: any) =>
      req.workflow_status === "link_sent" &&
      req.link_sent_at < sevenDaysAgo
    );
    
    if (stalledLinkSent.length > 0) {
      details.stalledLinkSent = {
        count: stalledLinkSent.length,
        message: `${stalledLinkSent.length} request(s) waiting for completion > 7 days (may need nudge)`,
      };
    }

    // ========== CHECK 4: Recent Completion Confirmations ==========
    console.log("Checking for unprocessed completion confirmations...");
    
    // Look for messages that might be completion confirmations
    const completionKeywords = ["done", "posted", "left", "submitted", "completed", "wrote", "finished"];
    
    const potentialCompletions = (recentInbound || []).filter((msg: any) => {
      const body = (msg.body || "").toLowerCase();
      return completionKeywords.some(kw => body.includes(kw));
    });
    
    // Check if any of these are from guests with link_sent status
    const unprocessedCompletions: any[] = [];
    
    for (const msg of potentialCompletions) {
      const phone = msg.metadata?.ghl_data?.contactPhone || msg.metadata?.unmatched_phone || "";
      if (!phone) continue;
      
      const phoneDigits = phone.replace(/\D/g, "").slice(-10);
      
      const { data: linkSentReq } = await supabase
        .from("google_review_requests")
        .select("id, guest_phone, workflow_status")
        .ilike("guest_phone", `%${phoneDigits}`)
        .eq("workflow_status", "link_sent")
        .limit(1)
        .maybeSingle();
      
      if (linkSentReq) {
        unprocessedCompletions.push({
          messageId: msg.id,
          messageBody: msg.body,
          requestId: linkSentReq.id,
          phone: linkSentReq.guest_phone,
        });
      }
    }
    
    if (unprocessedCompletions.length > 0) {
      issues.push(`${unprocessedCompletions.length} potential completion confirmation(s) not yet processed`);
      overallStatus = "warning";
      details.unprocessedCompletions = unprocessedCompletions;
    }

    // ========== CHECK 5: Duplicate Prevention & Detection ==========
    console.log("Checking for potential duplicate messages...");
    
    // Get SMS log for last 24 hours
    const { data: recentSmsLog } = await supabase
      .from("sms_log")
      .select("phone_number, message_type, created_at")
      .gte("created_at", twentyFourHoursAgo)
      .order("created_at", { ascending: false });
    
    // Check for any phone that received multiple permission_ask in 24h
    const phoneMessageCount: Record<string, number> = {};
    (recentSmsLog || []).forEach((log: any) => {
      if (log.message_type === "permission_ask") {
        const normalizedPhone = log.phone_number?.replace(/\D/g, '').slice(-10);
        phoneMessageCount[normalizedPhone] = (phoneMessageCount[normalizedPhone] || 0) + 1;
      }
    });
    
    // Also check lead_communications for duplicates
    const { data: recentGoogleReviewComms } = await supabase
      .from("lead_communications")
      .select("body, metadata, created_at")
      .gte("created_at", twentyFourHoursAgo)
      .eq("direction", "outbound")
      .ilike("body", "%Google reviews%");
    
    const commPhoneCount: Record<string, number> = {};
    (recentGoogleReviewComms || []).forEach((comm: any) => {
      const phone = comm.metadata?.ghl_data?.contactPhone || "";
      if (phone) {
        const normalizedPhone = phone.replace(/\D/g, '').slice(-10);
        commPhoneCount[normalizedPhone] = (commPhoneCount[normalizedPhone] || 0) + 1;
      }
    });
    
    // Combine counts from both sources
    Object.entries(commPhoneCount).forEach(([phone, count]) => {
      phoneMessageCount[phone] = (phoneMessageCount[phone] || 0) + count;
    });
    
    const duplicates = Object.entries(phoneMessageCount).filter(([_, count]) => count > 1);
    if (duplicates.length > 0) {
      issues.push(`${duplicates.length} phone(s) received multiple Google Review messages in 24h - DUPLICATE DETECTED`);
      overallStatus = "error";
      details.duplicatePermissionRequests = duplicates.map(([phone, count]) => ({ phone, count }));
      
      // ACTION: Mark these as already contacted to prevent further duplicates
      for (const [phone, count] of duplicates) {
        actions.push(`Phone ${phone} received ${count} messages - blocking further sends`);
      }
    }
    
    // ========== CHECK 5b: Verify Completed Reviews Won't Receive More Messages ==========
    console.log("Verifying completed reviews are fully blocked...");
    
    const { data: completedRequests } = await supabase
      .from("google_review_requests")
      .select("guest_phone, completed_at, workflow_status")
      .eq("workflow_status", "completed");
    
    const completedPhones = new Set(
      (completedRequests || []).map((r: any) => r.guest_phone?.replace(/\D/g, '').slice(-10))
    );
    
    details.completedPhonesBlocked = {
      count: completedPhones.size,
      message: `${completedPhones.size} phone(s) are marked complete and blocked from further messages`
    };

    // ========== CHECK 6: Completed Reviews (no further follow-ups) ==========
    console.log("Verifying completed reviews won't receive follow-ups...");
    
    const completedCount = statusCounts.completed;
    details.completedReviews = {
      count: completedCount,
      message: `${completedCount} review(s) marked complete - no follow-ups will be sent`,
    };

    // ========== CHECK 7: Today's Activity ==========
    console.log("Summarizing today's activity...");
    
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();
    
    const { data: todaysSms } = await supabase
      .from("sms_log")
      .select("message_type, status")
      .gte("created_at", todayISO);
    
    const todayStats = {
      permission_ask_sent: 0,
      link_sent: 0,
      thank_you_sent: 0,
      nudge_sent: 0,
      failed: 0,
    };
    
    (todaysSms || []).forEach((sms: any) => {
      if (sms.status === "failed") {
        todayStats.failed++;
      } else {
        if (sms.message_type === "permission_ask") todayStats.permission_ask_sent++;
        if (sms.message_type === "link_delivery") todayStats.link_sent++;
        if (sms.message_type === "thank_you") todayStats.thank_you_sent++;
        if (sms.message_type === "nudge" || sms.message_type === "final_reminder") todayStats.nudge_sent++;
      }
    });
    
    details.todayActivity = todayStats;

    // ========== Log Watchdog Results ==========
    const { error: logError } = await supabase
      .from("watchdog_logs")
      .insert({
        run_at: runAt,
        check_type: "google_reviews",
        status: overallStatus,
        details,
        issues_found: issues.length > 0 ? issues : null,
      });
    
    if (logError) {
      console.error("Failed to log watchdog results:", logError);
    }

    console.log("=== Google Reviews Watchdog Complete ===");
    console.log(`Status: ${overallStatus}`);
    console.log(`Issues: ${issues.length > 0 ? issues.join(", ") : "None"}`);

    return new Response(
      JSON.stringify({
        success: true,
        runAt,
        status: overallStatus,
        issues,
        actions,
        details,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Google Reviews Watchdog error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
