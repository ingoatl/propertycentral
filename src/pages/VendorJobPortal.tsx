import { useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { 
  MapPin, Clock, AlertTriangle, CheckCircle, XCircle, 
  Camera, DollarSign, ExternalLink, Phone, Loader2, Send, 
  Building2, Play, X, Lock, Key, Shield, Copy, FileText,
  ArrowRight, Info
} from "lucide-react";

const URGENCY_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  low: { label: "Low", variant: "secondary" },
  normal: { label: "Normal", variant: "outline" },
  medium: { label: "Medium", variant: "default" },
  high: { label: "High", variant: "destructive" },
  emergency: { label: "Emergency", variant: "destructive" },
};

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  new: { label: "New", variant: "secondary" },
  dispatched: { label: "Awaiting Response", variant: "default" },
  scheduled: { label: "Scheduled", variant: "outline" },
  in_progress: { label: "In Progress", variant: "default" },
  awaiting_approval: { label: "Awaiting Approval", variant: "secondary" },
  pending_verification: { label: "Pending Review", variant: "outline" },
  completed: { label: "Completed", variant: "secondary" },
};

interface WorkOrderData {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  urgency: string | null;
  status: string | null;
  created_at: string;
  access_instructions: string | null;
  quoted_cost: number | null;
  vendor_accepted: boolean | null;
  completed_at: string | null;
  property: { id: string; name: string | null; address: string | null; image_path: string | null } | null;
  assigned_vendor: { id: string; name: string; phone: string | null; company_name: string | null } | null;
}

interface MaintenanceBook {
  lockbox_code: string | null;
  gate_code: string | null;
  alarm_code: string | null;
  access_instructions: string | null;
}

