import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Property name keywords for matching posts to properties
const PROPERTY_KEYWORDS: Record<string, string> = {
  "berkley": "bdb82ccb-e1f7-499a-8fbc-2e3addc76a60",
  "chimney lakes": "bdb82ccb-e1f7-499a-8fbc-2e3addc76a60",
  "family retreat": "2a3b4c5d-6e7f-8901-bcde-f12345678904",
  "durham": "2a3b4c5d-6e7f-8901-bcde-f12345678904",
  "homerun hideaway": "2a3b4c5d-6e7f-8901-bcde-f12345678904",
  "alpine": "3b4c5d6e-7f89-0123-cdef-g23456789015",
  "scandinavian": "4c5d6e7f-8901-2345-defg-h34567890126",
  "old roswell": "5d6e7f89-0123-4567-efgh-i45678901237",
  "modern + cozy": "5d6e7f89-0123-4567-efgh-i45678901237",
  "woodland": "6e7f8901-2345-6789-fghi-j56789012348",
  "mableton": "6e7f8901-2345-6789-fghi-j56789012348",
  "boho lux": "7f890123-4567-8901-ghij-k67890123459",
  "scandi chic": "7f890123-4567-8901-ghij-k67890123459",
  "whispering oaks": "8g901234-5678-9012-hijk-l78901234560",
  "bloom": "8g901234-5678-9012-hijk-l78901234560",
  "canadian way": "9h012345-6789-0123-ijkl-m89012345671",
  "maple leaf": "9h012345-6789-0123-ijkl-m89012345671",
  "midtown lighthouse": "0i123456-7890-1234-jklm-n90123456782",
  "shift sanctuary": "0i123456-7890-1234-jklm-n90123456782",
  "smoke hollow": "1j234567-8901-2345-klmn-o01234567893",
  "alpharetta basecamp": "1j234567-8901-2345-klmn-o01234567893",
  "lavish living": "2k345678-9012-3456-lmno-p12345678904",
  "hazy": "76e11f06-a075-444c-afb3-fa8bbf35b06f",
};

interface GhlPost {
  _id: string;
  platform: string;
  type: string;
  summary?: string;
  media?: Array<{
    url: string;
    type: string;
    thumbnail?: string;
  }>;
  status: string;
  publishedAt?: string;
  scheduledAt?: string;
  postId?: string;
  userId?: string;
  accountId?: string;
}

