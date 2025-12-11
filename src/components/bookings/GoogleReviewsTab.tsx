import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  RefreshCw, Star, MessageSquare, Send, CheckCircle, Clock, XCircle, Eye, 
  ArrowRight, UserX, Phone, AlertTriangle, TrendingUp, Users, Inbox,
  Ban, RotateCcw
} from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface OwnerrezReview {
  id: string;
  booking_id: string;
  guest_name: string | null;
  guest_phone: string | null;
  guest_email: string | null;
  property_id: string | null;
  review_source: string | null;
  star_rating: number | null;
  review_text: string | null;
  review_date: string | null;
  created_at: string;
}

interface GoogleReviewRequest {
  id: string;
  review_id: string;
  guest_phone: string;
  workflow_status: string;
  permission_asked_at: string | null;
  permission_granted_at: string | null;
  link_sent_at: string | null;
  link_clicked_at: string | null;
  completed_at: string | null;
  nudge_count: number;
  opted_out: boolean;
  opted_out_at: string | null;
  created_at: string;
}

interface SmsLog {
  id: string;
  request_id: string | null;
  phone_number: string;
  message_type: string;
  message_body: string;
  status: string;
  created_at: string;
}

const GoogleReviewsTab = () => {
  const [reviews, setReviews] = useState<OwnerrezReview[]>([]);
  const [requests, setRequests] = useState<GoogleReviewRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [selectedReview, setSelectedReview] = useState<OwnerrezReview | null>(null);
  const [smsLogs, setSmsLogs] = useState<SmsLog[]>([]);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [allInboundMessages, setAllInboundMessages] = useState<SmsLog[]>([]);
  const [activeTab, setActiveTab] = useState("strategy");
  const [optOutConfirm, setOptOutConfirm] = useState<string | null>(null);
  const [resubscribeConfirm, setResubscribeConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [reviewsResult, requestsResult, inboundResult] = await Promise.all([
        supabase
          .from("ownerrez_reviews")
          .select("*")
          .order("review_date", { ascending: false }),
        supabase
          .from("google_review_requests")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("sms_log")
          .select("*")
          .in("message_type", ["inbound_reply", "inbound_opt_out", "inbound_resubscribe", "inbound_unmatched"])
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      if (reviewsResult.error) throw reviewsResult.error;
      if (requestsResult.error) throw requestsResult.error;

      setReviews(reviewsResult.data || []);
      setRequests(requestsResult.data || []);
      setAllInboundMessages(inboundResult.data || []);
    } catch (error: any) {
      console.error("Error loading Google reviews data:", error);
      toast.error("Failed to load reviews data");
    } finally {
      setLoading(false);
    }
  };

  const syncReviews = async () => {
    try {
      setSyncing(true);
      toast.loading("Syncing reviews from OwnerRez...");
      const { data, error } = await supabase.functions.invoke("sync-ownerrez-reviews");
      if (error) throw error;
      toast.dismiss();
      toast.success(`Synced ${data?.reviewsAdded || 0} new 5-star reviews`);
      await loadData();
    } catch (error: any) {
      console.error("Sync error:", error);
      toast.dismiss();
      toast.error("Failed to sync reviews");
    } finally {
      setSyncing(false);
    }
  };

  const backfillPhones = async () => {
    try {
      setBackfilling(true);
      toast.loading("Fetching phone numbers from OwnerRez...");
      const { data, error } = await supabase.functions.invoke("sync-ownerrez-reviews", {
        body: { action: "backfill_phones" },
      });
      if (error) throw error;
      toast.dismiss();
      const msg = data?.deleted > 0 
        ? `Updated ${data?.updated || 0} reviews, removed ${data?.deleted} invalid records`
        : `Updated ${data?.updated || 0} reviews with phone numbers`;
      toast.success(msg);
      await loadData();
    } catch (error: any) {
      console.error("Backfill error:", error);
      toast.dismiss();
      toast.error("Failed to backfill phone numbers");
    } finally {
      setBackfilling(false);
    }
  };

  const sendPermissionSms = async (reviewId: string, forceTime: boolean = false) => {
    try {
      toast.loading("Sending permission SMS...");
      const { data, error } = await supabase.functions.invoke("send-review-sms", {
        body: { reviewId, action: "permission_ask", forceTime },
      });
      if (error) throw error;
      toast.dismiss();
      
      if (data?.outsideWindow) {
        toast.error("Outside send window (11am-3pm EST). Use 'Force Send' to override.");
        return;
      }
      
      toast.success("Permission SMS sent successfully");
      await loadData();
    } catch (error: any) {
      console.error("SMS error:", error);
      toast.dismiss();
      toast.error(error.message || "Failed to send SMS");
    }
  };

  const sendTestSms = async () => {
    try {
      setSendingTest(true);
      toast.loading("Sending test SMS...");
      const { data, error } = await supabase.functions.invoke("send-review-sms", {
        body: { action: "test" },
      });
      if (error) throw error;
      toast.dismiss();
      toast.success("Test SMS sent to admin phone");
    } catch (error: any) {
      console.error("Test SMS error:", error);
      toast.dismiss();
      toast.error(error.message || "Failed to send test SMS");
    } finally {
      setSendingTest(false);
    }
  };

  const optOutGuest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from("google_review_requests")
        .update({ opted_out: true, opted_out_at: new Date().toISOString() })
        .eq("id", requestId);
      if (error) throw error;
      toast.success("Guest opted out successfully");
      await loadData();
    } catch (error: any) {
      toast.error("Failed to opt out guest");
    }
    setOptOutConfirm(null);
  };

  const resubscribeGuest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from("google_review_requests")
        .update({ opted_out: false, opted_out_at: null, workflow_status: "pending" })
        .eq("id", requestId);
      if (error) throw error;
      toast.success("Guest resubscribed successfully");
      await loadData();
    } catch (error: any) {
      toast.error("Failed to resubscribe guest");
    }
    setResubscribeConfirm(null);
  };

  const createTestGuest = async () => {
    try {
      toast.loading("Creating test guest...");
      
      // Create a test review
      const testBookingId = `TEST_${Date.now()}`;
      const { data: review, error: reviewError } = await supabase
        .from("ownerrez_reviews")
        .insert({
          booking_id: testBookingId,
          guest_name: "Test Guest (Campaign Test)",
          guest_phone: "+14044174582", // Admin phone for testing
          guest_email: "test@peachhausgroup.com",
          review_source: "Airbnb",
          star_rating: 5,
          review_text: "This was an amazing stay! The property was spotless, beautifully decorated, and had everything we needed. The hosts were incredibly responsive and helpful. We will definitely be back and highly recommend this place to anyone looking for a comfortable and stylish home away from home. Five stars all around!",
          review_date: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (reviewError) throw reviewError;
      
      // Create a workflow request for this test review
      const { error: requestError } = await supabase
        .from("google_review_requests")
        .insert({
          review_id: review.id,
          guest_phone: "+14044174582",
          workflow_status: "pending",
        });
      
      if (requestError) throw requestError;
      
      toast.dismiss();
      toast.success("Test guest created! Use 'Force' button to start the workflow.");
      await loadData();
    } catch (error: any) {
      console.error("Create test guest error:", error);
      toast.dismiss();
      toast.error(error.message || "Failed to create test guest");
    }
  };

  const viewSmsHistory = async (requestId: string) => {
    try {
      const { data, error } = await supabase
        .from("sms_log")
        .select("*")
        .eq("request_id", requestId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setSmsLogs(data || []);
      setSmsDialogOpen(true);
    } catch (error: any) {
      console.error("Error loading SMS history:", error);
      toast.error("Failed to load SMS history");
    }
  };

  const getRequestForReview = (reviewId: string) => {
    return requests.find((r) => r.review_id === reviewId);
  };

  const getReviewForRequest = (reviewId: string) => {
    return reviews.find((r) => r.id === reviewId);
  };

  const getStatusBadge = (status: string, optedOut?: boolean) => {
    if (optedOut) {
      return (
        <Badge variant="destructive" className="gap-1">
          <Ban className="w-3 h-3" />
          Opted Out
        </Badge>
      );
    }
    
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: any; color?: string }> = {
      pending: { variant: "secondary", icon: Clock },
      permission_asked: { variant: "outline", icon: Send },
      permission_granted: { variant: "default", icon: CheckCircle },
      link_sent: { variant: "default", icon: MessageSquare },
      link_clicked: { variant: "default", icon: Eye },
      completed: { variant: "default", icon: Star, color: "bg-emerald-500" },
      ignored: { variant: "destructive", icon: XCircle },
    };

    const config = statusConfig[status] || { variant: "secondary" as const, icon: Clock };
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className={`gap-1 ${config.color || ""}`}>
        <Icon className="w-3 h-3" />
        {status.replace(/_/g, " ")}
      </Badge>
    );
  };

  // Stats calculations
  const totalReviews = reviews.filter(r => r.guest_phone).length;
  const reviewsWithoutPhone = reviews.filter(r => !r.guest_phone).length;
  const pendingOutreach = reviews.filter(r => r.guest_phone && !getRequestForReview(r.id)).length;
  const permissionAsked = requests.filter(r => r.workflow_status === "permission_asked" && !r.opted_out).length;
  const permissionGranted = requests.filter(r => r.workflow_status === "permission_granted" && !r.opted_out).length;
  const linkSent = requests.filter(r => r.workflow_status === "link_sent" && !r.opted_out).length;
  const linkClicked = requests.filter(r => r.workflow_status === "link_clicked" && !r.opted_out).length;
  const completedCount = requests.filter(r => r.workflow_status === "completed").length;
  const ignoredCount = requests.filter(r => r.workflow_status === "ignored").length;
  const optedOutCount = requests.filter(r => r.opted_out).length;
  const conversionRate = totalReviews > 0 ? Math.round((completedCount / totalReviews) * 100) : 0;

  // Get opted out guests with their review info
  const optedOutRequests = requests.filter(r => r.opted_out);

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <TabsList className="grid grid-cols-4 w-full sm:w-auto">
            <TabsTrigger value="strategy" className="gap-1">
              <TrendingUp className="w-4 h-4 hidden sm:inline" />
              Strategy
            </TabsTrigger>
            <TabsTrigger value="queue" className="gap-1">
              <Users className="w-4 h-4 hidden sm:inline" />
              Queue
            </TabsTrigger>
            <TabsTrigger value="inbox" className="gap-1">
              <Inbox className="w-4 h-4 hidden sm:inline" />
              Inbox
            </TabsTrigger>
            <TabsTrigger value="optedout" className="gap-1">
              <UserX className="w-4 h-4 hidden sm:inline" />
              Opted Out {optedOutCount > 0 && `(${optedOutCount})`}
            </TabsTrigger>
          </TabsList>
          
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={createTestGuest} size="sm" className="bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/30 dark:border-amber-700 dark:text-amber-400">
              <Users className="w-4 h-4 mr-1" />
              Create Test Guest
            </Button>
            <Button variant="outline" onClick={sendTestSms} disabled={sendingTest} size="sm">
              <Send className={`w-4 h-4 mr-1 ${sendingTest ? "animate-pulse" : ""}`} />
              Test SMS
            </Button>
            <Button variant="outline" onClick={backfillPhones} disabled={backfilling} size="sm">
              <Phone className={`w-4 h-4 mr-1 ${backfilling ? "animate-spin" : ""}`} />
              Fetch Phones
            </Button>
            <Button onClick={syncReviews} disabled={syncing} size="sm">
              <RefreshCw className={`w-4 h-4 mr-1 ${syncing ? "animate-spin" : ""}`} />
              Sync Reviews
            </Button>
          </div>
        </div>

        {/* STRATEGY DASHBOARD TAB */}
        <TabsContent value="strategy" className="space-y-6">
          {/* Workflow Funnel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Google Review Conversion Funnel
              </CardTitle>
              <CardDescription>
                Automated 3-step SMS workflow to convert 5-star Airbnb/VRBO reviews into Google reviews
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                {/* Step 1: 5-Star Reviews */}
                <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20 rounded-lg p-4 text-center border border-amber-200 dark:border-amber-800">
                  <Star className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                  <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{totalReviews}</div>
                  <div className="text-xs text-amber-600 dark:text-amber-500">5-Star Reviews</div>
                  <div className="text-[10px] text-muted-foreground mt-1">with phone number</div>
                </div>
                
                <ArrowRight className="w-6 h-6 self-center justify-self-center text-muted-foreground hidden md:block" />
                
                {/* Step 2: Pending Outreach */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 rounded-lg p-4 text-center border border-blue-200 dark:border-blue-800">
                  <Clock className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{pendingOutreach}</div>
                  <div className="text-xs text-blue-600 dark:text-blue-500">Pending Outreach</div>
                  <div className="text-[10px] text-muted-foreground mt-1">ready to contact</div>
                </div>
                
                <ArrowRight className="w-6 h-6 self-center justify-self-center text-muted-foreground hidden md:block" />
                
                {/* Step 3: Permission Asked */}
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/20 rounded-lg p-4 text-center border border-purple-200 dark:border-purple-800">
                  <Send className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                  <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">{permissionAsked}</div>
                  <div className="text-xs text-purple-600 dark:text-purple-500">Permission Asked</div>
                  <div className="text-[10px] text-muted-foreground mt-1">awaiting reply</div>
                </div>
                
                <ArrowRight className="w-6 h-6 self-center justify-self-center text-muted-foreground hidden md:block" />
                
                {/* Step 4: Link Sent */}
                <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950/30 dark:to-cyan-900/20 rounded-lg p-4 text-center border border-cyan-200 dark:border-cyan-800">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 text-cyan-500" />
                  <div className="text-2xl font-bold text-cyan-700 dark:text-cyan-400">{linkSent}</div>
                  <div className="text-xs text-cyan-600 dark:text-cyan-500">Link Sent</div>
                  <div className="text-[10px] text-muted-foreground mt-1">review link delivered</div>
                </div>
                
                <ArrowRight className="w-6 h-6 self-center justify-self-center text-muted-foreground hidden md:block" />
                
                {/* Step 5: Completed */}
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/20 rounded-lg p-4 text-center border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                  <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{completedCount}</div>
                  <div className="text-xs text-emerald-600 dark:text-emerald-500">Completed</div>
                  <div className="text-[10px] text-muted-foreground mt-1">Google review left</div>
                </div>
              </div>
              
              {/* Conversion Rate Bar */}
              <div className="mt-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Conversion Rate</span>
                  <span className="text-sm font-bold text-emerald-600">{conversionRate}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-3">
                  <div 
                    className="bg-gradient-to-r from-emerald-400 to-emerald-600 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${conversionRate}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status Breakdown */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-amber-200 dark:border-amber-800">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                  Missing Phone
                </CardDescription>
                <CardTitle className="text-2xl text-amber-600">{reviewsWithoutPhone}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Reviews without contact info</p>
              </CardContent>
            </Card>
            
            <Card className="border-red-200 dark:border-red-800">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <XCircle className="w-3 h-3 text-red-500" />
                  Ignored/Timeout
                </CardDescription>
                <CardTitle className="text-2xl text-red-600">{ignoredCount}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">No response after nudges</p>
              </CardContent>
            </Card>
            
            <Card className="border-destructive/50">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <Ban className="w-3 h-3 text-destructive" />
                  Opted Out
                </CardDescription>
                <CardTitle className="text-2xl text-destructive">{optedOutCount}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Unsubscribed from SMS</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <Inbox className="w-3 h-3" />
                  Inbound Messages
                </CardDescription>
                <CardTitle className="text-2xl">{allInboundMessages.length}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Guest replies received</p>
              </CardContent>
            </Card>
          </div>

          {/* Workflow Steps Explanation */}
          <Card>
            <CardHeader>
              <CardTitle>How the Workflow Works</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 font-bold shrink-0">1</div>
                  <div>
                    <h4 className="font-medium">Wait 30 Minutes + Time Window</h4>
                    <p className="text-sm text-muted-foreground">After 5-star review is received, wait to avoid looking robotic. SMS only sent between <strong>11am-3pm EST</strong> to feel personal.</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 font-bold shrink-0">2</div>
                  <div>
                    <h4 className="font-medium">Permission Request (SMS #1)</h4>
                    <p className="text-sm text-muted-foreground italic">"Thanks again for the wonderful {'{'}ReviewSource{'}'} review — it truly means a lot. Google reviews help future guests trust us when booking directly. If you're open to it, I can send you a link plus a copy of your original review so you can paste it in seconds. Would that be okay?"</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-full bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center text-cyan-600 font-bold shrink-0">3</div>
                  <div>
                    <h4 className="font-medium">Permission Granted → Deliver Package (SMS #2 & #3)</h4>
                    <p className="text-sm text-muted-foreground">Any reply = YES. Send: <span className="italic">"Amazing — thank you! Here's the direct link to leave the Google review: {'{'}GoogleURL{'}'}"</span> + <span className="italic">"And here's the text of your {'{'}Source{'}'} review so you can copy/paste..."</span></p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 font-bold shrink-0">4</div>
                  <div>
                    <h4 className="font-medium">Nudge & Final Reminder</h4>
                    <p className="text-sm text-muted-foreground">If no reply in 48h: <span className="italic">"Just checking in real quick — no pressure at all..."</span> After another 48h silence: tag as ignored. If link sent but not clicked in 72h: <span className="italic">"Just a friendly bump in case life got busy..."</span> Max 3 outbound messages total. Guests can reply STOP anytime.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* REVIEW QUEUE TAB */}
        <TabsContent value="queue" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>5-Star Review Queue</CardTitle>
              <CardDescription>
                Airbnb and VRBO reviews eligible for Google Review conversion · {totalReviews} with phone numbers
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : reviews.length === 0 ? (
                <div className="text-center py-12">
                  <Star className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">
                    No 5-star reviews found. Click "Sync Reviews" to fetch from OwnerRez.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Guest</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reviews.map((review) => {
                      const request = getRequestForReview(review.id);
                      const hasPhone = !!review.guest_phone;

                      return (
                        <TableRow key={review.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{review.guest_name || "Unknown"}</p>
                              {review.guest_phone ? (
                                <p className="text-xs text-muted-foreground">{review.guest_phone}</p>
                              ) : (
                                <p className="text-xs text-amber-600 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" /> No phone
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{review.review_source}</Badge>
                          </TableCell>
                          <TableCell>
                            {review.review_date
                              ? format(new Date(review.review_date), "MMM d, yyyy")
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {request ? getStatusBadge(request.workflow_status, request.opted_out) : getStatusBadge("pending")}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedReview(review)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              {!request && hasPhone && (
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    onClick={() => sendPermissionSms(review.id, false)}
                                  >
                                    <Send className="w-4 h-4 mr-1" />
                                    Ask
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => sendPermissionSms(review.id, true)}
                                    title="Send immediately (ignores 11am-3pm EST window)"
                                  >
                                    Force
                                  </Button>
                                </div>
                              )}
                              {!hasPhone && !request && (
                                <Badge variant="outline" className="text-amber-600 border-amber-300">No Phone</Badge>
                              )}
                              {request && !request.opted_out && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => viewSmsHistory(request.id)}
                                  >
                                    <MessageSquare className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setOptOutConfirm(request.id)}
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Ban className="w-4 h-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SMS INBOX TAB */}
        <TabsContent value="inbox" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Inbox className="w-5 h-5" />
                SMS Inbox
              </CardTitle>
              <CardDescription>
                Inbound messages from guests · {allInboundMessages.length} messages
              </CardDescription>
            </CardHeader>
            <CardContent>
              {allInboundMessages.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-30 text-muted-foreground" />
                  <p className="text-muted-foreground">No inbound messages yet</p>
                  <p className="text-sm text-muted-foreground">Guest replies will appear here when they respond to SMS messages</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {allInboundMessages.map((msg) => {
                    const associatedReview = reviews.find(r => r.guest_phone === msg.phone_number);
                    const associatedRequest = requests.find(r => r.guest_phone === msg.phone_number);
                    
                    return (
                      <div 
                        key={msg.id} 
                        className={`border rounded-lg p-4 transition-colors ${
                          msg.message_type === "inbound_opt_out" ? "bg-destructive/5 border-destructive/20" :
                          msg.message_type === "inbound_reply" ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800" :
                          "bg-muted/30"
                        }`}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {associatedReview?.guest_name || "Unknown Guest"}
                              </span>
                              <Badge variant={
                                msg.message_type === "inbound_opt_out" ? "destructive" :
                                msg.message_type === "inbound_reply" ? "default" : "secondary"
                              } className="text-xs">
                                {msg.message_type === "inbound_reply" ? "Reply" :
                                 msg.message_type === "inbound_opt_out" ? "Opted Out" :
                                 msg.message_type === "inbound_resubscribe" ? "Resubscribed" :
                                 "Unmatched"}
                              </Badge>
                            </div>
                            <span className="text-xs text-muted-foreground">{msg.phone_number}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(msg.created_at), "MMM d, h:mm a")}
                          </span>
                        </div>
                        <div className="bg-background rounded-md p-3 border">
                          <p className="text-sm">{msg.message_body}</p>
                        </div>
                        {associatedRequest && (
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Status:</span>
                            {getStatusBadge(associatedRequest.workflow_status, associatedRequest.opted_out)}
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 text-xs"
                              onClick={() => viewSmsHistory(associatedRequest.id)}
                            >
                              View Thread
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* OPTED OUT TAB */}
        <TabsContent value="optedout" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserX className="w-5 h-5" />
                Opted Out Guests
              </CardTitle>
              <CardDescription>
                Guests who have unsubscribed from Google Review SMS outreach · {optedOutCount} guests
              </CardDescription>
            </CardHeader>
            <CardContent>
              {optedOutRequests.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-30 text-emerald-500" />
                  <p className="text-muted-foreground">No opted-out guests</p>
                  <p className="text-sm text-muted-foreground">Guests who reply "STOP" will appear here</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Guest</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Opted Out</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {optedOutRequests.map((request) => {
                      const review = getReviewForRequest(request.review_id);
                      
                      return (
                        <TableRow key={request.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{review?.guest_name || "Unknown"}</p>
                              <p className="text-xs text-muted-foreground">{review?.review_source}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs">{request.guest_phone}</code>
                          </TableCell>
                          <TableCell>
                            {request.opted_out_at 
                              ? format(new Date(request.opted_out_at), "MMM d, yyyy h:mm a")
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => viewSmsHistory(request.id)}
                              >
                                <MessageSquare className="w-4 h-4 mr-1" />
                                History
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setResubscribeConfirm(request.id)}
                              >
                                <RotateCcw className="w-4 h-4 mr-1" />
                                Resubscribe
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Opt-out Info */}
          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-amber-700 dark:text-amber-400">How Opt-Out Works</h4>
                  <p className="text-sm text-amber-600 dark:text-amber-500 mt-1">
                    Guests can reply "STOP" to any SMS to opt out. They will receive a confirmation message and be added to this list.
                    No further messages will be sent until they are manually resubscribed. Respecting opt-outs is legally required (TCPA compliance).
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Review Detail Dialog */}
      <Dialog open={!!selectedReview} onOpenChange={() => setSelectedReview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Details</DialogTitle>
            <DialogDescription>
              {selectedReview?.review_source} review from {selectedReview?.guest_name}
            </DialogDescription>
          </DialogHeader>
          {selectedReview && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <div className="bg-muted rounded-lg p-4">
                <p className="text-sm italic">"{selectedReview.review_text || "No review text available"}"</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Guest:</span>
                  <p className="font-medium">{selectedReview.guest_name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Phone:</span>
                  <p className="font-medium">{selectedReview.guest_phone || "Not available"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Source:</span>
                  <p className="font-medium">{selectedReview.review_source}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Date:</span>
                  <p className="font-medium">
                    {selectedReview.review_date 
                      ? format(new Date(selectedReview.review_date), "MMM d, yyyy")
                      : "-"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* SMS History Dialog */}
      <Dialog open={smsDialogOpen} onOpenChange={setSmsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>SMS Conversation</DialogTitle>
            <DialogDescription>
              Message history for this guest
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-96">
            {smsLogs.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No messages yet</p>
            ) : (
              <div className="space-y-3">
                {smsLogs.map((log) => (
                  <div 
                    key={log.id} 
                    className={`p-3 rounded-lg ${
                      log.message_type.startsWith("inbound") 
                        ? "bg-muted ml-0 mr-8" 
                        : "bg-primary/10 ml-8 mr-0"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <Badge variant="outline" className="text-xs">
                        {log.message_type.replace(/_/g, " ")}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(log.created_at), "MMM d, h:mm a")}
                      </span>
                    </div>
                    <p className="text-sm">{log.message_body}</p>
                    {log.status !== "delivered" && log.status !== "received" && (
                      <Badge variant="destructive" className="mt-2 text-xs">{log.status}</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Opt-Out Confirmation Dialog */}
      <AlertDialog open={!!optOutConfirm} onOpenChange={() => setOptOutConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Opt Out Guest?</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop all future SMS messages to this guest. They will be added to the Opted Out list and can be resubscribed later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => optOutConfirm && optOutGuest(optOutConfirm)}>
              Opt Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Resubscribe Confirmation Dialog */}
      <AlertDialog open={!!resubscribeConfirm} onOpenChange={() => setResubscribeConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resubscribe Guest?</AlertDialogTitle>
            <AlertDialogDescription>
              This will allow SMS messages to be sent to this guest again. Make sure you have their consent before resubscribing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => resubscribeConfirm && resubscribeGuest(resubscribeConfirm)}>
              Resubscribe
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default GoogleReviewsTab;
