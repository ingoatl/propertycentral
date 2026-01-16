import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Google Reviews dedicated phone number
const GOOGLE_REVIEWS_PHONE = "+14046090955";

// Format phone number to E.164 format
function formatPhoneE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return phone.startsWith('+') ? phone : `+${digits}`;
}

// Check if current time is within optimal send window (6pm-8pm EST)
function isWithinSendWindow(): { inWindow: boolean; currentESTHour: number } {
  const now = new Date();
  // EST is UTC-5 (or EDT UTC-4, but we'll use EST for consistency)
  const estOffset = -5 * 60;
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const estMinutes = utcMinutes + estOffset;
  const estHour = Math.floor(((estMinutes % 1440) + 1440) % 1440 / 60);
  // 6pm-8pm EST = hours 18, 19
  return { inWindow: estHour >= 18 && estHour < 20, currentESTHour: estHour };
}

// Best practice: Max 5 SMS per run
const MAX_SMS_PER_RUN = 5;
const MIN_DELAY_BETWEEN_SMS_MS = 30000; // 30 seconds between each SMS

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

    // Parse request body for options
    let forceRun = false;
    let retryPending = false;
    let isCronJob = false;
    try {
      const body = await req.json();
      forceRun = body?.forceRun === true;
      retryPending = body?.retryPending === true;
      isCronJob = body?.isCronJob === true;
    } catch {
      // No body or invalid JSON, use defaults
    }

    const windowCheck = isWithinSendWindow();
    console.log(`Current EST hour: ${windowCheck.currentESTHour}, In window (6-8pm): ${windowCheck.inWindow}, Force: ${forceRun}, Cron: ${isCronJob}`);

    // Check if we're in the optimal send window (unless forced)
    if (!forceRun && !windowCheck.inWindow) {
      console.log("Outside send window (6-8pm EST), skipping batch send");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Outside send window (6-8pm EST). Current EST hour: ${windowCheck.currentESTHour}. Use forceRun to override.`,
          sentCount: 0,
          currentESTHour: windowCheck.currentESTHour
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auto-sync reviews from OwnerRez first (to get phone numbers)
    console.log("Auto-syncing reviews from OwnerRez to get latest phone numbers...");
    try {
      const { data: syncResult, error: syncError } = await supabase.functions.invoke("sync-ownerrez-reviews", {
        body: { action: "backfill_phones" }
      });
      if (syncError) {
        console.error("OwnerRez sync error:", syncError);
      } else {
        console.log("OwnerRez sync result:", syncResult);
      }
    } catch (syncErr) {
      console.error("Failed to sync OwnerRez reviews:", syncErr);
    }

    // Check how many SMS have already been sent TODAY to enforce daily limit
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const { data: todaySent, error: todayError } = await supabase
      .from("google_review_requests")
      .select("id")
      .gte("permission_asked_at", todayStart.toISOString())
      .not("permission_asked_at", "is", null);
    
    const sentToday = todaySent?.length || 0;
    const remainingToday = Math.max(0, MAX_SMS_PER_RUN - sentToday);
    
    console.log(`Already sent ${sentToday} SMS today. Remaining quota: ${remainingToday}`);
    
    if (remainingToday === 0) {
      console.log("Daily limit of 5 SMS reached. No more messages will be sent today.");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Daily limit reached: ${sentToday} SMS already sent today. Max is ${MAX_SMS_PER_RUN}/day.`,
          sentCount: 0,
          sentToday,
          maxPerDay: MAX_SMS_PER_RUN
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all reviews with phone numbers
    const { data: allReviews, error: reviewError } = await supabase
      .from("ownerrez_reviews")
      .select(`
        id,
        guest_phone,
        review_source,
        review_text,
        review_date,
        guest_name
      `)
      .not("guest_phone", "is", null)
      .not("review_text", "is", null)
      .order("review_date", { ascending: false })
      .limit(100);

    if (reviewError) {
      console.error("Error fetching reviews:", reviewError);
      throw reviewError;
    }

    console.log(`Found ${allReviews?.length || 0} reviews with phone numbers`);

    // Get existing google_review_requests
    const { data: existingRequests } = await supabase
      .from("google_review_requests")
      .select("review_id, guest_phone, opted_out, workflow_status");

    const existingReviewIds = new Set(existingRequests?.map(r => r.review_id) || []);
    const optedOutPhones = new Set(
      existingRequests
        ?.filter(r => r.opted_out)
        .map(r => r.guest_phone?.replace(/\D/g, '').slice(-10)) || []
    );
    
    // CRITICAL: Track ALL phone numbers that have already been contacted (ANY status)
    // This prevents duplicates when the same phone has multiple reviews or GHL creates duplicate contacts
    const alreadyContactedPhones = new Set(
      existingRequests
        ?.filter(r => r.workflow_status !== "pending") // Already contacted if not pending
        .map(r => r.guest_phone?.replace(/\D/g, '').slice(-10)) || []
    );

    // Find reviews that need contact - prioritize NEW reviews from today
    let reviewsToContact: typeof allReviews = [];
    
    // First, find reviews posted today that don't have a request yet (priority)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayReviews = (allReviews || []).filter(review => {
      if (existingReviewIds.has(review.id)) return false;
      const phoneDigits = review.guest_phone?.replace(/\D/g, '').slice(-10);
      if (optedOutPhones.has(phoneDigits)) return false;
      // CRITICAL: Skip if this phone was already contacted for ANY review
      if (alreadyContactedPhones.has(phoneDigits)) {
        console.log(`Skipping ${review.guest_name} - phone ${phoneDigits} already contacted`);
        return false;
      }
      // Check if review is from today
      const reviewDate = review.review_date ? new Date(review.review_date) : null;
      return reviewDate && reviewDate >= today;
    });

    // Then find older reviews without requests
    const olderReviews = (allReviews || []).filter(review => {
      if (existingReviewIds.has(review.id)) return false;
      const phoneDigits = review.guest_phone?.replace(/\D/g, '').slice(-10);
      if (optedOutPhones.has(phoneDigits)) return false;
      // CRITICAL: Skip if this phone was already contacted for ANY review
      if (alreadyContactedPhones.has(phoneDigits)) {
        console.log(`Skipping ${review.guest_name} - phone ${phoneDigits} already contacted`);
        return false;
      }
      const reviewDate = review.review_date ? new Date(review.review_date) : null;
      return !reviewDate || reviewDate < today;
    });
    
    // Also check lead_communications for phones that received Google review messages today
    // to prevent race conditions where batch runs multiple times
    const { data: todayGoogleReviewComms } = await supabase
      .from("lead_communications")
      .select("body, metadata")
      .gte("created_at", todayStart.toISOString())
      .eq("direction", "outbound")
      .ilike("body", "%Google reviews%");
    
    const phonesContactedToday = new Set<string>();
    (todayGoogleReviewComms || []).forEach((comm: any) => {
      const phone = comm.metadata?.ghl_data?.contactPhone || "";
      if (phone) {
        phonesContactedToday.add(phone.replace(/\D/g, '').slice(-10));
      }
    });
    
    // Final filter to remove any phones already contacted today
    const filteredTodayReviews = todayReviews.filter(review => {
      const phoneDigits = review.guest_phone?.replace(/\D/g, '').slice(-10);
      if (phonesContactedToday.has(phoneDigits)) {
        console.log(`DUPLICATE PREVENTION: ${review.guest_name} (${phoneDigits}) already contacted today via lead_communications`);
        return false;
      }
      return true;
    });
    
    const filteredOlderReviews = olderReviews.filter(review => {
      const phoneDigits = review.guest_phone?.replace(/\D/g, '').slice(-10);
      if (phonesContactedToday.has(phoneDigits)) {
        console.log(`DUPLICATE PREVENTION: ${review.guest_name} (${phoneDigits}) already contacted today via lead_communications`);
        return false;
      }
      return true;
    });

    // Combine: today's reviews first (up to remaining quota), then fill with older ones
    // CRITICAL: Respect the remaining daily quota
    reviewsToContact = [
      ...filteredTodayReviews.slice(0, remainingToday),
      ...filteredOlderReviews.slice(0, Math.max(0, remainingToday - filteredTodayReviews.length))
    ].slice(0, remainingToday);

    console.log(`Found ${filteredTodayReviews.length} eligible new reviews from today, ${filteredOlderReviews.length} eligible older reviews`);
    console.log(`Processing ${reviewsToContact.length} reviews in this batch (limited by remaining quota: ${remainingToday})`);
    console.log(`Daily send stats: ${sentToday} already sent + ${reviewsToContact.length} this batch = ${sentToday + reviewsToContact.length} total`);

    // Provide detailed status if no reviews to contact
    if (reviewsToContact.length === 0) {
      const totalReviews = allReviews?.length || 0;
      const alreadyContacted = existingRequests?.length || 0;
      const pendingStatus = existingRequests?.filter(r => r.workflow_status === 'pending').length || 0;
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `All ${totalReviews} reviews have been processed. ${alreadyContacted} requests exist (${pendingStatus} pending status).`,
          sentCount: 0,
          stats: {
            totalReviews,
            alreadyContacted,
            pendingStatus,
            optedOut: optedOutPhones.size
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send SMS for each review with delay between sends
    const results: Array<{ reviewId: string; guestName?: string; phone: string; success: boolean; error?: string }> = [];

    for (let i = 0; i < reviewsToContact.length; i++) {
      const review = reviewsToContact[i];
      
      // Add delay between SMS (except for first one)
      if (i > 0) {
        console.log(`Waiting ${MIN_DELAY_BETWEEN_SMS_MS / 1000}s before next SMS...`);
        await new Promise(resolve => setTimeout(resolve, MIN_DELAY_BETWEEN_SMS_MS));
      }

      try {
        const formattedPhone = formatPhoneE164(review.guest_phone);
        const source = review.review_source || "Airbnb";
        const guestName = review.guest_name || "there";
        const message = `Hi ${guestName}! This is Anja & Ingo, your hosts with PeachHaus Group. Thanks again for the wonderful ${source} review — it truly means a lot! Google reviews help future guests trust us when booking directly. If you're open to it, I can send you a link plus a copy of your original review so you can paste it in seconds. Would that be okay?`;

        console.log(`[${i + 1}/${reviewsToContact.length}] Sending permission ask to ${formattedPhone} (${review.guest_name}) for review ${review.id}`);

        // Find or create GHL contact
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
          if (ghlContactId) {
            console.log(`Found existing GHL contact: ${ghlContactId}`);
          }
        }

        if (!ghlContactId) {
          console.log(`Creating new GHL contact for ${formattedPhone}`);
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
                name: review.guest_name || "Guest",
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
            console.error(`Failed to create contact: ${errorText}`);
          }
        }

        if (!ghlContactId) {
          throw new Error("Failed to find or create GHL contact");
        }

        // Send SMS
        console.log(`Sending SMS via GHL from ${GOOGLE_REVIEWS_PHONE} to ${formattedPhone}`);
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
          console.error(`GHL SMS error: ${errorText}`);
          
          // Check for opt-out
          if (errorText.includes("unsubscribed") || errorText.includes("blocked") || errorText.includes("DND")) {
            // Mark as opted out
            await supabase
              .from("google_review_requests")
              .upsert({
                review_id: review.id,
                guest_phone: formattedPhone,
                workflow_status: "ignored",
                opted_out: true,
                opted_out_at: new Date().toISOString(),
              }, { onConflict: 'review_id' });
            
            results.push({ reviewId: review.id, guestName: review.guest_name, phone: formattedPhone, success: false, error: "Contact opted out" });
            continue;
          }
          
          throw new Error(errorText);
        }

        const sendData = await sendResponse.json();
        console.log(`SMS sent successfully, message ID: ${sendData.messageId}`);

        // Create or update google_review_request record
        const { data: newRequest, error: upsertError } = await supabase
          .from("google_review_requests")
          .upsert({
            review_id: review.id,
            guest_phone: formattedPhone,
            workflow_status: "permission_asked",
            permission_asked_at: new Date().toISOString(),
            opted_out: false,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'review_id' })
          .select()
          .single();

        if (upsertError) {
          console.error("Error upserting request record:", upsertError);
        }

        // Log the SMS
        await supabase.from("sms_log").insert({
          request_id: newRequest?.id,
          phone_number: formattedPhone,
          message_type: "permission_ask",
          message_body: message,
          ghl_message_id: sendData.messageId,
          status: "sent",
        });

        results.push({ reviewId: review.id, guestName: review.guest_name, phone: formattedPhone, success: true });
        console.log(`✓ Successfully sent to ${review.guest_name} (${formattedPhone})`);

      } catch (error) {
        console.error(`✗ Error sending to review ${review.id}:`, error);
        results.push({ 
          reviewId: review.id, 
          guestName: review.guest_name,
          phone: review.guest_phone,
          success: false, 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`\n=== Batch Complete ===`);
    console.log(`Sent: ${successCount}, Failed: ${failCount}`);
    results.forEach(r => {
      console.log(`  ${r.success ? '✓' : '✗'} ${r.guestName || 'Unknown'} (${r.phone}) ${r.error ? `- ${r.error}` : ''}`);
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        sentCount: successCount,
        failedCount: failCount,
        totalProcessed: results.length,
        results 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Batch sender error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
