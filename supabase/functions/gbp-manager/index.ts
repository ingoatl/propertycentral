import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const MCP_SERVER_URL = "https://remote.mcp.pipedream.net";
const PIPEDREAM_CLIENT_ID = Deno.env.get("PIPEDREAM_CLIENT_ID");
const PIPEDREAM_CLIENT_SECRET = Deno.env.get("PIPEDREAM_CLIENT_SECRET");
const PIPEDREAM_PROJECT_ID = Deno.env.get("PIPEDREAM_PROJECT_ID");
const PIPEDREAM_USER_ID = Deno.env.get("PIPEDREAM_USER_ID") || "admin";

// Get Pipedream access token
async function getPipedreamAccessToken(): Promise<string> {
  const response = await fetch("https://api.pipedream.com/v1/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: PIPEDREAM_CLIENT_ID!,
      client_secret: PIPEDREAM_CLIENT_SECRET!,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get Pipedream token: ${await response.text()}`);
  }
  
  const data = await response.json();
  return data.access_token;
}

// Create a Pipedream Connect token for the user (same as Google Calendar)
async function createConnectToken(userId: string, successRedirectUri: string): Promise<{ token: string; connect_link_url: string; expires_at: string }> {
  const accessToken = await getPipedreamAccessToken();

  console.log("Creating Connect token for GBP user:", userId);
  console.log("Success redirect URI:", successRedirectUri);
  console.log("Project ID:", PIPEDREAM_PROJECT_ID);

  const response = await fetch(`https://api.pipedream.com/v1/connect/${PIPEDREAM_PROJECT_ID}/tokens`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "x-pd-environment": "development",
    },
    body: JSON.stringify({
      external_user_id: userId,
      success_redirect_uri: successRedirectUri,
      error_redirect_uri: successRedirectUri.replace("connected=true", "connected=false"),
    }),
  });

  const data = await response.json();
  console.log("Connect token response status:", response.status);
  console.log("Connect token response:", JSON.stringify(data));
  
  if (!response.ok || data.error) {
    console.error("Connect token error:", data);
    throw new Error(data.error_description || data.error || data.message || "Failed to create connect token");
  }

  return { 
    token: data.token, 
    connect_link_url: data.connect_link_url,
    expires_at: data.expires_at 
  };
}

// Get user's connected accounts from Pipedream
async function getUserAccounts(userId: string): Promise<any[]> {
  const accessToken = await getPipedreamAccessToken();

  console.log("Getting Pipedream accounts for user:", userId);

  const response = await fetch(
    `https://api.pipedream.com/v1/connect/${PIPEDREAM_PROJECT_ID}/users/${encodeURIComponent(userId)}/accounts`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "x-pd-environment": "development",
      },
    }
  );

  const data = await response.json();
  console.log("Get accounts response status:", response.status);
  console.log("Get accounts response:", JSON.stringify(data).substring(0, 500));
  
  if (data.error) {
    console.error("Get accounts error:", data);
    return [];
  }

  let accounts: any[] = [];
  if (Array.isArray(data)) {
    accounts = data;
  } else if (data.data && Array.isArray(data.data)) {
    accounts = data.data;
  } else if (data.accounts && Array.isArray(data.accounts)) {
    accounts = data.accounts;
  }
  
  console.log("Parsed accounts count:", accounts.length);
  return accounts;
}

// Check if user has Google My Business connected
async function hasGBPConnection(userId: string): Promise<boolean> {
  const accounts = await getUserAccounts(userId);
  
  const gbpAccount = accounts.find((a: any) => {
    const appSlug = typeof a.app === "object" ? a.app?.name_slug : a.app;
    return appSlug === "google_my_business" || 
           appSlug === "google-my-business" || 
           a.name?.toLowerCase().includes("google my business") ||
           a.name?.toLowerCase().includes("business profile");
  });

  console.log("GBP connection found:", !!gbpAccount, gbpAccount ? JSON.stringify(gbpAccount) : "none");
  return !!gbpAccount;
}

