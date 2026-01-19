import { useState, useRef, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";
import { 
  MapPin, Clock, AlertTriangle, CheckCircle, XCircle, 
  Camera, Upload, Play, Image, DollarSign, ExternalLink,
  Phone, Loader2, Send, ChevronDown, ChevronUp
} from "lucide-react";

const URGENCY_CONFIG = {
  low: { label: "Low Priority", color: "text-green-700", bgColor: "bg-green-100" },
  medium: { label: "Medium Priority", color: "text-yellow-700", bgColor: "bg-yellow-100" },
  high: { label: "High Priority", color: "text-orange-700", bgColor: "bg-orange-100" },
  emergency: { label: "🚨 Emergency", color: "text-red-700", bgColor: "bg-red-100" },
};

const VendorJobPortal = () => {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  
  const [photoTab, setPhotoTab] = useState<"before" | "during" | "after">("before");
  const [uploading, setUploading] = useState(false);
  const [quoteAmount, setQuoteAmount] = useState("");
  const [showQuoteInput, setShowQuoteInput] = useState(false);
  const [message, setMessage] = useState("");
  const [showInstructions, setShowInstructions] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch work order by token
  const { data: workOrder, isLoading, error } = useQuery({
    queryKey: ["vendor-job", token],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_orders")
        .select(`
          *,
          property:properties(name, address),
          assigned_vendor:vendors!work_orders_assigned_vendor_id_fkey(name, phone)
        `)
        .eq("vendor_access_token", token)
        .single();
      
      if (error) throw error;
      return data as any;
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

  const urgencyConfig = workOrder?.urgency ? URGENCY_CONFIG[workOrder.urgency as keyof typeof URGENCY_CONFIG] : null;

  // Upload photo mutation
  const uploadPhoto = useMutation({
    mutationFn: async (file: File) => {
      if (!workOrder?.id) throw new Error("No work order");

      setUploading(true);
      
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${workOrder.id}/${photoTab}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("work-order-photos")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("work-order-photos")
        .getPublicUrl(fileName);

      // Insert photo record
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

      // Add timeline entry
      await supabase.from("work_order_timeline").insert({
        work_order_id: workOrder.id,
        action: `${photoTab.charAt(0).toUpperCase() + photoTab.slice(1)} photo uploaded by vendor`,
        performed_by_type: "vendor",
        performed_by_name: workOrder.assigned_vendor?.name || "Vendor",
      });

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
        .update({ 
          vendor_accepted: true,
          status: "in_progress"
        })
        .eq("id", workOrder.id);

      if (error) throw error;

      await supabase.from("work_order_timeline").insert({
        work_order_id: workOrder.id,
        action: "Vendor confirmed the job",
        performed_by_type: "vendor",
        performed_by_name: workOrder.assigned_vendor?.name || "Vendor",
        previous_status: workOrder.status,
        new_status: "in_progress",
      });
    },
    onSuccess: () => {
      toast.success("Job confirmed! Thank you.");
      queryClient.invalidateQueries({ queryKey: ["vendor-job", token] });
    },
    onError: (error) => {
      toast.error("Failed to confirm: " + error.message);
    },
  });

  // Submit quote mutation
  const submitQuote = useMutation({
    mutationFn: async (amount: number) => {
      if (!workOrder?.id) throw new Error("No work order");

      const { error } = await supabase
        .from("work_orders")
        .update({ 
          quoted_cost: amount,
          status: amount > 500 ? "awaiting_approval" : workOrder.status,
        })
        .eq("id", workOrder.id);

      if (error) throw error;

      await supabase.from("work_order_timeline").insert({
        work_order_id: workOrder.id,
        action: `Vendor submitted quote: $${amount}`,
        performed_by_type: "vendor",
        performed_by_name: workOrder.assigned_vendor?.name || "Vendor",
      });
    },
    onSuccess: () => {
      toast.success("Quote submitted!");
      setShowQuoteInput(false);
      setQuoteAmount("");
      queryClient.invalidateQueries({ queryKey: ["vendor-job", token] });
    },
    onError: (error) => {
      toast.error("Failed to submit quote: " + error.message);
    },
  });

  // Mark complete mutation
  const markComplete = useMutation({
    mutationFn: async () => {
      if (!workOrder?.id) throw new Error("No work order");

      const { error } = await supabase
        .from("work_orders")
        .update({ 
          status: "pending_verification",
          vendor_completed_at: new Date().toISOString(),
        })
        .eq("id", workOrder.id);

      if (error) throw error;

      await supabase.from("work_order_timeline").insert({
        work_order_id: workOrder.id,
        action: "Vendor marked job as complete - awaiting verification",
        performed_by_type: "vendor",
        performed_by_name: workOrder.assigned_vendor?.name || "Vendor",
        previous_status: workOrder.status,
        new_status: "pending_verification",
      });
    },
    onSuccess: () => {
      toast.success("Job marked complete! Please submit your invoice via Bill.com.");
      queryClient.invalidateQueries({ queryKey: ["vendor-job", token] });
    },
    onError: (error) => {
      toast.error("Failed to update: " + error.message);
    },
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
    onError: (error) => {
      toast.error("Failed to send: " + error.message);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadPhoto.mutate(file);
    }
  };

  const openCamera = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const getGoogleMapsUrl = () => {
    if (!workOrder?.property) return "";
    const address = workOrder.property.address || "";
    return `https://maps.google.com/?q=${encodeURIComponent(address)}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading job details...</p>
        </div>
      </div>
    );
  }

  if (error || !workOrder) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Job Not Found</h2>
            <p className="text-muted-foreground">
              This job link may have expired or is invalid.
            </p>
            <p className="text-sm text-muted-foreground mt-4">
              Please contact PeachHaus if you believe this is an error.
            </p>
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground py-4 px-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            <img 
              src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png" 
              alt="PeachHaus" 
              className="h-8"
            />
            {urgencyConfig && (
              <Badge className={`${urgencyConfig.bgColor} ${urgencyConfig.color}`}>
                {urgencyConfig.label}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Job Status Banner */}
        {workOrder.vendor_accepted === null && (
          <Card className="border-yellow-300 bg-yellow-50">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-800">Action Required</p>
                  <p className="text-sm text-yellow-700">Please confirm or decline this job</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {workOrder.vendor_accepted === true && workOrder.status === "in_progress" && (
          <Card className="border-green-300 bg-green-50">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-800">Job Confirmed</p>
                  <p className="text-sm text-green-700">Upload photos and update status below</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Property Card with Map Link */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Property Location
            </CardTitle>
          </CardHeader>
          <CardContent>
            <a 
              href={getGoogleMapsUrl()} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
            >
              <p className="font-medium">{workOrder.property?.name || "Property"}</p>
              <p className="text-sm text-muted-foreground">
                {workOrder.property?.address}
              </p>
              <div className="flex items-center gap-1 text-primary text-sm mt-2">
                <ExternalLink className="h-4 w-4" />
                Open in Google Maps
              </div>
            </a>
          </CardContent>
        </Card>

        {/* Job Details */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{workOrder.title}</CardTitle>
            <Badge variant="outline" className="w-fit capitalize">
              {workOrder.category?.replace(/_/g, " ")}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground">{workOrder.description}</p>
            
            {workOrder.access_instructions && (
              <div 
                className="cursor-pointer"
                onClick={() => setShowInstructions(!showInstructions)}
              >
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <span className="font-medium text-blue-800">🔑 Access Instructions</span>
                  {showInstructions ? (
                    <ChevronUp className="h-4 w-4 text-blue-600" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-blue-600" />
                  )}
                </div>
                {showInstructions && (
                  <p className="text-sm text-blue-700 mt-2 p-3 bg-blue-50/50 rounded-b-lg -mt-1">
                    {workOrder.access_instructions}
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center gap-4 text-sm pt-2 border-t">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-4 w-4" />
                {format(new Date(workOrder.created_at), "MMM d, yyyy")}
              </div>
              {workOrder.quoted_cost && (
                <div className="flex items-center gap-1 font-medium text-primary">
                  <DollarSign className="h-4 w-4" />
                  Quote: ${workOrder.quoted_cost}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Voice Instructions placeholder - will show if PM sends voice message */}

        {/* Action Buttons */}
        {workOrder.vendor_accepted === null && (
          <div className="grid grid-cols-2 gap-3">
            <Button 
              size="lg" 
              className="w-full"
              onClick={() => confirmJob.mutate()}
              disabled={confirmJob.isPending}
            >
              {confirmJob.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Confirm Job
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => setShowQuoteInput(!showQuoteInput)}
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Submit Quote
            </Button>
          </div>
        )}

        {/* Quote Input */}
        {showQuoteInput && (
          <Card>
            <CardContent className="py-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="number"
                    value={quoteAmount}
                    onChange={(e) => setQuoteAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="w-full pl-8 pr-4 py-2 border rounded-lg"
                  />
                </div>
                <Button 
                  onClick={() => submitQuote.mutate(Number(quoteAmount))}
                  disabled={!quoteAmount || submitQuote.isPending}
                >
                  {submitQuote.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Submit"
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Quotes over $500 require owner approval
              </p>
            </CardContent>
          </Card>
        )}

        {/* Photo Upload Section */}
        {workOrder.vendor_accepted && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Camera className="h-5 w-5 text-primary" />
                Upload Photos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={photoTab} onValueChange={(v) => setPhotoTab(v as typeof photoTab)}>
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="before">
                    Before ({photosByType.before.length})
                  </TabsTrigger>
                  <TabsTrigger value="during">
                    During ({photosByType.during.length})
                  </TabsTrigger>
                  <TabsTrigger value="after">
                    After ({photosByType.after.length})
                  </TabsTrigger>
                </TabsList>

                {["before", "during", "after"].map((type) => (
                  <TabsContent key={type} value={type} className="mt-4">
                    {/* Photo Grid */}
                    {photosByType[type as keyof typeof photosByType].length > 0 && (
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        {photosByType[type as keyof typeof photosByType].map((photo) => (
                          <div 
                            key={photo.id} 
                            className="aspect-square rounded-lg overflow-hidden bg-muted"
                          >
                            <img 
                              src={photo.photo_url} 
                              alt={`${type} photo`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Upload Button */}
                    <Button 
                      variant="outline" 
                      className="w-full h-20"
                      onClick={openCamera}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <Loader2 className="h-6 w-6 animate-spin" />
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <Camera className="h-6 w-6" />
                          <span className="text-sm">Take or Upload Photo</span>
                        </div>
                      )}
                    </Button>
                  </TabsContent>
                ))}
              </Tabs>

              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
              />
            </CardContent>
          </Card>
        )}

        {/* Message Section */}
        {workOrder.vendor_accepted && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Phone className="h-5 w-5 text-primary" />
                Send Message to PM
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your message..."
                  rows={2}
                  className="flex-1"
                />
                <Button 
                  onClick={() => sendMessage.mutate()}
                  disabled={!message.trim() || sendMessage.isPending}
                >
                  {sendMessage.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mark Complete Button */}
        {workOrder.vendor_accepted && workOrder.status === "in_progress" && (
          <Button 
            size="lg" 
            className="w-full"
            onClick={() => markComplete.mutate()}
            disabled={markComplete.isPending}
          >
            {markComplete.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            Mark Job Complete
          </Button>
        )}

        {/* Bill.com Reminder */}
        {workOrder.status === "pending_verification" || workOrder.status === "completed" ? (
          <Card className="border-blue-300 bg-blue-50">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-blue-800">Submit Invoice via Bill.com</p>
                  <p className="text-sm text-blue-700">
                    Please submit your invoice through Bill.com for payment processing.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground py-4">
          <p>Questions? Call or text: <a href="tel:+14049915076" className="text-primary">404-991-5076</a></p>
        </div>
      </div>
    </div>
  );
};

export default VendorJobPortal;
