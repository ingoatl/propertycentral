import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Wrench, Home, User, Mic, Video, X, Play, Pause, Square } from "lucide-react";
import { VoiceRecorder } from "@/components/communications/VoiceRecorder";

interface StartWorkOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface Property {
  id: string;
  name: string | null;
  address: string | null;
  owner_id: string | null;
}

interface Vendor {
  id: string;
  name: string;
  company_name: string | null;
  specialty: string[];
  phone: string;
}

export function StartWorkOrderDialog({
  open,
  onOpenChange,
  onSuccess,
}: StartWorkOrderDialogProps) {
  const queryClient = useQueryClient();
  const [selectedProperty, setSelectedProperty] = useState<string>("");
  const [selectedVendor, setSelectedVendor] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "emergency">("normal");
  const [category, setCategory] = useState<string>("general_maintenance");
  
  // Voice recording state
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const voiceAudioRef = useRef<HTMLAudioElement>(null);
  
  // Video recording state
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Fetch properties
  const { data: properties = [], isLoading: loadingProperties } = useQuery({
    queryKey: ["properties-for-work-order"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, name, address, owner_id")
        .is("offboarded_at", null)
        .order("name");
      
      if (error) throw error;
      return (data || []) as Property[];
    },
    enabled: open,
  });

  // Generate full property label
  const getPropertyLabel = (property: Property) => {
    if (property.name && property.address) {
      return `${property.name} — ${property.address}`;
    }
    return property.address || property.name || "Unnamed Property";
  };

  // Fetch vendors
  const { data: vendors = [], isLoading: loadingVendors } = useQuery({
    queryKey: ["vendors-for-work-order"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("id, name, company_name, specialty, phone")
        .in("status", ["active", "preferred"])
        .order("name");
      
      if (error) throw error;
      return (data || []) as Vendor[];
    },
    enabled: open,
  });

  // Handle voice recording complete
  const handleVoiceRecordingComplete = (blob: Blob, duration: number) => {
    setVoiceBlob(blob);
    setVoiceDuration(duration);
    const url = URL.createObjectURL(blob);
    setVoiceUrl(url);
    setShowVoiceRecorder(false);
    toast.success("Voice message recorded");
  };

  // Handle video selection
  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 100 * 1024 * 1024) {
        toast.error("Video must be under 100MB");
        return;
      }
      setVideoFile(file);
      setVideoUrl(URL.createObjectURL(file));
      toast.success("Video added");
    }
  };

  // Clear voice message
  const clearVoice = () => {
    if (voiceUrl) URL.revokeObjectURL(voiceUrl);
    setVoiceBlob(null);
    setVoiceDuration(0);
    setVoiceUrl(null);
  };

  // Clear video
  const clearVideo = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoFile(null);
    setVideoUrl(null);
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  // Create work order mutation
  const createWorkOrderMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const createdByUserId = user?.id;
      
      const woNumber = `WO-${Date.now().toString().slice(-6)}`;
      const vendorAccessToken = crypto.randomUUID();
      const tokenExpiresAt = new Date();
      tokenExpiresAt.setFullYear(tokenExpiresAt.getFullYear() + 1); // 1 year expiry

      let voiceMessageUrl: string | null = null;
      let voiceTranscript: string | null = null;
      let videoMessageUrl: string | null = null;

      // Upload voice message if exists
      if (voiceBlob) {
        const fileName = `voice/${woNumber}-${Date.now()}.webm`;
        const { error: uploadError } = await supabase.storage
          .from("work-order-photos")
          .upload(fileName, voiceBlob, { contentType: "audio/webm" });
        
        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from("work-order-photos")
            .getPublicUrl(fileName);
          voiceMessageUrl = publicUrl;
          
          // Transcribe voice message
          try {
            const { data: transcriptData } = await supabase.functions.invoke("transcribe-audio", {
              body: { audioUrl: publicUrl },
            });
            if (transcriptData?.transcript) {
              voiceTranscript = transcriptData.transcript;
            }
          } catch (err) {
            console.error("Transcription failed:", err);
          }
        }
      }

      // Upload video if exists
      if (videoFile) {
        const ext = videoFile.name.split('.').pop() || 'mp4';
        const fileName = `video/${woNumber}-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("work-order-photos")
          .upload(fileName, videoFile, { contentType: videoFile.type });
        
        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from("work-order-photos")
            .getPublicUrl(fileName);
          videoMessageUrl = publicUrl;
        }
      }
      
      const insertData = {
        property_id: selectedProperty,
        assigned_vendor_id: selectedVendor,
        title,
        description,
        category,
        urgency: priority,
        status: "dispatched" as const,
        vendor_access_token: vendorAccessToken,
        vendor_access_token_expires_at: tokenExpiresAt.toISOString(),
        created_by: createdByUserId,
        voice_message_url: voiceMessageUrl,
        voice_message_transcript: voiceTranscript,
        video_url: videoMessageUrl,
      };
      
      const { data, error } = await supabase
        .from("work_orders")
        .insert([insertData])
        .select()
        .single();
      
      if (error) throw error;
      return { ...data, woNumber, vendorAccessToken, createdByUserId };
    },
    onSuccess: async (workOrder) => {
      const vendor = vendors.find(v => v.id === selectedVendor);
      const property = properties.find(p => p.id === selectedProperty);
      const propertyLabel = property ? getPropertyLabel(property) : "Property";
      const urgencyLabel = priority.charAt(0).toUpperCase() + priority.slice(1);
      
      const portalUrl = `https://propertycentral.lovable.app/vendor-job/${workOrder.vendorAccessToken}`;
      
      if (vendor?.phone) {
        try {
          const message = `🔧 NEW WORK ORDER ${workOrder.woNumber}\n\n` +
            `Job: ${title}\n` +
            `Location: ${propertyLabel}\n` +
            `Priority: ${urgencyLabel}\n\n` +
            `View full details & respond:\n${portalUrl}\n\n` +
            `Or quick reply: CONFIRM / DECLINE / QUOTE $xxx`;
          
          const { error: smsError } = await supabase.functions.invoke("ghl-send-sms", {
            body: {
              vendorId: vendor.id,
              phone: vendor.phone,
              message,
              workOrderId: workOrder.id,
              requestedByUserId: workOrder.createdByUserId,
            },
          });
          
          if (smsError) {
            console.error("Failed to send vendor notification SMS:", smsError);
            toast.error("Work order created but SMS notification failed");
          }
        } catch (smsError) {
          console.error("Failed to send vendor notification SMS:", smsError);
        }
      }
      
      toast.success(`Work order ${workOrder.woNumber} created and vendor notified!`);
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["all-work-orders"] });
      
      // Reset form
      setSelectedProperty("");
      setSelectedVendor("");
      setTitle("");
      setDescription("");
      setPriority("normal");
      setCategory("general_maintenance");
      clearVoice();
      clearVideo();
      
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(`Failed to create work order: ${error.message}`);
    },
  });

  const handleSubmit = () => {
    if (!selectedProperty || !selectedVendor || !title.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    createWorkOrderMutation.mutate();
  };

  const getVendorLabel = (vendor: Vendor) => {
    const specialties = vendor.specialty?.slice(0, 2).map(s => 
      s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    ).join(', ') || '';
    return `${vendor.name}${vendor.company_name ? ` (${vendor.company_name})` : ''}${specialties ? ` - ${specialties}` : ''}`;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            Start Work Order
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Property Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-sm">
              <Home className="h-3.5 w-3.5" />
              Property *
            </Label>
            <Select value={selectedProperty} onValueChange={setSelectedProperty}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder={loadingProperties ? "Loading..." : "Select property"} />
              </SelectTrigger>
              <SelectContent>
                {properties.map((property) => (
                  <SelectItem key={property.id} value={property.id} className="text-sm">
                    {getPropertyLabel(property)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Vendor Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-sm">
              <User className="h-3.5 w-3.5" />
              Assign Vendor *
            </Label>
            <Select value={selectedVendor} onValueChange={setSelectedVendor}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder={loadingVendors ? "Loading..." : "Select vendor"} />
              </SelectTrigger>
              <SelectContent>
                {vendors.map((vendor) => (
                  <SelectItem key={vendor.id} value={vendor.id} className="text-sm">
                    {getVendorLabel(vendor)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label className="text-sm">Work Order Title *</Label>
            <Input
              placeholder="e.g., HVAC repair, Plumbing leak fix..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-sm"
            />
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label className="text-sm">Priority</Label>
            <Select value={priority} onValueChange={(val) => setPriority(val as "low" | "normal" | "high" | "emergency")}>
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="emergency">Emergency</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label className="text-sm">Description</Label>
            <Textarea
              placeholder="Describe the work to be done..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="text-sm"
            />
          </div>

          {/* Voice & Video Recording Buttons */}
          <div className="space-y-3">
            <Label className="text-sm text-muted-foreground">Add Media Instructions</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={voiceUrl ? "default" : "outline"}
                size="sm"
                onClick={() => voiceUrl ? undefined : setShowVoiceRecorder(true)}
                className="gap-2"
              >
                <Mic className="h-4 w-4" />
                {voiceUrl ? "Voice Added" : "Record Voice"}
              </Button>
              <Button
                type="button"
                variant={videoUrl ? "default" : "outline"}
                size="sm"
                onClick={() => videoInputRef.current?.click()}
                className="gap-2"
              >
                <Video className="h-4 w-4" />
                {videoUrl ? "Video Added" : "Record Video"}
              </Button>
            </div>

            {/* Voice Recorder Modal */}
            {showVoiceRecorder && (
              <div className="mt-3 p-4 border rounded-lg bg-muted/30">
                <VoiceRecorder
                  onRecordingComplete={handleVoiceRecordingComplete}
                  maxDuration={60}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => setShowVoiceRecorder(false)}
                >
                  Cancel
                </Button>
              </div>
            )}

            {/* Voice Preview */}
            {voiceUrl && !showVoiceRecorder && (
              <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg border">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-full bg-primary text-primary-foreground"
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
                  {isPlayingVoice ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
                </Button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Voice message</p>
                  <p className="text-xs text-muted-foreground">{formatTime(voiceDuration)}</p>
                </div>
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={clearVoice}>
                  <X className="h-4 w-4" />
                </Button>
                <audio ref={voiceAudioRef} src={voiceUrl} onEnded={() => setIsPlayingVoice(false)} className="hidden" />
              </div>
            )}

            {/* Video Preview */}
            {videoUrl && (
              <div className="mt-3 p-3 bg-muted/30 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Video className="h-4 w-4" />
                    Video attached
                  </p>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={clearVideo}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <video src={videoUrl} controls className="w-full max-h-32 rounded-lg" playsInline preload="metadata" />
              </div>
            )}

            {/* Hidden Video Input */}
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              capture="environment"
              onChange={handleVideoSelect}
              className="hidden"
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={createWorkOrderMutation.isPending || !selectedProperty || !selectedVendor || !title.trim()}
            className="w-full sm:w-auto"
          >
            {createWorkOrderMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Wrench className="h-4 w-4 mr-2" />
                Create & Notify Vendor
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
