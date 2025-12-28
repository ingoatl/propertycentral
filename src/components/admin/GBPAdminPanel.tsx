import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { 
  Star, 
  MessageSquare, 
  Send, 
  RefreshCw, 
  Sparkles, 
  Calendar, 
  Settings,
  CheckCircle,
  Clock,
  AlertCircle,
  Building,
  Loader2,
  ExternalLink,
  Plus,
  List
} from "lucide-react";
import { format } from "date-fns";

interface GBPAccount {
  name: string;
  accountName: string;
  type: string;
  accountNumber?: string;
}

interface GBPLocation {
  name: string;
  locationName?: string;
  title?: string;
  storefrontAddress?: {
    locality?: string;
    administrativeArea?: string;
  };
}

interface GBPReview {
  id: string;
  gbp_review_name: string;
  reviewer_name: string | null;
  reviewer_profile_photo_url: string | null;
  star_rating: number;
  review_text: string | null;
  review_reply: string | null;
  reply_posted_at: string | null;
  ai_generated_reply: string | null;
  review_created_at: string | null;
  needs_reply: boolean;
  auto_replied: boolean;
  created_at: string;
}

interface GBPPost {
  id: string;
  content_type: string;
  summary: string;
  media_url: string | null;
  call_to_action_type: string | null;
  call_to_action_url: string | null;
  scheduled_for: string | null;
  posted_at: string | null;
  status: string;
  ai_generated: boolean;
  created_at: string;
}

interface GBPSettings {
  id: string;
  gbp_account_id: string | null;
  gbp_location_id: string | null;
  auto_reply_enabled: boolean;
  auto_post_enabled: boolean;
  post_time: string;
  reply_delay_minutes: number;
}