interface GhlResponse {
  results?: {
    posts?: GhlPost[];
  };
  posts?: GhlPost[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ghlApiKey = Deno.env.get("GHL_API_KEY");
    const ghlLocationId = Deno.env.get("GHL_LOCATION_ID");

    if (!ghlApiKey || !ghlLocationId) {
      console.error("[ghl-sync-social-posts] Missing GHL credentials");
      return new Response(
        JSON.stringify({ error: "GHL credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json().catch(() => ({}));
    const daysBack = body.daysBack || 90;

    // Calculate date range
    const fromDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
    const toDate = new Date().toISOString();

    console.log(`[ghl-sync-social-posts] Fetching posts from ${fromDate} to ${toDate}`);

    // Fetch posts from GHL Social Planner
    const ghlResponse = await fetch(
      `https://services.leadconnectorhq.com/social-media-posting/${ghlLocationId}/posts/list`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${ghlApiKey}`,
          "Version": "2021-07-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "published",
          fromDate,
          toDate,
          limit: "100",
          skip: "0",
          includeUsers: "true",
        }),
      }
    );

    if (!ghlResponse.ok) {
      const errorText = await ghlResponse.text();
      console.error("[ghl-sync-social-posts] GHL API error:", ghlResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: "GHL API request failed", status: ghlResponse.status }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ghlData: GhlResponse = await ghlResponse.json();
    const posts = ghlData.results?.posts || ghlData.posts || [];

    console.log(`[ghl-sync-social-posts] Fetched ${posts.length} posts from GHL`);

    // Get all active properties for matching
    const { data: properties } = await supabase
      .from("properties")
      .select("id, name")
      .is("offboarded_at", null);

    const propertyMap = new Map(properties?.map(p => [p.id, p.name]) || []);

    // Process and upsert posts
    let syncedCount = 0;
    let unmatchedCount = 0;
    const syncedPosts: Array<{
      external_id: string;
      property_id: string | null;
      platform: string;
      post_url: string | null;
    }> = [];

    for (const post of posts) {
      const caption = post.summary?.toLowerCase() || "";
      let matchedPropertyId: string | null = null;

      // Match post to property using keywords
      for (const [keyword, propId] of Object.entries(PROPERTY_KEYWORDS)) {
        if (caption.includes(keyword)) {
          // Verify property exists
          if (propertyMap.has(propId)) {
            matchedPropertyId = propId;
            break;
          }
        }
      }

      // Also try matching against actual property names
      if (!matchedPropertyId && properties) {
        for (const prop of properties) {
          const propNameLower = prop.name?.toLowerCase() || "";
          if (propNameLower && caption.includes(propNameLower)) {
            matchedPropertyId = prop.id;
            break;
          }
        }
      }

      // Generate post URL based on platform
      const getPostUrl = (post: GhlPost): string | null => {
        if (!post.postId) return null;
        
        switch (post.platform?.toLowerCase()) {
          case "tiktok":
            return `https://www.tiktok.com/@peachhausgroup/video/${post.postId}`;
          case "instagram":
            return `https://www.instagram.com/p/${post.postId}/`;
          case "facebook":
            return `https://www.facebook.com/${post.postId}`;
          case "linkedin":
            return `https://www.linkedin.com/posts/${post.postId}`;
          default:
            return null;
        }
      };

      const mediaItem = post.media?.[0];
      const postUrl = getPostUrl(post);

      // Upsert the post
      const { error: upsertError } = await supabase
        .from("social_media_posts")
        .upsert({
          external_id: post._id,
          source: "ghl_social_planner",
          property_id: matchedPropertyId,
          platform: post.platform?.toLowerCase() || "unknown",
          post_type: post.type || "post",
          caption: post.summary,
          media_url: mediaItem?.url || null,
          media_type: mediaItem?.type?.includes("video") ? "video" : "image",
          thumbnail_url: mediaItem?.thumbnail || null,
          post_url: postUrl,
          status: post.status,
          published_at: post.publishedAt || null,
          scheduled_for: post.scheduledAt || null,
          synced_at: new Date().toISOString(),
        }, {
          onConflict: "external_id,source",
        });

      if (upsertError) {
        console.error("[ghl-sync-social-posts] Upsert error:", upsertError);
      } else {
        syncedCount++;
        if (!matchedPropertyId) {
          unmatchedCount++;
        }
        syncedPosts.push({
          external_id: post._id,
          property_id: matchedPropertyId,
          platform: post.platform?.toLowerCase() || "unknown",
          post_url: postUrl,
        });
      }
    }

    // Log sync result
    await supabase.from("partner_sync_log").insert({
      source_system: "ghl_social_planner",
      sync_type: "social_posts",
      properties_synced: syncedCount - unmatchedCount,
      sync_status: "completed",
      error_details: {
        total_posts: posts.length,
        synced_posts: syncedCount,
        unmatched_posts: unmatchedCount,
        days_back: daysBack,
      },
    });

    console.log(`[ghl-sync-social-posts] Synced ${syncedCount} posts, ${unmatchedCount} unmatched`);

    return new Response(
      JSON.stringify({
        success: true,
        totalPosts: posts.length,
        syncedPosts: syncedCount,
        unmatchedPosts: unmatchedCount,
        posts: syncedPosts.slice(0, 10), // Return first 10 for debugging
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[ghl-sync-social-posts] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