const VendorJobPortal = () => {
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();
  
  const [photoType, setPhotoType] = useState<"before" | "after">("before");
  const [uploading, setUploading] = useState(false);
  const [quoteAmount, setQuoteAmount] = useState("");
  const [showQuoteInput, setShowQuoteInput] = useState(false);
  const [message, setMessage] = useState("");
  const [showDeclineReason, setShowDeclineReason] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const beforeInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef = useRef<HTMLInputElement>(null);

  // Fetch work order by token
  const { data: workOrder, isLoading, error } = useQuery({
    queryKey: ["vendor-job", token],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_orders")
        .select(`
          id, title, description, category, urgency, status, 
          created_at, access_instructions, quoted_cost,
          vendor_accepted, completed_at,
          property:properties(id, name, address, image_path),
          assigned_vendor:vendors!work_orders_assigned_vendor_id_fkey(id, name, phone, company_name)
        `)
        .eq("vendor_access_token", token)
        .single();
      
      if (error) throw error;
      return data as unknown as WorkOrderData;
    },
    enabled: !!token,
  });

  // Fetch property maintenance book for access codes
  const { data: maintenanceBook } = useQuery({
    queryKey: ["property-maintenance-book", workOrder?.property?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_maintenance_book")
        .select("lockbox_code, gate_code, alarm_code, access_instructions")
        .eq("property_id", workOrder!.property!.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as MaintenanceBook | null;
    },
    enabled: !!workOrder?.property?.id,
  });

  // Fetch photos for this work order
  const { data: photos = [] } = useQuery({
    queryKey: ["work-order-photos", workOrder?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_order_photos")
        .select("*")
        .eq("work_order_id", workOrder?.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!workOrder?.id,
  });

  const urgencyConfig = workOrder?.urgency ? URGENCY_CONFIG[workOrder.urgency] || URGENCY_CONFIG.normal : URGENCY_CONFIG.normal;
  const statusConfig = workOrder?.status ? STATUS_CONFIG[workOrder.status] || STATUS_CONFIG.new : STATUS_CONFIG.new;

  // Upload photo mutation
  const uploadPhoto = useMutation({
    mutationFn: async ({ file, type }: { file: File; type: "before" | "after" }) => {
      if (!workOrder?.id) throw new Error("No work order");
      setUploading(true);
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${workOrder.id}/${type}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("work-order-photos")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("work-order-photos")
        .getPublicUrl(fileName);

      const { error: insertError } = await supabase
        .from("work_order_photos")
        .insert({
          work_order_id: workOrder.id,
          photo_url: publicUrl,
          photo_type: type,
          uploaded_by: workOrder.assigned_vendor?.name || "Vendor",
          uploaded_by_type: "vendor",
        });

      if (insertError) throw insertError;
      return publicUrl;
    },
    onSuccess: () => {
      toast.success("Photo uploaded!");
      queryClient.invalidateQueries({ queryKey: ["work-order-photos", workOrder?.id] });
      setUploading(false);
    },
    onError: (error) => {
      toast.error("Upload failed: " + error.message);
      setUploading(false);
    },
  });

  // Confirm job mutation
  const confirmJob = useMutation({
    mutationFn: async () => {
      if (!workOrder?.id) throw new Error("No work order");
      const { error } = await supabase
        .from("work_orders")
        .update({ vendor_accepted: true, status: "scheduled" })
        .eq("id", workOrder.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Job confirmed!");
      queryClient.invalidateQueries({ queryKey: ["vendor-job", token] });
    },
    onError: (error) => toast.error("Failed to confirm: " + error.message),
  });

  // Decline job mutation
  const declineJob = useMutation({
    mutationFn: async (reason: string) => {
      if (!workOrder?.id) throw new Error("No work order");
      const { error } = await supabase
        .from("work_orders")
        .update({ vendor_accepted: false, assigned_vendor_id: null, status: "new", vendor_declined_reason: reason || "No reason provided" })
        .eq("id", workOrder.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Job declined.");
      queryClient.invalidateQueries({ queryKey: ["vendor-job", token] });
      setShowDeclineReason(false);
    },
    onError: (error) => toast.error("Failed to decline: " + error.message),
  });

  // Submit quote mutation
  const submitQuote = useMutation({
    mutationFn: async (amount: number) => {
      if (!workOrder?.id) throw new Error("No work order");
      const newStatus = amount > 300 ? "awaiting_approval" : workOrder.status;
      const { error } = await supabase
        .from("work_orders")
        .update({ quoted_cost: amount, status: newStatus as any })
        .eq("id", workOrder.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Quote submitted!");
      setShowQuoteInput(false);
      setQuoteAmount("");
      queryClient.invalidateQueries({ queryKey: ["vendor-job", token] });
    },
    onError: (error) => toast.error("Failed to submit quote: " + error.message),
  });

  // Start work mutation
  const startWork = useMutation({
    mutationFn: async () => {
      if (!workOrder?.id) throw new Error("No work order");
      const { error } = await supabase.from("work_orders").update({ status: "in_progress" }).eq("id", workOrder.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Work started!");
      queryClient.invalidateQueries({ queryKey: ["vendor-job", token] });
    },
    onError: (error) => toast.error("Failed to update: " + error.message),
  });

  // Mark complete mutation
  const markComplete = useMutation({
    mutationFn: async () => {
      if (!workOrder?.id) throw new Error("No work order");
      const { error } = await supabase
        .from("work_orders")
        .update({ status: "pending_verification", completed_at: new Date().toISOString() })
        .eq("id", workOrder.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Job marked complete!");
      queryClient.invalidateQueries({ queryKey: ["vendor-job", token] });
    },
    onError: (error) => toast.error("Failed to update: " + error.message),
  });

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!workOrder?.id || !message.trim()) throw new Error("No message");
      const { error } = await supabase.from("maintenance_messages").insert({
        work_order_id: workOrder.id,
        sender_type: "vendor",
        sender_name: workOrder.assigned_vendor?.name || "Vendor",
        message_text: message,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Message sent!");
      setMessage("");
    },
    onError: (error) => toast.error("Failed to send: " + error.message),
  });

  const handleBeforePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadPhoto.mutate({ file, type: "before" });
  };

  const handleAfterPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadPhoto.mutate({ file, type: "after" });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  const getGoogleMapsUrl = () => {
    if (!workOrder?.property) return "";
    return `https://maps.google.com/?q=${encodeURIComponent(workOrder.property.address || "")}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <img src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png" alt="PeachHaus" className="h-10 mx-auto mb-6" />
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        </div>
      </div>
    );
  }

  if (error || !workOrder) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-sm w-full">
          <CardHeader className="text-center pb-2">
            <img src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png" alt="PeachHaus" className="h-8 mx-auto mb-4" />
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
            <CardTitle>Job Not Found</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground text-sm">This job link may have expired or is invalid.</p>
            <Button className="mt-4 w-full" variant="outline" asChild>
              <a href="tel:+14049915076"><Phone className="h-4 w-4 mr-2" />Call Support</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const photosByType = {
    before: photos.filter(p => p.photo_type === "before"),
    after: photos.filter(p => p.photo_type === "after"),
  };

  const needsResponse = workOrder.vendor_accepted === null && workOrder.status === "dispatched";
  const isScheduled = workOrder.vendor_accepted === true && workOrder.status === "scheduled";
  const isInProgress = workOrder.status === "in_progress";
  const isPendingOrComplete = workOrder.status === "pending_verification" || workOrder.status === "completed";

  const hasAccessCodes = maintenanceBook?.lockbox_code || maintenanceBook?.gate_code || maintenanceBook?.alarm_code;
  const accessInstructions = maintenanceBook?.access_instructions || workOrder.access_instructions;

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Clean Header */}
      <header className="bg-background border-b sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <img src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png" alt="PeachHaus" className="h-8" />
          <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Process Explanation for New Jobs */}
        {needsResponse && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold text-foreground mb-2">How This Works:</p>
                  <ol className="space-y-1.5 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">1</span>
                      <span><strong>Confirm</strong> you can take the job, or <strong>Submit Quote</strong> if needed</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">2</span>
                      <span>Take <strong>Before Photos</strong> when you arrive</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">3</span>
                      <span>Complete work, take <strong>After Photos</strong></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">4</span>
                      <span>Mark Complete → Submit invoice via <strong>Bill.com</strong></span>
                    </li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Property Card */}
        <Card>
          <CardContent className="p-0">
            {workOrder.property?.image_path && (
              <div className="h-32 overflow-hidden">
                <img 
                  src={workOrder.property.image_path} 
                  alt={workOrder.property.name || "Property"} 
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-muted rounded-lg shrink-0">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{workOrder.property?.name || "Property"}</p>
                  <p className="text-sm text-muted-foreground">{workOrder.property?.address}</p>
                </div>
              </div>
              <Button variant="outline" className="w-full mt-3" asChild>
                <a href={getGoogleMapsUrl()} target="_blank" rel="noopener noreferrer">
                  <MapPin className="h-4 w-4 mr-2" />Navigate<ExternalLink className="h-3 w-3 ml-2" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Access Codes - Always Visible */}
        {(hasAccessCodes || accessInstructions) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Key className="h-4 w-4" />Access Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {hasAccessCodes && (
                <div className="grid grid-cols-1 gap-2">
                  {maintenanceBook?.lockbox_code && (
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                        <Lock className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Lockbox Code</p>
                          <p className="font-mono font-semibold">{maintenanceBook.lockbox_code}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(maintenanceBook.lockbox_code!, "Lockbox code")}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  {maintenanceBook?.gate_code && (
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                        <Key className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Gate Code</p>
                          <p className="font-mono font-semibold">{maintenanceBook.gate_code}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(maintenanceBook.gate_code!, "Gate code")}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  {maintenanceBook?.alarm_code && (
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Alarm Code</p>
                          <p className="font-mono font-semibold">{maintenanceBook.alarm_code}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(maintenanceBook.alarm_code!, "Alarm code")}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
              {accessInstructions && (
                <div className="p-3 bg-muted/50 rounded-lg border">
                  <p className="text-xs text-muted-foreground mb-1">Access Instructions</p>
                  <p className="text-sm whitespace-pre-wrap">{accessInstructions}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Job Details */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-lg">{workOrder.title}</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs capitalize">{workOrder.category?.replace(/_/g, " ")}</Badge>
                  <Badge variant={urgencyConfig.variant} className="text-xs">{urgencyConfig.label}</Badge>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {workOrder.description && (
              <p className="text-sm text-muted-foreground">{workOrder.description}</p>
            )}
            <Separator />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-4 w-4" />Created {format(new Date(workOrder.created_at), "MMM d, yyyy")}
              </span>
              {workOrder.quoted_cost && (
                <span className="font-semibold text-green-600 flex items-center gap-1">
                  <DollarSign className="h-4 w-4" />{workOrder.quoted_cost}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons - Confirm/Decline/Quote */}
        {needsResponse && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <Button 
                size="lg" 
                className="w-full" 
                onClick={() => confirmJob.mutate()} 
                disabled={confirmJob.isPending}
              >
                {confirmJob.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Confirm Job
                  </>
                )}
              </Button>
              
              <Button 
                size="lg" 
                variant="outline" 
                className="w-full" 
                onClick={() => setShowQuoteInput(!showQuoteInput)}
              >
                <DollarSign className="h-4 w-4 mr-2" />Submit Quote
              </Button>

              {showQuoteInput && (
                <div className="p-3 bg-muted rounded-lg space-y-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input 
                        type="number" 
                        value={quoteAmount} 
                        onChange={(e) => setQuoteAmount(e.target.value)} 
                        placeholder="Amount" 
                        className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm bg-background"
                      />
                    </div>
                    <Button onClick={() => submitQuote.mutate(Number(quoteAmount))} disabled={!quoteAmount || submitQuote.isPending}>
                      {submitQuote.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Quotes over $300 require owner approval</p>
                </div>
              )}

              <Button 
                variant="ghost" 
                className="w-full text-muted-foreground hover:text-destructive" 
                onClick={() => setShowDeclineReason(true)}
              >
                <X className="h-4 w-4 mr-2" />Decline
              </Button>

              {showDeclineReason && (
                <div className="p-3 bg-muted rounded-lg space-y-2">
                  <Textarea 
                    value={declineReason} 
                    onChange={(e) => setDeclineReason(e.target.value)} 
                    placeholder="Reason (optional)..." 
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowDeclineReason(false)} className="flex-1">
                      Cancel
                    </Button>
                    <Button variant="destructive" onClick={() => declineJob.mutate(declineReason)} disabled={declineJob.isPending} className="flex-1">
                      {declineJob.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Decline"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Start Work Button */}
        {isScheduled && (
          <Button size="lg" className="w-full" onClick={() => startWork.mutate()} disabled={startWork.isPending}>
            {startWork.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (
              <>
                <Play className="h-4 w-4 mr-2" />Start Work
              </>
            )}
          </Button>
        )}

        {/* Photo Upload - Simplified */}
        {(isScheduled || isInProgress || isPendingOrComplete) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Camera className="h-4 w-4" />Photos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Before Photos */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Before Photos</span>
                  <Badge variant="secondary">{photosByType.before.length}</Badge>
                </div>
                {photosByType.before.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {photosByType.before.map((photo) => (
                      <div key={photo.id} className="aspect-square rounded-lg overflow-hidden bg-muted">
                        <img src={photo.photo_url} alt="Before" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
                <Button 
                  variant="outline" 
                  className="w-full h-12"
                  onClick={() => beforeInputRef.current?.click()} 
                  disabled={uploading}
                >
                  {uploading && photoType === "before" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Camera className="h-4 w-4 mr-2" />Take Before Photo
                    </>
                  )}
                </Button>
                <input 
                  type="file" 
                  ref={beforeInputRef} 
                  accept="image/*" 
                  capture="environment" 
                  onChange={(e) => { setPhotoType("before"); handleBeforePhoto(e); }} 
                  className="hidden" 
                />
              </div>

              <Separator />

              {/* After Photos */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">After Photos</span>
                  <Badge variant="secondary">{photosByType.after.length}</Badge>
                </div>
                {photosByType.after.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {photosByType.after.map((photo) => (
                      <div key={photo.id} className="aspect-square rounded-lg overflow-hidden bg-muted">
                        <img src={photo.photo_url} alt="After" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
                <Button 
                  variant="outline" 
                  className="w-full h-12"
                  onClick={() => afterInputRef.current?.click()} 
                  disabled={uploading}
                >
                  {uploading && photoType === "after" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Camera className="h-4 w-4 mr-2" />Take After Photo
                    </>
                  )}
                </Button>
                <input 
                  type="file" 
                  ref={afterInputRef} 
                  accept="image/*" 
                  capture="environment" 
                  onChange={(e) => { setPhotoType("after"); handleAfterPhoto(e); }} 
                  className="hidden" 
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Message Section */}
        {(isScheduled || isInProgress) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Phone className="h-4 w-4" />Message
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Textarea 
                  value={message} 
                  onChange={(e) => setMessage(e.target.value)} 
                  placeholder="Message to property manager..." 
                  rows={2} 
                  className="flex-1"
                />
                <Button onClick={() => sendMessage.mutate()} disabled={!message.trim() || sendMessage.isPending}>
                  {sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mark Complete */}
        {isInProgress && (
          <Button size="lg" className="w-full" onClick={() => markComplete.mutate()} disabled={markComplete.isPending}>
            {markComplete.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />Mark Job Complete
              </>
            )}
          </Button>
        )}

        {/* Bill.com Section */}
        {isPendingOrComplete && (
          <Card className="border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">Submit Your Invoice</p>
                  <p className="text-sm text-muted-foreground mt-1">Submit your invoice through Bill.com for payment.</p>
                  <Button className="mt-3 w-full" asChild>
                    <a href="https://app.bill.com" target="_blank" rel="noopener noreferrer">
                      Open Bill.com<ArrowRight className="h-4 w-4 ml-2" />
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground">
            Questions? <a href="tel:+14049915076" className="text-primary font-medium">404-991-5076</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default VendorJobPortal;
