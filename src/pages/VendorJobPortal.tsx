import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import GetPaidModal from "@/components/maintenance/GetPaidModal";
import { 
  MapPin, Clock, CheckCircle, XCircle, 
  Camera, DollarSign, ExternalLink, Phone, Loader2, Send, 
  Building2, Play, X, Lock, Key, Shield, Copy, FileText,
  ArrowRight, ChevronDown, ChevronUp, AlertCircle, Pause, Mic, Video,
  PawPrint, Car, Wrench, AlertTriangle
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
  quote_scope: string | null;
  quote_materials: string | null;
  quote_labor_hours: number | null;
  voice_message_url: string | null;
  voice_message_transcript: string | null;
  video_url: string | null;
  // Enhanced access fields
  tenant_contact_name: string | null;
  tenant_contact_phone: string | null;
  pets_on_property: string | null;
  parking_instructions: string | null;
  utility_shutoff_notes: string | null;
  safety_notes: string | null;
  property: { id: string; name: string | null; address: string | null; image_path: string | null } | null;
  assigned_vendor: { id: string; name: string; phone: string | null; company_name: string | null; billcom_vendor_id: string | null; billcom_invite_sent_at: string | null } | null;
}

interface MaintenanceBook {
  lockbox_code: string | null;
  gate_code: string | null;
  alarm_code: string | null;
  access_instructions: string | null;
  vendor_access_code: string | null;
}

