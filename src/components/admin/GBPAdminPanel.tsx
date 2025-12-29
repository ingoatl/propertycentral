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
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  AlertTriangle,
  Unlink,
} from "lucide-react";
import { format } from "date-fns";

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
  const [isConnecting, setIsConnecting] = useState(false);
  const [manualLocationId, setManualLocationId] = useState("");

  // Check GBP connection status
  const { 
    data: connectionStatus, 
    isLoading: connectionLoading,
    refetch: refetchConnection 
  } = useQuery({
    queryKey: ["gbp-connection"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("gbp-manager", {
        body: { action: "check-connection" },
      });
      if (error) throw error;
      return data as { connected: boolean; verified: boolean; hasLocation?: boolean; error?: string };
    },
    refetchInterval: isConnecting ? 3000 : false,
  });

  // Fetch reviews from database
  const { data: reviews, isLoading: reviewsLoading, refetch: refetchReviews } = useQuery({
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

  // Fetch posts from database
  const { data: posts, isLoading: postsLoading, refetch: refetchPosts } = useQuery({
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

  // Fetch settings
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["gbp-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gbp_settings")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data as GBPSettings | null;
    },
  });

  // Handle OAuth callback from Google
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const oauthCallback = urlParams.get('oauth_callback');
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    
    if (oauthCallback === 'true' && code) {
      // Exchange the code for tokens
      const exchangeCode = async () => {
        try {
          setIsConnecting(true);
          const redirectUri = `${window.location.origin}/admin?tab=gbp&oauth_callback=true`;
          
          const { data, error: invokeError } = await supabase.functions.invoke("gbp-manager", {
            body: { 
              action: "exchange-code", 
              code,
              redirectUri,
            },
          });
          
          if (invokeError) throw invokeError;
          
          toast.success("Google Business Profile connected successfully!");
          refetchConnection();
          
          // Clean up URL
          window.history.replaceState({}, '', `${window.location.pathname}?tab=gbp`);
        } catch (err: any) {
          console.error("OAuth exchange error:", err);
          toast.error(err.message || "Failed to connect Google Business Profile");
        } finally {
          setIsConnecting(false);
        }
      };
      
      exchangeCode();
    } else if (error) {
      toast.error(`OAuth error: ${error}`);
      window.history.replaceState({}, '', `${window.location.pathname}?tab=gbp`);
    }
  }, []);

  // Handle Connect GBP button
  const handleConnectGBP = async () => {
    try {
      setIsConnecting(true);
      const { data, error } = await supabase.functions.invoke("gbp-manager", {
        body: { action: "get-auth-url", redirectUrl: window.location.origin },
      });
      
      if (error) throw error;
      
      if (data?.authUrl) {
        // Redirect to Google OAuth
        window.location.href = data.authUrl;
      } else {
        throw new Error("No auth URL returned");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to start connection");
      setIsConnecting(false);
    }
  };

  // State for configuration error
  const [configError, setConfigError] = useState<{
    error: string;
    userMessage: string;
    details: string;
    steps?: string[];
    helpUrl?: string;
  } | null>(null);

  // Sync reviews mutation
  const syncReviewsMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("gbp-manager", {
        body: { action: "sync-reviews" },
      });
      if (error) throw error;
      if (!data.success) {
        if (data.error === "GBP_LOCATION_NOT_CONFIGURED" || data.error === "GBP_LOCATION_NOT_FOUND") {
          setConfigError({
            error: data.error,
            userMessage: data.userMessage,
            details: data.details,
          });
          throw new Error(data.userMessage);
        }
        throw new Error(data.userMessage || data.error || "Sync failed");
      }
      setConfigError(null);
      return data;
    },
    onSuccess: (data) => {
      refetchReviews();
      toast.success(`Synced ${data.synced} reviews (${data.newReviews} new)`);
    },
    onError: (error: any) => {
      console.error("Sync error:", error);
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
    onSuccess: (data) => {
      refetchReviews();
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
      refetchReviews();
      setSelectedReview(null);
      setCustomReply("");
      toast.success("Reply posted to Google!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to post reply");
    },
  });

  // Generate post mutation
  const generatePostMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("gbp-manager", {
        body: { action: "generate-daily-post" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      refetchPosts();
      setNewPostContent(data.content);
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
      refetchPosts();
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

  // Discover locations mutation
  const discoverLocationsMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("gbp-manager", {
        body: { action: "discover-locations" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["gbp-settings"] });
      queryClient.invalidateQueries({ queryKey: ["gbp-connection"] });
      if (data.savedLocationId) {
        toast.success(`Location discovered and saved: ${data.savedLocationId}`);
        setConfigError(null);
      } else if (data.locations?.length === 0) {
        toast.warning("No locations found. You may need to add a business location in Google Business Profile.");
      } else {
        toast.info(`Found ${data.accounts?.length || 0} accounts, ${data.locations?.length || 0} locations`);
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to discover locations");
    },
  });

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("gbp-manager", {
        body: { action: "disconnect" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gbp-connection"] });
      queryClient.invalidateQueries({ queryKey: ["gbp-settings"] });
      toast.success("Disconnected from Google Business Profile");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to disconnect");
    },
  });

  // Save manual location ID
  const handleSaveManualLocationId = () => {
    if (!manualLocationId.trim()) {
      toast.error("Please enter a location ID");
      return;
    }
    updateSettingsMutation.mutate({ 
      gbp_location_id: manualLocationId.trim(),
    });
    setManualLocationId("");
    setConfigError(null);
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
          <div className="flex items-center gap-2">
            {connectionStatus?.connected && connectionStatus?.verified ? (
              <Badge className="bg-green-500/20 text-green-400">
                <CheckCircle className="w-3 h-3 mr-1" />
                Connected
              </Badge>
            ) : connectionStatus?.connected ? (
              <Badge className="bg-yellow-500/20 text-yellow-400">
                <AlertCircle className="w-3 h-3 mr-1" />
                Connection Issue
              </Badge>
            ) : (
              <Badge variant="secondary">Not Connected</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="reviews" className="space-y-4">
          <TabsList>
            <TabsTrigger value="reviews" className="flex items-center gap-2">
              <Star className="w-4 h-4" />
              Reviews
              {pendingReviews.length > 0 && (
                <Badge variant="destructive" className="ml-1 px-1.5 py-0.5 text-xs">
                  {pendingReviews.length}
                </Badge>
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
            {!connectionStatus?.connected ? (
              <Alert>
                <Building className="h-4 w-4" />
                <AlertTitle>Connect Google Business Profile</AlertTitle>
                <AlertDescription className="space-y-3">
                  <p>Connect your Google Business Profile to sync and respond to reviews.</p>
                  <Button onClick={handleConnectGBP} disabled={isConnecting}>
                    {isConnecting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Building className="w-4 h-4 mr-2" />
                    )}
                    Connect Google Business Profile
                  </Button>
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Pending Reviews ({pendingReviews.length})</h3>
                  <Button
                    onClick={() => syncReviewsMutation.mutate()}
                    disabled={syncReviewsMutation.isPending}
                    variant="outline"
                  >
                    {syncReviewsMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Sync Reviews
                  </Button>
                </div>

                {/* Configuration Error Alert */}
                {configError && (
                  <Alert variant="destructive" className="border-amber-500/50 bg-amber-500/10">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle className="text-amber-400">Configuration Required</AlertTitle>
                    <AlertDescription className="space-y-3">
                      <p className="text-sm">{configError.details}</p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => discoverLocationsMutation.mutate()}
                          disabled={discoverLocationsMutation.isPending}
                        >
                          {discoverLocationsMutation.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4 mr-2" />
                          )}
                          Discover Locations
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Pending Reviews */}
                <div className="space-y-3">
                  {pendingReviews.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      No pending reviews. All caught up! 🎉
                    </p>
                  ) : (
                    pendingReviews.map((review) => (
                      <div
                        key={review.id}
                        className="p-4 border rounded-lg space-y-3 bg-card"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                              {review.reviewer_name?.[0]?.toUpperCase() || "G"}
                            </div>
                            <div>
                              <p className="font-medium">{review.reviewer_name || "Guest"}</p>
                              <div className="flex items-center gap-1">
                                {renderStars(review.star_rating)}
                              </div>
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {review.review_created_at 
                              ? format(new Date(review.review_created_at), "MMM d, yyyy")
                              : "Unknown date"}
                          </span>
                        </div>

                        {review.review_text && (
                          <p className="text-sm text-muted-foreground">{review.review_text}</p>
                        )}

                        {selectedReview === review.id ? (
                          <div className="space-y-3">
                            <Textarea
                              value={customReply}
                              onChange={(e) => setCustomReply(e.target.value)}
                              placeholder="Write your reply..."
                              rows={3}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => generateReplyMutation.mutate(review.id)}
                                disabled={generateReplyMutation.isPending}
                                variant="outline"
                              >
                                {generateReplyMutation.isPending ? (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                  <Sparkles className="w-4 h-4 mr-2" />
                                )}
                                Generate AI Reply
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => postReplyMutation.mutate({ reviewId: review.id, reply: customReply })}
                                disabled={postReplyMutation.isPending || !customReply}
                              >
                                {postReplyMutation.isPending ? (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                  <Send className="w-4 h-4 mr-2" />
                                )}
                                Post Reply
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedReview(null);
                                  setCustomReply("");
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedReview(review.id);
                              setCustomReply(review.ai_generated_reply || "");
                            }}
                          >
                            <MessageSquare className="w-4 h-4 mr-2" />
                            Reply
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Replied Reviews */}
                {repliedReviews.length > 0 && (
                  <>
                    <h3 className="text-lg font-semibold mt-6">Replied Reviews ({repliedReviews.length})</h3>
                    <div className="space-y-3">
                      {repliedReviews.slice(0, 5).map((review) => (
                        <div
                          key={review.id}
                          className="p-4 border rounded-lg space-y-2 bg-card/50"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{review.reviewer_name || "Guest"}</span>
                              <div className="flex items-center gap-0.5">
                                {renderStars(review.star_rating)}
                              </div>
                            </div>
                            <Badge className="bg-green-500/20 text-green-400">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Replied
                            </Badge>
                          </div>
                          {review.review_text && (
                            <p className="text-sm text-muted-foreground line-clamp-2">{review.review_text}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </TabsContent>

          {/* Posts Tab */}
          <TabsContent value="posts" className="space-y-4">
            {!connectionStatus?.connected ? (
              <Alert>
                <Building className="h-4 w-4" />
                <AlertTitle>Connect Google Business Profile</AlertTitle>
                <AlertDescription>
                  Connect your Google Business Profile to create and publish posts.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Posts</h3>
                  <Button
                    onClick={() => generatePostMutation.mutate()}
                    disabled={generatePostMutation.isPending}
                  >
                    {generatePostMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2" />
                    )}
                    Generate Post
                  </Button>
                </div>

                {newPostContent && (
                  <div className="p-4 border rounded-lg space-y-3 bg-card">
                    <h4 className="font-medium">Generated Post</h4>
                    <p className="text-sm">{newPostContent}</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setNewPostContent("")}>
                        Discard
                      </Button>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {posts?.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      No posts yet. Generate your first post!
                    </p>
                  ) : (
                    posts?.map((post) => (
                      <div
                        key={post.id}
                        className="p-4 border rounded-lg space-y-3 bg-card"
                      >
                        <div className="flex items-start justify-between">
                          <p className="text-sm line-clamp-3">{post.summary}</p>
                          {getStatusBadge(post.status)}
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            {post.posted_at 
                              ? `Posted ${format(new Date(post.posted_at), "MMM d, yyyy")}`
                              : `Created ${format(new Date(post.created_at), "MMM d, yyyy")}`}
                          </span>
                          {post.status === "draft" && (
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
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            {/* Connection Status */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Connection</h3>
              
              {connectionLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Checking connection...</span>
                </div>
              ) : connectionStatus?.connected && connectionStatus?.verified ? (
                <div className="space-y-4">
                  <Alert className="border-green-500/50 bg-green-500/10">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <AlertTitle className="text-green-400">Connected to Google Business Profile</AlertTitle>
                    <AlertDescription>
                      <p>Your account is connected and verified.</p>
                      {settings?.gbp_location_id && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Location ID: {settings.gbp_location_id}
                        </p>
                      )}
                    </AlertDescription>
                  </Alert>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => discoverLocationsMutation.mutate()}
                      disabled={discoverLocationsMutation.isPending}
                    >
                      {discoverLocationsMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4 mr-2" />
                      )}
                      Refresh Locations
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => disconnectMutation.mutate()}
                      disabled={disconnectMutation.isPending}
                      className="text-destructive"
                    >
                      {disconnectMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Unlink className="w-4 h-4 mr-2" />
                      )}
                      Disconnect
                    </Button>
                  </div>
                </div>
              ) : connectionStatus?.connected ? (
                <Alert className="border-yellow-500/50 bg-yellow-500/10">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <AlertTitle className="text-yellow-400">Connection Issue</AlertTitle>
                  <AlertDescription className="space-y-3">
                    <p>{connectionStatus.error || "Could not verify connection"}</p>
                    <Button onClick={handleConnectGBP} disabled={isConnecting}>
                      {isConnecting ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Building className="w-4 h-4 mr-2" />
                      )}
                      Reconnect
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <Building className="h-4 w-4" />
                  <AlertTitle>Not Connected</AlertTitle>
                  <AlertDescription className="space-y-3">
                    <p>Connect your Google Business Profile to manage reviews and posts.</p>
                    <Button onClick={handleConnectGBP} disabled={isConnecting}>
                      {isConnecting ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Building className="w-4 h-4 mr-2" />
                      )}
                      Connect Google Business Profile
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Manual Location ID */}
            {connectionStatus?.connected && !connectionStatus?.hasLocation && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Manual Location Setup</h3>
                <p className="text-sm text-muted-foreground">
                  If auto-discovery doesn't find your location, you can enter the location ID manually.
                </p>
                <div className="flex gap-2">
                  <Input
                    value={manualLocationId}
                    onChange={(e) => setManualLocationId(e.target.value)}
                    placeholder="Enter GBP Location ID"
                    className="max-w-xs"
                  />
                  <Button
                    onClick={handleSaveManualLocationId}
                    disabled={updateSettingsMutation.isPending}
                  >
                    {updateSettingsMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    Save
                  </Button>
                </div>
              </div>
            )}

            {/* Automation Settings */}
            {connectionStatus?.connected && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Automation</h3>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto-Reply to Reviews</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically generate and post AI replies to new reviews
                    </p>
                  </div>
                  <Switch
                    checked={settings?.auto_reply_enabled || false}
                    onCheckedChange={(checked) => 
                      updateSettingsMutation.mutate({ auto_reply_enabled: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto-Post Daily Updates</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically generate and post daily content
                    </p>
                  </div>
                  <Switch
                    checked={settings?.auto_post_enabled || false}
                    onCheckedChange={(checked) => 
                      updateSettingsMutation.mutate({ auto_post_enabled: checked })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Daily Post Time</Label>
                  <Input
                    type="time"
                    value={settings?.post_time || "10:00"}
                    onChange={(e) => 
                      updateSettingsMutation.mutate({ post_time: e.target.value })
                    }
                    className="max-w-[150px]"
                  />
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
