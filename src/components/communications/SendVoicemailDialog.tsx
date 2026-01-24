import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mic, Sparkles, Send, Loader2, User, Phone, Video, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { VoiceRecorder } from "./VoiceRecorder";
import { AIVoiceGenerator } from "./AIVoiceGenerator";
import { VideoCapture } from "./VideoCapture";
import { cn } from "@/lib/utils";

// Voice message templates for owners with work orders
const OWNER_VOICE_TEMPLATES = [
  {
    label: "Request Approval",
    script: "Hi {{name}}, this is Alex from PeachHaus. I'm calling about your property. Our vendor has provided a quote and we need your approval before proceeding. Please give me a call back or reply APPROVE to this number. Thanks!",
  },
  {
    label: "Work Started",
    script: "Hi {{name}}, this is Alex from PeachHaus with a quick update. The vendor has started work at your property. Everything is going smoothly and we'll let you know as soon as it's complete.",
  },
  {
    label: "Work Complete",
    script: "Hi {{name}}, this is Alex from PeachHaus with great news! The work at your property is all done. Photos are available in your owner portal. Let me know if you have any questions!",
  },
  {
    label: "Additional Issue",
    script: "Hi {{name}}, this is Alex from PeachHaus. While our vendor was working, they discovered an additional issue. I wanted to discuss the options with you before proceeding. Please give me a call back when you get a chance.",
  },
  {
    label: "Schedule Access",
    script: "Hi {{name}}, this is Alex from PeachHaus. I'm calling to schedule access for our vendor at your property. Could you please let me know what times work best for you?",
  },
  {
    label: "Urgent",
    script: "Hi {{name}}, this is Alex from PeachHaus calling with an urgent matter. We've been notified of an emergency at your property. We've already dispatched a vendor. Please call us back as soon as possible.",
  },
];

interface SendVoicemailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientPhone: string;
  recipientName: string;
  leadId?: string;
  ownerId?: string;
  vendorId?: string;
  workOrderId?: string;
  propertyAddress?: string;
  onSuccess?: () => void;
  /** Allow editing recipient name for manual dial scenarios */
  allowNameEdit?: boolean;
}

