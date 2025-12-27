import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  Plus
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

  // Fetch settings
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["gbp-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gbp_settings")
        .select("*")
        .single();
      if (error) throw error;
      return data as GBPSettings;
    },
  });

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
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Google Business Profile Connection</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="accountId">GBP Account ID</Label>
                      <Input
                        id="accountId"
                        placeholder="e.g., 123456789"
                        defaultValue={settings?.gbp_account_id || ""}
                        onBlur={(e) => {
                          if (e.target.value !== settings?.gbp_account_id) {
                            updateSettingsMutation.mutate({ gbp_account_id: e.target.value });
                          }
                        }}
                      />
                      <p className="text-xs text-muted-foreground">
                        Find this in your Google Business Profile URL or API response
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="locationId">GBP Location ID</Label>
                      <Input
                        id="locationId"
                        placeholder="e.g., 987654321"
                        defaultValue={settings?.gbp_location_id || ""}
                        onBlur={(e) => {
                          if (e.target.value !== settings?.gbp_location_id) {
                            updateSettingsMutation.mutate({ gbp_location_id: e.target.value });
                          }
                        }}
                      />
                      <p className="text-xs text-muted-foreground">
                        The specific location/business ID
                      </p>
                    </div>
                  </div>
                </div>

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
