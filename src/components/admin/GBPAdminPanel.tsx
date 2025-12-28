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

// Hardcoded PeachHaus Group account ID - location is auto-discovered
const PEACHHAUS_ACCOUNT_ID = "106698735661379366674";

export default function GBPAdminPanel() {
  const queryClient = useQueryClient();
  const [selectedReview, setSelectedReview] = useState<string | null>(null);
  const [customReply, setCustomReply] = useState("");
  const [newPostContent, setNewPostContent] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);

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
      return data as { connected: boolean; verified: boolean; error?: string };
    },
    refetchInterval: isConnecting ? 5000 : false,
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

  // Handle callback from Pipedream OAuth
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const connected = urlParams.get('connected');
    
    if (connected === 'true') {
      toast.success("Google Business Profile connected!");
      setIsConnecting(false);
      refetchConnection();
      window.history.replaceState({}, '', window.location.pathname + '?tab=gbp');
    } else if (connected === 'false') {
      toast.error("Failed to connect Google Business Profile");
      setIsConnecting(false);
      window.history.replaceState({}, '', window.location.pathname + '?tab=gbp');
    }
  }, []);

  // Handle Connect GBP button
  const handleConnectGBP = async () => {
    try {
      setIsConnecting(true);
      const { data, error } = await supabase.functions.invoke("gbp-manager", {
        body: { action: "get-auth-url" },
      });
      
      if (error) throw error;
      
      if (data?.authUrl) {
        window.open(data.authUrl, '_blank', 'width=600,height=700');
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
        // Check for specific error types
        if (data.error === "GBP_LOCATION_NOT_CONFIGURED") {
          setConfigError({
            error: data.error,
            userMessage: data.userMessage,
            details: data.details,
            steps: data.steps,
            helpUrl: data.helpUrl,
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
                <AlertTitle className="text-amber-400">Google Business Profile Configuration Required</AlertTitle>
                <AlertDescription className="space-y-3">
                  <p className="text-sm">{configError.details}</p>
                  {configError.steps && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium">To fix this:</p>
                      <ul className="text-sm space-y-1 ml-4 list-disc">
                        {configError.steps.map((step, i) => (
                          <li key={i}>{step.replace(/^\d+\.\s*/, '')}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {configError.helpUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => window.open(configError.helpUrl, '_blank')}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Google Business Profile Help
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {reviewsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : pendingReviews.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No pending reviews</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingReviews.map((review) => (
                  <Card key={review.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{review.reviewer_name || "Anonymous"}</span>
                          <div className="flex">{renderStars(review.star_rating)}</div>
                          {review.review_created_at && (
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(review.review_created_at), "MMM d, yyyy")}
                            </span>
                          )}
                        </div>
                        <p className="text-sm">{review.review_text || "No review text"}</p>
                        
                        {selectedReview === review.id && (
                          <div className="space-y-2 mt-4">
                            {review.ai_generated_reply && (
                              <div className="p-2 bg-blue-500/10 rounded text-sm">
                                <p className="font-medium text-blue-400 mb-1">AI Suggested Reply:</p>
                                <p>{review.ai_generated_reply}</p>
                              </div>
                            )}
                            <Textarea
                              value={customReply}
                              onChange={(e) => setCustomReply(e.target.value)}
                              placeholder="Write your reply..."
                              className="min-h-[100px]"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => postReplyMutation.mutate({ 
                                  reviewId: review.id, 
                                  reply: customReply || undefined 
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
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedReview(null);
                                  setCustomReply("");
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {selectedReview !== review.id && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedReview(review.id);
                              generateReplyMutation.mutate(review.id);
                            }}
                            disabled={generateReplyMutation.isPending}
                          >
                            {generateReplyMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Sparkles className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => setSelectedReview(review.id)}
                          >
                            Reply
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {repliedReviews.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-semibold mb-4">Recent Replies</h3>
                <div className="space-y-4">
                  {repliedReviews.slice(0, 5).map((review) => (
                    <Card key={review.id} className="p-4 opacity-75">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{review.reviewer_name || "Anonymous"}</span>
                          <div className="flex">{renderStars(review.star_rating)}</div>
                          <Badge variant="outline" className="text-green-500">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Replied
                          </Badge>
                        </div>
                        <p className="text-sm">{review.review_text || "No review text"}</p>
                        {review.review_reply && (
                          <div className="p-2 bg-muted rounded text-sm">
                            <p className="font-medium mb-1">Your reply:</p>
                            <p>{review.review_reply}</p>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Posts Tab */}
          <TabsContent value="posts" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Content Management</h3>
              <Button
                onClick={() => generatePostMutation.mutate()}
                disabled={generatePostMutation.isPending}
                variant="outline"
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
              <Card className="p-4 border-primary/50">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge>Draft</Badge>
                  </div>
                  <p className="text-sm">{newPostContent}</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        toast.info("Post would be published here");
                      }}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Publish Now
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setNewPostContent("")}
                    >
                      Discard
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {postsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : !posts || posts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No posts yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {posts.map((post) => (
                  <Card key={post.id} className="p-4">
                    <CardContent className="p-0 space-y-3">
                      <div className="flex items-center justify-between">
                        {getStatusBadge(post.status)}
                        <span className="text-xs text-muted-foreground">
                          {post.posted_at 
                            ? format(new Date(post.posted_at), "MMM d, yyyy h:mm a")
                            : post.scheduled_for
                            ? `Scheduled: ${format(new Date(post.scheduled_for), "MMM d, yyyy h:mm a")}`
                            : format(new Date(post.created_at), "MMM d, yyyy")}
                        </span>
                      </div>
                      <p className="text-sm">{post.summary}</p>
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
                          Connected to PeachHaus Group (ID: {PEACHHAUS_ACCOUNT_ID})
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
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Account Configuration - Read Only */}
                {connectionStatus?.connected && (
                  <div className="p-4 bg-muted/50 border rounded-lg space-y-2">
                    <h4 className="font-medium">Account Configuration</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Account ID:</span>
                        <code className="ml-2 bg-background px-2 py-1 rounded">{settings?.gbp_account_id || PEACHHAUS_ACCOUNT_ID}</code>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Location ID:</span>
                        <code className="ml-2 bg-background px-2 py-1 rounded">{settings?.gbp_location_id || "Auto-discovered"}</code>
                      </div>
                    </div>
                  </div>
                )}

                {/* Automation Settings */}
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
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
