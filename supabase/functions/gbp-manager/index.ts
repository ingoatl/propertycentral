import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

// Google API endpoints
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GBP_ACCOUNTS_API = "https://mybusinessaccountmanagement.googleapis.com/v1";
const GBP_BUSINESS_INFO_API = "https://mybusinessbusinessinformation.googleapis.com/v1";
const GBP_API_V4 = "https://mybusiness.googleapis.com/v4";

// PeachHaus account ID (hardcoded for reliability)
// Location ID will be auto-discovered on first sync or can be set manually
const PEACHHAUS_ACCOUNT_ID = "106698735661379366674";

interface GBPSettings {
  id: string;
  gbp_account_id: string | null;
  gbp_location_id: string | null;
  auto_reply_enabled: boolean;
  auto_post_enabled: boolean;
  post_time: string;
  reply_delay_minutes: number;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
}

// Get or create GBP settings
async function getSettings(supabase: any): Promise<GBPSettings | null> {
  const { data } = await supabase
    .from("gbp_settings")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
}

// Refresh the access token using refresh token
async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  console.log("Refreshing Google access token...");
  
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Token refresh failed:", error);
    throw new Error(`Failed to refresh token: ${error}`);
  }

  const data = await response.json();
  console.log("Token refreshed successfully");
  return { access_token: data.access_token, expires_in: data.expires_in };
}

// Get a valid access token, refreshing if needed
async function getValidAccessToken(supabase: any, settings: GBPSettings): Promise<string> {
  if (!settings.refresh_token) {
    throw new Error("No refresh token stored. Please reconnect Google Business Profile.");
  }

  // Check if token is still valid (with 5 min buffer)
  if (settings.access_token && settings.token_expires_at) {
    const expiresAt = new Date(settings.token_expires_at);
    const now = new Date();
    const bufferMs = 5 * 60 * 1000; // 5 minutes
    
    if (expiresAt.getTime() - now.getTime() > bufferMs) {
      console.log("Using existing access token (still valid)");
      return settings.access_token;
    }
  }

  // Token expired or about to expire - refresh it
  const { access_token, expires_in } = await refreshAccessToken(settings.refresh_token);
  
  // Calculate new expiry time
  const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();
  
  // Update in database
  await supabase
    .from("gbp_settings")
    .update({
      access_token,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", settings.id);

  return access_token;
}

// Make authenticated request to Google APIs
async function callGoogleAPI(
  accessToken: string,
  url: string,
  method: string = "GET",
  body?: any
): Promise<any> {
  console.log(`Calling Google API: ${method} ${url}`);
  
  const options: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const responseText = await response.text();
  
  console.log(`Google API response status: ${response.status}`);
  
  if (!response.ok) {
    console.error(`Google API error: ${responseText}`);
    throw new Error(`Google API error (${response.status}): ${responseText}`);
  }

  return responseText ? JSON.parse(responseText) : {};
}

// Exchange authorization code for tokens
async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  console.log("Exchanging authorization code for tokens...");
  
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Token exchange failed:", error);
    throw new Error(`Failed to exchange code: ${error}`);
  }

  const data = await response.json();
  console.log("Token exchange successful");
  
  if (!data.refresh_token) {
    console.warn("No refresh token returned - user may have already authorized this app");
  }
  
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
  };
}

// Generate AI reply using Lovable AI
async function generateAIReply(
  reviewerName: string,
  starRating: number,
  reviewText: string
): Promise<string> {
  console.log(`Generating AI reply for ${starRating}-star review`);
  
  const systemPrompt = `You are the guest relations manager for PeachHaus, a premium short-term and mid-term rental company in Atlanta, Georgia. Generate warm, professional responses to Google reviews.

Guidelines:
- Use the reviewer's name if provided
- Reference specific details from their review when possible
- For 5-star reviews: Thank them warmly, highlight something specific, invite them back
- For 4-star reviews: Thank them, acknowledge any feedback, mention continuous improvements
- For 1-3 star reviews: Sincerely apologize, don't be defensive, offer to discuss offline at info@peachhausgroup.com
- Keep response between 200-400 characters for readability
- Be genuine and personable, not corporate
- Sign as "The PeachHaus Team"`;

  const userPrompt = `Generate a response for this Google review:

Reviewer: ${reviewerName || "Guest"}
Rating: ${starRating} stars
Review: ${reviewText || "(No written review, just a star rating)"}`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI generation failed: ${await response.text()}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || "Thank you for your review! We appreciate your feedback.";
}

