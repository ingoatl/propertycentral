import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Mic, Phone, Send, Loader2, X, Headphones } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import VendorVoiceRecorder from "./VendorVoiceRecorder";

const ALEX_PHONE = "(404) 341-5202";
const ALEX_PHONE_RAW = "+14043415202";

interface VendorContactCardProps {
  workOrderId: string;
  vendorId: string;
  vendorName: string;
  vendorPhone: string | null;
}

export default function VendorContactCard({ 
  workOrderId, 
  vendorId, 
  vendorName, 
  vendorPhone 
}: VendorContactCardProps) {
  const [showSMSForm, setShowSMSForm] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSendSMS = async () => {
    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }

    setIsSending(true);
    try {
      const { error } = await supabase.functions.invoke("vendor-send-message", {
        body: {
          workOrderId,
          vendorId,
          vendorName,
          vendorPhone,
          message: message.trim(),
        },
      });

      if (error) throw error;
      
      toast.success("Message sent to PeachHaus");
      setMessage("");
      setShowSMSForm(false);
    } catch (err: any) {
      toast.error("Failed to send message: " + (err.message || "Unknown error"));
    } finally {
      setIsSending(false);
    }
  };

  const handleVoiceRecorded = async (audioBlob: Blob, duration: number) => {
    try {
      // Convert to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;
        const base64Data = base64Audio.split(",")[1];

        const { error } = await supabase.functions.invoke("vendor-voice-message", {
          body: {
            workOrderId,
            vendorId,
            vendorName,
            vendorPhone,
            audioBase64: base64Data,
            duration,
            mimeType: audioBlob.type,
          },
        });

        if (error) throw error;
        
        toast.success("Voice message sent to PeachHaus");
        setShowVoiceRecorder(false);
      };
    } catch (err: any) {
      toast.error("Failed to send voice message: " + (err.message || "Unknown error"));
    }
  };

  return (
    <Card className="border-neutral-200 bg-gradient-to-br from-neutral-50 to-white">
      <CardContent className="p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Headphones className="h-4 w-4 text-neutral-600" />
            <span className="text-sm font-medium text-neutral-700">Need Help?</span>
          </div>
          <a 
            href={`tel:${ALEX_PHONE_RAW}`} 
            className="text-xs text-primary hover:underline font-medium flex items-center gap-1"
          >
            <Phone className="h-3 w-3" />
            {ALEX_PHONE}
          </a>
        </div>

        {/* Action Buttons */}
        {!showSMSForm && !showVoiceRecorder && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-10 text-xs touch-manipulation"
              onClick={() => setShowSMSForm(true)}
            >
              <MessageSquare className="h-4 w-4 mr-1.5" />
              Text Us
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-10 text-xs touch-manipulation"
              onClick={() => setShowVoiceRecorder(true)}
            >
              <Mic className="h-4 w-4 mr-1.5" />
              Voice Message
            </Button>
          </div>
        )}

        {/* SMS Form */}
        {showSMSForm && (
          <div className="space-y-2">
            <Textarea
              placeholder="Describe your question or issue..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[80px] text-sm resize-none"
              maxLength={500}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {message.length}/500
              </span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowSMSForm(false);
                    setMessage("");
                  }}
                  disabled={isSending}
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  onClick={handleSendSMS}
                  disabled={isSending || !message.trim()}
                  className="gap-1.5"
                >
                  {isSending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      Send
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Voice Recorder */}
        {showVoiceRecorder && (
          <VendorVoiceRecorder
            onRecordingComplete={handleVoiceRecorded}
            onCancel={() => setShowVoiceRecorder(false)}
          />
        )}
      </CardContent>
    </Card>
  );
}