const VendorJobPortal = () => {
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();
  
  const [uploading, setUploading] = useState(false);
  const [quoteAmount, setQuoteAmount] = useState("");
  const [quoteScope, setQuoteScope] = useState("");
  const [quoteMaterials, setQuoteMaterials] = useState("");
  const [quoteLaborHours, setQuoteLaborHours] = useState("");
  const [quoteNote, setQuoteNote] = useState("");
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [message, setMessage] = useState("");
  const [showDeclineReason, setShowDeclineReason] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [showAccessCodes, setShowAccessCodes] = useState(false);
  const [showGetPaidModal, setShowGetPaidModal] = useState(false);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const beforeInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef = useRef<HTMLInputElement>(null);
  const voiceAudioRef = useRef<HTMLAudioElement>(null);

  // Fetch work order by token
  const { data: workOrder, isLoading, error } = useQuery({
    queryKey: ["vendor-job", token],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_orders")
        .select(`
          id, title, description, category, urgency, status, 
          created_at, access_instructions, quoted_cost,
          vendor_accepted, completed_at, quote_scope, quote_materials, quote_labor_hours,
          voice_message_url, voice_message_transcript, video_url,
          tenant_contact_name, tenant_contact_phone, pets_on_property,
          parking_instructions, utility_shutoff_notes, safety_notes,
          property:properties(id, name, address, image_path),
          assigned_vendor:vendors!work_orders_assigned_vendor_id_fkey(id, name, phone, company_name, billcom_vendor_id, billcom_invite_sent_at)
        `)
        .eq("vendor_access_token", token)
        .single();
      
      if (error) throw error;
      return data as unknown as WorkOrderData;
    },
    enabled: !!token,
  });

  // Set up realtime subscription for work order updates
  useEffect(() => {
    if (!workOrder?.id) return;
    
    const channel = supabase
      .channel(`vendor-job-${workOrder.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'work_orders',
          filter: `id=eq.${workOrder.id}`,
        },
        (payload) => {
          console.log('Work order realtime update:', payload);
          queryClient.invalidateQueries({ queryKey: ["vendor-job", token] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workOrder?.id, token, queryClient]);

  // Fetch property maintenance book for access codes
  const { data: maintenanceBook } = useQuery({
    queryKey: ["property-maintenance-book", workOrder?.property?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_maintenance_book")
        .select("lockbox_code, gate_code, alarm_code, access_instructions, vendor_access_code")
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
    if (workOrder.status === "dispatched" && workOrder.vendor_accepted === null) return 1;
    if (workOrder.status === "pending_approval") return 1; // Awaiting owner approval
    if (workOrder.status === "scheduled" || workOrder.status === "awaiting_approval") return 2;
    if (workOrder.status === "in_progress") return 3;
    if (workOrder.status === "pending_verification" || workOrder.status === "completed") return 4;
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
      toast.success("Photo uploaded");
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
      toast.success("Job confirmed");
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
      toast.success("Job declined");
      queryClient.invalidateQueries({ queryKey: ["vendor-job", token] });
      setShowDeclineReason(false);
    },
    onError: (error) => toast.error("Failed to decline: " + error.message),
  });

  // Submit quote mutation - triggers owner approval for quotes > $300
  const submitQuote = useMutation({
    mutationFn: async () => {
      if (!workOrder?.id) throw new Error("No work order");
      const amount = Number(quoteAmount);
      
      console.log("[VendorJobPortal] Submitting quote:", { amount, workOrderId: workOrder.id });
      
      // Update work order with quote details
      const updateData: Record<string, unknown> = {
        quoted_cost: amount,
        quote_scope: quoteScope || null,
        quote_materials: quoteMaterials || null,
        quote_labor_hours: quoteLaborHours ? Number(quoteLaborHours) : null,
      };
      
      // Set status based on amount - $300 threshold
      if (amount > 300) {
        updateData.status = "pending_approval";
        console.log("[VendorJobPortal] Quote exceeds $300, setting status to pending_approval");
      }
      
      const { error } = await supabase
        .from("work_orders")
        .update(updateData)
        .eq("id", workOrder.id);
      
      if (error) {
        console.error("[VendorJobPortal] Failed to update work order:", error);
        throw error;
      }
      
      console.log("[VendorJobPortal] Work order updated successfully");
      
      // If quote > $300, trigger owner approval notification
      if (amount > 300) {
        console.log("[VendorJobPortal] Invoking send-owner-approval-request edge function...");
        
        try {
          const { data, error: notifyError } = await supabase.functions.invoke("send-owner-approval-request", {
            body: { 
              workOrderId: workOrder.id,
              vendorNote: quoteNote || undefined
            }
          });
          
          if (notifyError) {
            console.error("[VendorJobPortal] Owner notification error:", notifyError);
            // Don't throw - quote was saved, notification is secondary
            toast.warning("Quote saved but owner notification may have failed");
          } else {
            console.log("[VendorJobPortal] Owner notification sent:", data);
          }
        } catch (invokeError) {
          console.error("[VendorJobPortal] Failed to invoke edge function:", invokeError);
        }
      }
      
      return amount;
    },
    onSuccess: (amount) => {
      if (amount > 300) {
        toast.success("Quote submitted — awaiting owner approval");
      } else {
        toast.success("Quote submitted");
      }
      setShowQuoteForm(false);
      setQuoteAmount("");
      setQuoteScope("");
      setQuoteMaterials("");
      setQuoteLaborHours("");
      setQuoteNote("");
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
      toast.success("Work started");
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
      toast.success("Job marked complete");
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
      toast.success("Message sent");
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
    toast.success(`${label} copied`);
  };

  const getGoogleMapsUrl = () => {
    if (!workOrder?.property) return "";
    return `https://maps.google.com/?q=${encodeURIComponent(workOrder.property.address || "")}`;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <div className="text-center">
          <img src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png" alt="PeachHaus" className="h-8 mx-auto mb-6" />
          <Loader2 className="h-6 w-6 animate-spin text-neutral-400 mx-auto" />
          <p className="text-xs text-neutral-500 mt-2">Loading...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !workOrder) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <Card className="max-w-sm w-full border-neutral-200">
          <CardHeader className="text-center pb-2">
            <img src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png" alt="PeachHaus" className="h-7 mx-auto mb-4" />
            <XCircle className="h-10 w-10 text-neutral-400 mx-auto mb-2" />
            <CardTitle className="text-base font-medium">Job Not Found</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-neutral-500 text-sm">This link may have expired or is invalid.</p>
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
  const vendorAccessCode = maintenanceBook?.vendor_access_code || (workOrder as any).vendor_access_code;
  const isPendingApproval = workOrder.status === "pending_approval" || workOrder.status === "awaiting_approval";
  
  // Check for any site access info
  const hasSiteInfo = hasAccessCodes || accessInstructions || vendorAccessCode ||
    workOrder.tenant_contact_name || workOrder.tenant_contact_phone ||
    workOrder.pets_on_property || workOrder.parking_instructions ||
    workOrder.utility_shutoff_notes || workOrder.safety_notes;

  // Step labels
  const steps = [
    { num: 1, label: "Respond" },
    { num: 2, label: "Start" },
    { num: 3, label: "Complete" },
    { num: 4, label: "Invoice" },
  ];

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <img src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png" alt="PeachHaus" className="h-7" />
          <span className="text-xs text-neutral-500 font-medium">
            {isPendingApproval ? "Awaiting Approval" : `Step ${currentStep} of 4`}
          </span>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
        
        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-2">
          {steps.map((step, idx) => (
            <div key={step.num} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium border-2 transition-colors",
                  step.num < currentStep 
                    ? "bg-neutral-900 border-neutral-900 text-white" 
                    : step.num === currentStep 
                      ? "bg-white border-neutral-900 text-neutral-900" 
                      : "bg-white border-neutral-200 text-neutral-400"
                )}>
                  {step.num < currentStep ? <CheckCircle className="h-3.5 w-3.5" /> : step.num}
                </div>
                <span className={cn(
                  "text-[10px] mt-1 font-medium",
                  step.num <= currentStep ? "text-neutral-700" : "text-neutral-400"
                )}>
                  {step.label}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div className={cn(
                  "h-px flex-1 mx-1 -mt-4",
                  step.num < currentStep ? "bg-neutral-900" : "bg-neutral-200"
                )} />
              )}
            </div>
          ))}
        </div>

        {/* Pending Approval Notice */}
        {isPendingApproval && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-900">Awaiting Owner Approval</p>
                  <p className="text-xs text-amber-700 mt-1">
                    Your quote of ${workOrder.quoted_cost?.toLocaleString()} has been submitted. 
                    You'll be notified once the owner responds.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Property & Job Summary */}
        <Card className="border-neutral-200">
          <CardContent className="p-4">
            {/* Larger Property Image */}
            {workOrder.property?.image_path ? (
              <img 
                src={workOrder.property.image_path} 
                alt={workOrder.property.name || "Property"} 
                className="w-full h-48 rounded-lg object-cover"
              />
            ) : (
              <div className="w-full h-32 rounded-lg bg-neutral-100 flex items-center justify-center">
                <Building2 className="h-10 w-10 text-neutral-400" />
              </div>
            )}
            
            {/* Get Directions - Prominent placement below image */}
            <Button className="w-full mt-3 bg-neutral-900 hover:bg-neutral-800 text-white h-12 text-base touch-manipulation" asChild>
              <a href={getGoogleMapsUrl()} target="_blank" rel="noopener noreferrer">
                <MapPin className="h-5 w-5 mr-2" />Get Directions
              </a>
            </Button>
            
            <div className="min-w-0 mt-4">
              <h2 className="font-semibold text-neutral-900 text-lg leading-tight">{workOrder.title}</h2>
              <p className="text-sm text-neutral-500 mt-0.5">{workOrder.property?.name}</p>
              <p className="text-xs text-neutral-400 mt-1">{workOrder.property?.address}</p>
            </div>
            
            <div className="flex gap-2 mt-3">
              <Badge variant="outline" className="text-xs capitalize bg-white">{workOrder.category?.replace(/_/g, " ")}</Badge>
              {workOrder.urgency === "emergency" && (
                <Badge className="text-xs bg-red-100 text-red-700 border-red-200">Emergency</Badge>
              )}
            </div>
            
            {workOrder.description && (
              <p className="text-sm text-neutral-600 mt-3 p-3 bg-neutral-50 rounded border border-neutral-100">{workOrder.description}</p>
            )}
            
            {/* Voice Message Section - Mobile Optimized */}
            {workOrder.voice_message_url && (
              <div className="mt-4 p-3 sm:p-4 bg-neutral-50 rounded-lg border border-neutral-200">
                <div className="flex items-center gap-2 mb-3">
                  <Mic className="h-4 w-4 text-neutral-600" />
                  <span className="text-sm font-medium text-neutral-700">Voice Instructions</span>
                </div>
                
                <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-white rounded-lg border border-neutral-200">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white flex-shrink-0 touch-manipulation"
                    onClick={() => {
                      if (voiceAudioRef.current) {
                        if (isPlayingVoice) {
                          voiceAudioRef.current.pause();
                          setIsPlayingVoice(false);
                        } else {
                          voiceAudioRef.current.play();
                          setIsPlayingVoice(true);
                        }
                      }
                    }}
                  >
                    {isPlayingVoice ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
                  </Button>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-neutral-500">Audio Message</p>
                    <p className="text-sm text-neutral-700 font-medium">Tap to play</p>
                  </div>
                </div>
                <audio 
                  ref={voiceAudioRef} 
                  src={workOrder.voice_message_url} 
                  onEnded={() => setIsPlayingVoice(false)} 
                  className="hidden" 
                />
                
                {/* Collapsible Voice Transcript */}
                {workOrder.voice_message_transcript && (
                  <div className="mt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowTranscript(!showTranscript)}
                      className="w-full justify-between text-neutral-600 hover:text-neutral-900 h-10 touch-manipulation"
                    >
                      <span className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5" />
                        {showTranscript ? "Hide Transcript" : "Show Transcript"}
                      </span>
                      {showTranscript ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                    {showTranscript && (
                      <div className="mt-2 p-3 bg-white rounded-lg border border-neutral-200">
                        <p className="text-sm text-neutral-700 whitespace-pre-wrap leading-relaxed">{workOrder.voice_message_transcript}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {/* Video Section - Mobile Optimized */}
            {workOrder.video_url && (
              <div className="mt-4 p-3 sm:p-4 bg-neutral-50 rounded-lg border border-neutral-200">
                <div className="flex items-center gap-2 mb-3">
                  <Video className="h-4 w-4 text-neutral-600" />
                  <span className="text-sm font-medium text-neutral-700">Video Instructions</span>
                </div>
                
                <div className="relative w-full rounded-lg overflow-hidden border border-neutral-200 bg-black">
                  <video 
                    src={workOrder.video_url} 
                    controls 
                    className="w-full max-h-[300px] object-contain"
                    playsInline
                    preload="metadata"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Site Access & Safety - Always visible, not collapsed */}
        {hasSiteInfo && (
          <Card className="border-2 border-foreground">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide flex items-center gap-2">
                <Key className="h-4 w-4" />SITE ACCESS & SAFETY
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {/* Vendor Access Code - PROMINENT */}
              {vendorAccessCode && (
                <div className="p-4 bg-primary/10 border-2 border-primary rounded-lg">
                  <p className="text-[10px] text-primary font-bold uppercase tracking-wide mb-2 flex items-center gap-1">
                    🔑 VENDOR ACCESS CODE
                  </p>
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-2xl font-bold text-primary tracking-wider">{vendorAccessCode}</p>
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(vendorAccessCode, "Vendor Access Code")} className="h-10 touch-manipulation">
                      <Copy className="h-4 w-4 mr-1" />Copy
                    </Button>
                  </div>
                </div>
              )}

              {/* Entry Codes */}
              {hasAccessCodes && (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-wide font-medium text-muted-foreground">Entry</p>
                  {maintenanceBook?.lockbox_code && (
                    <div className="flex items-center justify-between p-3 bg-muted rounded border">
                      <div className="flex items-center gap-3">
                        <Lock className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Lockbox</p>
                          <p className="font-mono font-semibold text-foreground">{maintenanceBook.lockbox_code}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(maintenanceBook.lockbox_code!, "Code")}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  {maintenanceBook?.gate_code && (
                    <div className="flex items-center justify-between p-3 bg-muted rounded border">
                      <div className="flex items-center gap-3">
                        <Key className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Gate</p>
                          <p className="font-mono font-semibold text-foreground">{maintenanceBook.gate_code}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(maintenanceBook.gate_code!, "Code")}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  {maintenanceBook?.alarm_code && (
                    <div className="flex items-center justify-between p-3 bg-muted rounded border">
                      <div className="flex items-center gap-3">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Alarm</p>
                          <p className="font-mono font-semibold text-foreground">{maintenanceBook.alarm_code}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(maintenanceBook.alarm_code!, "Code")}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Access Instructions */}
              {accessInstructions && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded">
                  <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium uppercase tracking-wide mb-1">Entry Instructions</p>
                  <p className="text-sm text-amber-900 dark:text-amber-200 whitespace-pre-wrap">{accessInstructions}</p>
                </div>
              )}

              {/* Tenant Contact */}
              {(workOrder.tenant_contact_name || workOrder.tenant_contact_phone) && (
                <div className="p-3 bg-muted rounded border">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
                    <Phone className="h-3 w-3" />On-Site Contact
                  </p>
                  <div className="flex items-center justify-between">
                    <div>
                      {workOrder.tenant_contact_name && (
                        <p className="text-sm font-medium text-foreground">{workOrder.tenant_contact_name}</p>
                      )}
                      {workOrder.tenant_contact_phone && (
                        <p className="text-sm text-muted-foreground">{workOrder.tenant_contact_phone}</p>
                      )}
                    </div>
                    {workOrder.tenant_contact_phone && (
                      <Button variant="outline" size="sm" className="h-10 touch-manipulation" asChild>
                        <a href={`tel:${workOrder.tenant_contact_phone}`}>
                          <Phone className="h-4 w-4 mr-1" />Call
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Pets Warning - Highlighted */}
              {workOrder.pets_on_property && (
                <div className="p-3 bg-amber-100 dark:bg-amber-950/50 border-2 border-amber-300 dark:border-amber-700 rounded">
                  <p className="text-[10px] text-amber-800 dark:text-amber-300 font-bold uppercase tracking-wide mb-1 flex items-center gap-1">
                    <PawPrint className="h-3 w-3" />⚠️ Pets on Property
                  </p>
                  <p className="text-sm text-amber-900 dark:text-amber-200 whitespace-pre-wrap">{workOrder.pets_on_property}</p>
                </div>
              )}

              {/* Parking */}
              {workOrder.parking_instructions && (
                <div className="p-3 bg-muted rounded border">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
                    <Car className="h-3 w-3" />Parking
                  </p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{workOrder.parking_instructions}</p>
                </div>
              )}

              {/* Utility Shutoffs */}
              {workOrder.utility_shutoff_notes && (
                <div className="p-3 bg-muted rounded border">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
                    <Wrench className="h-3 w-3" />Utility Locations
                  </p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{workOrder.utility_shutoff_notes}</p>
                </div>
              )}

              {/* Safety Notes - Red Warning */}
              {workOrder.safety_notes && (
                <div className="p-3 bg-destructive/10 border-2 border-destructive/30 rounded">
                  <p className="text-[10px] text-destructive font-bold uppercase tracking-wide mb-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />⛔ Safety Warning
                  </p>
                  <p className="text-sm text-destructive whitespace-pre-wrap">{workOrder.safety_notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* STEP 1: Respond to Job */}
        {currentStep === 1 && !isPendingApproval && (
          <Card className="border-neutral-900 border-2">
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-medium">Your Response</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <Button 
                size="default" 
                className="w-full bg-neutral-900 hover:bg-neutral-800 text-white" 
                onClick={() => confirmJob.mutate()} 
                disabled={confirmJob.isPending}
              >
                {confirmJob.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                  <>Accept Job<ArrowRight className="h-4 w-4 ml-2" /></>
                )}
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => setShowQuoteForm(!showQuoteForm)}
              >
                <DollarSign className="h-4 w-4 mr-2" />Submit Quote First
              </Button>

              {showQuoteForm && (
                <div className="p-4 bg-neutral-50 rounded border border-neutral-200 space-y-4">
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="quoteAmount" className="text-xs text-neutral-600">Quote Amount *</Label>
                      <div className="relative mt-1">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                        <Input 
                          id="quoteAmount"
                          type="number" 
                          value={quoteAmount} 
                          onChange={(e) => setQuoteAmount(e.target.value)} 
                          placeholder="0.00" 
                          className="pl-9 bg-white"
                        />
                      </div>
                      {Number(quoteAmount) > 300 && (
                        <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />Quotes over $300 require owner approval
                        </p>
                      )}
                    </div>
                    
                    <div>
                      <Label htmlFor="quoteScope" className="text-xs text-neutral-600">Scope of Work</Label>
                      <Textarea 
                        id="quoteScope"
                        value={quoteScope} 
                        onChange={(e) => setQuoteScope(e.target.value)} 
                        placeholder="Describe what work will be performed..."
                        rows={2}
                        className="mt-1 bg-white text-sm"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="quoteMaterials" className="text-xs text-neutral-600">Materials Needed</Label>
                        <Input 
                          id="quoteMaterials"
                          value={quoteMaterials} 
                          onChange={(e) => setQuoteMaterials(e.target.value)} 
                          placeholder="Parts, supplies..."
                          className="mt-1 bg-white text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="quoteLaborHours" className="text-xs text-neutral-600">Est. Labor (hours)</Label>
                        <Input 
                          id="quoteLaborHours"
                          type="number" 
                          value={quoteLaborHours} 
                          onChange={(e) => setQuoteLaborHours(e.target.value)} 
                          placeholder="2"
                          className="mt-1 bg-white text-sm"
                        />
                      </div>
                    </div>
                    
                    {Number(quoteAmount) > 300 && (
                      <div>
                        <Label htmlFor="quoteNote" className="text-xs text-neutral-600">Note for Owner (optional)</Label>
                        <Textarea 
                          id="quoteNote"
                          value={quoteNote} 
                          onChange={(e) => setQuoteNote(e.target.value)} 
                          placeholder="Any additional context for the property owner..."
                          rows={2}
                          className="mt-1 bg-white text-sm"
                        />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowQuoteForm(false)} className="flex-1">
                      Cancel
                    </Button>
                    <Button 
                      onClick={() => submitQuote.mutate()} 
                      disabled={!quoteAmount || submitQuote.isPending}
                      className="flex-1 bg-neutral-900 hover:bg-neutral-800"
                    >
                      {submitQuote.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Quote"}
                    </Button>
                  </div>
                </div>
              )}

              <Button 
                variant="ghost" 
                className="w-full text-neutral-500 hover:text-red-600" 
                onClick={() => setShowDeclineReason(true)}
              >
                <X className="h-4 w-4 mr-2" />Can't Take This Job
              </Button>

              {showDeclineReason && (
                <div className="p-3 bg-red-50 rounded border border-red-100 space-y-2">
                  <Textarea 
                    value={declineReason} 
                    onChange={(e) => setDeclineReason(e.target.value)} 
                    placeholder="Reason (optional)..." 
                    rows={2}
                    className="border-red-200 bg-white text-sm"
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
        {currentStep === 2 && !isPendingApproval && (
          <Card className="border-neutral-900 border-2">
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-medium">Ready to Begin</CardTitle>
              <p className="text-xs text-neutral-500">Take before photos, then start work</p>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-4">
              {/* Before Photos */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-neutral-600">Before Photos</span>
                  <Badge variant="secondary" className="text-xs">{photosByType.before.length}</Badge>
                </div>
                {photosByType.before.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {photosByType.before.map((photo) => (
                      <div key={photo.id} className="aspect-square rounded overflow-hidden bg-neutral-100">
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

              <Separator className="bg-neutral-200" />

              <Button 
                size="default" 
                className="w-full bg-neutral-900 hover:bg-neutral-800 text-white" 
                onClick={() => startWork.mutate()} 
                disabled={startWork.isPending}
              >
                {startWork.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Play className="h-4 w-4 mr-2" />Start Work</>}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* STEP 3: Complete Work */}
        {currentStep === 3 && (
          <Card className="border-neutral-900 border-2">
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-medium">Work In Progress</CardTitle>
              <p className="text-xs text-neutral-500">Upload after photos when done</p>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-4">
              {/* Photo Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs font-medium text-neutral-500 mb-2 block">Before ({photosByType.before.length})</span>
                  {photosByType.before.length > 0 ? (
                    <div className="grid grid-cols-2 gap-1">
                      {photosByType.before.slice(0, 2).map((photo) => (
                        <div key={photo.id} className="aspect-square rounded overflow-hidden">
                          <img src={photo.photo_url} alt="Before" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="aspect-video rounded bg-neutral-100 flex items-center justify-center">
                      <Camera className="h-5 w-5 text-neutral-300" />
                    </div>
                  )}
                </div>
                <div>
                  <span className="text-xs font-medium text-neutral-500 mb-2 block">After ({photosByType.after.length})</span>
                  {photosByType.after.length > 0 ? (
                    <div className="grid grid-cols-2 gap-1">
                      {photosByType.after.slice(0, 2).map((photo) => (
                        <div key={photo.id} className="aspect-square rounded overflow-hidden">
                          <img src={photo.photo_url} alt="After" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="aspect-video rounded bg-neutral-100 flex items-center justify-center">
                      <Camera className="h-5 w-5 text-neutral-300" />
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

              <Separator className="bg-neutral-200" />

              {/* Message */}
              <div>
                <p className="text-xs text-neutral-500 mb-2">Message property manager (optional)</p>
                <div className="flex gap-2">
                  <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Any notes..." rows={1} className="flex-1 text-sm" />
                  <Button onClick={() => sendMessage.mutate()} disabled={!message.trim() || sendMessage.isPending} size="sm" variant="outline">
                    {sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <Button 
                size="default" 
                className="w-full bg-neutral-900 hover:bg-neutral-800 text-white" 
                onClick={() => markComplete.mutate()} 
                disabled={markComplete.isPending}
              >
                {markComplete.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle className="h-4 w-4 mr-2" />Mark Complete</>}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* STEP 4: Submit Invoice */}
        {currentStep === 4 && (
          <Card className="border-border bg-muted/30">
            <CardContent className="p-5 text-center">
              <CheckCircle className="h-10 w-10 text-foreground mx-auto mb-3" />
              <h3 className="text-base font-semibold text-foreground mb-1">Job Complete</h3>
              <p className="text-xs text-muted-foreground mb-4">
                {workOrder.completed_at ? `Completed ${format(new Date(workOrder.completed_at), "MMM d, yyyy")}` : "Great work"}
              </p>
              
              <Separator className="my-4" />
              
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-background rounded border text-left">
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm text-foreground">Get Paid</p>
                    <p className="text-xs text-muted-foreground">
                      Get paid fast by using Bill.com
                    </p>
                  </div>
                </div>
                <Button 
                  className="w-full bg-primary hover:bg-primary/90" 
                  onClick={() => setShowGetPaidModal(true)}
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Get Paid
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Get Paid Modal */}
        {workOrder.assigned_vendor && (
          <GetPaidModal
            open={showGetPaidModal}
            onOpenChange={setShowGetPaidModal}
            workOrderId={workOrder.id}
            vendorId={workOrder.assigned_vendor.id}
            vendorName={workOrder.assigned_vendor.name}
            vendorPhone={workOrder.assigned_vendor.phone}
            propertyName={workOrder.property?.name || "Property"}
            propertyAddress={workOrder.property?.address}
            quotedAmount={workOrder.quoted_cost}
            completedAt={workOrder.completed_at}
            isBillComConnected={!!workOrder.assigned_vendor.billcom_vendor_id}
            billcomInviteSentAt={workOrder.assigned_vendor.billcom_invite_sent_at}
            onEnrollmentComplete={() => queryClient.invalidateQueries({ queryKey: ["vendor-job", token] })}
          />
        )}

        {/* Cost Summary */}
        {workOrder.quoted_cost && (
          <Card className="border-neutral-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-500">Quoted Amount</span>
                <span className="text-lg font-semibold text-neutral-900 font-mono">${workOrder.quoted_cost.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center pt-4 pb-8">
          <p className="text-xs text-neutral-400">
            Questions? <a href="tel:+14049915076" className="text-neutral-600 font-medium">404-991-5076</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default VendorJobPortal;