export default function GBPAdminPanel() {
  const queryClient = useQueryClient();
  const [selectedReview, setSelectedReview] = useState<string | null>(null);
  const [customReply, setCustomReply] = useState("");
  const [newPostContent, setNewPostContent] = useState("");
  const [accounts, setAccounts] = useState<GBPAccount[]>([]);
  const [locations, setLocations] = useState<GBPLocation[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [isConnecting, setIsConnecting] = useState(false);

  // Check connection status
  const { data: connectionStatus, isLoading: connectionLoading, refetch: refetchConnection } = useQuery({
    queryKey: ["gbp-connection"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("gbp-manager", {
        body: { action: "check-connection" },
      });
      if (error) throw error;
      return data as { connected: boolean; verified: boolean; error?: string };
    },
    refetchInterval: isConnecting ? 5000 : false, // Poll while connecting
  });

  // Fetch reviews
  const { data: reviews, isLoading: reviewsLoading } = useQuery({
    queryKey: ["gbp-reviews"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gbp_reviews")
        .select("*")
        .order("review_created_at", { ascending: false });
      if (error) throw error;
      return data as GBPReview[];
    },
  });

  // Fetch posts
  const { data: posts, isLoading: postsLoading } = useQuery({
    queryKey: ["gbp-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gbp_posts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as GBPPost[];
    },
  });

  // Fetch settings (get first one since there should only be one global settings row)
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["gbp-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gbp_settings")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as GBPSettings | null;
    },
  });

  // Handle connecting GBP
  const handleConnectGBP = async () => {
    setIsConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("gbp-manager", {
        body: { 
          action: "get-auth-url",
          redirectUrl: window.location.origin,
        },
      });
      
      if (error) throw error;
      
      if (data.connected) {
        toast.success("Google Business Profile is already connected!");
        refetchConnection();
      } else if (data.authUrl) {
        // Redirect to Pipedream Connect
        window.location.href = data.authUrl;
      } else {
        throw new Error("No auth URL returned");
      }
    } catch (err: any) {
      console.error("Connect GBP error:", err);
      toast.error(err.message || "Failed to initiate GBP connection");
    } finally {
      setIsConnecting(false);
    }
  };

  // Check for connection callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("connected") === "true") {
      toast.success("Google Business Profile connected successfully!");
      refetchConnection();
      // Clean up URL
      const newUrl = window.location.pathname + "?tab=gbp";
      window.history.replaceState({}, "", newUrl);
    } else if (urlParams.get("connected") === "false") {
      toast.error("Failed to connect Google Business Profile");
      // Clean up URL
      const newUrl = window.location.pathname + "?tab=gbp";
      window.history.replaceState({}, "", newUrl);
    }
  }, []);


  // Sync reviews mutation
  const syncReviewsMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("gbp-manager", {
        body: { action: "sync-reviews" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["gbp-reviews"] });
      toast.success(`Synced ${data.synced} reviews (${data.newReviews} new)`);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to sync reviews");
    },
  });

  // Generate AI reply mutation
  const generateReplyMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      const { data, error } = await supabase.functions.invoke("gbp-manager", {
        body: { action: "generate-reply", reviewId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data, reviewId) => {
      queryClient.invalidateQueries({ queryKey: ["gbp-reviews"] });
      setSelectedReview(reviewId);
      setCustomReply(data.reply);
      toast.success("AI reply generated!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to generate reply");
    },
  });

  // Post reply mutation
  const postReplyMutation = useMutation({
    mutationFn: async ({ reviewId, reply }: { reviewId: string; reply?: string }) => {
      const { data, error } = await supabase.functions.invoke("gbp-manager", {
        body: { action: "post-reply", reviewId, reply },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gbp-reviews"] });
      setSelectedReview(null);
      setCustomReply("");
      toast.success("Reply posted to Google!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to post reply");
    },
  });

  // Generate daily post mutation
  const generatePostMutation = useMutation({
    mutationFn: async (category?: string) => {
      const { data, error } = await supabase.functions.invoke("gbp-manager", {
        body: { action: "generate-daily-post", category },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["gbp-posts"] });
      setNewPostContent(data.post?.summary || "");
      toast.success("Post content generated!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to generate post");
    },
  });

  // Publish post mutation
  const publishPostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const { data, error } = await supabase.functions.invoke("gbp-manager", {
        body: { action: "create-post", postId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gbp-posts"] });
      toast.success("Post published to Google Business Profile!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to publish post");
    },
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: Partial<GBPSettings>) => {
      const { data, error } = await supabase.functions.invoke("gbp-manager", {
        body: { 
          action: "update-settings",
          gbpAccountId: newSettings.gbp_account_id,
          gbpLocationId: newSettings.gbp_location_id,
          autoReplyEnabled: newSettings.auto_reply_enabled,
          autoPostEnabled: newSettings.auto_post_enabled,
          postTime: newSettings.post_time,
          replyDelayMinutes: newSettings.reply_delay_minutes,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gbp-settings"] });
      toast.success("Settings updated!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update settings");
    },
  });

  // List tools mutation (for debugging)
  const listToolsMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("gbp-manager", {
        body: { action: "list-tools" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      console.log("Available GBP tools:", data.tools);
      toast.success("Tools listed in console");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to list tools");
    },
  });

  // List accounts mutation
  const listAccountsMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("gbp-manager", {
        body: { action: "list-accounts" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      console.log("GBP Accounts:", data);
      if (data.accounts && data.accounts.length > 0) {
        setAccounts(data.accounts);
        toast.success(`Found ${data.accounts.length} account(s)`);
      } else {
        toast.info("No accounts found. Check your GBP MCP connection.");
      }
    },
    onError: (error: any) => {
      console.error("List accounts error:", error);
      toast.error(error.message || "Failed to list accounts");
    },
  });

  // List locations mutation
  const listLocationsMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const { data, error } = await supabase.functions.invoke("gbp-manager", {
        body: { action: "list-locations", accountId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      console.log("GBP Locations:", data);
      if (data.locations && data.locations.length > 0) {
        setLocations(data.locations);
        toast.success(`Found ${data.locations.length} location(s)`);
      } else {
        toast.info("No locations found for this account.");
      }
    },
    onError: (error: any) => {
      console.error("List locations error:", error);
      toast.error(error.message || "Failed to list locations");
    },
  });

  // Helper to extract account ID from account name
  const extractAccountId = (accountName: string): string => {
    // Account name format: "accounts/123456789"
    const match = accountName.match(/accounts\/(\d+)/);
    return match ? match[1] : accountName;
  };

  // Helper to extract location ID from location name
  const extractLocationId = (locationName: string): string => {
    // Location name format: "accounts/123456789/locations/987654321"
    const match = locationName.match(/locations\/(\d+)/);
    return match ? match[1] : locationName;
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${i < rating ? "fill-yellow-400 text-yellow-400" : "text-muted"}`}
      />
    ));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "posted":
        return <Badge className="bg-green-500/20 text-green-400"><CheckCircle className="w-3 h-3 mr-1" />Posted</Badge>;
      case "scheduled":
        return <Badge className="bg-blue-500/20 text-blue-400"><Clock className="w-3 h-3 mr-1" />Scheduled</Badge>;
      case "failed":
        return <Badge className="bg-red-500/20 text-red-400"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="secondary">Draft</Badge>;
    }
  };

  const pendingReviews = reviews?.filter(r => r.needs_reply) || [];
  const repliedReviews = reviews?.filter(r => !r.needs_reply) || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building className="w-5 h-5" />
              Google Business Profile
            </CardTitle>
            <CardDescription>
              Manage reviews and posts for your Google Business Profile
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => listToolsMutation.mutate()}
            disabled={listToolsMutation.isPending}
          >
            {listToolsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Debug Tools"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="reviews">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="reviews" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Reviews
              {pendingReviews.length > 0 && (
                <Badge variant="destructive" className="ml-1">{pendingReviews.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="posts" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Posts
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Reviews Tab */}
          <TabsContent value="reviews" className="space-y-4">
            {/* Setup Alert */}
            {settings && (!settings.gbp_account_id || !settings.gbp_location_id) && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-600">Setup Required</p>
                  <p className="text-sm text-muted-foreground">
                    Please configure your GBP Account ID and Location ID in the Settings tab to sync reviews and enable automation.
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Pending Reviews ({pendingReviews.length})</h3>
              <Button
                variant="outline"
                onClick={() => syncReviewsMutation.mutate()}
                disabled={syncReviewsMutation.isPending || !settings?.gbp_account_id || !settings?.gbp_location_id}
              >
                {syncReviewsMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Sync Reviews
              </Button>
            </div>

            {reviewsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : pendingReviews.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {settings?.gbp_account_id && settings?.gbp_location_id 
                  ? "No pending reviews. All caught up! Click 'Sync Reviews' to fetch the latest."
                  : "Configure your GBP settings to start syncing reviews."}
              </div>
            ) : (
              <div className="space-y-4">
                {pendingReviews.map((review) => (
                  <Card key={review.id} className="border-l-4 border-l-yellow-500">
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold">{review.reviewer_name || "Anonymous"}</p>
                          <div className="flex items-center gap-1 mt-1">
                            {renderStars(review.star_rating)}
                          </div>
                          {review.review_created_at && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(review.review_created_at), "PPp")}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => generateReplyMutation.mutate(review.id)}
                            disabled={generateReplyMutation.isPending}
                          >
                            {generateReplyMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Sparkles className="w-4 h-4" />
                            )}
                            <span className="ml-2 hidden sm:inline">Generate Reply</span>
                          </Button>
                        </div>
                      </div>

                      <p className="text-sm mt-2">{review.review_text || "(No written review)"}</p>

                      {(review.ai_generated_reply || selectedReview === review.id) && (
                        <div className="mt-4 p-3 bg-muted rounded-lg">
                          <Label className="text-xs text-muted-foreground">AI Generated Reply</Label>
                          <Textarea
                            value={selectedReview === review.id ? customReply : review.ai_generated_reply || ""}
                            onChange={(e) => {
                              setSelectedReview(review.id);
                              setCustomReply(e.target.value);
                            }}
                            className="mt-2"
                            rows={3}
                          />
                          <div className="flex justify-end gap-2 mt-2">
                            <Button
                              size="sm"
                              onClick={() => postReplyMutation.mutate({ 
                                reviewId: review.id, 
                                reply: selectedReview === review.id ? customReply : undefined 
                              })}
                              disabled={postReplyMutation.isPending}
                            >
                              {postReplyMutation.isPending ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <Send className="w-4 h-4 mr-2" />
                              )}
                              Post Reply
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {repliedReviews.length > 0 && (
              <>
                <h3 className="text-lg font-semibold mt-8">Recent Replies ({repliedReviews.length})</h3>
                <div className="space-y-4">
                  {repliedReviews.slice(0, 5).map((review) => (
                    <Card key={review.id} className="border-l-4 border-l-green-500">
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold">{review.reviewer_name || "Anonymous"}</p>
                            <div className="flex items-center gap-1 mt-1">
                              {renderStars(review.star_rating)}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {review.auto_replied && (
                              <Badge variant="secondary">
                                <Sparkles className="w-3 h-3 mr-1" />
                                AI Reply
                              </Badge>
                            )}
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          </div>
                        </div>
                        <p className="text-sm mt-2 text-muted-foreground">{review.review_text || "(No written review)"}</p>
                        {review.review_reply && (
                          <div className="mt-2 p-2 bg-green-500/10 rounded text-sm">
                            <p className="text-xs text-muted-foreground mb-1">Your reply:</p>
                            {review.review_reply}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </TabsContent>

          {/* Posts Tab */}
          <TabsContent value="posts" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Content Posts</h3>
              <Button
                onClick={() => generatePostMutation.mutate(undefined)}
                disabled={generatePostMutation.isPending}
              >
                {generatePostMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Generate Post
              </Button>
            </div>

            {postsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : posts?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No posts yet. Generate your first post!
              </div>
            ) : (
              <div className="space-y-4">
                {posts?.map((post) => (
                  <Card key={post.id}>
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(post.status)}
                          {post.ai_generated && (
                            <Badge variant="outline">
                              <Sparkles className="w-3 h-3 mr-1" />
                              AI Generated
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {post.posted_at 
                            ? `Posted ${format(new Date(post.posted_at), "PPp")}`
                            : `Created ${format(new Date(post.created_at), "PPp")}`
                          }
                        </div>
                      </div>

                      <p className="text-sm mt-2">{post.summary}</p>

                      {post.call_to_action_type && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          CTA: {post.call_to_action_type}
                          {post.call_to_action_url && (
                            <a href={post.call_to_action_url} target="_blank" rel="noopener noreferrer" className="ml-2 text-primary">
                              <ExternalLink className="w-3 h-3 inline" />
                            </a>
                          )}
                        </div>
                      )}

                      {post.status === "draft" && (
                        <div className="flex justify-end mt-4">
                          <Button
                            size="sm"
                            onClick={() => publishPostMutation.mutate(post.id)}
                            disabled={publishPostMutation.isPending}
                          >
                            {publishPostMutation.isPending ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Send className="w-4 h-4 mr-2" />
                            )}
                            Publish
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            {settingsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : (
              <>
                {/* Connection Status Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Google Business Profile Connection</h3>
                  
                  {connectionLoading ? (
                    <div className="p-4 border rounded-lg flex items-center gap-3">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-muted-foreground">Checking connection status...</span>
                    </div>
                  ) : connectionStatus?.connected && connectionStatus?.verified ? (
                    <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-green-600">Google Business Profile Connected</p>
                        <p className="text-sm text-muted-foreground">
                          Your Google Business Profile is connected and ready to use.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refetchConnection()}
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg space-y-3">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-medium text-amber-600">Connection Required</p>
                          <p className="text-sm text-muted-foreground">
                            Connect your Google Business Profile to manage reviews and posts.
                            {connectionStatus?.error && (
                              <span className="block mt-1 text-xs text-red-500">{connectionStatus.error}</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            After completing the OAuth flow, close the popup and click "Check Again".
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleConnectGBP}
                          disabled={isConnecting}
                          className="flex-1"
                        >
                          {isConnecting ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <ExternalLink className="w-4 h-4 mr-2" />
                          )}
                          Connect Google Business Profile
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => refetchConnection()}
                          disabled={connectionLoading}
                        >
                          {connectionLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}
                          Check Again
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Only show account/location selection if connected */}
                {connectionStatus?.connected && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Account & Location Selection</h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => listAccountsMutation.mutate()}
                        disabled={listAccountsMutation.isPending}
                      >
                        {listAccountsMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <List className="w-4 h-4 mr-2" />
                        )}
                        Fetch Accounts
                      </Button>
                    </div>

                  {/* Step 1: Select Account */}
                  <div className="p-4 border rounded-lg space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">Step 1</Badge>
                      <Label className="font-medium">Select GBP Account</Label>
                    </div>
                    
                    {accounts.length > 0 ? (
                      <div className="space-y-3">
                        <Select
                          value={selectedAccountId || settings?.gbp_account_id || ""}
                          onValueChange={(value) => {
                            setSelectedAccountId(value);
                            setLocations([]);
                            setSelectedLocationId("");
                            updateSettingsMutation.mutate({ gbp_account_id: value });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select an account..." />
                          </SelectTrigger>
                          <SelectContent className="bg-background border">
                            {accounts.map((account) => {
                              const accountId = extractAccountId(account.name);
                              return (
                                <SelectItem key={account.name} value={accountId}>
                                  {account.accountName || account.name} ({accountId})
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            const accountId = selectedAccountId || settings?.gbp_account_id;
                            if (accountId) {
                              listLocationsMutation.mutate(accountId);
                            } else {
                              toast.error("Please select an account first");
                            }
                          }}
                          disabled={listLocationsMutation.isPending || (!selectedAccountId && !settings?.gbp_account_id)}
                        >
                          {listLocationsMutation.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <List className="w-4 h-4 mr-2" />
                          )}
                          Fetch Locations for Selected Account
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Click "Fetch Accounts" to load your connected GBP accounts.
                        </p>
                        {settings?.gbp_account_id && (
                          <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span className="text-sm">Current Account ID: <code className="bg-muted px-1 rounded">{settings.gbp_account_id}</code></span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Step 2: Select Location */}
                  <div className="p-4 border rounded-lg space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">Step 2</Badge>
                      <Label className="font-medium">Select GBP Location</Label>
                    </div>
                    
                    {locations.length > 0 ? (
                      <Select
                        value={selectedLocationId || settings?.gbp_location_id || ""}
                        onValueChange={(value) => {
                          setSelectedLocationId(value);
                          updateSettingsMutation.mutate({ gbp_location_id: value });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a location..." />
                        </SelectTrigger>
                        <SelectContent className="bg-background border">
                          {locations.map((location) => {
                            const locationId = extractLocationId(location.name);
                            const displayName = location.title || location.locationName || location.name;
                            const address = location.storefrontAddress 
                              ? `${location.storefrontAddress.locality || ''}, ${location.storefrontAddress.administrativeArea || ''}`
                              : '';
                            return (
                              <SelectItem key={location.name} value={locationId}>
                                {displayName} {address && `- ${address}`} ({locationId})
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Select an account first, then click "Fetch Locations" to load locations.
                        </p>
                        {settings?.gbp_location_id && (
                          <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span className="text-sm">Current Location ID: <code className="bg-muted px-1 rounded">{settings.gbp_location_id}</code></span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Connection Status */}
                  {settings?.gbp_account_id && settings?.gbp_location_id && (
                    <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                      <div>
                        <p className="font-medium text-green-600">Connection Configured</p>
                        <p className="text-sm text-muted-foreground">
                          Account: <code className="bg-muted px-1 rounded">{settings.gbp_account_id}</code> | 
                          Location: <code className="bg-muted px-1 rounded">{settings.gbp_location_id}</code>
                        </p>
                      </div>
                    </div>
                  )}
                  </div>
                )}

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Automation Settings</h3>
                  
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Auto-Reply to Reviews</p>
                      <p className="text-sm text-muted-foreground">
                        Automatically generate and post AI replies to new reviews
                      </p>
                    </div>
                    <Switch
                      checked={settings?.auto_reply_enabled || false}
                      onCheckedChange={(checked) => {
                        updateSettingsMutation.mutate({ auto_reply_enabled: checked });
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Auto-Post Daily Content</p>
                      <p className="text-sm text-muted-foreground">
                        Automatically generate and publish daily posts
                      </p>
                    </div>
                    <Switch
                      checked={settings?.auto_post_enabled || false}
                      onCheckedChange={(checked) => {
                        updateSettingsMutation.mutate({ auto_post_enabled: checked });
                      }}
                    />
                  </div>

                  {settings?.auto_post_enabled && (
                    <div className="space-y-2 ml-4">
                      <Label htmlFor="postTime">Daily Post Time (EST)</Label>
                      <Input
                        id="postTime"
                        type="time"
                        defaultValue={settings?.post_time || "10:00"}
                        onBlur={(e) => {
                          if (e.target.value !== settings?.post_time) {
                            updateSettingsMutation.mutate({ post_time: e.target.value });
                          }
                        }}
                        className="w-32"
                      />
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t">
                  <p className="text-xs text-muted-foreground">
                    Google Business Profile is connected via Pipedream MCP. Make sure the connection is active in your Pipedream project settings.
                  </p>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