// Parse SSE response from Pipedream MCP
async function parseSSEResponse(response: Response): Promise<any> {
  const contentType = response.headers.get("content-type") || "";
  
  // If it's regular JSON, parse directly
  if (contentType.includes("application/json")) {
    return await response.json();
  }
  
  // Handle SSE (Server-Sent Events) response
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let lastData: any = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;
        try {
          lastData = JSON.parse(data);
          console.log("SSE data parsed:", JSON.stringify(lastData).substring(0, 200));
        } catch (e) {
          console.log("SSE parse error for line:", data);
        }
      }
    }
  }
  
  return lastData;
}

// Call MCP tool via Pipedream
async function callMCPTool(
  accessToken: string,
  userId: string,
  toolName: string,
  args: Record<string, any>
): Promise<any> {
  console.log(`Calling MCP tool: ${toolName}`);
  console.log("Tool args:", JSON.stringify(args));
  
  const response = await fetch(MCP_SERVER_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Accept": "application/json, text/event-stream",
      "Content-Type": "application/json",
      "x-pd-project-id": PIPEDREAM_PROJECT_ID!,
      "x-pd-environment": "development",
      "x-pd-external-user-id": userId,
      "x-pd-app-slug": "google_my_business",
      "x-pd-app-discovery": "true",
      "x-pd-tool-mode": "sub-agent",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args,
      },
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`MCP tool call failed: ${response.status} - ${errorText}`);
  }
  
  return parseSSEResponse(response);
}

