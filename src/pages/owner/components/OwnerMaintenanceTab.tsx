import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Wrench,
  Clock,
  CheckCircle,
  AlertCircle,
  DollarSign,
  Camera,
  ChevronRight,
  Loader2,
  CalendarDays,
  Image,
  X,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";

interface OwnerMaintenanceTabProps {
  ownerId: string;
  propertyId?: string;
}

interface WorkOrder {
  id: string;
  work_order_number: number;
  title: string;
  description: string | null;
  status: string;
  urgency: string;
  category: string | null;
  quoted_cost: number | null;
  actual_cost: number | null;
  created_at: string;
  completed_at: string | null;
  owner_approved: boolean | null;
  vendors: {
    name: string;
  } | null;
  properties: {
    name: string;
    address: string;
  } | null;
}

interface WorkOrderPhoto {
  id: string;
  photo_url: string;
  photo_type: string;
  media_type: string | null;
  caption: string | null;
  created_at: string;
  uploaded_by: string | null;
}

const isVideoFile = (url: string, mediaType: string | null): boolean => {
  if (mediaType === 'video') return true;
  const videoExtensions = ['.mp4', '.mov', '.avi', '.webm', '.m4v', '.MOV', '.MP4'];
  return videoExtensions.some(ext => url.toLowerCase().includes(ext.toLowerCase()));
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  new: { label: "New", color: "bg-blue-100 text-blue-800", icon: AlertCircle },
  assigned: { label: "Assigned", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  dispatched: { label: "Dispatched", color: "bg-purple-100 text-purple-800", icon: Clock },
  scheduled: { label: "Scheduled", color: "bg-purple-100 text-purple-800", icon: CalendarDays },
  in_progress: { label: "In Progress", color: "bg-orange-100 text-orange-800", icon: Wrench },
  pending_approval: { label: "Awaiting Approval", color: "bg-amber-100 text-amber-800", icon: Clock },
  awaiting_approval: { label: "Awaiting Approval", color: "bg-amber-100 text-amber-800", icon: Clock },
  pending_verification: { label: "Pending Verification", color: "bg-indigo-100 text-indigo-800", icon: CheckCircle },
  completed: { label: "Completed", color: "bg-green-100 text-green-800", icon: CheckCircle },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-800", icon: AlertCircle },
};

export function OwnerMaintenanceTab({ ownerId, propertyId }: OwnerMaintenanceTabProps) {
  const queryClient = useQueryClient();
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"active" | "completed" | "all">("all");
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  // Fetch work orders for this owner's properties
  const { data: workOrders = [], isLoading } = useQuery({
    queryKey: ["owner-work-orders", ownerId, propertyId, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("work_orders")
        .select(`
          id,
          work_order_number,
          title,
          description,
          status,
          urgency,
          category,
          quoted_cost,
          actual_cost,
          created_at,
          completed_at,
          owner_approved,
          vendors!work_orders_assigned_vendor_id_fkey(name),
          properties!inner(name, address, owner_id)
        `)
        .eq("properties.owner_id", ownerId)
        .order("created_at", { ascending: false });

      if (propertyId) {
        query = query.eq("property_id", propertyId);
      }

      if (statusFilter === "active") {
        query = query.not("status", "in", '("completed","cancelled")');
      } else if (statusFilter === "completed") {
        query = query.in("status", ["completed", "cancelled"]);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as WorkOrder[];
    },
  });

  // Set up realtime subscription for work order updates
  useEffect(() => {
    const channel = supabase
      .channel('owner-work-orders-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'work_orders',
        },
        (payload) => {
          console.log('Work order realtime update:', payload);
          queryClient.invalidateQueries({ queryKey: ["owner-work-orders", ownerId, propertyId, statusFilter] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ownerId, propertyId, statusFilter, queryClient]);

  // Fetch photos for selected work order
  const { data: workOrderPhotos = [] } = useQuery({
    queryKey: ["work-order-photos-owner", selectedWorkOrder?.id],
    queryFn: async () => {
      if (!selectedWorkOrder?.id) return [];
      const { data, error } = await supabase
        .from("work_order_photos")
        .select("*")
        .eq("work_order_id", selectedWorkOrder.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as WorkOrderPhoto[];
    },
    enabled: !!selectedWorkOrder?.id,
  });

  // Approve work order mutation
  const approveWorkOrder = useMutation({
    mutationFn: async (workOrderId: string) => {
      const { error } = await supabase
        .from("work_orders")
        .update({ 
          owner_approved: true, 
          status: "scheduled" 
        })
        .eq("id", workOrderId);
      if (error) throw error;

      // Add timeline entry
      await supabase.from("work_order_timeline").insert({
        work_order_id: workOrderId,
        action: "Owner approved the work order",
        performed_by_type: "owner",
        performed_by_name: "Owner",
      });
    },
    onSuccess: () => {
      toast.success("Work order approved! Vendor has been notified.");
      queryClient.invalidateQueries({ queryKey: ["owner-work-orders"] });
      setSelectedWorkOrder(null);
    },
    onError: (error) => {
      toast.error("Failed to approve: " + error.message);
    },
  });

  // Decline work order mutation
  const declineWorkOrder = useMutation({
    mutationFn: async ({ workOrderId, reason }: { workOrderId: string; reason: string }) => {
      const { error } = await supabase
        .from("work_orders")
        .update({ 
          owner_approved: false, 
          status: "on_hold",
          owner_declined_reason: reason || "No reason provided"
        })
        .eq("id", workOrderId);
      if (error) throw error;

      // Add timeline entry
      await supabase.from("work_order_timeline").insert({
        work_order_id: workOrderId,
        action: `Owner declined the work order. Reason: ${reason || "Not specified"}`,
        performed_by_type: "owner",
        performed_by_name: "Owner",
      });
    },
    onSuccess: () => {
      toast.success("Work order declined.");
      queryClient.invalidateQueries({ queryKey: ["owner-work-orders"] });
      setSelectedWorkOrder(null);
      setShowDeclineDialog(false);
      setDeclineReason("");
    },
    onError: (error) => {
      toast.error("Failed to decline: " + error.message);
    },
  });

  // Group photos by type
  const photosByType = {
    before: workOrderPhotos.filter(p => p.photo_type === "before"),
    during: workOrderPhotos.filter(p => p.photo_type === "during"),
    after: workOrderPhotos.filter(p => p.photo_type === "after"),
  };

  // Calculate stats
  const totalCost = workOrders.reduce((sum, wo) => sum + (wo.actual_cost || wo.quoted_cost || 0), 0);
  const completedCount = workOrders.filter(wo => wo.status === "completed").length;
  const pendingApprovalCount = workOrders.filter(wo => 
    wo.status === "pending_approval" || wo.status === "awaiting_approval"
  ).length;

  const isAwaitingApproval = (status: string) => 
    status === "pending_approval" || status === "awaiting_approval";

  const renderWorkOrderCard = (wo: WorkOrder) => {
    const statusConfig = STATUS_CONFIG[wo.status] || STATUS_CONFIG.new;
    const StatusIcon = statusConfig.icon;
    const needsApproval = isAwaitingApproval(wo.status);

    return (
      <Card
        key={wo.id}
        className={`cursor-pointer hover:shadow-md transition-shadow border-l-4 ${needsApproval ? 'ring-2 ring-amber-400' : ''}`}
        style={{ borderLeftColor: needsApproval ? "#f59e0b" : "transparent" }}
        onClick={() => setSelectedWorkOrder(wo)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs text-muted-foreground font-mono">
                  #{wo.work_order_number}
                </span>
                <Badge className={statusConfig.color} variant="secondary">
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {statusConfig.label}
                </Badge>
                {wo.urgency === "emergency" && (
                  <Badge variant="destructive">Emergency</Badge>
                )}
                {needsApproval && (
                  <Badge className="bg-amber-500 text-white animate-pulse">Action Required</Badge>
                )}
              </div>
              <h4 className="font-medium text-sm">{wo.title}</h4>
              {wo.properties && (
                <p className="text-xs text-muted-foreground mt-1">
                  {wo.properties.name}
                </p>
              )}
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span>{format(new Date(wo.created_at), "MMM d, yyyy")}</span>
                {wo.vendors && (
                  <span className="flex items-center gap-1">
                    <Wrench className="h-3 w-3" />
                    {wo.vendors.name}
                  </span>
                )}
                {(wo.actual_cost || wo.quoted_cost) && (
                  <span className="flex items-center gap-1 font-medium">
                    <DollarSign className="h-3 w-3" />
                    ${(wo.actual_cost || wo.quoted_cost)?.toLocaleString()}
                  </span>
                )}
              </div>
              {needsApproval && (
                <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                  <Button 
                    size="sm" 
                    className="bg-green-600 hover:bg-green-700 flex-1"
                    onClick={() => approveWorkOrder.mutate(wo.id)}
                    disabled={approveWorkOrder.isPending}
                  >
                    <ThumbsUp className="h-3 w-3 mr-1" />
                    Approve
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="border-red-300 text-red-600 hover:bg-red-50 flex-1"
                    onClick={() => {
                      setSelectedWorkOrder(wo);
                      setShowDeclineDialog(true);
                    }}
                  >
                    <ThumbsDown className="h-3 w-3 mr-1" />
                    Decline
                  </Button>
                </div>
              )}
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderPhotoGrid = (photos: WorkOrderPhoto[], label: string) => {
    if (photos.length === 0) return null;
    const videos = photos.filter(p => isVideoFile(p.photo_url, p.media_type));
    const images = photos.filter(p => !isVideoFile(p.photo_url, p.media_type));
    
    return (
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          {label} 
          <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
            {images.length} photos, {videos.length} videos
          </span>
        </h4>
        <div className="grid grid-cols-3 gap-3">
          {photos.map((photo) => {
            const isVideo = isVideoFile(photo.photo_url, photo.media_type);
            return (
              <div
                key={photo.id}
                className="aspect-square rounded-xl overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all relative group shadow-sm"
                onClick={() => setSelectedPhoto(photo.photo_url)}
              >
                {isVideo ? (
                  <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <div className="w-0 h-0 border-t-6 border-b-6 border-l-10 border-transparent border-l-white ml-1" 
                           style={{ borderWidth: '8px 0 8px 14px' }} />
                    </div>
                    <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                      </svg>
                      Video
                    </div>
                  </div>
                ) : (
                  <img
                    src={photo.photo_url}
                    alt={photo.caption || label}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-xs text-white font-medium">{photo.uploaded_by || 'Vendor'}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{workOrders.length}</div>
            <div className="text-xs text-muted-foreground">Total Work Orders</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{completedCount}</div>
            <div className="text-xs text-muted-foreground">Completed</div>
          </CardContent>
        </Card>
        <Card className={pendingApprovalCount > 0 ? "ring-2 ring-amber-500 animate-pulse" : ""}>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-amber-600">{pendingApprovalCount}</div>
            <div className="text-xs text-muted-foreground">Awaiting Approval</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">${totalCost.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Total Cost</div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Approval Alert */}
      {pendingApprovalCount > 0 && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <div className="flex-1">
                <p className="font-medium text-amber-800">
                  {pendingApprovalCount} work order{pendingApprovalCount > 1 ? "s" : ""} awaiting your approval
                </p>
                <p className="text-sm text-amber-600">
                  Click "Approve" or "Decline" below, or reply via SMS
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter Tabs */}
      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Work Orders List */}
      {workOrders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Wrench className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No maintenance work orders yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              When maintenance is needed, you'll see the details here
            </p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[500px]">
          <div className="space-y-3 pr-4">
            {workOrders.map(renderWorkOrderCard)}
          </div>
        </ScrollArea>
      )}

      {/* Work Order Detail Dialog */}
      <Dialog open={!!selectedWorkOrder && !showDeclineDialog} onOpenChange={() => setSelectedWorkOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Work Order #{selectedWorkOrder?.work_order_number}
            </DialogTitle>
          </DialogHeader>
          
          {selectedWorkOrder && (
            <div className="space-y-6">
              {/* Approval Buttons at Top for pending items */}
              {isAwaitingApproval(selectedWorkOrder.status) && (
                <Card className="bg-amber-50 border-amber-200">
                  <CardContent className="p-4">
                    <p className="text-sm text-amber-800 mb-3 font-medium">
                      This work order requires your approval to proceed.
                    </p>
                    <div className="flex gap-3">
                      <Button 
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        onClick={() => approveWorkOrder.mutate(selectedWorkOrder.id)}
                        disabled={approveWorkOrder.isPending}
                      >
                        {approveWorkOrder.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <><ThumbsUp className="h-4 w-4 mr-2" />Approve</>
                        )}
                      </Button>
                      <Button 
                        variant="outline" 
                        className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                        onClick={() => setShowDeclineDialog(true)}
                      >
                        <ThumbsDown className="h-4 w-4 mr-2" />Decline
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Status & Details */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={STATUS_CONFIG[selectedWorkOrder.status]?.color || ""}>
                    {STATUS_CONFIG[selectedWorkOrder.status]?.label || selectedWorkOrder.status}
                  </Badge>
                  {selectedWorkOrder.urgency === "emergency" && (
                    <Badge variant="destructive">Emergency</Badge>
                  )}
                  {selectedWorkOrder.category && (
                    <Badge variant="outline">{selectedWorkOrder.category}</Badge>
                  )}
                </div>
                
                <h3 className="text-lg font-semibold">{selectedWorkOrder.title}</h3>
                
                {selectedWorkOrder.description && (
                  <p className="text-muted-foreground">{selectedWorkOrder.description}</p>
                )}
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Property:</span>
                    <p className="font-medium">{selectedWorkOrder.properties?.name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Vendor:</span>
                    <p className="font-medium">{selectedWorkOrder.vendors?.name || "Not assigned"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Created:</span>
                    <p className="font-medium">{format(new Date(selectedWorkOrder.created_at), "MMM d, yyyy")}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cost:</span>
                    <p className="font-medium text-lg">
                      ${(selectedWorkOrder.actual_cost || selectedWorkOrder.quoted_cost || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Photos Section */}
              {workOrderPhotos.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    Photos
                  </h4>
                  
                  <Tabs defaultValue="before" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="before" disabled={photosByType.before.length === 0}>
                        Before ({photosByType.before.length})
                      </TabsTrigger>
                      <TabsTrigger value="during" disabled={photosByType.during.length === 0}>
                        During ({photosByType.during.length})
                      </TabsTrigger>
                      <TabsTrigger value="after" disabled={photosByType.after.length === 0}>
                        After ({photosByType.after.length})
                      </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="before" className="mt-4">
                      {renderPhotoGrid(photosByType.before, "Before")}
                    </TabsContent>
                    <TabsContent value="during" className="mt-4">
                      {renderPhotoGrid(photosByType.during, "During")}
                    </TabsContent>
                    <TabsContent value="after" className="mt-4">
                      {renderPhotoGrid(photosByType.after, "After")}
                    </TabsContent>
                  </Tabs>
                </div>
              )}

              {workOrderPhotos.length === 0 && (
                <Card className="bg-muted/50">
                  <CardContent className="py-6 text-center">
                    <Camera className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">No photos uploaded yet</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Decline Dialog */}
      <Dialog open={showDeclineDialog} onOpenChange={setShowDeclineDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline Work Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Please provide a reason for declining this work order (optional):
            </p>
            <Textarea 
              value={declineReason} 
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="e.g., Too expensive, want a second quote, not a priority right now..."
              rows={3}
            />
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowDeclineDialog(false);
                  setDeclineReason("");
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={() => {
                  if (selectedWorkOrder) {
                    declineWorkOrder.mutate({ 
                      workOrderId: selectedWorkOrder.id, 
                      reason: declineReason 
                    });
                  }
                }}
                disabled={declineWorkOrder.isPending}
                className="flex-1"
              >
                {declineWorkOrder.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Decline Work Order"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Photo Lightbox */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-4xl p-0 bg-black/90">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 z-10 text-white hover:bg-white/20"
            onClick={() => setSelectedPhoto(null)}
          >
            <X className="h-6 w-6" />
          </Button>
          {selectedPhoto && (
            <img
              src={selectedPhoto}
              alt="Work order photo"
              className="w-full h-auto max-h-[90vh] object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
