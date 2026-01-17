import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// =========================================================================
// CENTRALIZED PHONE CONFIG - Single source of truth
// All edge functions MUST use these constants to prevent mismatches
// =========================================================================
const GOOGLE_REVIEWS_PHONE = "+14049247251";
const GHL_MAIN_PHONE = "+14048005932";

// Helper functions
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

function formatPhoneE164(phone: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return phone.startsWith("+") ? phone : `+${digits}`;
}

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

    console.log("=== Google Reviews Self-Healing Watchdog Starting ===");
    const runAt = new Date().toISOString();
    const issues: string[] = [];
    const actions: string[] = [];
    const healingActions: string[] = [];
    let overallStatus: "healthy" | "warning" | "error" = "healthy";
    const details: Record<string, any> = {};

    // ========== SELF-HEALING CHECK 1: Validate GHL Phone Configuration ==========
    console.log("[SELF-HEAL] Validating GHL phone configuration...");
    
    try {
      const phoneResponse = await fetch(
        `https://services.leadconnectorhq.com/locations/${ghlLocationId}/phone-numbers`,
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${ghlApiKey}`,
            "Version": "2021-07-28",
            "Content-Type": "application/json",
          },
        }
      );
      
      if (phoneResponse.ok) {
        const phoneData = await phoneResponse.json();
        const ghlPhones = phoneData.phoneNumbers || [];
        
        // Check if our configured phone exists in GHL
        const googleReviewsPhoneExists = ghlPhones.some((p: any) => 
          normalizePhone(p.phoneNumber || p.phone || "") === normalizePhone(GOOGLE_REVIEWS_PHONE)
        );
        
        const mainPhoneExists = ghlPhones.some((p: any) => 
          normalizePhone(p.phoneNumber || p.phone || "") === normalizePhone(GHL_MAIN_PHONE)
        );
        
        details.phoneValidation = {
          googleReviewsPhone: GOOGLE_REVIEWS_PHONE,
          googleReviewsPhoneValid: googleReviewsPhoneExists,
          mainPhone: GHL_MAIN_PHONE,
          mainPhoneValid: mainPhoneExists,
          ghlPhonesAvailable: ghlPhones.map((p: any) => p.phoneNumber || p.phone).filter(Boolean),
        };
        
        if (!googleReviewsPhoneExists) {
          issues.push(`CRITICAL: Google Reviews phone ${GOOGLE_REVIEWS_PHONE} NOT found in GHL!`);
          overallStatus = "error";
          
          // Attempt self-healing: Find an alternative phone
          if (ghlPhones.length > 0) {
            const suggestedPhone = ghlPhones[0].phoneNumber || ghlPhones[0].phone;
            healingActions.push(`Suggested alternative: ${suggestedPhone}`);
            details.suggestedAlternativePhone = suggestedPhone;
          }
        }
      }
    } catch (phoneErr) {
      console.log("Could not validate GHL phones:", phoneErr);
      details.phoneValidation = { error: "Could not fetch GHL phone numbers" };
    }

    // ========== SELF-HEALING CHECK 2: Process Stuck "permission_granted" Requests ==========
    console.log("[SELF-HEAL] Checking for stuck permission_granted requests...");
    
    const { data: stuckRequests } = await supabase
      .from("google_review_requests")
      .select("id, guest_phone, workflow_status, permission_granted_at, review_id")
      .eq("workflow_status", "permission_granted")
      .is("link_sent_at", null);
    
    if (stuckRequests && stuckRequests.length > 0) {
      issues.push(`${stuckRequests.length} request(s) stuck in permission_granted - auto-healing...`);
      overallStatus = overallStatus === "error" ? "error" : "warning";
      
      // AUTO-HEAL: Trigger link sending for stuck requests
      for (const stuckReq of stuckRequests) {
        try {
          console.log(`[SELF-HEAL] Auto-triggering link send for request ${stuckReq.id}`);
          
          // Get review details
          const { data: reviewData } = await supabase
            .from("ownerrez_reviews")
            .select("guest_name, property_id, source, review_text")
            .eq("id", stuckReq.review_id)
            .maybeSingle();
          
          if (reviewData) {
            // Get property Google review URL
            const { data: propertyData } = await supabase
              .from("properties")
              .select("google_review_url, name")
              .eq("id", reviewData.property_id)
              .maybeSingle();
            
            if (propertyData?.google_review_url) {
              // Call send-review-sms to send the link
              const sendResult = await supabase.functions.invoke("send-review-sms", {
                body: {
                  phone: stuckReq.guest_phone,
                  guestName: reviewData.guest_name,
                  propertyName: propertyData.name,
                  googleReviewUrl: propertyData.google_review_url,
                  source: reviewData.source,
                  reviewText: reviewData.review_text,
                  requestId: stuckReq.id,
                },
              });
              
              if (sendResult.error) {
                console.error(`[SELF-HEAL] Failed to send link for ${stuckReq.id}:`, sendResult.error);
                healingActions.push(`Failed to heal ${stuckReq.guest_phone}: ${sendResult.error.message}`);
              } else {
                healingActions.push(`Auto-sent review link to ${stuckReq.guest_phone}`);
              }
            }
          }
        } catch (healErr) {
          console.error(`[SELF-HEAL] Error healing request ${stuckReq.id}:`, healErr);
        }
      }
    }
    
    details.stuckPermissionGranted = stuckRequests?.length || 0;

    // ========== SELF-HEALING CHECK 3: Process Unhandled Inbound Replies ==========
    console.log("[SELF-HEAL] Checking for unprocessed inbound replies...");
    
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    // Get recent inbound messages
    const { data: recentInbound } = await supabase
      .from("lead_communications")
      .select("id, body, created_at, metadata, from_phone")
      .eq("direction", "inbound")
      .gte("created_at", twentyFourHoursAgo)
      .order("created_at", { ascending: false });
    
    // Positive reply keywords
    const positiveKeywords = ["yes", "sure", "ok", "okay", "yeah", "yep", "definitely", "absolutely", "of course", "please", "send", "y"];
    const completionKeywords = ["done", "posted", "left", "submitted", "completed", "wrote", "finished"];
    
    for (const msg of recentInbound || []) {
      const body = (msg.body || "").toLowerCase().trim();
      const phone = msg.from_phone || msg.metadata?.ghl_data?.contactPhone || msg.metadata?.unmatched_phone || "";
      
      if (!phone) continue;
      
      const phoneDigits = normalizePhone(phone);
      
      // Check if this person has a pending request
      const { data: pendingRequest } = await supabase
        .from("google_review_requests")
        .select("id, workflow_status, guest_phone")
        .or(`guest_phone.ilike.%${phoneDigits}`)
        .in("workflow_status", ["permission_asked", "link_sent"])
        .maybeSingle();
      
      if (!pendingRequest) continue;
      
      // Check if this is a positive reply that wasn't processed
      const isPositiveReply = positiveKeywords.some((kw: string) => {
        const words = body.split(/\s+/);
        return words.some((w: string) => w === kw || w.startsWith(kw));
      });
      
      const isCompletionReply = completionKeywords.some(kw => body.includes(kw));
      
      if (pendingRequest.workflow_status === "permission_asked" && isPositiveReply) {
        console.log(`[SELF-HEAL] Found unprocessed positive reply from ${phone}: "${body}"`);
        issues.push(`Unprocessed positive reply from ${phone} detected - triggering link send`);
        
        // AUTO-HEAL: Update status and trigger link send
        await supabase
          .from("google_review_requests")
          .update({ 
            workflow_status: "permission_granted",
            permission_granted_at: new Date().toISOString()
          })
          .eq("id", pendingRequest.id);
        
        healingActions.push(`Updated ${phone} to permission_granted and queued for link delivery`);
      }
      
      if (pendingRequest.workflow_status === "link_sent" && isCompletionReply) {
        console.log(`[SELF-HEAL] Found unprocessed completion from ${phone}: "${body}"`);
        issues.push(`Unprocessed completion confirmation from ${phone} - marking complete`);
        
        // AUTO-HEAL: Mark as complete
        await supabase
          .from("google_review_requests")
          .update({ 
            workflow_status: "completed",
            completed_at: new Date().toISOString()
          })
          .eq("id", pendingRequest.id);
        
        healingActions.push(`Marked ${phone} as completed based on reply: "${body}"`);
      }
    }

    // ========== CHECK 4: Status Summary ==========
    console.log("Generating status summary...");
    
    const { data: allRequests } = await supabase
      .from("google_review_requests")
      .select("id, workflow_status, opted_out")
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

    // ========== CHECK 5: Duplicate Detection ==========
    console.log("Checking for duplicates...");
    
    const { data: recentSmsLog } = await supabase
      .from("sms_log")
      .select("phone_number, message_type, created_at")
      .gte("created_at", twentyFourHoursAgo)
      .order("created_at", { ascending: false });
    
    const phoneMessageCount: Record<string, number> = {};
    (recentSmsLog || []).forEach((log: any) => {
      if (log.message_type === "permission_ask") {
        const normalized = normalizePhone(log.phone_number || "");
        if (normalized.length === 10) {
          phoneMessageCount[normalized] = (phoneMessageCount[normalized] || 0) + 1;
        }
      }
    });
    
    const duplicates = Object.entries(phoneMessageCount).filter(([_, count]) => count > 1);
    if (duplicates.length > 0) {
      issues.push(`${duplicates.length} phone(s) received duplicate messages`);
      overallStatus = "error";
      details.duplicates = duplicates.map(([phone, count]) => ({ phone, count }));
    }

    // ========== CHECK 6: Today's Activity ==========
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const { data: todaysSms } = await supabase
      .from("sms_log")
      .select("message_type, status")
      .gte("created_at", todayStart.toISOString());
    
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
    details.healingActionsPerformed = healingActions;

    // ========== Log Results ==========
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

    console.log("=== Google Reviews Self-Healing Watchdog Complete ===");
    console.log(`Status: ${overallStatus}`);
    console.log(`Issues: ${issues.length > 0 ? issues.join(", ") : "None"}`);
    console.log(`Healing Actions: ${healingActions.length > 0 ? healingActions.join(", ") : "None"}`);

    return new Response(
      JSON.stringify({
        success: true,
        runAt,
        status: overallStatus,
        issues,
        healingActions,
        details,
        configuredPhones: {
          googleReviews: GOOGLE_REVIEWS_PHONE,
          ghlMain: GHL_MAIN_PHONE,
        },
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
