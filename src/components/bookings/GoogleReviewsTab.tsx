import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, Star, MessageSquare, Send, CheckCircle, Clock, XCircle, Eye } from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  completed_at: string | null;
  nudge_count: number;
  created_at: string;
}

interface SmsLog {
  id: string;
  request_id: string;
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
  const [selectedReview, setSelectedReview] = useState<OwnerrezReview | null>(null);
  const [smsLogs, setSmsLogs] = useState<SmsLog[]>([]);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [reviewsResult, requestsResult] = await Promise.all([
        supabase
          .from("ownerrez_reviews")
          .select("*")
          .order("review_date", { ascending: false }),
        supabase
          .from("google_review_requests")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);

      if (reviewsResult.error) throw reviewsResult.error;
      if (requestsResult.error) throw requestsResult.error;

      setReviews(reviewsResult.data || []);
      setRequests(requestsResult.data || []);
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

  const sendPermissionSms = async (reviewId: string) => {
    try {
      toast.loading("Sending permission SMS...");

      const { data, error } = await supabase.functions.invoke("send-review-sms", {
        body: { reviewId, action: "permission_ask" },
      });

      if (error) throw error;

      toast.dismiss();
      toast.success("Permission SMS sent successfully");
      await loadData();
    } catch (error: any) {
      console.error("SMS error:", error);
      toast.dismiss();
      toast.error(error.message || "Failed to send SMS");
    }
  };

  const viewSmsHistory = async (requestId: string) => {
    try {
      const { data, error } = await supabase
        .from("sms_log")
        .select("*")
        .eq("request_id", requestId)
        .order("created_at", { ascending: false });

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

  const getStatusBadge = (status: string) => {
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

  // Stats calculations
  const totalReviews = reviews.length;
  const pendingCount = reviews.filter((r) => !getRequestForReview(r.id)).length;
  const inProgressCount = requests.filter((r) => 
    ["permission_asked", "permission_granted", "link_sent"].includes(r.workflow_status)
  ).length;
  const completedCount = requests.filter((r) => r.workflow_status === "completed").length;
  const conversionRate = totalReviews > 0 ? Math.round((completedCount / totalReviews) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Dashboard Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total 5-Star Reviews</CardDescription>
            <CardTitle className="text-2xl">{totalReviews}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending Outreach</CardDescription>
            <CardTitle className="text-2xl text-amber-600">{pendingCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>In Progress</CardDescription>
            <CardTitle className="text-2xl text-blue-600">{inProgressCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Conversion Rate</CardDescription>
            <CardTitle className="text-2xl text-emerald-600">{conversionRate}%</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex justify-end">
        <Button onClick={syncReviews} disabled={syncing} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing..." : "Sync Reviews from OwnerRez"}
        </Button>
      </div>

      {/* Reviews Table */}
      <Card>
        <CardHeader>
          <CardTitle>5-Star Review Queue</CardTitle>
          <CardDescription>
            Airbnb and VRBO reviews eligible for Google Review conversion
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
                          {review.guest_phone && (
                            <p className="text-xs text-muted-foreground">{review.guest_phone}</p>
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
                        {request ? getStatusBadge(request.workflow_status) : getStatusBadge("pending")}
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
                            <Button
                              size="sm"
                              onClick={() => sendPermissionSms(review.id)}
                            >
                              <Send className="w-4 h-4 mr-1" />
                              Ask
                            </Button>
                          )}
                          {!hasPhone && !request && (
                            <Badge variant="destructive">No Phone</Badge>
                          )}
                          {request && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => viewSmsHistory(request.id)}
                            >
                              <MessageSquare className="w-4 h-4" />
                            </Button>
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
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-5 h-5 ${
                      star <= (selectedReview.star_rating || 0)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-300"
                    }`}
                  />
                ))}
              </div>
              <ScrollArea className="max-h-[300px]">
                <p className="text-sm whitespace-pre-wrap">
                  {selectedReview.review_text || "No review text available"}
                </p>
              </ScrollArea>
              <div className="text-xs text-muted-foreground">
                Reviewed on:{" "}
                {selectedReview.review_date
                  ? format(new Date(selectedReview.review_date), "PPP")
                  : "Unknown date"}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* SMS History Dialog */}
      <Dialog open={smsDialogOpen} onOpenChange={setSmsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>SMS History</DialogTitle>
            <DialogDescription>All messages sent for this review conversion</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-4">
              {smsLogs.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No SMS messages sent yet</p>
              ) : (
                smsLogs.map((log) => (
                  <div key={log.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex justify-between items-start">
                      <Badge variant="outline">{log.message_type.replace(/_/g, " ")}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(log.created_at), "MMM d, h:mm a")}
                      </span>
                    </div>
                    <p className="text-sm">{log.message_body}</p>
                    <Badge variant={log.status === "sent" ? "default" : "destructive"}>
                      {log.status}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GoogleReviewsTab;
