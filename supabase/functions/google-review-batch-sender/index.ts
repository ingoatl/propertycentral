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

// Check if current time is within optimal send window (11am-3pm EST)
function isWithinSendWindow(): boolean {
  const now = new Date();
  const estOffset = -5 * 60;
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const estMinutes = utcMinutes + estOffset;
  const estHour = Math.floor(((estMinutes % 1440) + 1440) % 1440 / 60);
  return estHour >= 11 && estHour < 15;
}

// Best practice: Max 5 SMS per hour for optimal deliverability
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
    try {
      const body = await req.json();
      forceRun = body?.forceRun === true;
      retryPending = body?.retryPending === true;
    } catch {
      // No body or invalid JSON, use defaults
    }

    // Check if we're in the optimal send window (unless forced)
    if (!forceRun && !isWithinSendWindow()) {
      console.log("Outside send window (11am-3pm EST), skipping batch send");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Outside send window (11am-3pm EST). Use 'Run Now' button to force.",
          sentCount: 0 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all reviews with phone numbers
    const { data: pendingReviews, error: reviewError } = await supabase
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
      .limit(50);

    if (reviewError) {
      console.error("Error fetching reviews:", reviewError);
      throw reviewError;
    }

    console.log(`Found ${pendingReviews?.length || 0} reviews with phone numbers`);

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

    // Find reviews that need contact
    let reviewsToContact: typeof pendingReviews = [];
    
    if (retryPending) {
      // Retry reviews with "pending" status (created but not sent)
      const pendingRequestReviewIds = new Set(
        existingRequests
          ?.filter(r => r.workflow_status === 'pending')
          .map(r => r.review_id) || []
      );
      reviewsToContact = (pendingReviews || []).filter(review => 
        pendingRequestReviewIds.has(review.id)
      ).slice(0, MAX_SMS_PER_RUN);
    } else {
      // Normal flow - find reviews without any request yet
      reviewsToContact = (pendingReviews || []).filter(review => {
        // Skip if already has a request
        if (existingReviewIds.has(review.id)) return false;
        
        // Skip if guest has opted out
        const phoneDigits = review.guest_phone?.replace(/\D/g, '').slice(-10);
        if (optedOutPhones.has(phoneDigits)) return false;
        
        return true;
      }).slice(0, MAX_SMS_PER_RUN);
    }

    console.log(`${reviewsToContact.length} reviews to contact in this batch`);

    // Provide detailed status if no reviews to contact
    if (reviewsToContact.length === 0) {
      const totalReviews = pendingReviews?.length || 0;
      const alreadyContacted = existingRequests?.length || 0;
      const pendingStatus = existingRequests?.filter(r => r.workflow_status === 'pending').length || 0;
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `All ${totalReviews} reviews have already been contacted. ${alreadyContacted} requests exist (${pendingStatus} pending status). Sync new reviews from OwnerRez or use retryPending option.`,
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
    const results: Array<{ reviewId: string; success: boolean; error?: string }> = [];

    for (let i = 0; i < reviewsToContact.length; i++) {
      const review = reviewsToContact[i];
      
      // Add delay between SMS (except for first one)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, MIN_DELAY_BETWEEN_SMS_MS));
      }

      try {
        const formattedPhone = formatPhoneE164(review.guest_phone);
        const source = review.review_source || "Airbnb";
        const message = `Thanks again for the wonderful ${source} review — it truly means a lot. Google reviews help future guests trust us when booking directly. If you're open to it, I can send you a link plus a copy of your original review so you can paste it in seconds. Would that be okay?`;

        console.log(`Sending permission ask to ${formattedPhone} for review ${review.id}`);

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
        }

        if (!ghlContactId) {
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
          }
        }

        if (!ghlContactId) {
          throw new Error("Failed to find or create GHL contact");
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
          
          // Check for opt-out
          if (errorText.includes("unsubscribed") || errorText.includes("blocked") || errorText.includes("DND")) {
            // Mark as opted out
            await supabase
              .from("google_review_requests")
              .insert({
                review_id: review.id,
                guest_phone: formattedPhone,
                workflow_status: "ignored",
                opted_out: true,
                opted_out_at: new Date().toISOString(),
              });
            
            results.push({ reviewId: review.id, success: false, error: "Contact opted out" });
            continue;
          }
          
          throw new Error(errorText);
        }

        const sendData = await sendResponse.json();

        // Create google_review_request record
        const { data: newRequest, error: insertError } = await supabase
          .from("google_review_requests")
          .insert({
            review_id: review.id,
            guest_phone: formattedPhone,
            workflow_status: "permission_asked",
            permission_asked_at: new Date().toISOString(),
            opted_out: false,
          })
          .select()
          .single();

        if (insertError) {
          console.error("Error creating request record:", insertError);
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

        results.push({ reviewId: review.id, success: true });
        console.log(`Successfully sent to ${formattedPhone}`);

      } catch (error) {
        console.error(`Error sending to review ${review.id}:`, error);
        results.push({ 
          reviewId: review.id, 
          success: false, 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }

    const successCount = results.filter(r => r.success).length;

    return new Response(
      JSON.stringify({ 
        success: true, 
        sentCount: successCount,
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
