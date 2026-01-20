import { useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { 
  MapPin, Clock, AlertTriangle, CheckCircle, XCircle, 
  Camera, DollarSign, ExternalLink, Phone, Loader2, Send, 
  ChevronDown, ChevronUp, Building2, Play, X
} from "lucide-react";

const URGENCY_CONFIG: Record<string, { label: string; color: string; bgColor: string; borderColor: string }> = {
  low: { label: "Low Priority", color: "text-green-700", bgColor: "bg-green-100", borderColor: "border-green-300" },
  normal: { label: "Normal", color: "text-blue-700", bgColor: "bg-blue-100", borderColor: "border-blue-300" },
  medium: { label: "Medium Priority", color: "text-yellow-700", bgColor: "bg-yellow-100", borderColor: "border-yellow-300" },
  high: { label: "High Priority", color: "text-orange-700", bgColor: "bg-orange-100", borderColor: "border-orange-300" },
  emergency: { label: "🚨 Emergency", color: "text-red-700", bgColor: "bg-red-100", borderColor: "border-red-300" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  new: { label: "New", color: "text-gray-700", bgColor: "bg-gray-100" },
  dispatched: { label: "Awaiting Your Response", color: "text-amber-700", bgColor: "bg-amber-100" },
  scheduled: { label: "Scheduled", color: "text-blue-700", bgColor: "bg-blue-100" },
  in_progress: { label: "In Progress", color: "text-purple-700", bgColor: "bg-purple-100" },
  awaiting_approval: { label: "Awaiting Owner Approval", color: "text-yellow-700", bgColor: "bg-yellow-100" },
  pending_verification: { label: "Pending Verification", color: "text-indigo-700", bgColor: "bg-indigo-100" },
  completed: { label: "Completed", color: "text-green-700", bgColor: "bg-green-100" },
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

const VendorJobPortal = () => {
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();
  
  const [photoTab, setPhotoTab] = useState<"before" | "during" | "after">("before");
  const [uploading, setUploading] = useState(false);
  const [quoteAmount, setQuoteAmount] = useState("");
  const [showQuoteInput, setShowQuoteInput] = useState(false);
  const [message, setMessage] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);
  const [showDeclineReason, setShowDeclineReason] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    mutationFn: async (file: File) => {
      if (!workOrder?.id) throw new Error("No work order");
      setUploading(true);
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${workOrder.id}/${photoTab}/${Date.now()}.${fileExt}`;
      
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
          photo_type: photoTab,
          uploaded_by: workOrder.assigned_vendor?.name || "Vendor",
          uploaded_by_type: "vendor",
        });

      if (insertError) throw insertError;
      return publicUrl;
    },
    onSuccess: () => {
      toast.success("Photo uploaded successfully!");
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
      toast.success("Job confirmed! Thank you.");
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
      toast.success("Job declined. The property manager has been notified.");
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
      toast.success("Job marked complete! Please submit your invoice via Bill.com.");
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
      toast.success("Message sent to property manager!");
      setMessage("");
    },
    onError: (error) => toast.error("Failed to send: " + error.message),
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadPhoto.mutate(file);
  };

  const getGoogleMapsUrl = () => {
    if (!workOrder?.property) return "";
    return `https://maps.google.com/?q=${encodeURIComponent(workOrder.property.address || "")}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 flex items-center justify-center p-4">
        <div className="text-center">
          <img src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png" alt="PeachHaus" className="h-12 mx-auto mb-6" />
          <Loader2 className="h-8 w-8 animate-spin text-amber-600 mx-auto" />
        </div>
      </div>
    );
  }

  if (error || !workOrder) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 flex items-center justify-center p-4">
        <Card className="max-w-sm w-full shadow-xl border-0 rounded-3xl overflow-hidden">
          <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 p-6 text-center">
            <img src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png" alt="PeachHaus" className="h-10 mx-auto" />
          </div>
          <CardContent className="p-8 text-center">
            <XCircle className="h-14 w-14 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Job Not Found</h2>
            <p className="text-muted-foreground">This job link may have expired or is invalid.</p>
            <Button className="mt-6 w-full" variant="outline" asChild>
              <a href="tel:+14049915076"><Phone className="h-4 w-4 mr-2" />Call Support</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const photosByType = {
    before: photos.filter(p => p.photo_type === "before"),
    during: photos.filter(p => p.photo_type === "during"),
    after: photos.filter(p => p.photo_type === "after"),
  };

  const needsResponse = workOrder.vendor_accepted === null && workOrder.status === "dispatched";
  const isScheduled = workOrder.vendor_accepted === true && workOrder.status === "scheduled";
  const isInProgress = workOrder.status === "in_progress";
  const isPendingOrComplete = workOrder.status === "pending_verification" || workOrder.status === "completed";

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10 max-w-lg mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <img src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png" alt="PeachHaus" className="h-10" />
            <Badge className={cn("font-semibold", urgencyConfig.bgColor, urgencyConfig.color)}>{urgencyConfig.label}</Badge>
          </div>
          <p className="text-amber-100 text-sm mt-2">Vendor Job Portal</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Property Card */}
        <Card className="overflow-hidden shadow-lg border-0 rounded-2xl">
          {workOrder.property?.image_path ? (
            <div className="relative h-44">
              <img src={workOrder.property.image_path} alt={workOrder.property.name || "Property"} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                <div className="flex items-center gap-2 mb-1"><Building2 className="h-4 w-4" /><span className="font-semibold">{workOrder.property?.name}</span></div>
                <p className="text-sm text-white/90">{workOrder.property?.address}</p>
              </div>
            </div>
          ) : (
            <CardContent className="p-4 bg-gradient-to-br from-amber-50 to-orange-50">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-100 rounded-lg"><Building2 className="h-5 w-5 text-amber-600" /></div>
                <div>
                  <p className="font-semibold">{workOrder.property?.name || "Property"}</p>
                  <p className="text-sm text-muted-foreground">{workOrder.property?.address}</p>
                </div>
              </div>
            </CardContent>
          )}
          <a href={getGoogleMapsUrl()} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            <MapPin className="h-4 w-4" /><span className="font-medium">Open in Google Maps</span><ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Card>

        {/* Status Banner */}
        <Card className={cn("border-2", urgencyConfig.borderColor, "shadow-md")}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {needsResponse ? <AlertTriangle className="h-5 w-5 text-amber-600" /> : <Clock className="h-5 w-5 text-primary" />}
                <div>
                  <p className="font-semibold">{needsResponse ? "Action Required" : statusConfig.label}</p>
                  <p className="text-sm text-muted-foreground">{needsResponse ? "Please confirm or decline this job" : ""}</p>
                </div>
              </div>
              <Badge className={cn(statusConfig.bgColor, statusConfig.color)}>{statusConfig.label}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Job Details */}
        <Card className="shadow-lg border-0 rounded-2xl">
          <CardContent className="p-5 space-y-4">
            <div>
              <h2 className="text-xl font-bold">{workOrder.title}</h2>
              <Badge variant="outline" className="mt-2 capitalize">{workOrder.category?.replace(/_/g, " ")}</Badge>
            </div>
            {workOrder.description && <p className="text-muted-foreground">{workOrder.description}</p>}
            {workOrder.access_instructions && (
              <div>
                <button onClick={() => setShowInstructions(!showInstructions)} className="flex items-center justify-between w-full p-3 bg-blue-50 rounded-xl text-left hover:bg-blue-100 transition-colors">
                  <span className="font-semibold text-blue-800">🔑 Access Instructions</span>
                  {showInstructions ? <ChevronUp className="h-4 w-4 text-blue-600" /> : <ChevronDown className="h-4 w-4 text-blue-600" />}
                </button>
                {showInstructions && <div className="mt-2 p-3 bg-blue-50/50 rounded-xl border border-blue-100"><p className="text-sm text-blue-700 whitespace-pre-wrap">{workOrder.access_instructions}</p></div>}
              </div>
            )}
            <div className="flex items-center gap-4 text-sm pt-3 border-t">
              <div className="flex items-center gap-1.5 text-muted-foreground"><Clock className="h-4 w-4" />Created {format(new Date(workOrder.created_at), "MMM d, yyyy")}</div>
              {workOrder.quoted_cost && <div className="flex items-center gap-1 font-semibold text-green-600"><DollarSign className="h-4 w-4" />Quote: ${workOrder.quoted_cost}</div>}
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        {needsResponse && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Button size="lg" className="w-full h-14 text-base font-semibold bg-green-600 hover:bg-green-700 rounded-xl shadow-md" onClick={() => confirmJob.mutate()} disabled={confirmJob.isPending}>
                {confirmJob.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <><CheckCircle className="h-5 w-5 mr-2" />Confirm Job</>}
              </Button>
              <Button size="lg" variant="outline" className="w-full h-14 text-base font-semibold rounded-xl border-2" onClick={() => setShowQuoteInput(!showQuoteInput)}>
                <DollarSign className="h-5 w-5 mr-2" />Submit Quote
              </Button>
            </div>
            <Button size="lg" variant="ghost" className="w-full h-12 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setShowDeclineReason(true)}>
              <X className="h-4 w-4 mr-2" />Decline Job
            </Button>
          </div>
        )}

        {showDeclineReason && (
          <Card className="shadow-lg border-destructive/30 rounded-2xl">
            <CardContent className="p-5 space-y-3">
              <h3 className="font-semibold">Reason for declining (optional)</h3>
              <Textarea value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} placeholder="e.g., Schedule conflict..." rows={2} />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowDeclineReason(false)} className="flex-1">Cancel</Button>
                <Button variant="destructive" onClick={() => declineJob.mutate(declineReason)} disabled={declineJob.isPending} className="flex-1">
                  {declineJob.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Decline Job"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isScheduled && (
          <Button size="lg" className="w-full h-14 text-base font-semibold bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md" onClick={() => startWork.mutate()} disabled={startWork.isPending}>
            {startWork.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Play className="h-5 w-5 mr-2" />Start Work</>}
          </Button>
        )}

        {showQuoteInput && (
          <Card className="shadow-lg border-amber-200 rounded-2xl">
            <CardContent className="p-5 space-y-3">
              <h3 className="font-semibold">Submit Your Quote</h3>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <input type="number" value={quoteAmount} onChange={(e) => setQuoteAmount(e.target.value)} placeholder="Enter amount" className="w-full pl-10 pr-4 py-3 border-2 rounded-xl text-lg" />
                </div>
                <Button size="lg" onClick={() => submitQuote.mutate(Number(quoteAmount))} disabled={!quoteAmount || submitQuote.isPending} className="px-6 rounded-xl">
                  {submitQuote.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Submit"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Quotes over $300 require owner approval</p>
            </CardContent>
          </Card>
        )}

        {/* Photo Upload */}
        {(isScheduled || isInProgress || isPendingOrComplete) && (
          <Card className="shadow-lg border-0 rounded-2xl">
            <CardContent className="p-5">
              <h3 className="font-semibold flex items-center gap-2 mb-4"><Camera className="h-5 w-5 text-primary" />Upload Photos</h3>
              <Tabs value={photoTab} onValueChange={(v) => setPhotoTab(v as typeof photoTab)}>
                <TabsList className="grid grid-cols-3 w-full mb-4">
                  <TabsTrigger value="before">Before ({photosByType.before.length})</TabsTrigger>
                  <TabsTrigger value="during">During ({photosByType.during.length})</TabsTrigger>
                  <TabsTrigger value="after">After ({photosByType.after.length})</TabsTrigger>
                </TabsList>
                {["before", "during", "after"].map((type) => (
                  <TabsContent key={type} value={type} className="mt-0">
                    {photosByType[type as keyof typeof photosByType].length > 0 && (
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        {photosByType[type as keyof typeof photosByType].map((photo) => (
                          <div key={photo.id} className="aspect-square rounded-xl overflow-hidden bg-muted">
                            <img src={photo.photo_url} alt={`${type} photo`} className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                    <Button variant="outline" className="w-full h-20 rounded-xl border-2 border-dashed" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                      {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <div className="flex flex-col items-center gap-1"><Camera className="h-6 w-6 text-primary" /><span className="text-sm font-medium">Take or Upload Photo</span></div>}
                    </Button>
                  </TabsContent>
                ))}
              </Tabs>
              <input type="file" ref={fileInputRef} accept="image/*" capture="environment" onChange={handleFileSelect} className="hidden" />
            </CardContent>
          </Card>
        )}

        {/* Message Section */}
        {(isScheduled || isInProgress) && (
          <Card className="shadow-lg border-0 rounded-2xl">
            <CardContent className="p-5">
              <h3 className="font-semibold flex items-center gap-2 mb-3"><Phone className="h-5 w-5 text-primary" />Message Property Manager</h3>
              <div className="flex gap-2">
                <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type your message..." rows={2} className="flex-1 rounded-xl" />
                <Button onClick={() => sendMessage.mutate()} disabled={!message.trim() || sendMessage.isPending} className="px-4 rounded-xl">
                  {sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mark Complete */}
        {isInProgress && (
          <Button size="lg" className="w-full h-14 text-base font-semibold bg-green-600 hover:bg-green-700 rounded-xl shadow-md" onClick={() => markComplete.mutate()} disabled={markComplete.isPending}>
            {markComplete.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <><CheckCircle className="h-5 w-5 mr-2" />Mark Job Complete</>}
          </Button>
        )}

        {/* Bill.com Reminder */}
        {isPendingOrComplete && (
          <Card className="border-2 border-blue-300 bg-blue-50 shadow-lg rounded-2xl">
            <CardContent className="py-5">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-blue-100 rounded-lg"><DollarSign className="h-6 w-6 text-blue-600" /></div>
                <div>
                  <p className="font-semibold text-blue-800">Submit Invoice via Bill.com</p>
                  <p className="text-sm text-blue-700 mt-1">Please submit your invoice through Bill.com for payment processing.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center py-6">
          <p className="text-sm text-muted-foreground">Questions? Call or text: <a href="tel:+14049915076" className="text-primary font-semibold">404-991-5076</a></p>
          <p className="text-xs text-muted-foreground mt-2">Powered by PeachHaus</p>
        </div>
      </div>
    </div>
  );
};

export default VendorJobPortal;
