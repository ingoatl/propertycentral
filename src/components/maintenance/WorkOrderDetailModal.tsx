import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { 
  MapPin, User, Clock, DollarSign, Wrench, Send, 
  CheckCircle, AlertTriangle, Phone, Mail, Calendar,
  RotateCcw, ExternalLink, Loader2
} from "lucide-react";
import { 
  WorkOrder, WorkOrderStatus, WorkOrderTimeline, MaintenanceMessage,
  STATUS_CONFIG, URGENCY_CONFIG, WORK_ORDER_CATEGORIES, Vendor 
} from "@/types/maintenance";

interface WorkOrderDetailModalProps {
  workOrderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

const WorkOrderDetailModal = ({ 
  workOrderId, 
  open, 
  onOpenChange, 
  onUpdate 
}: WorkOrderDetailModalProps) => {
  const [newMessage, setNewMessage] = useState("");
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [notifySms, setNotifySms] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [isNotifying, setIsNotifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const queryClient = useQueryClient();

  // Fetch the complete work order data
  const { data: workOrder, isLoading: workOrderLoading } = useQuery({
    queryKey: ["work-order-detail", workOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_orders")
        .select(`
          *,
          property:properties(id, name, address),
          assigned_vendor:vendors!work_orders_assigned_vendor_id_fkey(id, name, company_name, phone, email)
        `)
        .eq("id", workOrderId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: open && !!workOrderId,
  });

  const statusConfig = workOrder ? STATUS_CONFIG[workOrder.status as WorkOrderStatus] : null;
  const urgencyConfig = workOrder ? URGENCY_CONFIG[workOrder.urgency as keyof typeof URGENCY_CONFIG] : null;
  const category = workOrder ? WORK_ORDER_CATEGORIES.find(c => c.value === workOrder.category) : null;

  // Fetch timeline
  const { data: timeline = [] } = useQuery({
    queryKey: ["work-order-timeline", workOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_order_timeline")
        .select("*")
        .eq("work_order_id", workOrderId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as WorkOrderTimeline[];
    },
    enabled: open && !!workOrderId,
  });

  // Fetch messages
  const { data: messages = [] } = useQuery({
    queryKey: ["work-order-messages", workOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_messages")
        .select("*")
        .eq("work_order_id", workOrderId)
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      return data as MaintenanceMessage[];
    },
    enabled: open && !!workOrderId,
  });

  // Fetch vendors for assignment (all active vendors, preferred ones first, matching category highlighted)
  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors-for-assignment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("*")
        .in("status", ["active", "preferred"])
        .order("status", { ascending: false })
        .order("name", { ascending: true });
      
      if (error) throw error;
      return data as Vendor[];
    },
  });

  // Separate vendors by category match for display
  const matchingVendors = vendors.filter(v => workOrder?.category && v.specialty?.includes(workOrder.category));
  const otherVendors = vendors.filter(v => !workOrder?.category || !v.specialty?.includes(workOrder.category));

  // Update status
  const updateStatus = useMutation({
    mutationFn: async (newStatus: WorkOrderStatus) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("work_orders")
        .update({ 
          status: newStatus,
          ...(newStatus === "completed" ? { completed_at: new Date().toISOString() } : {})
        })
        .eq("id", workOrderId);

      if (error) throw error;

      await supabase.from("work_order_timeline").insert({
        work_order_id: workOrderId,
        action: `Status changed to ${STATUS_CONFIG[newStatus].label}`,
        performed_by_type: "pm",
        performed_by_name: user?.email,
        performed_by_user_id: user?.id,
        previous_status: workOrder?.status,
        new_status: newStatus,
      });
    },
    onSuccess: () => {
      toast.success("Status updated");
      onUpdate();
      queryClient.invalidateQueries({ queryKey: ["work-order-detail", workOrderId] });
      queryClient.invalidateQueries({ queryKey: ["work-order-timeline", workOrderId] });
    },
    onError: (error) => {
      toast.error("Failed to update: " + error.message);
    },
  });

  // Assign vendor and notify
  const assignVendor = useMutation({
    mutationFn: async (vendorId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const vendor = vendors.find(v => v.id === vendorId);
      
      const { error } = await supabase
        .from("work_orders")
        .update({ 
          assigned_vendor_id: vendorId,
          assigned_by: user?.id,
          assigned_at: new Date().toISOString(),
          status: "dispatched"
        })
        .eq("id", workOrderId);

      if (error) throw error;

      await supabase.from("work_order_timeline").insert({
        work_order_id: workOrderId,
        action: `Assigned to vendor: ${vendor?.name}`,
        performed_by_type: "pm",
        performed_by_name: user?.email,
        performed_by_user_id: user?.id,
        previous_status: workOrder?.status,
        new_status: "dispatched",
      });

      // Notify vendor via SMS and/or Email
      const notifyMethods: string[] = [];
      if (notifySms) notifyMethods.push("sms");
      if (notifyEmail) notifyMethods.push("email");

      if (notifyMethods.length > 0) {
        setIsNotifying(true);
        try {
          const { data, error: notifyError } = await supabase.functions.invoke("notify-vendor-work-order", {
            body: { 
              workOrderId: workOrderId, 
              vendorId,
              notifyMethods 
            },
          });

          if (notifyError) {
            console.error("Notification error:", notifyError);
            toast.warning("Vendor assigned but notification failed");
          } else if (data?.success) {
            toast.success(data.message);
          }
        } catch (e) {
          console.error("Failed to notify vendor:", e);
        } finally {
          setIsNotifying(false);
        }
      }
    },
    onSuccess: () => {
      toast.success("Vendor assigned successfully");
      onUpdate();
      setSelectedVendorId(null);
      queryClient.invalidateQueries({ queryKey: ["work-order-detail", workOrderId] });
      queryClient.invalidateQueries({ queryKey: ["work-order-timeline", workOrderId] });
    },
    onError: (error) => {
      toast.error("Failed to assign: " + error.message);
    },
  });

  // Send message
  const sendMessage = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.from("maintenance_messages").insert({
        work_order_id: workOrderId,
        sender_type: "pm",
        sender_name: user?.email || "Property Manager",
        sender_user_id: user?.id,
        message_text: newMessage,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["work-order-messages", workOrderId] });
    },
    onError: (error) => {
      toast.error("Failed to send: " + error.message);
    },
  });

  // Resend work order link to vendor
  const resendVendorLink = async () => {
    if (!workOrder?.id || !workOrder?.assigned_vendor_id) {
      toast.error("No vendor assigned");
      return;
    }
    
    setIsResending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Generate new vendor access token
      const newToken = crypto.randomUUID();
      const { error: updateError } = await supabase
        .from("work_orders")
        .update({ 
          vendor_access_token: newToken,
          vendor_access_token_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
        })
        .eq("id", workOrder.id);

      if (updateError) throw updateError;

      // Notify vendor via SMS
      const { data, error: notifyError } = await supabase.functions.invoke("notify-vendor-work-order", {
        body: { 
          workOrderId: workOrder.id, 
          vendorId: workOrder.assigned_vendor_id,
          notifyMethods: ["sms"]
        },
      });

      if (notifyError) throw notifyError;

      // Log to timeline
      await supabase.from("work_order_timeline").insert({
        work_order_id: workOrder.id,
        action: `Resent job portal link to ${workOrder.assigned_vendor?.name}`,
        performed_by_type: "pm",
        performed_by_name: user?.email,
        performed_by_user_id: user?.id,
      });

      toast.success("Work order link resent to vendor!");
      queryClient.invalidateQueries({ queryKey: ["work-order-timeline", workOrderId] });
    } catch (error: any) {
      toast.error("Failed to resend: " + error.message);
    } finally {
      setIsResending(false);
    }
  };

  const getSenderBadgeColor = (type: string) => {
    switch (type) {
      case 'owner': return 'bg-muted text-foreground border border-border';
      case 'vendor': return 'bg-muted text-foreground border border-border';
      case 'guest': return 'bg-muted text-foreground border border-border';
      case 'ai': return 'bg-muted text-foreground border border-border';
      case 'system': return 'bg-muted text-foreground border border-border';
      default: return 'bg-muted text-foreground border border-border';
    }
  };

  if (workOrderLoading || !workOrder) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-background">
        <DialogHeader className="pb-4 border-b border-border">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                <Wrench className="h-5 w-5 text-foreground" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold text-foreground">{workOrder.title}</DialogTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {workOrder.property?.name || workOrder.property?.address}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {statusConfig && (
                <Badge variant="outline" className="font-medium">
                  {statusConfig.label}
                </Badge>
              )}
              {urgencyConfig && (
                <Badge variant="outline" className="font-medium">
                  {urgencyConfig.label}
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="details" className="mt-4">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="messages">Messages ({messages.length})</TabsTrigger>
            <TabsTrigger value="timeline">Timeline ({timeline.length})</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
          </TabsList>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-6 mt-4">
            <div className="grid grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-5">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Description</Label>
                  <p className="mt-2 text-foreground">{workOrder.description || 'No description provided'}</p>
                </div>

                <div>
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Category</Label>
                  <p className="mt-2 text-foreground">{category?.label || 'Unknown'}</p>
                </div>

                <div>
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Source</Label>
                  <p className="mt-2 capitalize text-foreground">{workOrder.source?.replace(/_/g, ' ') || 'Unknown'}</p>
                </div>

                {workOrder.reported_by && (
                  <div>
                    <Label className="text-muted-foreground">Reported By</Label>
                    <div className="mt-1 space-y-1">
                      <p className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {workOrder.reported_by}
                      </p>
                      {workOrder.reported_by_email && (
                        <p className="flex items-center gap-2 text-sm">
                          <Mail className="h-3.5 w-3.5" />
                          {workOrder.reported_by_email}
                        </p>
                      )}
                      {workOrder.reported_by_phone && (
                        <p className="flex items-center gap-2 text-sm">
                          <Phone className="h-3.5 w-3.5" />
                          {workOrder.reported_by_phone}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Created</Label>
                  <p className="mt-1 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {format(new Date(workOrder.created_at), "MMM d, yyyy h:mm a")}
                  </p>
                </div>

                {workOrder.assigned_vendor && (
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Assigned Vendor</Label>
                    <div className="mt-2 p-4 bg-muted/50 rounded-lg border border-border">
                      <p className="font-semibold text-foreground">{workOrder.assigned_vendor.name}</p>
                      {workOrder.assigned_vendor.company_name && (
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {workOrder.assigned_vendor.company_name}
                        </p>
                      )}
                      <p className="text-sm mt-2 flex items-center gap-2 text-foreground">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        {workOrder.assigned_vendor.phone}
                      </p>
                      {/* Vendor Response Status */}
                      <div className="mt-3 pt-3 border-t border-border space-y-2">
                        {workOrder.vendor_accepted === true && (
                          <Badge variant="outline" className="text-foreground">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Confirmed
                          </Badge>
                        )}
                        {workOrder.vendor_accepted === false && (
                          <div>
                            <Badge variant="outline" className="text-foreground">Declined</Badge>
                            {workOrder.vendor_declined_reason && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {workOrder.vendor_declined_reason}
                              </p>
                            )}
                          </div>
                        )}
                        {workOrder.vendor_accepted === null && (
                          <Badge variant="outline" className="text-muted-foreground">
                            <Clock className="h-3 w-3 mr-1" />
                            Awaiting Response
                          </Badge>
                        )}
                        {/* Resend Link Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={resendVendorLink}
                          disabled={isResending}
                          className="w-full mt-2"
                        >
                          {isResending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                          ) : (
                            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                          )}
                          Resend Job Link
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {workOrder.scheduled_date && (
                  <div>
                    <Label className="text-muted-foreground">Scheduled</Label>
                    <p className="mt-1 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(workOrder.scheduled_date), "MMM d, yyyy")}
                      {workOrder.scheduled_time_window && ` (${workOrder.scheduled_time_window})`}
                    </p>
                  </div>
                )}

                <div className="flex gap-4 flex-wrap">
                  {workOrder.estimated_cost && (
                    <div>
                      <Label className="text-muted-foreground">Estimated</Label>
                      <p className="mt-1 font-medium">${workOrder.estimated_cost}</p>
                    </div>
                  )}
                  {workOrder.quoted_cost && (
                    <div>
                      <Label className="text-muted-foreground">Vendor Quote</Label>
                      <p className="mt-1 font-medium text-primary">${workOrder.quoted_cost}</p>
                    </div>
                  )}
                  {workOrder.actual_cost && (
                    <div>
                      <Label className="text-muted-foreground">Actual</Label>
                      <p className="mt-1 font-medium">${workOrder.actual_cost}</p>
                    </div>
                  )}
                </div>

                {/* Owner Approval Status */}
                {workOrder.status === "awaiting_approval" && (
                  <div className="p-4 bg-muted border border-border rounded-lg">
                    <div className="flex items-center gap-2 text-foreground font-medium">
                      <AlertTriangle className="h-4 w-4" />
                      Awaiting Owner Approval
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Quote of ${workOrder.quoted_cost} requires owner authorization
                    </p>
                  </div>
                )}
                {workOrder.owner_approved === true && (
                  <div className="flex items-center gap-2 text-foreground">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">Owner Approved</span>
                    {workOrder.owner_approved_at && (
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(workOrder.owner_approved_at), "MMM d, h:mm a")}
                      </span>
                    )}
                  </div>
                )}
                {workOrder.owner_approved === false && (
                  <div className="flex items-center gap-2 text-foreground">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-medium">Owner Declined</span>
                  </div>
                )}

                {workOrder.access_instructions && (
                  <div>
                    <Label className="text-muted-foreground">Access Instructions</Label>
                    <p className="mt-1">{workOrder.access_instructions}</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Messages Tab */}
          <TabsContent value="messages" className="mt-4">
            <div className="space-y-4">
              {/* Message List */}
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {messages.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No messages yet
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className="p-3 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={getSenderBadgeColor(msg.sender_type)}>
                          {msg.sender_type}
                        </Badge>
                        <span className="font-medium text-sm">{msg.sender_name}</span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {format(new Date(msg.created_at), "MMM d, h:mm a")}
                        </span>
                      </div>
                      <p className="text-sm">{msg.message_text}</p>
                    </div>
                  ))
                )}
              </div>

              {/* New Message */}
              <div className="flex gap-2">
                <Textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1"
                  rows={2}
                />
                <Button
                  onClick={() => sendMessage.mutate()}
                  disabled={!newMessage.trim() || sendMessage.isPending}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Timeline Tab */}
          <TabsContent value="timeline" className="mt-4">
            <div className="space-y-4 max-h-[400px] overflow-y-auto">
              {timeline.map((entry) => (
                <div key={entry.id} className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                  <div className="flex-1">
                    <p className="font-medium">{entry.action}</p>
                    <p className="text-sm text-muted-foreground">
                      {entry.performed_by_name} • {format(new Date(entry.created_at), "MMM d, h:mm a")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Actions Tab */}
          <TabsContent value="actions" className="space-y-6 mt-4">
            {/* Status Update */}
            <div className="space-y-2">
              <Label>Update Status</Label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                  <Button
                    key={status}
                    variant={workOrder.status === status ? "default" : "outline"}
                    size="sm"
                    onClick={() => updateStatus.mutate(status as WorkOrderStatus)}
                    disabled={updateStatus.isPending || workOrder.status === status}
                  >
                    {config.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Vendor Assignment */}
            {!workOrder.assigned_vendor_id && (
              <div className="space-y-3">
                <Label>Assign Vendor</Label>
                
                {/* Notification Options - Show before dropdown */}
                <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                  <Label className="text-sm font-medium">Notify Vendor When Assigned</Label>
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="notify_sms"
                        checked={notifySms}
                        onCheckedChange={(checked) => setNotifySms(!!checked)}
                      />
                      <label htmlFor="notify_sms" className="text-sm flex items-center gap-1.5 cursor-pointer">
                        <Phone className="h-3.5 w-3.5" />
                        SMS
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="notify_email"
                        checked={notifyEmail}
                        onCheckedChange={(checked) => setNotifyEmail(!!checked)}
                      />
                      <label htmlFor="notify_email" className="text-sm flex items-center gap-1.5 cursor-pointer">
                        <Mail className="h-3.5 w-3.5" />
                        Email
                      </label>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Vendor will receive work order details and be asked to confirm availability
                  </p>
                </div>

                <div className="flex gap-2">
                  <Select
                    value={selectedVendorId || ""}
                    onValueChange={setSelectedVendorId}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select a vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      {matchingVendors.length > 0 && (
                        <>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted">
                            Recommended for {category?.label}
                          </div>
                          {matchingVendors.map((vendor) => (
                            <SelectItem key={vendor.id} value={vendor.id}>
                              <div className="flex items-center gap-2">
                                <span>{vendor.name}</span>
                                {vendor.status === "preferred" && (
                                  <Badge variant="secondary" className="text-xs">Preferred</Badge>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </>
                      )}
                      {otherVendors.length > 0 && (
                        <>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted">
                            Other Vendors
                          </div>
                          {otherVendors.map((vendor) => (
                            <SelectItem key={vendor.id} value={vendor.id}>
                              <div className="flex items-center gap-2">
                                <span>{vendor.name}</span>
                                {vendor.status === "preferred" && (
                                  <Badge variant="secondary" className="text-xs">Preferred</Badge>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </>
                      )}
                      {vendors.length === 0 && (
                        <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                          No vendors available
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() => selectedVendorId && assignVendor.mutate(selectedVendorId)}
                    disabled={!selectedVendorId || assignVendor.isPending || isNotifying}
                  >
                    {assignVendor.isPending || isNotifying ? "Assigning..." : "Assign"}
                  </Button>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2">
              {workOrder.status === "pending_verification" && (
                <Button
                  variant="default"
                  onClick={() => updateStatus.mutate("completed")}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mark Complete
                </Button>
              )}
              {workOrder.status !== "cancelled" && workOrder.status !== "completed" && (
                <Button
                  variant="outline"
                  onClick={() => updateStatus.mutate("on_hold")}
                >
                  Put On Hold
                </Button>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default WorkOrderDetailModal;
