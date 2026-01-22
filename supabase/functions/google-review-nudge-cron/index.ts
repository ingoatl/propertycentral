import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Google Reviews dedicated phone number (GHL) - MUST match GHL location phone
const GOOGLE_REVIEWS_PHONE = "+14049247251";

// Format phone number to E.164 format
function formatPhoneE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return phone;
}

// Get current EST hour for logging
function getCurrentESTHour(): number {
  const now = new Date();
  const estOffset = -5 * 60;
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const estMinutes = utcMinutes + estOffset;
  return Math.floor(((estMinutes % 1440) + 1440) % 1440 / 60);
}

// Max nudges per run to avoid rate limiting
const MAX_NUDGES_PER_RUN = 10;

// Delay between SMS sends (5 seconds for better deliverability)
const SMS_DELAY_MS = 5000;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ghlApiKey = Deno.env.get("GHL_API_KEY")!;
    const ghlLocationId = Deno.env.get("GHL_LOCATION_ID")!;
    const googleReviewUrl = Deno.env.get("GOOGLE_REVIEW_URL") || "https://g.page/r/YOUR_REVIEW_LINK";
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body for options
    let forceRun = false;
    try {
      const body = await req.json();
      forceRun = body?.forceRun === true;
    } catch {
      // No body or invalid JSON, use defaults
    }

    const currentESTHour = getCurrentESTHour();
    console.log(`=== Google Review Nudge Cron Started ===`);
    console.log(`Current EST hour: ${currentESTHour}`);

    // Find requests that need nudging:
    // - Permission asked at least 48 hours ago
    // - No response received (still in permission_asked status)
    // - Not opted out
    // - Nudge count < 2 (max 2 nudges)
    // - Last nudge was more than 48 hours ago (or never nudged)
    const twoDaysAgo = new Date();
    twoDaysAgo.setHours(twoDaysAgo.getHours() - 48);
    const twoDaysAgoStr = twoDaysAgo.toISOString();

    // DEDUPLICATION: Use raw SQL to get DISTINCT phones with proper priority
    const { data: needsNudge, error: fetchError } = await supabase
      .from("google_review_requests")
      .select("*, ownerrez_reviews(*)")
      .eq("workflow_status", "permission_asked")
      .eq("opted_out", false)
      .lt("nudge_count", 2)
      .lt("permission_asked_at", twoDaysAgoStr)
      .or(`last_nudge_at.is.null,last_nudge_at.lt.${twoDaysAgoStr}`)
      .order("nudge_count", { ascending: true }) // Prioritize those never nudged
      .order("permission_asked_at", { ascending: true }); // Then oldest first

    if (fetchError) {
      console.error("Error fetching nudge candidates:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${needsNudge?.length || 0} total nudge candidates`);

    // PHONE-BASED DEDUPLICATION: Only process one request per unique phone
    const processedPhones = new Set<string>();
    const deduplicatedRequests: typeof needsNudge = [];
    
    for (const request of needsNudge || []) {
      const normalizedPhone = formatPhoneE164(request.guest_phone);
      if (!processedPhones.has(normalizedPhone)) {
        processedPhones.add(normalizedPhone);
        deduplicatedRequests.push(request);
      }
    }

    console.log(`After phone deduplication: ${deduplicatedRequests.length} unique phones to nudge`);

    // Check for recent SMS to prevent rapid-fire duplicates
    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);
    
    const { data: recentSms } = await supabase
      .from("sms_log")
      .select("phone_number")
      .in("message_type", ["nudge", "final_reminder"])
      .eq("status", "sent")
      .gte("created_at", oneDayAgo.toISOString());
    
    const recentlyNudgedPhones = new Set(
      (recentSms || []).map(s => formatPhoneE164(s.phone_number))
    );
    
    // Filter out phones that were successfully nudged in the last 24 hours
    const toNudge = deduplicatedRequests.filter(r => 
      !recentlyNudgedPhones.has(formatPhoneE164(r.guest_phone))
    );
    
    console.log(`After 24h dedup: ${toNudge.length} phones to nudge (skipped ${deduplicatedRequests.length - toNudge.length} recently nudged)`);

    let nudgesSent = 0;
    const results: { requestId: string; phone: string; success: boolean; error?: string }[] = [];

    // Helper to send SMS via GHL - creates contact if not found
    const sendNudgeSms = async (phone: string, message: string, guestName?: string): Promise<{ success: boolean; messageId?: string; error?: string }> => {
      try {
        const formattedPhone = formatPhoneE164(phone);
        
        // Find contact in GHL
        const searchResponse = await fetch(
          `https://services.leadconnectorhq.com/contacts/search/duplicate?locationId=${ghlLocationId}&phone=${encodeURIComponent(formattedPhone)}`,
          {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${ghlApiKey}`,
              "Version": "2021-07-28",
            },
          }
        );

        let ghlContactId = null;
        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          ghlContactId = searchData.contact?.id;
        }

        // If contact not found, create one
        if (!ghlContactId) {
          console.log(`Contact not found for ${formattedPhone}, creating new GHL contact...`);
          const createResponse = await fetch(
            `https://services.leadconnectorhq.com/contacts/`,
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${ghlApiKey}`,
                "Version": "2021-07-28",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                locationId: ghlLocationId,
                phone: formattedPhone,
                name: guestName || "Guest",
                source: "GoogleReviews",
              }),
            }
          );

          if (createResponse.ok) {
            const createData = await createResponse.json();
            ghlContactId = createData.contact?.id;
            console.log(`Created new GHL contact: ${ghlContactId}`);
          } else {
            const errorText = await createResponse.text();
            console.error(`Failed to create GHL contact: ${errorText}`);
            return { success: false, error: `Failed to create contact: ${errorText}` };
          }
        }

        if (!ghlContactId) {
          return { success: false, error: "Failed to find or create GHL contact" };
        }

        // Send SMS
        const sendResponse = await fetch(
          `https://services.leadconnectorhq.com/conversations/messages`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${ghlApiKey}`,
              "Version": "2021-04-15",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              type: "SMS",
              contactId: ghlContactId,
              message: message,
              fromNumber: GOOGLE_REVIEWS_PHONE,
            }),
          }
        );

        if (!sendResponse.ok) {
          const errorText = await sendResponse.text();
          return { success: false, error: errorText };
        }

        const data = await sendResponse.json();
        return { success: true, messageId: data.messageId };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    };

    // Process nudges with rate limiting
    const requestsToProcess = toNudge.slice(0, MAX_NUDGES_PER_RUN);
    
    for (let i = 0; i < requestsToProcess.length; i++) {
      const request = requestsToProcess[i];
      
      try {
        // Get guest name from ownerrez_reviews if available
        const guestName = request.ownerrez_reviews?.guest_name || "there";
        const firstName = guestName.split(' ')[0];
        
        // IMPROVED MESSAGES with host identity
        const nudgeMessage = request.nudge_count === 0
          ? `Hi ${firstName}! It's Ingo & Anja from PeachHaus Group, your Airbnb hosts. Just checking in real quick — no pressure at all. Happy to send the Google link + your review text if you'd like. Just reply and I'll send it over!`
          : `Hey ${firstName}, it's Ingo & Anja again from PeachHaus Group! Just a friendly bump in case life got busy. If you're still open to sharing a quick Google review, here's the link: ${googleReviewUrl}. We'd really appreciate it!`;

        console.log(`[${i + 1}/${requestsToProcess.length}] Sending nudge to ${request.guest_phone} (nudge_count: ${request.nudge_count})`);
        
        const result = await sendNudgeSms(request.guest_phone, nudgeMessage, guestName);

        // Log the SMS
        await supabase.from("sms_log").insert({
          request_id: request.id,
          phone_number: request.guest_phone,
          message_type: request.nudge_count === 0 ? "nudge" : "final_reminder",
          message_body: nudgeMessage,
          ghl_message_id: result.messageId,
          status: result.success ? "sent" : "failed",
          error_message: result.error,
        });

        if (result.success) {
          // Update request with nudge count
          await supabase
            .from("google_review_requests")
            .update({
              nudge_count: request.nudge_count + 1,
              last_nudge_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", request.id);

          nudgesSent++;
          results.push({ requestId: request.id, phone: request.guest_phone, success: true });
          console.log(`✓ Nudge sent to ${request.guest_phone}`);
        } else {
          results.push({ requestId: request.id, phone: request.guest_phone, success: false, error: result.error });
          console.log(`✗ Nudge failed for ${request.guest_phone}: ${result.error}`);
        }

        // Delay between messages (5 seconds) for better deliverability
        if (i < requestsToProcess.length - 1) {
          console.log(`Waiting ${SMS_DELAY_MS / 1000}s before next SMS...`);
          await new Promise(resolve => setTimeout(resolve, SMS_DELAY_MS));
        }
      } catch (error) {
        console.error(`Error processing nudge for ${request.id}:`, error);
        results.push({ requestId: request.id, phone: request.guest_phone, success: false, error: String(error) });
      }
    }

    console.log(`=== Nudge cron complete. Sent ${nudgesSent}/${requestsToProcess.length} nudges ===`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        nudgesSent, 
        total: toNudge.length,
        processed: requestsToProcess.length,
        skippedDuplicates: (needsNudge?.length || 0) - deduplicatedRequests.length,
        skippedRecentlyNudged: deduplicatedRequests.length - toNudge.length,
        results 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Nudge cron error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
