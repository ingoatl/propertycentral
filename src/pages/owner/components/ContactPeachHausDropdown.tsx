import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Mail, 
  Phone, 
  Calendar,
  Send,
  Loader2,
  CheckCircle,
  ChevronDown,
  Square,
  RotateCcw
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface ContactPeachHausDropdownProps {
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  propertyId?: string;
  propertyName?: string;
  onScheduleCall?: () => void;
  variant?: "default" | "outline" | "secondary" | "ghost";
}

export function ContactPeachHausDropdown({
  ownerId,
  ownerName,
  ownerEmail,
  propertyId,
  propertyName,
  onScheduleCall,
  variant = "outline"
}: ContactPeachHausDropdownProps) {
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [showTextModal, setShowTextModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [textMessage, setTextMessage] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
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

  const handleSendVoice = async () => {
    if (!recordedBlob) return;

    setIsSending(true);
    try {
      // Upload audio to storage
      const fileName = `owner-messages/${ownerId}/${Date.now()}.webm`;
      const { error: uploadError } = await supabase.storage
        .from("message-attachments")
        .upload(fileName, recordedBlob, { contentType: "audio/webm" });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("message-attachments")
        .getPublicUrl(fileName);

      // Save as lead communication
      const { error } = await supabase.from("lead_communications").insert({
        owner_id: ownerId,
        property_id: propertyId || null,
        communication_type: "voicemail",
        direction: "inbound",
        body: `Voice message from ${ownerName} (${duration}s)`,
        subject: `Voice message from ${ownerName}`,
        sender_email: ownerEmail,
        attachment_url: urlData.publicUrl,
        status: "unread",
      });

      if (error) throw error;

      setVoiceSent(true);
      toast.success("Voice message sent!");
      
      setTimeout(() => {
        setShowVoiceModal(false);
        setVoiceSent(false);
        resetRecording();
      }, 2000);
    } catch (error) {
      console.error("Error sending voice message:", error);
      toast.error("Failed to send voice message");
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
      const { error } = await supabase.from("lead_communications").insert({
        owner_id: ownerId,
        property_id: propertyId || null,
        communication_type: "sms",
        direction: "inbound",
        body: textMessage,
        subject: `Message from ${ownerName}`,
        sender_email: ownerEmail,
        status: "unread",
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

  const handleSendEmail = async () => {
    if (!emailSubject.trim() || !emailBody.trim()) {
      toast.error("Please fill in subject and message");
      return;
    }

    setIsSending(true);
    try {
      const { error } = await supabase.from("lead_communications").insert({
        owner_id: ownerId,
        property_id: propertyId || null,
        communication_type: "email",
        direction: "inbound",
        body: emailBody,
        subject: emailSubject,
        sender_email: ownerEmail,
        status: "unread",
      });

      if (error) throw error;

      toast.success("Email sent! We'll respond shortly.");
      setEmailSubject("");
      setEmailBody("");
      setShowEmailModal(false);
    } catch (error) {
      console.error("Error sending email:", error);
      toast.error("Failed to send email");
    } finally {
      setIsSending(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant={variant} size="sm" className="gap-2">
            <MessageCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Contact Us</span>
            <ChevronDown className="h-3 w-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Reach your property manager
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={() => setShowVoiceModal(true)} className="cursor-pointer">
            <Mic className="h-4 w-4 mr-3 text-orange-500" />
            <div>
              <p className="font-medium">Leave Voicemail</p>
              <p className="text-xs text-muted-foreground">Record a voice message</p>
            </div>
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => setShowTextModal(true)} className="cursor-pointer">
            <MessageCircle className="h-4 w-4 mr-3 text-purple-500" />
            <div>
              <p className="font-medium">Send Text</p>
              <p className="text-xs text-muted-foreground">Quick message</p>
            </div>
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => setShowEmailModal(true)} className="cursor-pointer">
            <Mail className="h-4 w-4 mr-3 text-emerald-500" />
            <div>
              <p className="font-medium">Send Email</p>
              <p className="text-xs text-muted-foreground">Detailed inquiry</p>
            </div>
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={onScheduleCall} className="cursor-pointer">
            <Calendar className="h-4 w-4 mr-3 text-primary" />
            <div>
              <p className="font-medium">Schedule Call</p>
              <p className="text-xs text-muted-foreground">Video or phone</p>
            </div>
          </DropdownMenuItem>
          
          <DropdownMenuItem asChild>
            <a href="tel:+14048005932" className="cursor-pointer">
              <Phone className="h-4 w-4 mr-3 text-blue-500" />
              <div>
                <p className="font-medium">Call Now</p>
                <p className="text-xs text-muted-foreground">(404) 800-5932</p>
              </div>
            </a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Voice Message Modal */}
      <Dialog open={showVoiceModal} onOpenChange={(open) => {
        setShowVoiceModal(open);
        if (!open) resetRecording();
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5 text-orange-500" />
              Leave a Voice Message
            </DialogTitle>
            <DialogDescription>
              Record a message for your property manager. We'll respond within 24 hours.
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
            <div className="space-y-6 py-4">
              {/* Recording UI */}
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
                      {isRecording ? <Square className="h-10 w-10" /> : <Mic className="h-10 w-10" />}
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
                      <Button onClick={handleSendVoice} disabled={isSending}>
                        {isSending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4 mr-2" />
                        )}
                        Send Message
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Text Message Modal */}
      <Dialog open={showTextModal} onOpenChange={setShowTextModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-purple-500" />
              Send a Text Message
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

      {/* Email Modal */}
      <Dialog open={showEmailModal} onOpenChange={setShowEmailModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-emerald-500" />
              Send an Email
            </DialogTitle>
            <DialogDescription>
              Send a detailed message about {propertyName || "your property"}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="emailSubject">Subject</Label>
              <input
                id="emailSubject"
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Question about my property"
                className="mt-1.5 w-full px-3 py-2 border rounded-md bg-background"
              />
            </div>
            
            <div>
              <Label htmlFor="emailBody">Message</Label>
              <Textarea
                id="emailBody"
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                placeholder="Hi, I wanted to ask about..."
                rows={6}
                className="mt-1.5"
              />
            </div>
            
            <Button 
              onClick={handleSendEmail} 
              disabled={isSending || !emailSubject.trim() || !emailBody.trim()}
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
                  Send Email
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
