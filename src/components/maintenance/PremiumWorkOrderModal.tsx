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
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
  RotateCcw, ExternalLink, Loader2, Image, Video, Play,
  Building2, FileText, MessageSquare, History, Settings, X, Camera
} from "lucide-react";
import { 
  WorkOrder, WorkOrderStatus, WorkOrderTimeline, MaintenanceMessage,
  STATUS_CONFIG, URGENCY_CONFIG, WORK_ORDER_CATEGORIES, Vendor 
} from "@/types/maintenance";

interface WorkOrderPhoto {
  id: string;
  photo_url: string;
  photo_type: string;
  media_type: string | null;
  caption: string | null;
  created_at: string;
  uploaded_by: string | null;
}

interface PremiumWorkOrderModalProps {
  workOrderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

const isVideoFile = (url: string, mediaType: string | null): boolean => {
  if (mediaType === 'video') return true;
  const videoExtensions = ['.mp4', '.mov', '.avi', '.webm', '.m4v', '.MOV', '.MP4'];
  return videoExtensions.some(ext => url.toLowerCase().includes(ext.toLowerCase()));
};

const PremiumWorkOrderModal = ({ 
  workOrderId, 
  open, 
  onOpenChange, 
  onUpdate 
}: PremiumWorkOrderModalProps) => {
  const [newMessage, setNewMessage] = useState("");
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [notifySms, setNotifySms] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [isNotifying, setIsNotifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<WorkOrderPhoto | null>(null);
  const [activePhotoTab, setActivePhotoTab] = useState<string>("before");
  const queryClient = useQueryClient();

  // Fetch the complete work order data with property image
  const { data: workOrder, isLoading: workOrderLoading } = useQuery({
    queryKey: ["work-order-detail", workOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_orders")
        .select(`
          *,
          property:properties(id, name, address, image_path),
          assigned_vendor:vendors!work_orders_assigned_vendor_id_fkey(id, name, company_name, phone, email)
        `)
        .eq("id", workOrderId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: open && !!workOrderId,
  });

  // Fetch photos/videos for this work order
  const { data: workOrderMedia = [] } = useQuery({
    queryKey: ["work-order-media", workOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_order_photos")
        .select("*")
        .eq("work_order_id", workOrderId)
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      return data as WorkOrderPhoto[];
    },
    enabled: open && !!workOrderId,
  });

  const statusConfig = workOrder ? STATUS_CONFIG[workOrder.status as WorkOrderStatus] : null;
  const urgencyConfig = workOrder ? URGENCY_CONFIG[workOrder.urgency as keyof typeof URGENCY_CONFIG] : null;
  const category = workOrder ? WORK_ORDER_CATEGORIES.find(c => c.value === workOrder.category) : null;

  // Group media by type
  const mediaByType = {
    before: workOrderMedia.filter(m => m.photo_type === "before"),
    during: workOrderMedia.filter(m => m.photo_type === "during"),
    after: workOrderMedia.filter(m => m.photo_type === "after"),
  };

  const totalPhotos = workOrderMedia.filter(m => !isVideoFile(m.photo_url, m.media_type)).length;
  const totalVideos = workOrderMedia.filter(m => isVideoFile(m.photo_url, m.media_type)).length;

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

  // Fetch vendors
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

  // Assign vendor
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

      const notifyMethods: string[] = [];
      if (notifySms) notifyMethods.push("sms");
      if (notifyEmail) notifyMethods.push("email");

      if (notifyMethods.length > 0) {
        setIsNotifying(true);
        try {
          const { data, error: notifyError } = await supabase.functions.invoke("notify-vendor-work-order", {
            body: { workOrderId, vendorId, notifyMethods },
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

  // Resend vendor link
  const resendVendorLink = async () => {
    if (!workOrder?.id || !workOrder?.assigned_vendor_id) {
      toast.error("No vendor assigned");
      return;
    }
    
    setIsResending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const newToken = crypto.randomUUID();
      
      await supabase.from("work_orders").update({ 
        vendor_access_token: newToken,
        vendor_access_token_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      }).eq("id", workOrder.id);

      await supabase.functions.invoke("notify-vendor-work-order", {
        body: { workOrderId: workOrder.id, vendorId: workOrder.assigned_vendor_id, notifyMethods: ["sms"] },
      });

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
      case 'vendor': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'owner': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'pm': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'system': return 'bg-gray-100 text-gray-700 border-gray-200';
      default: return 'bg-muted text-foreground border-border';
    }
  };

  const renderMediaItem = (media: WorkOrderPhoto) => {
    const isVideo = isVideoFile(media.photo_url, media.media_type);
    
    return (
      <div
        key={media.id}
        className="group relative aspect-square rounded-xl overflow-hidden bg-muted cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all duration-200 shadow-sm"
        onClick={() => setSelectedMedia(media)}
      >
        {isVideo ? (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Play className="h-7 w-7 text-white ml-1" fill="currentColor" />
              </div>
            </div>
            <Video className="h-8 w-8 text-white/40 absolute bottom-3 right-3" />
          </div>
        ) : (
          <img
            src={media.photo_url}
            alt={media.caption || media.photo_type}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <p className="text-xs text-white font-medium truncate">
            {media.uploaded_by || 'Vendor'}
          </p>
        </div>
      </div>
    );
  };

  if (workOrderLoading || !workOrder) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl">
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const propertyImage = workOrder?.property?.image_path;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[92vh] p-0 overflow-hidden bg-background">
          {/* Premium Header with Property Image */}
          <div className="relative bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white">
            {/* Property Image Background */}
            {propertyImage && (
              <div className="absolute inset-0 overflow-hidden">
                <img 
                  src={propertyImage} 
                  alt={workOrder.property?.name || 'Property'} 
                  className="w-full h-full object-cover opacity-20"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-800/80 to-slate-900/90" />
              </div>
            )}
            
            <div className="relative p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  {/* Property Thumbnail */}
                  {propertyImage ? (
                    <div className="h-16 w-16 rounded-2xl overflow-hidden border-2 border-white/20 shadow-lg">
                      <img 
                        src={propertyImage} 
                        alt={workOrder.property?.name || 'Property'} 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-14 w-14 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                      <Wrench className="h-7 w-7 text-white" />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-white/60 text-sm font-mono">WO-{workOrder.work_order_number}</span>
                      {statusConfig && (
                        <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30">
                          {statusConfig.label}
                        </Badge>
                      )}
                      {urgencyConfig && workOrder.urgency === "emergency" && (
                        <Badge className="bg-red-500/80 text-white border-red-400">
                          {urgencyConfig.label}
                        </Badge>
                      )}
                    </div>
                    <h2 className="text-xl font-semibold">{workOrder.title}</h2>
                    <div className="flex items-center gap-2 text-white/70 mt-2 text-sm">
                      <MapPin className="h-4 w-4" />
                      <span>{workOrder.property?.name || workOrder.property?.address}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  {workOrder.quoted_cost && (
                    <div className="text-2xl font-bold">${workOrder.quoted_cost.toLocaleString()}</div>
                  )}
                  <div className="text-white/60 text-xs">
                    {format(new Date(workOrder.created_at), "MMM d, yyyy")}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(92vh-120px)]">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-5 mb-6 bg-muted/50">
                <TabsTrigger value="overview" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="media" className="gap-2">
                  <Camera className="h-4 w-4" />
                  Media ({workOrderMedia.length})
                </TabsTrigger>
                <TabsTrigger value="messages" className="gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Messages ({messages.length})
                </TabsTrigger>
                <TabsTrigger value="timeline" className="gap-2">
                  <History className="h-4 w-4" />
                  Timeline
                </TabsTrigger>
                <TabsTrigger value="actions" className="gap-2">
                  <Settings className="h-4 w-4" />
                  Actions
                </TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="mt-0">
                <div className="grid grid-cols-3 gap-6">
                  {/* Main Info */}
                  <div className="col-span-2 space-y-6">
                    <Card className="border-border/50">
                      <CardContent className="p-5">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</Label>
                        <p className="mt-2 text-foreground leading-relaxed">{workOrder.description || 'No description provided'}</p>
                      </CardContent>
                    </Card>

                    <div className="grid grid-cols-3 gap-4">
                      <Card className="border-border/50">
                        <CardContent className="p-4 text-center">
                          <div className="text-3xl font-bold text-foreground">{totalPhotos}</div>
                          <div className="text-xs text-muted-foreground mt-1">Photos</div>
                        </CardContent>
                      </Card>
                      <Card className="border-border/50">
                        <CardContent className="p-4 text-center">
                          <div className="text-3xl font-bold text-foreground">{totalVideos}</div>
                          <div className="text-xs text-muted-foreground mt-1">Videos</div>
                        </CardContent>
                      </Card>
                      <Card className="border-border/50">
                        <CardContent className="p-4 text-center">
                          <div className="text-3xl font-bold text-foreground">{messages.length}</div>
                          <div className="text-xs text-muted-foreground mt-1">Messages</div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Quick Media Preview */}
                    {workOrderMedia.length > 0 && (
                      <Card className="border-border/50">
                        <CardContent className="p-5">
                          <div className="flex items-center justify-between mb-4">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              Recent Media
                            </Label>
                            <Button variant="ghost" size="sm" className="text-xs" onClick={() => {
                              const element = document.querySelector('[data-state="active"][value="media"]');
                              if (element) (element as HTMLElement).click();
                            }}>
                              View All →
                            </Button>
                          </div>
                          <div className="grid grid-cols-4 gap-3">
                            {workOrderMedia.slice(0, 4).map(renderMediaItem)}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  {/* Sidebar */}
                  <div className="space-y-4">
                    {/* Vendor Card */}
                    {workOrder.assigned_vendor && (
                      <Card className="border-border/50 overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-4 border-b border-border/50">
                          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assigned Vendor</Label>
                        </div>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-semibold">{workOrder.assigned_vendor.name}</p>
                              {workOrder.assigned_vendor.company_name && (
                                <p className="text-xs text-muted-foreground">{workOrder.assigned_vendor.company_name}</p>
                              )}
                            </div>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Phone className="h-3.5 w-3.5" />
                              {workOrder.assigned_vendor.phone}
                            </div>
                            {workOrder.assigned_vendor.email && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Mail className="h-3.5 w-3.5" />
                                <span className="truncate">{workOrder.assigned_vendor.email}</span>
                              </div>
                            )}
                          </div>
                          <Separator className="my-3" />
                          <div className="space-y-2">
                            {workOrder.vendor_accepted === true && (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 w-full justify-center">
                                <CheckCircle className="h-3 w-3 mr-1.5" />
                                Job Confirmed
                              </Badge>
                            )}
                            {workOrder.vendor_accepted === false && (
                              <Badge className="bg-red-100 text-red-800 border-red-200 w-full justify-center">
                                Declined
                              </Badge>
                            )}
                            {workOrder.vendor_accepted === null && (
                              <Badge variant="outline" className="w-full justify-center">
                                <Clock className="h-3 w-3 mr-1.5" />
                                Awaiting Response
                              </Badge>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={resendVendorLink}
                              disabled={isResending}
                              className="w-full"
                            >
                              {isResending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RotateCcw className="h-3.5 w-3.5 mr-1.5" />}
                              Resend Job Link
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Details Card */}
                    <Card className="border-border/50">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Category</span>
                          <span className="font-medium">{category?.label || 'General'}</span>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Created</span>
                          <span className="font-medium">{format(new Date(workOrder.created_at), "MMM d, yyyy")}</span>
                        </div>
                        {workOrder.scheduled_date && (
                          <>
                            <Separator />
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Scheduled</span>
                              <span className="font-medium">{format(new Date(workOrder.scheduled_date), "MMM d, yyyy")}</span>
                            </div>
                          </>
                        )}
                        {workOrder.completed_at && (
                          <>
                            <Separator />
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Completed</span>
                              <span className="font-medium text-emerald-600">{format(new Date(workOrder.completed_at), "MMM d, yyyy")}</span>
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              {/* Media Tab */}
              <TabsContent value="media" className="mt-0">
                <div className="space-y-6">
                  <Tabs value={activePhotoTab} onValueChange={setActivePhotoTab}>
                    <TabsList className="bg-muted/50">
                      <TabsTrigger value="before" className="gap-2">
                        Before ({mediaByType.before.length})
                      </TabsTrigger>
                      <TabsTrigger value="during" className="gap-2">
                        During ({mediaByType.during.length})
                      </TabsTrigger>
                      <TabsTrigger value="after" className="gap-2">
                        After ({mediaByType.after.length})
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="before" className="mt-4">
                      {mediaByType.before.length === 0 ? (
                        <Card className="border-dashed">
                          <CardContent className="p-8 text-center text-muted-foreground">
                            <Camera className="h-10 w-10 mx-auto mb-3 opacity-30" />
                            <p>No before photos uploaded yet</p>
                          </CardContent>
                        </Card>
                      ) : (
                        <div className="grid grid-cols-4 gap-4">
                          {mediaByType.before.map(renderMediaItem)}
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="during" className="mt-4">
                      {mediaByType.during.length === 0 ? (
                        <Card className="border-dashed">
                          <CardContent className="p-8 text-center text-muted-foreground">
                            <Camera className="h-10 w-10 mx-auto mb-3 opacity-30" />
                            <p>No in-progress photos uploaded yet</p>
                          </CardContent>
                        </Card>
                      ) : (
                        <div className="grid grid-cols-4 gap-4">
                          {mediaByType.during.map(renderMediaItem)}
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="after" className="mt-4">
                      {mediaByType.after.length === 0 ? (
                        <Card className="border-dashed">
                          <CardContent className="p-8 text-center text-muted-foreground">
                            <Camera className="h-10 w-10 mx-auto mb-3 opacity-30" />
                            <p>No after photos uploaded yet</p>
                          </CardContent>
                        </Card>
                      ) : (
                        <div className="grid grid-cols-4 gap-4">
                          {mediaByType.after.map(renderMediaItem)}
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              </TabsContent>

              {/* Messages Tab */}
              <TabsContent value="messages" className="mt-0">
                <Card className="border-border/50">
                  <CardContent className="p-4">
                    <ScrollArea className="h-[350px] pr-4">
                      {messages.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
                          <p>No messages yet</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {messages.map((msg) => (
                            <div key={msg.id} className="flex gap-3">
                              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium ${
                                msg.sender_type === 'vendor' ? 'bg-blue-100 text-blue-700' :
                                msg.sender_type === 'pm' ? 'bg-purple-100 text-purple-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {msg.sender_name?.charAt(0).toUpperCase() || '?'}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-sm">{msg.sender_name}</span>
                                  <Badge variant="outline" className={`text-[10px] ${getSenderBadgeColor(msg.sender_type)}`}>
                                    {msg.sender_type}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground ml-auto">
                                    {format(new Date(msg.created_at), "MMM d, h:mm a")}
                                  </span>
                                </div>
                                <p className="text-sm text-foreground bg-muted/50 rounded-lg p-3">
                                  {msg.message_text}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                    <Separator className="my-4" />
                    <div className="flex gap-3">
                      <Textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 resize-none"
                        rows={2}
                      />
                      <Button
                        onClick={() => sendMessage.mutate()}
                        disabled={!newMessage.trim() || sendMessage.isPending}
                        className="self-end"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Timeline Tab */}
              <TabsContent value="timeline" className="mt-0">
                <Card className="border-border/50">
                  <CardContent className="p-4">
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="relative">
                        <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />
                        <div className="space-y-6">
                          {timeline.map((entry, index) => (
                            <div key={entry.id} className="flex gap-4 relative">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center z-10 ${
                                index === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted border border-border'
                              }`}>
                                <div className={`w-2 h-2 rounded-full ${index === 0 ? 'bg-primary-foreground' : 'bg-muted-foreground'}`} />
                              </div>
                              <div className="flex-1 pb-2">
                                <p className="font-medium text-sm">{entry.action}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                  <span>{entry.performed_by_name}</span>
                                  <span>•</span>
                                  <span>{format(new Date(entry.created_at), "MMM d, h:mm a")}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Actions Tab */}
              <TabsContent value="actions" className="mt-0 space-y-6">
                {/* Status Update */}
                <Card className="border-border/50">
                  <CardContent className="p-5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Update Status</Label>
                    <div className="flex flex-wrap gap-2 mt-3">
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
                  </CardContent>
                </Card>

                {/* Vendor Assignment */}
                {!workOrder.assigned_vendor_id && (
                  <Card className="border-border/50">
                    <CardContent className="p-5">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 block">Assign Vendor</Label>
                      
                      <div className="p-4 bg-muted/30 rounded-lg mb-4 space-y-3">
                        <Label className="text-sm font-medium">Notification Preferences</Label>
                        <div className="flex flex-wrap gap-6">
                          <div className="flex items-center gap-2">
                            <Checkbox id="notify_sms" checked={notifySms} onCheckedChange={(c) => setNotifySms(!!c)} />
                            <label htmlFor="notify_sms" className="text-sm flex items-center gap-1.5 cursor-pointer">
                              <Phone className="h-3.5 w-3.5" /> SMS
                            </label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox id="notify_email" checked={notifyEmail} onCheckedChange={(c) => setNotifyEmail(!!c)} />
                            <label htmlFor="notify_email" className="text-sm flex items-center gap-1.5 cursor-pointer">
                              <Mail className="h-3.5 w-3.5" /> Email
                            </label>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <Select value={selectedVendorId || ""} onValueChange={setSelectedVendorId}>
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
                          </SelectContent>
                        </Select>
                        <Button
                          onClick={() => selectedVendorId && assignVendor.mutate(selectedVendorId)}
                          disabled={!selectedVendorId || assignVendor.isPending || isNotifying}
                        >
                          {assignVendor.isPending || isNotifying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Assign
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Quick Actions */}
                <div className="flex flex-wrap gap-3">
                  {workOrder.status === "pending_verification" && (
                    <Button onClick={() => updateStatus.mutate("completed")}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Mark Complete
                    </Button>
                  )}
                  {workOrder.status !== "cancelled" && workOrder.status !== "completed" && (
                    <Button variant="outline" onClick={() => updateStatus.mutate("on_hold")}>
                      Put On Hold
                    </Button>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {/* Media Lightbox */}
      <Dialog open={!!selectedMedia} onOpenChange={() => setSelectedMedia(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 z-50 text-white hover:bg-white/20"
            onClick={() => setSelectedMedia(null)}
          >
            <X className="h-5 w-5" />
          </Button>
          {selectedMedia && (
            <div className="relative">
              {isVideoFile(selectedMedia.photo_url, selectedMedia.media_type) ? (
                <video
                  src={selectedMedia.photo_url}
                  controls
                  autoPlay
                  className="w-full max-h-[80vh] object-contain"
                />
              ) : (
                <img
                  src={selectedMedia.photo_url}
                  alt={selectedMedia.caption || "Work order media"}
                  className="w-full max-h-[80vh] object-contain"
                />
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                <div className="flex items-center justify-between text-white">
                  <div>
                    <Badge className="bg-white/20 text-white border-white/30 capitalize mb-1">
                      {selectedMedia.photo_type}
                    </Badge>
                    {selectedMedia.caption && (
                      <p className="text-sm text-white/80">{selectedMedia.caption}</p>
                    )}
                  </div>
                  <div className="text-right text-sm text-white/60">
                    <p>{selectedMedia.uploaded_by || 'Vendor'}</p>
                    <p>{format(new Date(selectedMedia.created_at), "MMM d, h:mm a")}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PremiumWorkOrderModal;
