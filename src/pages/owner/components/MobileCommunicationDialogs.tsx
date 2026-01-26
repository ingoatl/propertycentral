import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  MessageCircle, 
  Mic, 
  Send,
  Loader2,
  CheckCircle,
  Square,
  RotateCcw,
  Video
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface MobileCommunicationDialogsProps {
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  propertyId?: string;
  propertyName?: string;
  showVoiceModal: boolean;
  setShowVoiceModal: (show: boolean) => void;
  showTextModal: boolean;
  setShowTextModal: (show: boolean) => void;
  showVideoModal: boolean;
  setShowVideoModal: (show: boolean) => void;
}

export function MobileCommunicationDialogs({
  ownerId,
  ownerName,
  ownerEmail,
  propertyId,
  propertyName,
  showVoiceModal,
  setShowVoiceModal,
  showTextModal,
  setShowTextModal,
  showVideoModal,
  setShowVideoModal,
}: MobileCommunicationDialogsProps) {
  const [textMessage, setTextMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [voiceSent, setVoiceSent] = useState(false);
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startRecording = async (isVideo = false) => {
    try {
      const constraints = isVideo 
        ? { audio: true, video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } }
        : { audio: true };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      // Show video preview if recording video
      if (isVideo && videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play();
      }
      
      const mimeType = isVideo 
        ? (MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : 'video/mp4')
        : (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4');
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
        stream.getTracks().forEach(track => track.stop());
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = null;
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration(d => {
          if (d >= 120) {
            stopRecording();
            return d;
          }
          return d + 1;
        });
      }, 1000);
    } catch (error) {
      console.error("Media access denied:", error);
      toast.error(isVideo 
        ? "Camera access denied. Please allow camera and microphone access."
        : "Microphone access denied. Please allow microphone access."
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
  };

  const resetRecording = () => {
    setRecordedBlob(null);
    setDuration(0);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
  };

  const handleSendVoice = async (isVideo = false) => {
    if (!recordedBlob) return;

    setIsSending(true);
    try {
      const fileName = `owner-messages/${ownerId}/${Date.now()}.webm`;
      const { error: uploadError } = await supabase.storage
        .from("message-attachments")
        .upload(fileName, recordedBlob, { contentType: "audio/webm" });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("message-attachments")
        .getPublicUrl(fileName);

      const { error } = await supabase.functions.invoke("owner-send-message", {
        body: {
          owner_id: ownerId,
          property_id: propertyId || null,
          message_type: isVideo ? "video" : "voicemail",
          body: `${isVideo ? 'Video' : 'Voice'} message from ${ownerName} (${duration}s)`,
          subject: `${isVideo ? 'Video' : 'Voice'} message from ${ownerName}`,
          sender_email: ownerEmail,
          sender_name: ownerName,
          attachment_url: urlData.publicUrl,
          duration,
        },
      });

      if (error) throw error;

      setVoiceSent(true);
      toast.success(`${isVideo ? 'Video' : 'Voice'} message sent!`);
      
      setTimeout(() => {
        setShowVoiceModal(false);
        setShowVideoModal(false);
        setVoiceSent(false);
        resetRecording();
      }, 2000);
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const handleSendText = async () => {
    if (!textMessage.trim()) {
      toast.error("Please enter a message");
      return;
    }

    setIsSending(true);
    try {
      const { error } = await supabase.functions.invoke("owner-send-message", {
        body: {
          owner_id: ownerId,
          property_id: propertyId || null,
          message_type: "sms",
          body: textMessage,
          sender_email: ownerEmail,
          sender_name: ownerName,
        },
      });

      if (error) throw error;

      toast.success("Message sent! We'll respond shortly.");
      setTextMessage("");
      setShowTextModal(false);
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const RecordingUI = ({ isVideo = false }: { isVideo?: boolean }) => (
    <div className="space-y-4 py-2">
      <div className="flex flex-col items-center gap-3">
        {/* Video Preview */}
        {isVideo && (
          <div className={cn(
            "w-full aspect-video bg-muted rounded-xl overflow-hidden",
            !isRecording && !recordedBlob && "hidden"
          )}>
            <video 
              ref={videoPreviewRef}
              className="w-full h-full object-cover"
              muted
              playsInline
            />
          </div>
        )}
        
        {!recordedBlob ? (
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => isRecording ? stopRecording() : startRecording(isVideo)}
              className={cn(
                "w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-lg",
                isRecording 
                  ? "bg-destructive text-destructive-foreground animate-pulse" 
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              {isRecording ? <Square className="h-8 w-8" /> : (isVideo ? <Video className="h-8 w-8" /> : <Mic className="h-8 w-8" />)}
            </button>
            <p className="text-sm text-muted-foreground text-center">
              {isRecording ? `Recording... ${formatDuration(duration)}` : `Tap to start ${isVideo ? 'video' : 'voice'} recording`}
            </p>
            {isRecording && (
              <p className="text-xs text-muted-foreground">Max: 2 minutes</p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 w-full">
            <div className="text-center">
              <p className="font-medium text-foreground">Recording Complete</p>
              <p className="text-sm text-muted-foreground">{formatDuration(duration)}</p>
            </div>
            <div className="flex gap-2 w-full">
              <Button variant="outline" onClick={resetRecording} className="flex-1">
                <RotateCcw className="h-4 w-4 mr-1.5" />
                Re-record
              </Button>
              <Button onClick={() => handleSendVoice(isVideo)} disabled={isSending} className="flex-1">
                {isSending ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-1.5" />
                )}
                Send
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Voice Message Modal */}
      <Dialog open={showVoiceModal} onOpenChange={(open) => {
        setShowVoiceModal(open);
        if (!open) resetRecording();
      }}>
        <DialogContent className="sm:max-w-md mx-4">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Mic className="h-5 w-5 text-primary" />
              Leave a Voice Message
            </DialogTitle>
            <DialogDescription className="text-sm">
              Record a message for your property manager.
            </DialogDescription>
          </DialogHeader>
          
          {voiceSent ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="h-7 w-7 text-emerald-600" />
              </div>
              <p className="font-semibold text-base">Message Sent!</p>
              <p className="text-sm text-muted-foreground">We'll get back to you soon.</p>
            </div>
          ) : (
            <RecordingUI isVideo={false} />
          )}
        </DialogContent>
      </Dialog>

      {/* Video Message Modal */}
      <Dialog open={showVideoModal} onOpenChange={(open) => {
        setShowVideoModal(open);
        if (!open) resetRecording();
      }}>
        <DialogContent className="sm:max-w-md mx-4">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Video className="h-5 w-5 text-primary" />
              Record Video Message
            </DialogTitle>
            <DialogDescription className="text-sm">
              Record a video message for your property manager.
            </DialogDescription>
          </DialogHeader>
          
          {voiceSent ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="h-7 w-7 text-emerald-600" />
              </div>
              <p className="font-semibold text-base">Video Sent!</p>
              <p className="text-sm text-muted-foreground">We'll get back to you soon.</p>
            </div>
          ) : (
            <RecordingUI isVideo={true} />
          )}
        </DialogContent>
      </Dialog>

      {/* Text Message Modal */}
      <Dialog open={showTextModal} onOpenChange={setShowTextModal}>
        <DialogContent className="sm:max-w-md mx-4">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <MessageCircle className="h-5 w-5 text-primary" />
              Send a Message
            </DialogTitle>
            <DialogDescription className="text-sm">
              Send a quick message about {propertyName || "your property"}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3">
            <div>
              <Label htmlFor="textMessage" className="text-sm font-medium">Your Message</Label>
              <Textarea
                id="textMessage"
                value={textMessage}
                onChange={(e) => setTextMessage(e.target.value)}
                placeholder="Hi, I have a question about..."
                rows={3}
                className="mt-1.5 min-h-[100px]"
              />
            </div>
            
            <Button 
              onClick={handleSendText} 
              disabled={isSending || !textMessage.trim()}
              className="w-full h-11"
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-1.5" />
                  Send Message
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}