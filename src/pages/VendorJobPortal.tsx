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
  MapPin, Clock, CheckCircle, XCircle, 
  Camera, DollarSign, ExternalLink, Phone, Loader2, Send, 
  Building2, Play, X, Lock, Key, Shield, Copy, FileText,
  ArrowRight, ChevronDown, ChevronUp
} from "lucide-react";

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
  
  const [uploading, setUploading] = useState(false);
  const [quoteAmount, setQuoteAmount] = useState("");
  const [showQuoteInput, setShowQuoteInput] = useState(false);
  const [message, setMessage] = useState("");
  const [showDeclineReason, setShowDeclineReason] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [showAccessCodes, setShowAccessCodes] = useState(false);
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

  // Determine current step based on status
  const getStep = () => {
    if (!workOrder) return 0;
    if (workOrder.status === "dispatched" && workOrder.vendor_accepted === null) return 1; // Respond
    if (workOrder.status === "scheduled") return 2; // Start Work
    if (workOrder.status === "in_progress") return 3; // Complete
    if (workOrder.status === "pending_verification" || workOrder.status === "completed") return 4; // Done
    return 1;
  };

  const currentStep = getStep();

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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <img src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png" alt="PeachHaus" className="h-10 mx-auto mb-6" />
          <Loader2 className="h-8 w-8 animate-spin text-slate-600 mx-auto" />
          <p className="text-sm text-slate-500 mt-2">Loading job details...</p>
        </div>
      </div>
    );
  }

  if (error || !workOrder) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-sm w-full shadow-sm">
          <CardHeader className="text-center pb-2">
            <img src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png" alt="PeachHaus" className="h-8 mx-auto mb-4" />
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-2" />
            <CardTitle className="text-lg">Job Not Found</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-slate-500 text-sm">This job link may have expired or is invalid.</p>
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

  const hasAccessCodes = maintenanceBook?.lockbox_code || maintenanceBook?.gate_code || maintenanceBook?.alarm_code;
  const accessInstructions = maintenanceBook?.access_instructions || workOrder.access_instructions;

  // Step indicator component
  const StepIndicator = () => (
    <div className="flex items-center justify-center gap-1 mb-6">
      {[1, 2, 3, 4].map((step) => (
        <div key={step} className="flex items-center">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
            step < currentStep ? "bg-green-500 text-white" :
            step === currentStep ? "bg-slate-800 text-white" :
            "bg-slate-200 text-slate-400"
          )}>
            {step < currentStep ? <CheckCircle className="h-4 w-4" /> : step}
          </div>
          {step < 4 && <div className={cn("w-8 h-0.5", step < currentStep ? "bg-green-500" : "bg-slate-200")} />}
        </div>
      ))}
    </div>
  );

  // Step labels
  const stepLabels = ["", "Respond", "Start Work", "Complete", "Submit Invoice"];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <img src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png" alt="PeachHaus" className="h-8" />
          <Badge variant="outline" className="text-xs font-medium">
            Step {currentStep}: {stepLabels[currentStep]}
          </Badge>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Progress Steps */}
        <StepIndicator />

        {/* Property & Job Summary Card */}
        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-4">
            <div className="flex gap-4">
              {workOrder.property?.image_path ? (
                <img 
                  src={workOrder.property.image_path} 
                  alt={workOrder.property.name || "Property"} 
                  className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-20 h-20 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-8 w-8 text-slate-400" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-lg text-slate-900 leading-tight">{workOrder.title}</h2>
                <p className="text-sm text-slate-500 mt-0.5">{workOrder.property?.name}</p>
                <p className="text-xs text-slate-400 mt-1">{workOrder.property?.address}</p>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline" className="text-xs capitalize">{workOrder.category?.replace(/_/g, " ")}</Badge>
                  {workOrder.urgency === "emergency" && <Badge variant="destructive" className="text-xs">Emergency</Badge>}
                </div>
              </div>
            </div>
            {workOrder.description && (
              <p className="text-sm text-slate-600 mt-4 p-3 bg-slate-50 rounded-lg">{workOrder.description}</p>
            )}
            <Button variant="outline" className="w-full mt-4" size="sm" asChild>
              <a href={getGoogleMapsUrl()} target="_blank" rel="noopener noreferrer">
                <MapPin className="h-4 w-4 mr-2" />Get Directions<ExternalLink className="h-3 w-3 ml-2" />
              </a>
            </Button>
          </CardContent>
        </Card>

        {/* Access Codes - Collapsible */}
        {(hasAccessCodes || accessInstructions) && (
          <Card className="shadow-sm border-slate-200">
            <CardHeader 
              className="p-4 cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => setShowAccessCodes(!showAccessCodes)}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Key className="h-4 w-4 text-slate-600" />Access Codes
                </CardTitle>
                {showAccessCodes ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CardHeader>
            {showAccessCodes && (
              <CardContent className="pt-0 px-4 pb-4 space-y-2">
                {maintenanceBook?.lockbox_code && (
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Lock className="h-4 w-4 text-slate-500" />
                      <div>
                        <p className="text-xs text-slate-500">Lockbox</p>
                        <p className="font-mono font-semibold">{maintenanceBook.lockbox_code}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(maintenanceBook.lockbox_code!, "Code")}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                {maintenanceBook?.gate_code && (
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Key className="h-4 w-4 text-slate-500" />
                      <div>
                        <p className="text-xs text-slate-500">Gate</p>
                        <p className="font-mono font-semibold">{maintenanceBook.gate_code}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(maintenanceBook.gate_code!, "Code")}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                {maintenanceBook?.alarm_code && (
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Shield className="h-4 w-4 text-slate-500" />
                      <div>
                        <p className="text-xs text-slate-500">Alarm</p>
                        <p className="font-mono font-semibold">{maintenanceBook.alarm_code}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(maintenanceBook.alarm_code!, "Code")}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                {accessInstructions && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-700 font-medium mb-1">Instructions</p>
                    <p className="text-sm text-amber-900 whitespace-pre-wrap">{accessInstructions}</p>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        )}

        {/* STEP 1: Respond to Job */}
        {currentStep === 1 && (
          <Card className="shadow-sm border-2 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Your Response</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                size="lg" 
                className="w-full bg-green-600 hover:bg-green-700" 
                onClick={() => confirmJob.mutate()} 
                disabled={confirmJob.isPending}
              >
                {confirmJob.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                  <><CheckCircle className="h-5 w-5 mr-2" />Accept Job</>
                )}
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => setShowQuoteInput(!showQuoteInput)}
              >
                <DollarSign className="h-4 w-4 mr-2" />Submit Quote First
              </Button>

              {showQuoteInput && (
                <div className="p-3 bg-slate-50 rounded-lg space-y-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input 
                        type="number" 
                        value={quoteAmount} 
                        onChange={(e) => setQuoteAmount(e.target.value)} 
                        placeholder="Amount" 
                        className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                      />
                    </div>
                    <Button onClick={() => submitQuote.mutate(Number(quoteAmount))} disabled={!quoteAmount || submitQuote.isPending}>
                      {submitQuote.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500">Quotes over $300 require owner approval</p>
                </div>
              )}

              <Button 
                variant="ghost" 
                className="w-full text-slate-500 hover:text-red-600" 
                onClick={() => setShowDeclineReason(true)}
              >
                <X className="h-4 w-4 mr-2" />Can't Take This Job
              </Button>

              {showDeclineReason && (
                <div className="p-3 bg-red-50 rounded-lg space-y-2">
                  <Textarea 
                    value={declineReason} 
                    onChange={(e) => setDeclineReason(e.target.value)} 
                    placeholder="Reason (optional)..." 
                    rows={2}
                    className="border-red-200"
                  />
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowDeclineReason(false)} className="flex-1">Cancel</Button>
                    <Button variant="destructive" onClick={() => declineJob.mutate(declineReason)} disabled={declineJob.isPending} className="flex-1">
                      {declineJob.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Decline"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* STEP 2: Start Work */}
        {currentStep === 2 && (
          <Card className="shadow-sm border-2 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Ready to Begin?</CardTitle>
              <p className="text-sm text-slate-500">Take before photos first, then start work</p>
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
                      <div key={photo.id} className="aspect-square rounded-lg overflow-hidden bg-slate-100">
                        <img src={photo.photo_url} alt="Before" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => beforeInputRef.current?.click()} 
                  disabled={uploading}
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Camera className="h-4 w-4 mr-2" />Take Before Photo</>}
                </Button>
                <input type="file" ref={beforeInputRef} accept="image/*" capture="environment" onChange={handleBeforePhoto} className="hidden" />
              </div>

              <Separator />

              <Button 
                size="lg" 
                className="w-full bg-slate-800 hover:bg-slate-900" 
                onClick={() => startWork.mutate()} 
                disabled={startWork.isPending}
              >
                {startWork.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Play className="h-5 w-5 mr-2" />Start Work</>}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* STEP 3: Complete Work */}
        {currentStep === 3 && (
          <Card className="shadow-sm border-2 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Work In Progress</CardTitle>
              <p className="text-sm text-slate-500">Upload after photos when done</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Photo Sections */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-500">Before ({photosByType.before.length})</span>
                  </div>
                  {photosByType.before.length > 0 ? (
                    <div className="grid grid-cols-2 gap-1">
                      {photosByType.before.slice(0, 2).map((photo) => (
                        <div key={photo.id} className="aspect-square rounded overflow-hidden">
                          <img src={photo.photo_url} alt="Before" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="aspect-video rounded bg-slate-100 flex items-center justify-center">
                      <Camera className="h-6 w-6 text-slate-300" />
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-500">After ({photosByType.after.length})</span>
                  </div>
                  {photosByType.after.length > 0 ? (
                    <div className="grid grid-cols-2 gap-1">
                      {photosByType.after.slice(0, 2).map((photo) => (
                        <div key={photo.id} className="aspect-square rounded overflow-hidden">
                          <img src={photo.photo_url} alt="After" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="aspect-video rounded bg-slate-100 flex items-center justify-center">
                      <Camera className="h-6 w-6 text-slate-300" />
                    </div>
                  )}
                </div>
              </div>

              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => afterInputRef.current?.click()} 
                disabled={uploading}
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Camera className="h-4 w-4 mr-2" />Take After Photo</>}
              </Button>
              <input type="file" ref={afterInputRef} accept="image/*" capture="environment" onChange={handleAfterPhoto} className="hidden" />

              <Separator />

              {/* Message */}
              <div>
                <p className="text-xs text-slate-500 mb-2">Message property manager (optional)</p>
                <div className="flex gap-2">
                  <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Any notes..." rows={1} className="flex-1" />
                  <Button onClick={() => sendMessage.mutate()} disabled={!message.trim() || sendMessage.isPending} size="sm">
                    {sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <Button 
                size="lg" 
                className="w-full bg-green-600 hover:bg-green-700" 
                onClick={() => markComplete.mutate()} 
                disabled={markComplete.isPending}
              >
                {markComplete.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle className="h-5 w-5 mr-2" />Mark Complete</>}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* STEP 4: Submit Invoice */}
        {currentStep === 4 && (
          <Card className="shadow-sm border-green-200 bg-green-50">
            <CardContent className="p-6 text-center">
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-green-900 mb-1">Job Complete!</h3>
              <p className="text-sm text-green-700 mb-4">
                {workOrder.completed_at ? `Completed ${format(new Date(workOrder.completed_at), "MMM d, yyyy h:mm a")}` : "Great work!"}
              </p>
              
              <Separator className="my-4 bg-green-200" />
              
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-white rounded-lg text-left">
                  <FileText className="h-5 w-5 text-slate-600 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Submit Your Invoice</p>
                    <p className="text-xs text-slate-500">Upload to Bill.com for payment</p>
                  </div>
                </div>
                <Button className="w-full" asChild>
                  <a href="https://app.bill.com" target="_blank" rel="noopener noreferrer">
                    Open Bill.com<ArrowRight className="h-4 w-4 ml-2" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cost Summary */}
        {workOrder.quoted_cost && (
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Quoted Amount</span>
                <span className="text-lg font-bold text-green-600">${workOrder.quoted_cost.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center pt-4 pb-8">
          <p className="text-sm text-slate-400">
            Questions? <a href="tel:+14049915076" className="text-slate-600 font-medium">404-991-5076</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default VendorJobPortal;