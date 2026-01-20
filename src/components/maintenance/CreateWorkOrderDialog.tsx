import { useState, useRef, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Phone, Mail, Mic, Video, Loader2, X, Play, Pause, FileText } from "lucide-react";
import { WORK_ORDER_CATEGORIES, Vendor } from "@/types/maintenance";

interface CreateWorkOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  defaultPropertyId?: string;
}

const CreateWorkOrderDialog = ({ 
  open, 
  onOpenChange, 
  onSuccess,
  defaultPropertyId 
}: CreateWorkOrderDialogProps) => {
  const [formData, setFormData] = useState({
    property_id: defaultPropertyId || "",
    title: "",
    description: "",
    category: "",
    urgency: "normal" as "low" | "normal" | "high" | "emergency",
    source: "internal",
    reported_by: "",
    reported_by_email: "",
    reported_by_phone: "",
    access_instructions: "",
    estimated_cost: "",
    assigned_vendor_id: "",
  });
  const [notifySms, setNotifySms] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);
  
  // Voice message state
  const [isRecording, setIsRecording] = useState(false);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
  const [voiceTranscript, setVoiceTranscript] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  
  // Video state
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Fetch properties
  const { data: properties = [] } = useQuery({
    queryKey: ["properties-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, name, address")
        .is("offboarded_at", null)
        .order("name");
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch all vendors
  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors-for-workorder"],
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

  // Filter vendors by selected category
  const matchingVendors = formData.category 
    ? vendors.filter(v => v.specialty?.includes(formData.category))
    : [];
  const otherVendors = formData.category 
    ? vendors.filter(v => !v.specialty?.includes(formData.category))
    : vendors;

  // Voice recording functions
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setVoiceBlob(blob);
        setVoiceUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Failed to start recording:", error);
      toast.error("Could not access microphone");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const transcribeVoice = useCallback(async () => {
    if (!voiceBlob) return;
    
    setTranscribing(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(voiceBlob);
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(',')[1];
        
        const { data, error } = await supabase.functions.invoke("elevenlabs-transcribe", {
          body: { audioBase64: base64Audio }
        });

        if (error) throw error;
        setVoiceTranscript(data?.text || "No transcript available");
      };
    } catch (error) {
      console.error("Transcription error:", error);
      toast.error("Failed to transcribe voice message");
    } finally {
      setTranscribing(false);
    }
  }, [voiceBlob]);

  const playVoice = useCallback(() => {
    if (voiceUrl && audioRef.current) {
      if (isPlayingVoice) {
        audioRef.current.pause();
        setIsPlayingVoice(false);
      } else {
        audioRef.current.play();
        setIsPlayingVoice(true);
      }
    }
  }, [voiceUrl, isPlayingVoice]);

  const removeVoice = useCallback(() => {
    setVoiceBlob(null);
    setVoiceUrl(null);
    setVoiceTranscript(null);
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlayingVoice(false);
  }, []);

  // Video handling
  const handleVideoSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Force MP4 compatibility
      setVideoFile(file);
      setVideoPreviewUrl(URL.createObjectURL(file));
    }
  }, []);

  const removeVideo = useCallback(() => {
    setVideoFile(null);
    setVideoPreviewUrl(null);
  }, []);

  const createWorkOrder = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const assignedVendorId = formData.assigned_vendor_id || null;
      const vendor = assignedVendorId ? vendors.find(v => v.id === assignedVendorId) : null;
      
      let voiceMessageUrl: string | null = null;
      let videoUrl: string | null = null;
      
      // Upload voice message if present
      if (voiceBlob) {
        const fileName = `work-orders/voice/${Date.now()}.webm`;
        const { error: uploadError } = await supabase.storage
          .from("work-order-photos")
          .upload(fileName, voiceBlob);
        
        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from("work-order-photos")
            .getPublicUrl(fileName);
          voiceMessageUrl = urlData.publicUrl;
        }
      }
      
      // Upload video if present
      if (videoFile) {
        setUploadingVideo(true);
        const fileExt = videoFile.name.split('.').pop() || 'mp4';
        const fileName = `work-orders/video/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("work-order-photos")
          .upload(fileName, videoFile);
        
        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from("work-order-photos")
            .getPublicUrl(fileName);
          videoUrl = urlData.publicUrl;
        }
        setUploadingVideo(false);
      }
      
      const { data, error } = await supabase
        .from("work_orders")
        .insert({
          property_id: formData.property_id,
          title: formData.title,
          description: formData.description,
          category: formData.category,
          urgency: formData.urgency,
          source: formData.source,
          reported_by: formData.reported_by || null,
          reported_by_email: formData.reported_by_email || null,
          reported_by_phone: formData.reported_by_phone || null,
          access_instructions: formData.access_instructions || null,
          estimated_cost: formData.estimated_cost ? parseFloat(formData.estimated_cost) : null,
          status: assignedVendorId ? "dispatched" : "new",
          created_by: user?.id,
          assigned_vendor_id: assignedVendorId,
          assigned_by: assignedVendorId ? user?.id : null,
          assigned_at: assignedVendorId ? new Date().toISOString() : null,
          voice_message_url: voiceMessageUrl,
          voice_message_transcript: voiceTranscript,
          video_url: videoUrl,
        })
        .select()
        .single();

      if (error) throw error;

      // Add timeline entry for creation
      await supabase.from("work_order_timeline").insert({
        work_order_id: data.id,
        action: "Work order created",
        performed_by_type: "pm",
        performed_by_name: user?.email,
        performed_by_user_id: user?.id,
        new_status: assignedVendorId ? "dispatched" : "new",
      });

      // If vendor assigned, add assignment timeline and notify
      if (assignedVendorId && vendor) {
        await supabase.from("work_order_timeline").insert({
          work_order_id: data.id,
          action: `Assigned to vendor: ${vendor.name}`,
          performed_by_type: "pm",
          performed_by_name: user?.email,
          performed_by_user_id: user?.id,
          new_status: "dispatched",
        });

        // Notify vendor
        const notifyMethods: string[] = [];
        if (notifySms) notifyMethods.push("sms");
        if (notifyEmail) notifyMethods.push("email");

        if (notifyMethods.length > 0) {
          try {
            const { data: notifyData, error: notifyError } = await supabase.functions.invoke("notify-vendor-work-order", {
              body: { 
                workOrderId: data.id, 
                vendorId: assignedVendorId,
                notifyMethods 
              },
            });

            if (notifyError) {
              console.error("Notification error:", notifyError);
              toast.warning("Work order created but vendor notification failed");
            } else if (notifyData?.success) {
              toast.success(notifyData.message);
            }
          } catch (e) {
            console.error("Failed to notify vendor:", e);
          }
        }
      }

      return data;
    },
    onSuccess: () => {
      toast.success("Work order created successfully");
      onSuccess();
      onOpenChange(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Failed to create work order: " + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      property_id: defaultPropertyId || "",
      title: "",
      description: "",
      category: "",
      urgency: "normal",
      source: "internal",
      reported_by: "",
      reported_by_email: "",
      reported_by_phone: "",
      access_instructions: "",
      estimated_cost: "",
      assigned_vendor_id: "",
    });
    setNotifySms(true);
    setNotifyEmail(true);
    removeVoice();
    removeVideo();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Work Order</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!formData.property_id || !formData.title || !formData.category) {
              toast.error("Please fill in required fields");
              return;
            }
            createWorkOrder.mutate();
          }}
          className="space-y-6"
        >
          {/* Property Selection */}
          <div className="space-y-2">
            <Label>Property *</Label>
            <Select
              value={formData.property_id}
              onValueChange={(value) => setFormData({ ...formData, property_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a property" />
              </SelectTrigger>
              <SelectContent>
              {properties.map((property) => (
                  <SelectItem key={property.id} value={property.id}>
                    <span className="flex flex-col">
                      <span className="font-medium">{property.name || "Unnamed Property"}</span>
                      {property.address && (
                        <span className="text-xs text-muted-foreground">{property.address}</span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Brief description of the issue"
              required
            />
          </div>

          {/* Category & Urgency */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {WORK_ORDER_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      <span className="flex items-center gap-2">
                        <span>{cat.icon}</span>
                        {cat.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Urgency</Label>
              <Select
                value={formData.urgency}
                onValueChange={(value: string) => setFormData({ ...formData, urgency: value as "low" | "normal" | "high" | "emergency" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low - Can wait</SelectItem>
                  <SelectItem value="normal">Normal - Within a few days</SelectItem>
                  <SelectItem value="high">High - Needs attention soon</SelectItem>
                  <SelectItem value="emergency">Emergency - Immediate action</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Detailed description of the issue, including any relevant context..."
              rows={4}
              required
            />
          </div>

          {/* Voice & Video Attachments */}
          <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
            <Label className="text-base">Attachments (Optional)</Label>
            <p className="text-sm text-muted-foreground">
              Add a voice message or video to provide more context for the vendor.
            </p>
            
            <div className="flex gap-3">
              {/* Voice Recording */}
              {!voiceUrl ? (
                <Button
                  type="button"
                  variant={isRecording ? "destructive" : "outline"}
                  size="sm"
                  onClick={isRecording ? stopRecording : startRecording}
                  className="flex items-center gap-2"
                >
                  <Mic className={`h-4 w-4 ${isRecording ? 'animate-pulse' : ''}`} />
                  {isRecording ? "Stop Recording" : "Record Voice"}
                </Button>
              ) : (
                <div className="flex items-center gap-2 p-2 bg-background border rounded-lg">
                  <Button type="button" variant="ghost" size="icon" onClick={playVoice}>
                    {isPlayingVoice ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <span className="text-sm text-muted-foreground">Voice message</span>
                  {!voiceTranscript && (
                    <Button type="button" variant="ghost" size="sm" onClick={transcribeVoice} disabled={transcribing}>
                      {transcribing ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
                    </Button>
                  )}
                  <Button type="button" variant="ghost" size="icon" onClick={removeVoice}>
                    <X className="h-4 w-4" />
                  </Button>
                  <audio ref={audioRef} src={voiceUrl} onEnded={() => setIsPlayingVoice(false)} className="hidden" />
                </div>
              )}
              
              {/* Video Upload */}
              {!videoFile ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => videoInputRef.current?.click()}
                  className="flex items-center gap-2"
                >
                  <Video className="h-4 w-4" />
                  Upload Video
                </Button>
              ) : (
                <div className="flex items-center gap-2 p-2 bg-background border rounded-lg">
                  <Video className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground truncate max-w-[150px]">{videoFile.name}</span>
                  <Button type="button" variant="ghost" size="icon" onClick={removeVideo}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                onChange={handleVideoSelect}
                className="hidden"
              />
            </div>
            
            {/* Transcript Display */}
            {voiceTranscript && (
              <div className="p-3 bg-background border rounded-lg">
                <p className="text-xs font-medium text-muted-foreground mb-1">Voice Transcript:</p>
                <p className="text-sm">{voiceTranscript}</p>
              </div>
            )}
            
            {/* Video Preview */}
            {videoPreviewUrl && (
              <div className="relative aspect-video max-w-xs rounded-lg overflow-hidden border">
                <video src={videoPreviewUrl} controls className="w-full h-full object-cover" />
              </div>
            )}
          </div>

          {/* Source */}
          <div className="space-y-2">
            <Label>Source</Label>
            <Select
              value={formData.source}
              onValueChange={(value) => setFormData({ ...formData, source: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="internal">Internal (Staff)</SelectItem>
                <SelectItem value="guest_report">Guest Report</SelectItem>
                <SelectItem value="inspection">Inspection Finding</SelectItem>
                <SelectItem value="preventive">Preventive Maintenance</SelectItem>
                <SelectItem value="owner_request">Owner Request</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reporter Info */}
          <div className="space-y-4">
            <Label className="text-base">Reporter Information (Optional)</Label>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="reported_by" className="text-sm font-normal">Name</Label>
                <Input
                  id="reported_by"
                  value={formData.reported_by}
                  onChange={(e) => setFormData({ ...formData, reported_by: e.target.value })}
                  placeholder="Guest name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reported_by_email" className="text-sm font-normal">Email</Label>
                <Input
                  id="reported_by_email"
                  type="email"
                  value={formData.reported_by_email}
                  onChange={(e) => setFormData({ ...formData, reported_by_email: e.target.value })}
                  placeholder="guest@email.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reported_by_phone" className="text-sm font-normal">Phone</Label>
                <Input
                  id="reported_by_phone"
                  value={formData.reported_by_phone}
                  onChange={(e) => setFormData({ ...formData, reported_by_phone: e.target.value })}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
          </div>

          {/* Additional Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="estimated_cost">Estimated Cost ($)</Label>
              <Input
                id="estimated_cost"
                type="number"
                value={formData.estimated_cost}
                onChange={(e) => setFormData({ ...formData, estimated_cost: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="access_instructions">Access Instructions</Label>
              <Input
                id="access_instructions"
                value={formData.access_instructions}
                onChange={(e) => setFormData({ ...formData, access_instructions: e.target.value })}
                placeholder="Lockbox code, gate code, etc."
              />
            </div>
          </div>

          {/* Vendor Assignment (Optional) */}
          <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
            <Label className="text-base">Assign Vendor (Optional)</Label>
            <p className="text-sm text-muted-foreground">
              Optionally assign a vendor now. You can also assign later from the work order details.
            </p>
            
            <Select
              value={formData.assigned_vendor_id}
              onValueChange={(value) => setFormData({ ...formData, assigned_vendor_id: value === "none" ? "" : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a vendor (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground">No vendor - assign later</span>
                </SelectItem>
                {matchingVendors.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted">
                      Recommended for {WORK_ORDER_CATEGORIES.find(c => c.value === formData.category)?.label}
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
                      {matchingVendors.length > 0 ? "Other Vendors" : "All Vendors"}
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

            {/* Notification options when vendor selected */}
            {formData.assigned_vendor_id && (
              <div className="mt-3 p-3 bg-background rounded-lg border space-y-2">
                <Label className="text-sm font-medium">Notify Vendor</Label>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="create_notify_sms"
                      checked={notifySms}
                      onCheckedChange={(checked) => setNotifySms(!!checked)}
                    />
                    <label htmlFor="create_notify_sms" className="text-sm flex items-center gap-1.5 cursor-pointer">
                      <Phone className="h-3.5 w-3.5" />
                      SMS
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="create_notify_email"
                      checked={notifyEmail}
                      onCheckedChange={(checked) => setNotifyEmail(!!checked)}
                    />
                    <label htmlFor="create_notify_email" className="text-sm flex items-center gap-1.5 cursor-pointer">
                      <Mail className="h-3.5 w-3.5" />
                      Email
                    </label>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Vendor will be notified immediately after work order is created
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createWorkOrder.isPending || uploadingVideo}>
              {createWorkOrder.isPending || uploadingVideo ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {uploadingVideo ? "Uploading..." : "Creating..."}
                </>
              ) : (
                "Create Work Order"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateWorkOrderDialog;