// List available MCP tools
async function listMCPTools(accessToken: string, userId: string): Promise<any> {
  console.log("Listing available GBP MCP tools...");
  
  const response = await fetch(MCP_SERVER_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Accept": "application/json, text/event-stream",
      "Content-Type": "application/json",
      "x-pd-project-id": PIPEDREAM_PROJECT_ID!,
      "x-pd-environment": "development",
      "x-pd-external-user-id": userId,
      "x-pd-app-slug": "google_my_business",
      "x-pd-app-discovery": "true",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/list",
      params: {},
    }),
  });
  
  return parseSSEResponse(response);
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
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
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
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
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
  
  // Parse the response
  const postMatch = content.match(/POST:\s*(.+?)(?=CTA:|$)/s);
  const ctaMatch = content.match(/CTA:\s*(\w+)/);
  
  return {
    summary: postMatch?.[1]?.trim() || content.substring(0, 1500),
    callToAction: ctaMatch?.[1]?.trim() || "LEARN_MORE",
  };
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

    // Get GBP settings (get first one since there should only be one global settings row)
    const { data: settings } = await supabase
      .from("gbp_settings")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const userId = params.userId || PIPEDREAM_USER_ID;

    switch (action) {
      case "get-auth-url": {
        // Get Pipedream Connect URL for Google My Business OAuth
        const { redirectUrl } = params;

        if (!PIPEDREAM_CLIENT_ID || !PIPEDREAM_CLIENT_SECRET || !PIPEDREAM_PROJECT_ID) {
          throw new Error("Pipedream credentials not configured. Please add PIPEDREAM_CLIENT_ID, PIPEDREAM_CLIENT_SECRET, and PIPEDREAM_PROJECT_ID.");
        }

        // Check if user already has Google My Business connected
        const hasConnection = await hasGBPConnection(userId);
        if (hasConnection) {
          // Verify the connection works via MCP
          try {
            const accessToken = await getPipedreamAccessToken();
            const tools = await listMCPTools(accessToken, userId);
            
            // If we can list tools, connection is working
            if (tools && !tools.error) {
              return new Response(JSON.stringify({ 
                success: true, 
                connected: true,
                message: "Google Business Profile is already connected" 
              }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
          } catch (e) {
            console.log("Existing connection verification failed, will prompt for reconnect:", e);
          }
        }

        // Create success redirect URL
        const baseRedirect = redirectUrl || "https://peachhaus.lovable.app";
        const successRedirectUri = `${baseRedirect}/admin?tab=gbp&connected=true`;

        // Create a Pipedream Connect token
        const connectData = await createConnectToken(userId, successRedirectUri);
        
        // Build the Connect Link URL with app parameter for Google My Business
        const authUrl = `${connectData.connect_link_url}&app=google_my_business`;

        console.log("Generated Pipedream Connect auth URL for GBP:", authUrl);

        return new Response(JSON.stringify({ authUrl, connected: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "check-connection": {
        // Check if Google Business Profile is connected
        try {
          const hasConnection = await hasGBPConnection(userId);
          
          if (!hasConnection) {
            return new Response(JSON.stringify({ 
              connected: false, 
              verified: false,
              error: "No Google Business Profile account connected"
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          // Verify connection works by listing tools via MCP
          try {
            const accessToken = await getPipedreamAccessToken();
            const tools = await listMCPTools(accessToken, userId);
            
            // Check if we got a valid response
            const hasTools = tools?.result?.tools || tools?.tools;
            
            return new Response(JSON.stringify({ 
              connected: true, 
              verified: !!hasTools,
              message: hasTools ? "Google Business Profile connected and verified" : "Connection exists but could not verify tools"
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          } catch (mcpError: any) {
            console.error("MCP verification failed:", mcpError);
            
            return new Response(JSON.stringify({ 
              connected: true, 
              verified: false,
              error: mcpError.message || "Could not verify GBP access via MCP"
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        } catch (error: any) {
          return new Response(JSON.stringify({ 
            connected: false, 
            verified: false,
            error: error.message 
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      case "list-tools": {
        // List available GBP MCP tools
        const accessToken = await getPipedreamAccessToken();
        const tools = await listMCPTools(accessToken, userId);
        
        return new Response(JSON.stringify({ 
          success: true, 
          tools 
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "list-accounts": {
        // List GBP accounts the user has access to
        const accessToken = await getPipedreamAccessToken();
        
        console.log("Listing GBP accounts...");
        
        const accountsResult = await callMCPTool(
          accessToken,
          userId,
          "google_my_business-list-accounts",
          {
            instruction: "List all Google Business Profile accounts I have access to"
          }
        );

        console.log("Accounts result:", JSON.stringify(accountsResult).substring(0, 2000));

        // Extract accounts from the response
        let accounts = [];
        try {
          const content = accountsResult?.result?.content?.[0]?.text;
          if (content) {
            const parsed = JSON.parse(content);
            accounts = parsed?.accounts || [];
          }
        } catch (e) {
          console.error("Failed to parse accounts:", e);
        }

        return new Response(JSON.stringify({ 
          success: true, 
          accounts,
          raw: accountsResult
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "list-locations": {
        // List locations for a specific account
        const { accountId } = params;
        
        if (!accountId) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: "Account ID is required" 
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
        }

        const accessToken = await getPipedreamAccessToken();
        
        console.log(`Listing locations for account: ${accountId}`);
        
        const locationsResult = await callMCPTool(
          accessToken,
          userId,
          "google_my_business-list-locations",
          {
            parent: `accounts/${accountId}`,
          }
        );

        console.log("Locations result:", JSON.stringify(locationsResult).substring(0, 2000));

        // Extract locations from the response
        let locations = [];
        try {
          const content = locationsResult?.result?.content?.[0]?.text;
          if (content) {
            const parsed = JSON.parse(content);
            locations = parsed?.locations || [];
          }
        } catch (e) {
          console.error("Failed to parse locations:", e);
        }

        return new Response(JSON.stringify({ 
          success: true, 
          locations,
          raw: locationsResult
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "sync-reviews": {
        // Sync reviews from Google Business Profile
        const accessToken = await getPipedreamAccessToken();
        
        // The MCP tools only accept an 'instruction' parameter - let the AI figure out the right format
        console.log("Fetching all reviews via MCP instruction...");
        
        const reviewsResult = await callMCPTool(
          accessToken,
          userId,
          "google_my_business-list-all-reviews",
          {
            instruction: `List all reviews for the PeachHaus Group business. First, list all available accounts and locations to find the correct business location. Then fetch and return all reviews in JSON format with fields: name, reviewer name, star rating (as number 1-5), review text, and any existing reply. If you encounter any errors finding locations, please include details about what accounts/locations you found.`,
          }
        );
        
        console.log("Reviews result:", JSON.stringify(reviewsResult).substring(0, 2000));

        console.log("Reviews result:", JSON.stringify(reviewsResult).substring(0, 1000));

        // Extract reviews from the response - handle error responses gracefully
        let reviews: any[] = [];
        try {
          const contentText = reviewsResult?.result?.content?.[0]?.text;
          if (contentText) {
            // Check if it's a natural language response (not JSON)
            if (contentText.startsWith("I could not") || contentText.startsWith("Error") || !contentText.startsWith("{") && !contentText.startsWith("[")) {
              console.error("MCP tool returned message:", contentText);
              // Extract useful info from the response
              const accountMatch = contentText.match(/ID: (\d+)/);
              const suggestedAccountId = accountMatch ? accountMatch[1] : null;
              
              return new Response(JSON.stringify({ 
                success: false, 
                error: "Invalid account/location configuration. Please update your GBP settings.",
                message: contentText,
                suggestedAccountId,
              }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
            }
            const parsed = JSON.parse(contentText);
            reviews = parsed?.reviews || [];
          }
        } catch (parseErr) {
          console.error("Failed to parse reviews response:", parseErr);
          const contentText = reviewsResult?.result?.content?.[0]?.text || "";
          return new Response(JSON.stringify({ 
            success: false, 
            error: "Failed to parse reviews from GBP API. The account/location IDs may be incorrect.",
            rawResponse: contentText.substring(0, 500),
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
        }

        let syncedCount = 0;
        let newReviewsCount = 0;

        for (const review of reviews) {
          const reviewName = review.name;
          const starRating = review.starRating === "FIVE" ? 5 
            : review.starRating === "FOUR" ? 4 
            : review.starRating === "THREE" ? 3 
            : review.starRating === "TWO" ? 2 : 1;

          // Upsert review
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
              review_reply: review.reviewReply?.comment,
              reply_posted_at: review.reviewReply?.updateTime,
              review_created_at: review.createTime,
              needs_reply: !review.reviewReply,
            });
            newReviewsCount++;
          } else {
            // Update existing review
            await supabase
              .from("gbp_reviews")
              .update({
                review_reply: review.reviewReply?.comment,
                reply_posted_at: review.reviewReply?.updateTime,
                needs_reply: !review.reviewReply && !existingReview.review_reply,
                synced_at: new Date().toISOString(),
              })
              .eq("gbp_review_name", reviewName);
          }
          syncedCount++;
        }

        return new Response(JSON.stringify({ 
          success: true, 
          synced: syncedCount,
          newReviews: newReviewsCount,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "generate-reply": {
        // Generate AI reply for a specific review
        const { reviewId } = params;
        
        const { data: review, error } = await supabase
          .from("gbp_reviews")
          .select("*")
          .eq("id", reviewId)
          .single();

        if (error || !review) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: "Review not found" 
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 });
        }

        const aiReply = await generateAIReply(
          review.reviewer_name,
          review.star_rating,
          review.review_text
        );

        // Save the AI-generated reply
        await supabase
          .from("gbp_reviews")
          .update({ 
            ai_generated_reply: aiReply,
            updated_at: new Date().toISOString(),
          })
          .eq("id", reviewId);

        return new Response(JSON.stringify({ 
          success: true, 
          reply: aiReply 
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "post-reply": {
        // Post a reply to Google Business Profile
        const { reviewId, reply } = params;
        
        if (!settings?.gbp_account_id || !settings?.gbp_location_id) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: "GBP Account ID and Location ID not configured" 
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
        }

        const { data: review, error } = await supabase
          .from("gbp_reviews")
          .select("*")
          .eq("id", reviewId)
          .single();

        if (error || !review) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: "Review not found" 
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 });
        }

        const accessToken = await getPipedreamAccessToken();
        
        // Post the reply using MCP (correct tool name: create-update-reply-to-review)
        const replyResult = await callMCPTool(
          accessToken,
          userId,
          "google_my_business-create-update-reply-to-review",
          {
            reviewName: review.gbp_review_name,
            comment: reply || review.ai_generated_reply,
          }
        );

        console.log("Reply result:", JSON.stringify(replyResult).substring(0, 500));

        // Update the review record
        await supabase
          .from("gbp_reviews")
          .update({
            review_reply: reply || review.ai_generated_reply,
            reply_posted_at: new Date().toISOString(),
            needs_reply: false,
            auto_replied: !reply,
            updated_at: new Date().toISOString(),
          })
          .eq("id", reviewId);

        return new Response(JSON.stringify({ 
          success: true, 
          result: replyResult 
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "generate-daily-post": {
        // Generate content for daily post
        const dayOfWeek = new Date().getDay();
        
        // Content rotation based on day of week
        const categoryByDay: Record<number, string> = {
          0: "seasonal", // Sunday
          1: "property_highlight", // Monday
          2: "local_area", // Tuesday
          3: "testimonial", // Wednesday
          4: "behind_scenes", // Thursday
          5: "tip", // Friday
          6: "amenity", // Saturday
        };
        
        const category = params.category || categoryByDay[dayOfWeek];
        
        // Get a random unused content idea
        const { data: idea } = await supabase
          .from("gbp_content_ideas")
          .select("*, properties(name)")
          .eq("category", category)
          .eq("is_active", true)
          .is("used_at", null)
          .limit(1)
          .single();

        if (!idea) {
          // If no unused ideas, get any idea from the category
          const { data: anyIdea } = await supabase
            .from("gbp_content_ideas")
            .select("*, properties(name)")
            .eq("category", category)
            .eq("is_active", true)
            .order("used_at", { ascending: true, nullsFirst: true })
            .limit(1)
            .single();

          if (!anyIdea) {
            return new Response(JSON.stringify({ 
              success: false, 
              error: `No content ideas found for category: ${category}` 
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 });
          }

          // Use this idea
          const { summary, callToAction } = await generateDailyPost(
            anyIdea.category,
            anyIdea.topic,
            anyIdea.properties?.name
          );

          // Mark idea as used
          await supabase
            .from("gbp_content_ideas")
            .update({ used_at: new Date().toISOString() })
            .eq("id", anyIdea.id);

          // Create draft post
          const { data: post, error: postError } = await supabase
            .from("gbp_posts")
            .insert({
              content_type: "STANDARD",
              summary,
              call_to_action_type: callToAction,
              call_to_action_url: "https://peachhausgroup.com",
              status: "draft",
              ai_generated: true,
              scheduled_for: params.scheduleFor || null,
            })
            .select()
            .single();

          return new Response(JSON.stringify({ 
            success: true, 
            post,
            idea: anyIdea,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Use the fresh idea
        const { summary, callToAction } = await generateDailyPost(
          idea.category,
          idea.topic,
          idea.properties?.name
        );

        // Mark idea as used
        await supabase
          .from("gbp_content_ideas")
          .update({ used_at: new Date().toISOString() })
          .eq("id", idea.id);

        // Create draft post
        const { data: post } = await supabase
          .from("gbp_posts")
          .insert({
            content_type: "STANDARD",
            summary,
            call_to_action_type: callToAction,
            call_to_action_url: "https://peachhausgroup.com",
            status: "draft",
            ai_generated: true,
            scheduled_for: params.scheduleFor || null,
          })
          .select()
          .single();

        return new Response(JSON.stringify({ 
          success: true, 
          post,
          idea,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "create-post": {
        // Post content to Google Business Profile
        const { postId } = params;
        
        if (!settings?.gbp_account_id || !settings?.gbp_location_id) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: "GBP Account ID and Location ID not configured" 
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
        }

        const { data: post, error } = await supabase
          .from("gbp_posts")
          .select("*")
          .eq("id", postId)
          .single();

        if (error || !post) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: "Post not found" 
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 });
        }

        const accessToken = await getPipedreamAccessToken();
        
        // Create the post using MCP
        const postResult = await callMCPTool(
          accessToken,
          userId,
          "google_my_business-create-post",
          {
            parent: `accounts/${settings.gbp_account_id}/locations/${settings.gbp_location_id}`,
            localPost: {
              topicType: "STANDARD",
              languageCode: "en-US",
              summary: post.summary,
              callToAction: post.call_to_action_type ? {
                actionType: post.call_to_action_type,
                url: post.call_to_action_url || "https://peachhausgroup.com",
              } : undefined,
            },
          }
        );

        console.log("Post result:", JSON.stringify(postResult).substring(0, 500));

        // Parse response to get post name
        const postResponse = postResult?.result?.content?.[0]?.text
          ? JSON.parse(postResult.result.content[0].text)
          : null;

        // Update the post record
        await supabase
          .from("gbp_posts")
          .update({
            gbp_post_name: postResponse?.name,
            posted_at: new Date().toISOString(),
            status: "posted",
            updated_at: new Date().toISOString(),
          })
          .eq("id", postId);

        return new Response(JSON.stringify({ 
          success: true, 
          result: postResult 
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "process-queue": {
        // Process auto-reply and auto-post queue (called by cron)
        const results = {
          reviewsProcessed: 0,
          repliesPosted: 0,
          postsCreated: 0,
          errors: [] as string[],
        };

        // Auto-reply to reviews if enabled
        if (settings?.auto_reply_enabled) {
          const { data: pendingReviews } = await supabase
            .from("gbp_reviews")
            .select("*")
            .eq("needs_reply", true)
            .is("ai_generated_reply", null)
            .limit(5);

          for (const review of pendingReviews || []) {
            try {
              // Generate AI reply
              const aiReply = await generateAIReply(
                review.reviewer_name,
                review.star_rating,
                review.review_text
              );

              await supabase
                .from("gbp_reviews")
                .update({ ai_generated_reply: aiReply })
                .eq("id", review.id);

              results.reviewsProcessed++;

              // Post the reply after a delay (configured in settings)
              const accessToken = await getPipedreamAccessToken();
              
              await callMCPTool(
                accessToken,
                userId,
                "google_my_business-reply-to-review",
                {
                  name: review.gbp_review_name,
                  comment: aiReply,
                }
              );

              await supabase
                .from("gbp_reviews")
                .update({
                  review_reply: aiReply,
                  reply_posted_at: new Date().toISOString(),
                  needs_reply: false,
                  auto_replied: true,
                })
                .eq("id", review.id);

              results.repliesPosted++;
            } catch (e: any) {
              results.errors.push(`Review ${review.id}: ${e.message}`);
            }
          }
        }

        // Auto-create daily post if enabled and not already posted today
        if (settings?.auto_post_enabled) {
          const today = new Date().toISOString().split("T")[0];
          
          const { data: todaysPost } = await supabase
            .from("gbp_posts")
            .select("id")
            .gte("posted_at", `${today}T00:00:00`)
            .lte("posted_at", `${today}T23:59:59`)
            .single();

          if (!todaysPost) {
            try {
              // Generate and post daily content
              const generateResponse = await fetch(`${SUPABASE_URL}/functions/v1/gbp-manager`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                },
                body: JSON.stringify({ action: "generate-daily-post", userId }),
              });

              const generateResult = await generateResponse.json();
              
              if (generateResult.success && generateResult.post) {
                // Post it
                const postResponse = await fetch(`${SUPABASE_URL}/functions/v1/gbp-manager`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                  },
                  body: JSON.stringify({ 
                    action: "create-post", 
                    postId: generateResult.post.id,
                    userId,
                  }),
                });

                const postResult = await postResponse.json();
                if (postResult.success) {
                  results.postsCreated++;
                }
              }
            } catch (e: any) {
              results.errors.push(`Daily post: ${e.message}`);
            }
          }
        }

        return new Response(JSON.stringify({ 
          success: true, 
          results 
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "update-settings": {
        // Update GBP settings - use upsert to handle case where no settings exist
        const { gbpAccountId, gbpLocationId, autoReplyEnabled, autoPostEnabled, postTime, replyDelayMinutes } = params;
        
        // Build update object with only provided fields
        const updateData: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };
        
        if (gbpAccountId !== undefined) updateData.gbp_account_id = gbpAccountId;
        if (gbpLocationId !== undefined) updateData.gbp_location_id = gbpLocationId;
        if (autoReplyEnabled !== undefined) updateData.auto_reply_enabled = autoReplyEnabled;
        if (autoPostEnabled !== undefined) updateData.auto_post_enabled = autoPostEnabled;
        if (postTime !== undefined) updateData.post_time = postTime;
        if (replyDelayMinutes !== undefined) updateData.reply_delay_minutes = replyDelayMinutes;

        let data, error;

        if (settings?.id) {
          // Update existing settings
          const result = await supabase
            .from("gbp_settings")
            .update(updateData)
            .eq("id", settings.id)
            .select()
            .single();
          data = result.data;
          error = result.error;
        } else {
          // Insert new settings record
          const result = await supabase
            .from("gbp_settings")
            .insert({
              ...updateData,
              created_at: new Date().toISOString(),
            })
            .select()
            .single();
          data = result.data;
          error = result.error;
        }

        if (error) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: error.message 
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
        }

        return new Response(JSON.stringify({ 
          success: true, 
          settings: data 
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      default:
        return new Response(JSON.stringify({ 
          error: `Unknown action: ${action}` 
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
    }
  } catch (error: any) {
    console.error("GBP Manager error:", error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
  }
});