export function SendVoicemailDialog({
  open,
  onOpenChange,
  recipientPhone,
  recipientName,
  leadId,
  ownerId,
  vendorId,
  workOrderId,
  propertyAddress,
  onSuccess,
  allowNameEdit = false,
}: SendVoicemailDialogProps) {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<"record" | "ai" | "video">("ai");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [messageText, setMessageText] = useState<string>("");
  const [voiceId, setVoiceId] = useState<string>("HXPJDxQ2YWg0wT4IBlof");
  const [audioSource, setAudioSource] = useState<"recording" | "ai_generated">("ai_generated");
  const [isSending, setIsSending] = useState(false);
  
  // Video state
  const [mediaType, setMediaType] = useState<"audio" | "video">("audio");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoStoragePath, setVideoStoragePath] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  
  // Editable name for manual dial scenarios
  const [editableName, setEditableName] = useState<string>(recipientName);
  
  // Update editable name when prop changes
  useEffect(() => {
    setEditableName(recipientName);
  }, [recipientName]);
  
  // The name to actually use (editable or prop)
  const effectiveRecipientName = allowNameEdit ? editableName : recipientName;
  
  // Show video option for all contacts (not just owners)
  const showVideoOption = true;

  // Get current user's name
  const { data: currentUser } = useQuery({
    queryKey: ["current-user-profile-voicemail"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data } = await supabase
        .from("profiles")
        .select("first_name, email")
        .eq("id", user.id)
        .single();
      
      return data;
    },
  });

  const senderName = currentUser?.first_name || currentUser?.email?.split("@")[0] || "Your representative";

  const handleRecordingComplete = (blob: Blob, duration: number) => {
    setAudioBlob(blob);
    setAudioDuration(duration);
    setAudioSource("recording");
    setMessageText("(Voice recording)");
    setMediaType("audio");
  };

  const handleAIAudioGenerated = (blob: Blob, text: string, voice: string) => {
    setAudioBlob(blob);
    setMessageText(text);
    setVoiceId(voice);
    setAudioSource("ai_generated");
    setMediaType("audio");
  };

  const handleVideoReady = (url: string, duration: number, storagePath: string) => {
    setVideoUrl(url);
    setVideoDuration(duration);
    setVideoStoragePath(storagePath);
    setMediaType("video");
    setMessageText("(Video message)");
  };

  const handleSend = async () => {
    // Check if we have content to send
    const hasAudio = !!audioBlob;
    const hasVideo = mediaType === "video" && !!videoUrl;
    
    if (!hasAudio && !hasVideo) {
      toast.error("Please record or generate a message first");
      return;
    }

    if (!recipientPhone) {
      toast.error("No phone number provided");
      return;
    }

    // Validate phone number - clean and check length
    const cleanedPhone = recipientPhone.replace(/\D/g, "");
    if (cleanedPhone.length < 10 || cleanedPhone.length > 11) {
      toast.error(`Invalid phone number: must be 10 digits (got ${cleanedPhone.length})`);
      return;
    }

    setIsSending(true);

    try {
      let audioBase64 = null;
      
      // Only convert audio to base64 if we're sending audio
      if (hasAudio && audioBlob) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(",")[1];
            resolve(base64);
          };
          reader.onerror = reject;
        });
        reader.readAsDataURL(audioBlob);
        audioBase64 = await base64Promise;
      }

      // Call the send-voicemail edge function
      const { data, error } = await supabase.functions.invoke("send-voicemail", {
        body: {
          recipientPhone,
          recipientName: effectiveRecipientName,
          leadId,
          ownerId,
          vendorId,
          senderName,
          messageText,
          audioBase64: hasAudio ? audioBase64 : null,
          audioMimeType: hasAudio && audioBlob ? audioBlob.type : null,
          audioSource,
          voiceId,
          durationSeconds: hasVideo ? videoDuration : audioDuration,
          // Video-specific fields
          mediaType,
          videoUrl: hasVideo ? videoUrl : null,
          videoStoragePath: hasVideo ? videoStoragePath : null,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(hasVideo ? "Video message sent!" : "Voice message sent!");
        onOpenChange(false);
        onSuccess?.();
        
        // Reset state
        setAudioBlob(null);
        setMessageText("");
        setAudioDuration(0);
        setVideoUrl(null);
        setVideoStoragePath(null);
        setVideoDuration(0);
        setMediaType("audio");
      } else {
        throw new Error(data?.error || "Failed to send message");
      }
    } catch (error: any) {
      console.error("Error sending message:", error);
      toast.error(error.message || "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setAudioBlob(null);
      setMessageText("");
      setAudioDuration(0);
      setVideoUrl(null);
      setVideoStoragePath(null);
      setVideoDuration(0);
      setMediaType("audio");
      setActiveTab("ai");
    }
  }, [open]);

  // Determine if we're ready to send
  const isReadyToSend = (mediaType === "audio" && !!audioBlob) || (mediaType === "video" && !!videoUrl);

  const content = (
    <div className="flex flex-col gap-4">
      {/* Recipient Info - with editable name for manual dial */}
      <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <User className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          {allowNameEdit ? (
            <div className="space-y-1">
              <Label htmlFor="recipient-name" className="text-xs text-muted-foreground flex items-center gap-1">
                <Pencil className="h-3 w-3" />
                First Name (for greeting)
              </Label>
              <Input
                id="recipient-name"
                value={editableName}
                onChange={(e) => setEditableName(e.target.value)}
                placeholder="Enter first name..."
                className="h-8 text-sm"
              />
            </div>
          ) : (
            <p className="font-medium truncate">{effectiveRecipientName}</p>
          )}
          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
            <Phone className="h-3 w-3" />
            {recipientPhone}
          </p>
        </div>
        {isReadyToSend && (
          <Badge variant="secondary" className="shrink-0">
            {mediaType === "video" ? "Video ready" : "Audio ready"}
          </Badge>
        )}
      </div>

      {/* Tabs for Record vs AI vs Video (if owner) */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "record" | "ai" | "video")}>
        <TabsList className={cn("grid w-full", showVideoOption ? "grid-cols-3" : "grid-cols-2")}>
          <TabsTrigger value="record" className="gap-2">
            <Mic className="h-4 w-4" />
            Record
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-2">
            <Sparkles className="h-4 w-4" />
            AI Voice
          </TabsTrigger>
          {showVideoOption && (
            <TabsTrigger value="video" className="gap-2">
              <Video className="h-4 w-4" />
              Video
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="record" className="mt-4">
          <VoiceRecorder
            onRecordingComplete={handleRecordingComplete}
            maxDuration={60}
          />
        </TabsContent>

        <TabsContent value="ai" className="mt-4 space-y-4">
          {/* Quick templates for owners with work orders */}
          {ownerId && workOrderId && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Quick Scripts</Label>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {OWNER_VOICE_TEMPLATES.map((template, idx) => (
                  <button
                    key={idx}
                    onClick={() => setMessageText(template.script.replace("{{name}}", effectiveRecipientName.split(" ")[0]))}
                    className="px-3 py-1.5 rounded-full text-xs font-medium border border-border bg-background hover:bg-muted transition-colors whitespace-nowrap flex-shrink-0"
                  >
                    {template.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <AIVoiceGenerator
            recipientName={effectiveRecipientName}
            senderName={senderName}
            propertyAddress={propertyAddress}
            onAudioGenerated={handleAIAudioGenerated}
          />
        </TabsContent>

        {showVideoOption && (
          <TabsContent value="video" className="mt-4">
            <VideoCapture
              onVideoReady={handleVideoReady}
              maxDuration={180}
            />
          </TabsContent>
        )}
      </Tabs>

      {/* Send Button */}
      <Button
        onClick={handleSend}
        disabled={!isReadyToSend || isSending}
        size="lg"
        className="w-full gap-2 mt-2"
      >
        {isSending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <Send className="h-4 w-4" />
            {mediaType === "video" ? "Send Video Message" : "Send Voice Message"}
          </>
        )}
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        {recipientName} will receive an SMS with a link to {mediaType === "video" ? "watch" : "listen to"} your message
      </p>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="border-b pb-4">
            <DrawerTitle className="flex items-center gap-2">
              {mediaType === "video" ? <Video className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              Send {showVideoOption ? "Media" : "Voice"} Message
            </DrawerTitle>
          </DrawerHeader>
          <div className="p-4 overflow-y-auto">
            {content}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mediaType === "video" ? <Video className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            Send {showVideoOption ? "Media" : "Voice"} Message
          </DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