// Generate daily post content using Lovable AI
async function generateDailyPost(
  category: string,
  topic: string,
  propertyName?: string
): Promise<{ summary: string; callToAction: string }> {
  console.log(`Generating daily post for category: ${category}, topic: ${topic}`);
  
  const systemPrompt = `You are the social media manager for PeachHaus, a premium short-term and mid-term rental company in Atlanta, Georgia. Generate engaging Google Business Profile posts.

Guidelines:
- Keep posts between 150-300 words
- Be friendly, informative, and engaging
- Include a clear call-to-action
- Use emojis sparingly but effectively (1-2 max)
- Highlight unique value propositions
- Focus on guest experience and Atlanta lifestyle
- Do NOT use hashtags (Google Business doesn't support them well)

Your posts should feel authentic and helpful, not salesy.`;

  const userPrompt = `Generate a Google Business Profile post with the following:

Category: ${category}
Topic: ${topic}
${propertyName ? `Property: ${propertyName}` : ""}

Return your response in this format:
POST: [Your post content here]
CTA: [Call to action - one of: LEARN_MORE, BOOK, CALL, GET_DIRECTIONS]`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 600,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI generation failed: ${await response.text()}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content || "";
  
  const postMatch = content.match(/POST:\s*(.+?)(?=CTA:|$)/s);
  const ctaMatch = content.match(/CTA:\s*(\w+)/);
  
  return {
    summary: postMatch?.[1]?.trim() || content.substring(0, 1500),
    callToAction: ctaMatch?.[1]?.trim() || "LEARN_MORE",
  };
}

