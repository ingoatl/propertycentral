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
  
  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setRecordedBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
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
      console.error("Microphone access denied:", error);
      toast.error("Microphone access denied. Please allow microphone access.");
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
  };

  const resetRecording = () => {
    setRecordedBlob(null);
    setDuration(0);
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
    <div className="space-y-6 py-4">
      <div className="flex flex-col items-center gap-4">
        {!recordedBlob ? (
          <>
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={cn(
                "w-24 h-24 rounded-full flex items-center justify-center transition-all",
                isRecording 
                  ? "bg-destructive text-destructive-foreground animate-pulse" 
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              {isRecording ? <Square className="h-10 w-10" /> : (isVideo ? <Video className="h-10 w-10" /> : <Mic className="h-10 w-10" />)}
            </button>
            <p className="text-sm text-muted-foreground">
              {isRecording ? `Recording... ${formatDuration(duration)}` : "Tap to start recording"}
            </p>
            {isRecording && (
              <p className="text-xs text-muted-foreground">
                Max: 2 minutes
              </p>
            )}
          </>
        ) : (
          <>
            <div className="text-center">
              <p className="font-medium">Recording Complete</p>
              <p className="text-sm text-muted-foreground">{formatDuration(duration)}</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={resetRecording}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Re-record
              </Button>
              <Button onClick={() => handleSendVoice(isVideo)} disabled={isSending}>
                {isSending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Send
              </Button>
            </div>
          </>
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
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5 text-primary" />
              Leave a Voice Message
            </DialogTitle>
            <DialogDescription>
              Record a message for your property manager.
            </DialogDescription>
          </DialogHeader>
          
          {voiceSent ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-accent" />
              </div>
              <p className="font-semibold text-lg">Message Sent!</p>
              <p className="text-muted-foreground">We'll get back to you soon.</p>
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
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="h-5 w-5 text-primary" />
              Record Video Message
            </DialogTitle>
            <DialogDescription>
              Record a video message for your property manager.
            </DialogDescription>
          </DialogHeader>
          
          {voiceSent ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-accent" />
              </div>
              <p className="font-semibold text-lg">Video Sent!</p>
              <p className="text-muted-foreground">We'll get back to you soon.</p>
            </div>
          ) : (
            <RecordingUI isVideo={true} />
          )}
        </DialogContent>
      </Dialog>

      {/* Text Message Modal */}
      <Dialog open={showTextModal} onOpenChange={setShowTextModal}>
        <DialogContent className="sm:max-w-md mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              Send a Message
            </DialogTitle>
            <DialogDescription>
              Send a quick message about {propertyName || "your property"}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="textMessage">Your Message</Label>
              <Textarea
                id="textMessage"
                value={textMessage}
                onChange={(e) => setTextMessage(e.target.value)}
                placeholder="Hi, I have a question about..."
                rows={4}
                className="mt-1.5"
              />
            </div>
            
            <Button 
              onClick={handleSendText} 
              disabled={isSending || !textMessage.trim()}
              className="w-full"
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
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