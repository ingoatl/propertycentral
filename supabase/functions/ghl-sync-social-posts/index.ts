import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Property name keywords for matching posts to properties - CORRECT UUIDs from database
const PROPERTY_KEYWORDS: Record<string, string> = {
  // The Berkley at Chimney Lakes / Smoke Hollow
  "berkley": "bdb82ccb-b2fa-42fb-8c58-42aad6e2ef38",
  "chimney lakes": "bdb82ccb-b2fa-42fb-8c58-42aad6e2ef38",
  "smoke hollow": "bdb82ccb-b2fa-42fb-8c58-42aad6e2ef38",
  "3419 smoke hollow": "bdb82ccb-b2fa-42fb-8c58-42aad6e2ef38",
  // Family Retreat / Durham
  "family retreat": "fa81c7ec-7e9b-48ab-aa8c-d2ddf41eea9b",
  "durham ridge": "fa81c7ec-7e9b-48ab-aa8c-d2ddf41eea9b",
  "5360 durham": "fa81c7ec-7e9b-48ab-aa8c-d2ddf41eea9b",
  // Alpine
  "alpine": "695bfc2a-4187-4377-8e25-18aa2fcd0454",
  "osburn ct": "695bfc2a-4187-4377-8e25-18aa2fcd0454",
  "4241 osburn": "695bfc2a-4187-4377-8e25-18aa2fcd0454",
  // Scandinavian Retreat
  "scandinavian": "9f7f6d4d-9873-46be-926f-c5a48863a946",
  "laurel bridge": "9f7f6d4d-9873-46be-926f-c5a48863a946",
  // Modern + Cozy Townhome (Old Roswell)
  "old roswell": "6ffe191b-d85c-44f3-b91b-f8d38bee16b4",
  "modern + cozy": "6ffe191b-d85c-44f3-b91b-f8d38bee16b4",
  "willow stream": "6ffe191b-d85c-44f3-b91b-f8d38bee16b4",
  // Woodland Lane
  "woodland": "54536b8d-9b6f-41f8-855f-3c4eb78aaf00",
  "mableton": "54536b8d-9b6f-41f8-855f-3c4eb78aaf00",
  "184 woodland": "54536b8d-9b6f-41f8-855f-3c4eb78aaf00",
  // Scandi Chic
  "scandi chic": "6c80c23b-997a-45af-8702-aeb7a7cf3e81",
  "duvall pl": "6c80c23b-997a-45af-8702-aeb7a7cf3e81",
  "3155 duvall": "6c80c23b-997a-45af-8702-aeb7a7cf3e81",
  // Whispering Oaks Farmhouse
  "whispering oaks": "cc43827e-1180-44b1-900f-82b49a267119",
  "grady smith": "cc43827e-1180-44b1-900f-82b49a267119",
  "loganville": "cc43827e-1180-44b1-900f-82b49a267119",
  // Canadian Way
  "canadian way": "38ddcda8-36f7-4f82-8f0f-27f7877637d5",
  "3708 canadian": "38ddcda8-36f7-4f82-8f0f-27f7877637d5",
  "tucker": "38ddcda8-36f7-4f82-8f0f-27f7877637d5",
  // MidTown Lighthouse
  "midtown lighthouse": "b3ddb7c3-2eb7-48cd-9446-e46bfb3ee743",
  "751 piedmont": "b3ddb7c3-2eb7-48cd-9446-e46bfb3ee743",
  // Lavish Living
  "lavish living": "96e2819b-c0e8-4281-b535-5c99c39973b3",
  "rita way": "96e2819b-c0e8-4281-b535-5c99c39973b3",
  "smyrna": "96e2819b-c0e8-4281-b535-5c99c39973b3",
  // Hazy Way properties
  "hazy way": "c74fab1a-cf60-42b6-afe6-fc268026f478",
  "1429 hazy": "c74fab1a-cf60-42b6-afe6-fc268026f478",
  "1427 hazy": "eb5a82df-fc98-4001-a5d1-0e20dc5e4e2f",
};

// Location-based fallback matching for posts that mention city/area
const LOCATION_KEYWORDS: Record<string, string[]> = {
  "roswell": [
    "bdb82ccb-b2fa-42fb-8c58-42aad6e2ef38", // The Berkley - primary Roswell property
    "6ffe191b-d85c-44f3-b91b-f8d38bee16b4", // Modern + Cozy
  ],
  "kennesaw": [
    "6c80c23b-997a-45af-8702-aeb7a7cf3e81", // Scandi Chic
    "05e83cd6-e232-46f1-a6eb-99b6a979bea8", // Sand Wedge
    "3f4ee435-5cbd-4c14-87b0-8c0dbd921cf0", // Timberlake
  ],
  "smyrna": [
    "96e2819b-c0e8-4281-b535-5c99c39973b3", // Lavish Living
    "9f7f6d4d-9873-46be-926f-c5a48863a946", // Scandinavian Retreat
  ],
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
  publishedUrl?: string; // Some platforms include the published URL directly
}

// Helper to extract TikTok video ID from various formats
const extractTikTokVideoId = (postId: string | undefined, publishedUrl?: string): string | null => {
  // If we have a published URL, extract from there
  if (publishedUrl) {
    const urlMatch = publishedUrl.match(/video\/(\d+)/);
    if (urlMatch) return urlMatch[1];
  }
  
  if (!postId) return null;
  
  // Format: v_pub_url~v2.7600082490660767774 -> extract the numeric part
  if (postId.includes('~v2.')) {
    const match = postId.match(/~v2\.(\d+)/);
    if (match) return match[1];
  }
  
  // If it's already numeric
  if (/^\d+$/.test(postId)) return postId;
  
  return null;
};

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

      // Location-based fallback matching - for posts that only mention city
      if (!matchedPropertyId) {
        for (const [location, propIds] of Object.entries(LOCATION_KEYWORDS)) {
          if (caption.includes(location)) {
            // Use the first (primary) property for this location
            const primaryPropId = propIds[0];
            if (propertyMap.has(primaryPropId)) {
              matchedPropertyId = primaryPropId;
              console.log(`[ghl-sync-social-posts] Location match: ${location} -> ${primaryPropId}`);
              break;
            }
          }
        }
      }

      // Generate post URL based on platform
      const getPostUrl = (post: GhlPost): string | null => {
        const platform = post.platform?.toLowerCase();
        
        switch (platform) {
          case "tiktok": {
            const videoId = extractTikTokVideoId(post.postId, post.publishedUrl);
            if (videoId) {
              return `https://www.tiktok.com/@peachhausgroup/video/${videoId}`;
            }
            return null;
          }
          case "instagram":
            if (post.postId) return `https://www.instagram.com/p/${post.postId}/`;
            return null;
          case "facebook":
            if (post.postId) return `https://www.facebook.com/${post.postId}`;
            return null;
          case "linkedin":
            if (post.postId) return `https://www.linkedin.com/posts/${post.postId}`;
            return null;
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
