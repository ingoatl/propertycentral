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
  UserX, Phone, Inbox, Ban, RotateCcw, Pause, Play, PhoneCall
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

const GOOGLE_REVIEWS_PHONE = "+14046090955";

const GoogleReviewsTab = () => {
  const [reviews, setReviews] = useState<OwnerrezReview[]>([]);
  const [requests, setRequests] = useState<GoogleReviewRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedReview, setSelectedReview] = useState<OwnerrezReview | null>(null);
  const [smsLogs, setSmsLogs] = useState<SmsLog[]>([]);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [allInboundMessages, setAllInboundMessages] = useState<SmsLog[]>([]);
  const [activeTab, setActiveTab] = useState("inbox");
  const [optOutConfirm, setOptOutConfirm] = useState<string | null>(null);
  const [resubscribeConfirm, setResubscribeConfirm] = useState<string | null>(null);
  const [campaignPaused, setCampaignPaused] = useState(true);

  useEffect(() => {
    loadData();
    
    const channel = supabase
      .channel('sms-log-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sms_log'
        },
        (payload) => {
          const newMessage = payload.new as SmsLog;
          if (newMessage.message_type?.startsWith('inbound')) {
            setAllInboundMessages(prev => [newMessage, ...prev]);
            toast.info(`New SMS from ${newMessage.phone_number}`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
          .in("message_type", ["inbound_reply", "inbound_opt_out", "inbound_resubscribe", "inbound_unmatched", "inbound_unmatched_reviews"])
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
      toast.dismiss();
      toast.error("Failed to sync reviews");
    } finally {
      setSyncing(false);
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
        toast.error("Outside send window (11am-3pm EST). Use 'Force' to override.");
        return;
      }
      
      toast.success("Permission SMS sent");
      await loadData();
    } catch (error: any) {
      toast.dismiss();
      toast.error(error.message || "Failed to send SMS");
    }
  };

  const sendTestSms = async (forceTime: boolean = false) => {
    try {
      setSendingTest(true);
      toast.loading("Sending test SMS to Ingo...");
      const { data, error } = await supabase.functions.invoke("send-review-sms", {
        body: { action: "test", forceTime },
      });
      if (error) throw error;
      toast.dismiss();
      toast.success("Test SMS sent to Ingo (770) 906-5022 — Reply to test automation!");
    } catch (error: any) {
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
      toast.success("Guest opted out");
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
      toast.success("Guest resubscribed");
      await loadData();
    } catch (error: any) {
      toast.error("Failed to resubscribe guest");
    }
    setResubscribeConfirm(null);
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
      return <Badge variant="destructive" className="gap-1"><Ban className="w-3 h-3" />Opted Out</Badge>;
    }
    
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
      pending: { variant: "secondary", icon: Clock },
      permission_asked: { variant: "outline", icon: Send },
      permission_granted: { variant: "default", icon: CheckCircle },
      link_sent: { variant: "default", icon: MessageSquare },
      completed: { variant: "default", icon: Star },
      ignored: { variant: "destructive", icon: XCircle },
    };

    const config = statusConfig[status] || { variant: "secondary" as const, icon: Clock };
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="w-3 h-3" />
        {status.replace(/_/g, " ")}
      </Badge>
    );
  };

  // Stats
  const totalReviews = reviews.filter(r => r.guest_phone).length;
  const pendingOutreach = reviews.filter(r => r.guest_phone && !getRequestForReview(r.id)).length;
  const permissionAsked = requests.filter(r => r.workflow_status === "permission_asked" && !r.opted_out).length;
  const completedCount = requests.filter(r => r.workflow_status === "completed").length;
  const optedOutCount = requests.filter(r => r.opted_out).length;
  const optedOutRequests = requests.filter(r => r.opted_out);

  const formatPhone = (phone: string) => {
    return phone.replace(/^\+1/, '').replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
  };

  return (
    <div className="space-y-4">
      {/* Header with phone number and actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-muted/50 rounded-lg border">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-full">
            <PhoneCall className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">Google Reviews SMS Line</p>
            <p className="text-sm text-muted-foreground font-mono">{formatPhone(GOOGLE_REVIEWS_PHONE)}</p>
          </div>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <Button 
            variant={campaignPaused ? "destructive" : "default"}
            onClick={() => setCampaignPaused(!campaignPaused)} 
            size="sm"
            className={campaignPaused ? "" : "bg-emerald-600 hover:bg-emerald-700"}
          >
            {campaignPaused ? <><Pause className="w-4 h-4 mr-1" />Paused</> : <><Play className="w-4 h-4 mr-1" />Active</>}
          </Button>
          <Button variant="outline" onClick={() => sendTestSms(false)} disabled={sendingTest} size="sm">
            <Send className={`w-4 h-4 mr-1 ${sendingTest ? "animate-pulse" : ""}`} />
            Test SMS
          </Button>
          <Button variant="secondary" onClick={() => sendTestSms(true)} disabled={sendingTest} size="sm" title="Bypass time window">
            Force Test
          </Button>
          <Button onClick={syncReviews} disabled={syncing} size="sm">
            <RefreshCw className={`w-4 h-4 mr-1 ${syncing ? "animate-spin" : ""}`} />
            Sync
          </Button>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-5 gap-2">
        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-center border border-amber-200 dark:border-amber-800">
          <div className="text-xl font-bold text-amber-700 dark:text-amber-400">{totalReviews}</div>
          <div className="text-xs text-amber-600">5-Star</div>
        </div>
        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-center border border-blue-200 dark:border-blue-800">
          <div className="text-xl font-bold text-blue-700 dark:text-blue-400">{pendingOutreach}</div>
          <div className="text-xs text-blue-600">Ready</div>
        </div>
        <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg text-center border border-purple-200 dark:border-purple-800">
          <div className="text-xl font-bold text-purple-700 dark:text-purple-400">{permissionAsked}</div>
          <div className="text-xs text-purple-600">Asked</div>
        </div>
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg text-center border border-emerald-200 dark:border-emerald-800">
          <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{completedCount}</div>
          <div className="text-xs text-emerald-600">Done</div>
        </div>
        <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg text-center border border-red-200 dark:border-red-800">
          <div className="text-xl font-bold text-red-700 dark:text-red-400">{optedOutCount}</div>
          <div className="text-xs text-red-600">Opted Out</div>
        </div>
      </div>

      {/* Campaign paused warning */}
      {campaignPaused && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-center gap-2">
          <Pause className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Campaign paused. Use "Force" button in Queue to test individual messages.
          </p>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="inbox" className="gap-1">
            <Inbox className="w-4 h-4" />
            Inbox {allInboundMessages.length > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5">{allInboundMessages.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="queue" className="gap-1">
            <Phone className="w-4 h-4" />
            Queue
          </TabsTrigger>
          <TabsTrigger value="optedout" className="gap-1">
            <UserX className="w-4 h-4" />
            Opted Out {optedOutCount > 0 && `(${optedOutCount})`}
          </TabsTrigger>
        </TabsList>

        {/* INBOX TAB */}
        <TabsContent value="inbox" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Inbox className="w-5 h-5" />
                SMS Inbox
              </CardTitle>
              <CardDescription>
                Guest replies to {formatPhone(GOOGLE_REVIEWS_PHONE)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {allInboundMessages.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30 text-muted-foreground" />
                  <p className="text-muted-foreground">No messages yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Guest replies will appear here</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {allInboundMessages.map((msg) => {
                    const associatedRequest = requests.find(r => r.guest_phone === msg.phone_number);
                    const associatedReview = reviews.find(r => r.guest_phone === msg.phone_number);
                    
                    return (
                      <div key={msg.id} className="p-3 bg-muted/50 rounded-lg border">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {associatedReview?.guest_name || formatPhone(msg.phone_number)}
                            </span>
                            <Badge variant={
                              msg.message_type === "inbound_opt_out" ? "destructive" :
                              msg.message_type === "inbound_reply" ? "default" : "secondary"
                            } className="text-xs">
                              {msg.message_type === "inbound_reply" ? "Reply" :
                               msg.message_type === "inbound_opt_out" ? "Opt Out" :
                               msg.message_type === "inbound_resubscribe" ? "Resubscribed" : "New"}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(msg.created_at), "MMM d, h:mm a")}
                          </span>
                        </div>
                        <p className="text-sm bg-background rounded p-2 border">{msg.message_body}</p>
                        {associatedRequest && (
                          <div className="mt-2 flex items-center gap-2">
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

        {/* QUEUE TAB */}
        <TabsContent value="queue" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Review Queue</CardTitle>
              <CardDescription>{totalReviews} reviews with phone numbers</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : reviews.length === 0 ? (
                <div className="text-center py-8">
                  <Star className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
                  <p className="text-muted-foreground">No reviews. Click "Sync" to fetch from OwnerRez.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Guest</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reviews.slice(0, 20).map((review) => {
                      const request = getRequestForReview(review.id);
                      const hasPhone = !!review.guest_phone;

                      return (
                        <TableRow key={review.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{review.guest_name || "Unknown"}</p>
                              {review.guest_phone ? (
                                <p className="text-xs text-muted-foreground font-mono">{formatPhone(review.guest_phone)}</p>
                              ) : (
                                <p className="text-xs text-amber-600">No phone</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{review.review_source}</Badge>
                          </TableCell>
                          <TableCell>
                            {request ? getStatusBadge(request.workflow_status, request.opted_out) : getStatusBadge("pending")}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button variant="ghost" size="sm" onClick={() => setSelectedReview(review)}>
                                <Eye className="w-4 h-4" />
                              </Button>
                              {!request && hasPhone && (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => sendPermissionSms(review.id, false)}
                                    disabled={campaignPaused}
                                    title={campaignPaused ? "Paused" : "Send"}
                                  >
                                    <Send className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => sendPermissionSms(review.id, true)}
                                    title="Force send (bypasses pause)"
                                  >
                                    Force
                                  </Button>
                                </>
                              )}
                              {request && !request.opted_out && (
                                <>
                                  <Button variant="ghost" size="sm" onClick={() => viewSmsHistory(request.id)}>
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

        {/* OPTED OUT TAB */}
        <TabsContent value="optedout" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <UserX className="w-5 h-5" />
                Opted Out
              </CardTitle>
              <CardDescription>{optedOutCount} guests unsubscribed</CardDescription>
            </CardHeader>
            <CardContent>
              {optedOutRequests.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-10 h-10 mx-auto mb-3 opacity-30 text-emerald-500" />
                  <p className="text-muted-foreground">No opted-out guests</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Guest</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {optedOutRequests.map((request) => {
                      const review = getReviewForRequest(request.review_id);
                      
                      return (
                        <TableRow key={request.id}>
                          <TableCell>
                            <p className="font-medium text-sm">{review?.guest_name || "Unknown"}</p>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs">{formatPhone(request.guest_phone)}</code>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {request.opted_out_at ? format(new Date(request.opted_out_at), "MMM d, yyyy") : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button variant="ghost" size="sm" onClick={() => viewSmsHistory(request.id)}>
                                <MessageSquare className="w-4 h-4" />
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => setResubscribeConfirm(request.id)}>
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
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <div className="bg-muted rounded-lg p-3">
                <p className="text-sm italic">"{selectedReview.review_text || "No text"}"</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Phone:</span>
                  <p className="font-medium">{selectedReview.guest_phone ? formatPhone(selectedReview.guest_phone) : "N/A"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Date:</span>
                  <p className="font-medium">
                    {selectedReview.review_date ? format(new Date(selectedReview.review_date), "MMM d, yyyy") : "-"}
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
            <DialogTitle>SMS Thread</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-80">
            {smsLogs.length === 0 ? (
              <p className="text-muted-foreground text-center py-6">No messages</p>
            ) : (
              <div className="space-y-2">
                {smsLogs.map((log) => (
                  <div 
                    key={log.id} 
                    className={`p-2 rounded-lg text-sm ${
                      log.message_type.startsWith("inbound") 
                        ? "bg-muted ml-0 mr-8" 
                        : "bg-primary/10 ml-8 mr-0"
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <Badge variant="outline" className="text-xs h-5">
                        {log.message_type.replace(/_/g, " ")}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(log.created_at), "MMM d, h:mm a")}
                      </span>
                    </div>
                    <p>{log.message_body}</p>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Opt-Out Confirmation */}
      <AlertDialog open={!!optOutConfirm} onOpenChange={() => setOptOutConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Opt Out Guest?</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop all future SMS messages to this guest.
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

      {/* Resubscribe Confirmation */}
      <AlertDialog open={!!resubscribeConfirm} onOpenChange={() => setResubscribeConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resubscribe Guest?</AlertDialogTitle>
            <AlertDialogDescription>
              This will allow SMS messages to be sent to this guest again.
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