// Convert star rating string to number
function parseStarRating(rating: string): number {
  const ratingMap: Record<string, number> = {
    "FIVE": 5,
    "FOUR": 4,
    "THREE": 3,
    "TWO": 2,
    "ONE": 1,
  };
  return ratingMap[rating] || 3;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { action, ...params } = await req.json();
    
    console.log(`GBP Manager action: ${action}`);
    console.log("Params:", JSON.stringify(params));

    const settings = await getSettings(supabase);

    switch (action) {
      case "get-auth-url": {
        // Generate Google OAuth URL for GBP access using edge function as callback
        // This is the same pattern used by Gmail OAuth - stable redirect URI
        
        if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
          throw new Error("Google OAuth credentials not configured");
        }

        // Use edge function as the redirect URI (same pattern as gmail-oauth)
        const callbackUrl = `${SUPABASE_URL}/functions/v1/gbp-oauth`;
        
        // Required scopes for Google Business Profile
        const scopes = [
          "https://www.googleapis.com/auth/business.manage",
        ].join(" ");

        // State contains the return URL for redirect after OAuth
        const state = JSON.stringify({
          returnUrl: "/admin?tab=gbp"
        });

        const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
        authUrl.searchParams.set("redirect_uri", callbackUrl);
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("scope", scopes);
        authUrl.searchParams.set("access_type", "offline");
        authUrl.searchParams.set("prompt", "consent"); // Force consent to get refresh token
        authUrl.searchParams.set("state", encodeURIComponent(state));

        console.log("Generated OAuth URL with edge function callback:", authUrl.toString());
        console.log("Redirect URI:", callbackUrl);

        return new Response(JSON.stringify({ 
          authUrl: authUrl.toString(),
          redirectUri: callbackUrl,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "exchange-code": {
        // Exchange authorization code for tokens
        const { code, redirectUri } = params;
        
        if (!code) {
          throw new Error("Authorization code is required");
        }

        const tokens = await exchangeCodeForTokens(code, redirectUri);
        const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

        // Update or create settings with tokens
        if (settings?.id) {
          await supabase
            .from("gbp_settings")
            .update({
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token || settings.refresh_token,
              token_expires_at: expiresAt,
              updated_at: new Date().toISOString(),
            })
            .eq("id", settings.id);
        } else {
          await supabase.from("gbp_settings").insert({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            token_expires_at: expiresAt,
            gbp_account_id: PEACHHAUS_ACCOUNT_ID,
          });
        }

        return new Response(JSON.stringify({ 
          success: true,
          message: "Google Business Profile connected successfully",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "check-connection": {
        // Check if we have valid tokens stored
        if (!settings?.refresh_token) {
          return new Response(JSON.stringify({ 
            connected: false,
            verified: false,
            error: "No Google Business Profile connection",
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        try {
          // Try to get a valid access token (will refresh if needed)
          const accessToken = await getValidAccessToken(supabase, settings);
          
          // Test the connection by listing accounts
          const accountsUrl = `${GBP_ACCOUNTS_API}/accounts`;
          await callGoogleAPI(accessToken, accountsUrl);

          return new Response(JSON.stringify({ 
            connected: true,
            verified: true,
            hasLocation: !!settings.gbp_location_id,
            message: "Google Business Profile connected and verified",
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (error: any) {
          console.error("Connection verification failed:", error);
          
          return new Response(JSON.stringify({ 
            connected: !!settings.refresh_token,
            verified: false,
            error: error.message,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      case "list-accounts": {
        // List all GBP accounts the user has access to
        if (!settings?.refresh_token) {
          throw new Error("Not connected to Google Business Profile");
        }

        const accessToken = await getValidAccessToken(supabase, settings);
        const accountsUrl = `${GBP_ACCOUNTS_API}/accounts`;
        const data = await callGoogleAPI(accessToken, accountsUrl);

        return new Response(JSON.stringify({ 
          success: true,
          accounts: data.accounts || [],
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "list-locations": {
        // List locations for a specific account
        if (!settings?.refresh_token) {
          throw new Error("Not connected to Google Business Profile");
        }

        const accountId = params.accountId || settings.gbp_account_id || PEACHHAUS_ACCOUNT_ID;
        const accessToken = await getValidAccessToken(supabase, settings);
        
        const locationsUrl = `${GBP_BUSINESS_INFO_API}/accounts/${accountId}/locations?readMask=name,title,storefrontAddress`;
        const data = await callGoogleAPI(accessToken, locationsUrl);

        return new Response(JSON.stringify({ 
          success: true,
          locations: data.locations || [],
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "discover-locations": {
        // Auto-discover and save the first location
        if (!settings?.refresh_token) {
          throw new Error("Not connected to Google Business Profile");
        }

        const accessToken = await getValidAccessToken(supabase, settings);
        
        // First list accounts
        const accountsUrl = `${GBP_ACCOUNTS_API}/accounts`;
        const accountsData = await callGoogleAPI(accessToken, accountsUrl);
        const accounts = accountsData.accounts || [];
        
        console.log(`Found ${accounts.length} accounts`);

        let allLocations: any[] = [];
        let savedAccountId = null;
        let savedLocationId = null;

        // For each account, list locations
        for (const account of accounts) {
          const accountName = account.name; // Format: accounts/123
          const accountId = accountName.replace("accounts/", "");
          
          try {
            const locationsUrl = `${GBP_BUSINESS_INFO_API}/${accountName}/locations?readMask=name,title,storefrontAddress`;
            const locationsData = await callGoogleAPI(accessToken, locationsUrl);
            const locations = locationsData.locations || [];
            
            console.log(`Account ${accountId} has ${locations.length} locations`);
            
            for (const loc of locations) {
              allLocations.push({
                ...loc,
                accountId,
                accountName: account.accountName,
              });
              
              // Save the first location found
              if (!savedLocationId && loc.name) {
                const locationIdMatch = loc.name.match(/locations\/(\d+)/);
                if (locationIdMatch) {
                  savedLocationId = locationIdMatch[1];
                  savedAccountId = accountId;
                }
              }
            }
          } catch (locError: any) {
            console.error(`Failed to list locations for account ${accountId}:`, locError.message);
          }
        }

        // Save to settings
        if (savedLocationId && settings?.id) {
          await supabase
            .from("gbp_settings")
            .update({
              gbp_account_id: savedAccountId,
              gbp_location_id: savedLocationId,
              updated_at: new Date().toISOString(),
            })
            .eq("id", settings.id);
        }

        return new Response(JSON.stringify({ 
          success: true,
          accounts,
          locations: allLocations,
          savedAccountId,
          savedLocationId,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "sync-reviews": {
        // Sync reviews from Google Business Profile
        if (!settings?.refresh_token) {
          throw new Error("Not connected to Google Business Profile");
        }

        const accountId = settings?.gbp_account_id || PEACHHAUS_ACCOUNT_ID;
        const locationId = settings?.gbp_location_id;
        
        if (!locationId) {
          // Try to auto-discover the location
          try {
            const accessToken = await getValidAccessToken(supabase, settings);
            const locationsUrl = `${GBP_BUSINESS_INFO_API}/accounts/${accountId}/locations?readMask=name,title`;
            const locationsData = await callGoogleAPI(accessToken, locationsUrl);
            const locations = locationsData.locations || [];
            
            if (locations.length > 0) {
              const firstLocation = locations[0];
              const locationIdMatch = firstLocation.name?.match(/locations\/(\d+)/);
              const discoveredLocationId = locationIdMatch?.[1];
              
              if (discoveredLocationId && settings?.id) {
                await supabase
                  .from("gbp_settings")
                  .update({ gbp_location_id: discoveredLocationId })
                  .eq("id", settings.id);
                
                // Use discovered location for this request
                const reviewsUrl = `${GBP_API_V4}/accounts/${accountId}/locations/${discoveredLocationId}/reviews`;
                console.log(`Using auto-discovered location: ${discoveredLocationId}`);
                const data = await callGoogleAPI(accessToken, reviewsUrl);
                // Continue with reviews sync...
              }
            }
          } catch (discoverError: any) {
            console.error("Auto-discovery failed:", discoverError);
          }
          
          return new Response(JSON.stringify({ 
            success: false,
            error: "GBP_LOCATION_NOT_CONFIGURED",
            userMessage: "No location found. Click 'Discover Locations' to find your business location.",
            details: "Run location discovery to auto-configure.",
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          });
        }

        const accessToken = await getValidAccessToken(supabase, settings);
        
        // Fetch reviews using the v4 API
        const reviewsUrl = `${GBP_API_V4}/accounts/${accountId}/locations/${locationId}/reviews`;
        console.log(`Fetching reviews from: ${reviewsUrl}`);
        
        let reviews: any[] = [];
        try {
          const data = await callGoogleAPI(accessToken, reviewsUrl);
          reviews = data.reviews || [];
          console.log(`Fetched ${reviews.length} reviews from GBP`);
        } catch (apiError: any) {
          // Check for specific error types
          if (apiError.message.includes("404")) {
            return new Response(JSON.stringify({ 
              success: false,
              error: "GBP_LOCATION_NOT_FOUND",
              userMessage: "Location not found. The location ID may be incorrect or the location may have been removed.",
              details: apiError.message,
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 400,
            });
          }
          throw apiError;
        }

        let syncedCount = 0;
        let newReviewsCount = 0;

        for (const review of reviews) {
          const reviewName = review.name;
          const starRating = parseStarRating(review.starRating);

          // Check if review exists
          const { data: existingReview } = await supabase
            .from("gbp_reviews")
            .select("id, review_reply")
            .eq("gbp_review_name", reviewName)
            .single();

          if (!existingReview) {
            // New review
            await supabase.from("gbp_reviews").insert({
              gbp_review_name: reviewName,
              reviewer_name: review.reviewer?.displayName,
              reviewer_profile_photo_url: review.reviewer?.profilePhotoUrl,
              star_rating: starRating,
              review_text: review.comment,
              review_reply: review.reviewReply?.comment || null,
              reply_posted_at: review.reviewReply?.updateTime || null,
              review_created_at: review.createTime,
              needs_reply: !review.reviewReply,
              synced_at: new Date().toISOString(),
            });
            newReviewsCount++;
          } else {
            // Update existing review
            await supabase
              .from("gbp_reviews")
              .update({
                star_rating: starRating,
                review_text: review.comment,
                review_reply: review.reviewReply?.comment || existingReview.review_reply,
                reply_posted_at: review.reviewReply?.updateTime || null,
                needs_reply: !review.reviewReply && !existingReview.review_reply,
                synced_at: new Date().toISOString(),
              })
              .eq("id", existingReview.id);
          }
          syncedCount++;
        }

        return new Response(JSON.stringify({ 
          success: true,
          synced: syncedCount,
          newReviews: newReviewsCount,
          totalFromGBP: reviews.length,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "generate-reply": {
        // Generate AI reply for a review
        const { reviewId } = params;

        const { data: review, error } = await supabase
          .from("gbp_reviews")
          .select("*")
          .eq("id", reviewId)
          .single();

        if (error || !review) {
          throw new Error("Review not found");
        }

        const reply = await generateAIReply(
          review.reviewer_name || "Guest",
          review.star_rating,
          review.review_text || ""
        );

        // Save the generated reply
        await supabase
          .from("gbp_reviews")
          .update({
            ai_generated_reply: reply,
            updated_at: new Date().toISOString(),
          })
          .eq("id", reviewId);

        return new Response(JSON.stringify({ 
          success: true,
          reply,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "post-reply": {
        // Post a reply to a review on Google
        if (!settings?.refresh_token) {
          throw new Error("Not connected to Google Business Profile");
        }

        const { reviewId, reply } = params;

        const { data: review, error } = await supabase
          .from("gbp_reviews")
          .select("*")
          .eq("id", reviewId)
          .single();

        if (error || !review) {
          throw new Error("Review not found");
        }

        const replyText = reply || review.ai_generated_reply;
        if (!replyText) {
          throw new Error("No reply text provided");
        }

        const accessToken = await getValidAccessToken(supabase, settings);
        
        // Post reply using v4 API
        const replyUrl = `${GBP_API_V4}/${review.gbp_review_name}/reply`;
        console.log(`Posting reply to: ${replyUrl}`);
        
        await callGoogleAPI(accessToken, replyUrl, "PUT", {
          comment: replyText,
        });

        // Update the review in database
        await supabase
          .from("gbp_reviews")
          .update({
            review_reply: replyText,
            reply_posted_at: new Date().toISOString(),
            needs_reply: false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", reviewId);

        return new Response(JSON.stringify({ 
          success: true,
          message: "Reply posted successfully",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "generate-daily-post": {
        // Generate content for a daily post
        // Get a random content idea
        const { data: ideas } = await supabase
          .from("gbp_content_ideas")
          .select("*")
          .eq("is_active", true)
          .is("used_at", null)
          .limit(5);

        const randomIdea = ideas?.[Math.floor(Math.random() * (ideas?.length || 1))];
        const category = randomIdea?.category || "General";
        const topic = randomIdea?.topic || "Guest experience at PeachHaus properties";

        const { summary, callToAction } = await generateDailyPost(category, topic);

        // Mark the idea as used
        if (randomIdea?.id) {
          await supabase
            .from("gbp_content_ideas")
            .update({ used_at: new Date().toISOString() })
            .eq("id", randomIdea.id);
        }

        // Save the generated post as draft
        const { data: post } = await supabase
          .from("gbp_posts")
          .insert({
            content_type: "STANDARD",
            summary,
            call_to_action_type: callToAction,
            status: "draft",
            ai_generated: true,
          })
          .select()
          .single();

        return new Response(JSON.stringify({ 
          success: true,
          postId: post?.id,
          content: summary,
          callToAction,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "create-post": {
        // Create a post on Google Business Profile
        if (!settings?.refresh_token) {
          throw new Error("Not connected to Google Business Profile");
        }

        const { postId, content } = params;
        let postContent = content;

        // If postId provided, get content from database
        if (postId) {
          const { data: post } = await supabase
            .from("gbp_posts")
            .select("*")
            .eq("id", postId)
            .single();
          
          if (post) {
            postContent = post.summary;
          }
        }

        if (!postContent) {
          throw new Error("No post content provided");
        }

        const accountId = settings?.gbp_account_id || PEACHHAUS_ACCOUNT_ID;
        const locationId = settings?.gbp_location_id;

        if (!locationId) {
          throw new Error("No location configured. Please click 'Discover Locations' first.");
        }

        const accessToken = await getValidAccessToken(supabase, settings);
        
        // Create post using v4 API
        const postsUrl = `${GBP_API_V4}/accounts/${accountId}/locations/${locationId}/localPosts`;
        console.log(`Creating post at: ${postsUrl}`);
        
        const postData = await callGoogleAPI(accessToken, postsUrl, "POST", {
          languageCode: "en-US",
          summary: postContent,
          topicType: "STANDARD",
        });

        // Update post in database
        if (postId) {
          await supabase
            .from("gbp_posts")
            .update({
              status: "posted",
              posted_at: new Date().toISOString(),
              gbp_post_name: postData.name,
              updated_at: new Date().toISOString(),
            })
            .eq("id", postId);
        }

        return new Response(JSON.stringify({ 
          success: true,
          message: "Post created successfully",
          gbpPostName: postData.name,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "update-settings": {
        // Update GBP settings
        const {
          gbpAccountId,
          gbpLocationId,
          autoReplyEnabled,
          autoPostEnabled,
          postTime,
          replyDelayMinutes,
        } = params;

        const updates: any = {
          updated_at: new Date().toISOString(),
        };

        if (gbpAccountId !== undefined) updates.gbp_account_id = gbpAccountId;
        if (gbpLocationId !== undefined) updates.gbp_location_id = gbpLocationId;
        if (autoReplyEnabled !== undefined) updates.auto_reply_enabled = autoReplyEnabled;
        if (autoPostEnabled !== undefined) updates.auto_post_enabled = autoPostEnabled;
        if (postTime !== undefined) updates.post_time = postTime;
        if (replyDelayMinutes !== undefined) updates.reply_delay_minutes = replyDelayMinutes;

        if (settings?.id) {
          await supabase
            .from("gbp_settings")
            .update(updates)
            .eq("id", settings.id);
        } else {
          await supabase.from("gbp_settings").insert({
            ...updates,
            gbp_account_id: gbpAccountId || PEACHHAUS_ACCOUNT_ID,
          });
        }

        return new Response(JSON.stringify({ 
          success: true,
          message: "Settings updated",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "disconnect": {
        // Clear stored tokens
        if (settings?.id) {
          await supabase
            .from("gbp_settings")
            .update({
              access_token: null,
              refresh_token: null,
              token_expires_at: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", settings.id);
        }

        return new Response(JSON.stringify({ 
          success: true,
          message: "Disconnected from Google Business Profile",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ 
          error: `Unknown action: ${action}` 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
    }
  } catch (error: any) {
    console.error("GBP Manager error:", error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
