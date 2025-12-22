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
  CheckCircle, AlertTriangle, Phone, Mail, Calendar
} from "lucide-react";
import { 
  WorkOrder, WorkOrderStatus, WorkOrderTimeline, MaintenanceMessage,
  STATUS_CONFIG, URGENCY_CONFIG, WORK_ORDER_CATEGORIES, Vendor 
} from "@/types/maintenance";

interface WorkOrderDetailModalProps {
  workOrder: WorkOrder;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

const WorkOrderDetailModal = ({ 
  workOrder, 
  open, 
  onOpenChange, 
  onUpdate 
}: WorkOrderDetailModalProps) => {
  const [newMessage, setNewMessage] = useState("");
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [notifySms, setNotifySms] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [isNotifying, setIsNotifying] = useState(false);
  const queryClient = useQueryClient();

  const statusConfig = STATUS_CONFIG[workOrder.status];
  const urgencyConfig = URGENCY_CONFIG[workOrder.urgency];
  const category = WORK_ORDER_CATEGORIES.find(c => c.value === workOrder.category);

  // Fetch timeline
  const { data: timeline = [] } = useQuery({
    queryKey: ["work-order-timeline", workOrder.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_order_timeline")
        .select("*")
        .eq("work_order_id", workOrder.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as WorkOrderTimeline[];
    },
  });

  // Fetch messages
  const { data: messages = [] } = useQuery({
    queryKey: ["work-order-messages", workOrder.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_messages")
        .select("*")
        .eq("work_order_id", workOrder.id)
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      return data as MaintenanceMessage[];
    },
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
  const matchingVendors = vendors.filter(v => v.specialty?.includes(workOrder.category));
  const otherVendors = vendors.filter(v => !v.specialty?.includes(workOrder.category));

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
        .eq("id", workOrder.id);

      if (error) throw error;

      await supabase.from("work_order_timeline").insert({
        work_order_id: workOrder.id,
        action: `Status changed to ${STATUS_CONFIG[newStatus].label}`,
        performed_by_type: "pm",
        performed_by_name: user?.email,
        performed_by_user_id: user?.id,
        previous_status: workOrder.status,
        new_status: newStatus,
      });
    },
    onSuccess: () => {
      toast.success("Status updated");
      onUpdate();
      queryClient.invalidateQueries({ queryKey: ["work-order-timeline", workOrder.id] });
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
        .eq("id", workOrder.id);

      if (error) throw error;

      await supabase.from("work_order_timeline").insert({
        work_order_id: workOrder.id,
        action: `Assigned to vendor: ${vendor?.name}`,
        performed_by_type: "pm",
        performed_by_name: user?.email,
        performed_by_user_id: user?.id,
        previous_status: workOrder.status,
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
              workOrderId: workOrder.id, 
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
      queryClient.invalidateQueries({ queryKey: ["work-order-timeline", workOrder.id] });
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
        work_order_id: workOrder.id,
        sender_type: "pm",
        sender_name: user?.email || "Property Manager",
        sender_user_id: user?.id,
        message_text: newMessage,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["work-order-messages", workOrder.id] });
    },
    onError: (error) => {
      toast.error("Failed to send: " + error.message);
    },
  });

  const getSenderBadgeColor = (type: string) => {
    switch (type) {
      case 'owner': return 'bg-purple-100 text-purple-700';
      case 'vendor': return 'bg-orange-100 text-orange-700';
      case 'guest': return 'bg-blue-100 text-blue-700';
      case 'ai': return 'bg-cyan-100 text-cyan-700';
      case 'system': return 'bg-gray-100 text-gray-700';
      default: return 'bg-green-100 text-green-700';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{category?.icon}</span>
              <div>
                <DialogTitle className="text-xl">{workOrder.title}</DialogTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {workOrder.property?.name || workOrder.property?.address}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Badge className={`${statusConfig.bgColor} ${statusConfig.color}`}>
                {statusConfig.label}
              </Badge>
              <Badge className={`${urgencyConfig.bgColor} ${urgencyConfig.color}`}>
                {urgencyConfig.label}
              </Badge>
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
              <div className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="mt-1">{workOrder.description}</p>
                </div>

                <div>
                  <Label className="text-muted-foreground">Category</Label>
                  <p className="mt-1">{category?.label}</p>
                </div>

                <div>
                  <Label className="text-muted-foreground">Source</Label>
                  <p className="mt-1 capitalize">{workOrder.source.replace(/_/g, ' ')}</p>
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
                    <Label className="text-muted-foreground">Assigned Vendor</Label>
                    <div className="mt-1 p-3 bg-muted rounded-lg">
                      <p className="font-medium">{workOrder.assigned_vendor.name}</p>
                      {workOrder.assigned_vendor.company_name && (
                        <p className="text-sm text-muted-foreground">
                          {workOrder.assigned_vendor.company_name}
                        </p>
                      )}
                      <p className="text-sm mt-1 flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5" />
                        {workOrder.assigned_vendor.phone}
                      </p>
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

                <div className="flex gap-4">
                  {workOrder.estimated_cost && (
                    <div>
                      <Label className="text-muted-foreground">Estimated</Label>
                      <p className="mt-1 font-medium">${workOrder.estimated_cost}</p>
                    </div>
                  )}
                  {workOrder.actual_cost && (
                    <div>
                      <Label className="text-muted-foreground">Actual</Label>
                      <p className="mt-1 font-medium">${workOrder.actual_cost}</p>
                    </div>
                  )}
                </div>

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
