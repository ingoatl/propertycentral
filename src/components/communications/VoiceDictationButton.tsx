import { useState, useCallback } from "react";
import { Mic, MicOff, Loader2, Sparkles, Check, X, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useScribe, CommitStrategy } from "@elevenlabs/react";
import { useIsMobile } from "@/hooks/use-mobile";

interface VoiceDictationButtonProps {
  onResult: (text: string) => void;
  messageType: "email" | "sms";
  contactName?: string;
  placeholder?: string;
  className?: string;
  showPreview?: boolean;
}

export function VoiceDictationButton({
  onResult,
  messageType,
  contactName,
  placeholder = "Hold to speak...",
  className,
  showPreview = true,
}: VoiceDictationButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [polishedPreview, setPolishedPreview] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    onPartialTranscript: (data) => {
      console.log("[Scribe] Partial:", data.text);
      setTranscript(prev => {
        const parts = prev.split(/(?<=\. )/);
        if (parts.length > 0 && !data.text.includes('.')) {
          parts[parts.length - 1] = data.text;
          return parts.join('');
        }
        return prev + data.text;
      });
    },
    onCommittedTranscript: (data) => {
      console.log("[Scribe] Committed:", data.text);
      setTranscript(prev => {
        const cleaned = prev.replace(/[^.]*$/, '');
        return (cleaned + ' ' + data.text).trim();
      });
    },
  });

  const startListening = useCallback(async () => {
    setIsConnecting(true);
    setTranscript("");
    setPolishedPreview(null);
    
    try {
      const { data, error } = await supabase.functions.invoke("elevenlabs-scribe-token");
      
      if (error || !data?.token) {
        console.error("[Scribe] Token error:", error);
        toast.error("Failed to start speech recognition. Please try again.");
        setIsConnecting(false);
        return;
      }

      console.log("[Scribe] Got token, connecting...");

      await scribe.connect({
        token: data.token,
        microphone: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      console.log("[Scribe] Connected successfully");
    } catch (error) {
      console.error("[Scribe] Connection error:", error);
      toast.error("Failed to connect to speech recognition service.");
    } finally {
      setIsConnecting(false);
    }
  }, [scribe]);

  const stopListening = useCallback(() => {
    console.log("[Scribe] Stopping...");
    scribe.disconnect();
  }, [scribe]);

  const handlePolishAndInsert = async () => {
    if (!transcript.trim()) {
      toast.error("No speech detected. Try again.");
      return;
    }

    console.log("[VoiceDictation] Starting polish with transcript:", transcript);
    setIsProcessing(true);

    try {
      console.log("[VoiceDictation] Calling ai-message-assistant with:", {
        action: "improve",
        currentMessage: transcript,
        contactName,
        messageType,
      });
      
      const { data, error } = await supabase.functions.invoke("ai-message-assistant", {
        body: {
          action: "improve",
          currentMessage: transcript,
          contactName,
          messageType,
        },
      });

      console.log("[VoiceDictation] AI response:", { data, error });

      if (error) {
        console.error("[VoiceDictation] Function error:", error);
        throw error;
      }
      if (data?.error) {
        console.error("[VoiceDictation] Data error:", data.error);
        throw new Error(data.error);
      }

      const polishedText = data?.message;
      console.log("[VoiceDictation] Polished text:", polishedText);

      if (polishedText) {
        if (showPreview) {
          console.log("[VoiceDictation] Setting polished preview");
          setPolishedPreview(polishedText);
          toast.success("AI polished your message!");
        } else {
          onResult(polishedText);
          toast.success("Voice message polished and inserted!");
          setTranscript("");
          setIsOpen(false);
        }
      } else {
        console.warn("[VoiceDictation] AI returned empty, using raw transcript");
        if (showPreview) {
          setPolishedPreview(transcript);
          toast.info("Using raw transcript");
        } else {
          onResult(transcript);
          toast.info("Inserted raw transcript");
          setTranscript("");
          setIsOpen(false);
        }
      }
    } catch (error: any) {
      console.error("[VoiceDictation] Polish error:", error);
      if (showPreview) {
        setPolishedPreview(transcript);
        toast.info("Using raw transcript (AI unavailable)");
      } else {
        onResult(transcript);
        toast.info("Inserted raw transcript (AI unavailable)");
        setTranscript("");
        setIsOpen(false);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSend = () => {
    if (polishedPreview) {
      console.log("[VoiceDictation] Sending polished message:", polishedPreview);
      onResult(polishedPreview);
      toast.success("Message inserted!");
      resetState();
    }
  };

  const handleInsertRaw = () => {
    if (transcript.trim()) {
      if (showPreview) {
        setPolishedPreview(transcript);
      } else {
        onResult(transcript);
        toast.success("Raw transcript inserted");
        setTranscript("");
        setIsOpen(false);
      }
    }
  };

  const resetState = () => {
    setPolishedPreview(null);
    setTranscript("");
    setIsOpen(false);
  };

  const handleCancel = () => {
    setPolishedPreview(null);
  };

  const isListening = scribe.isConnected;

  // Trigger button - shared between desktop and mobile
  const TriggerButton = (
    <Button
      type="button"
      variant={isListening ? "destructive" : "ghost"}
      size="icon"
      className={cn(
        "h-9 w-9 rounded-full transition-all flex-shrink-0",
        isListening && "animate-pulse bg-red-500 hover:bg-red-600",
        !isListening && "hover:bg-primary/10",
        className
      )}
      title="Voice dictation - Click to speak"
    >
      {isListening ? (
        <MicOff className="h-4 w-4" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </Button>
  );

  // Shared content for popover/drawer
  const DictationContent = (
    <div className="space-y-4 md:space-y-4">
      {/* Status indicator */}
      <div className="flex flex-col items-center gap-3 py-2 md:flex-row md:gap-2 md:py-0">
        <div className={cn(
          "h-16 w-16 md:h-3 md:w-3 rounded-full flex items-center justify-center transition-all",
          isListening ? "bg-red-500 animate-pulse" : isConnecting ? "bg-yellow-500 animate-pulse" : polishedPreview ? "bg-green-500" : "bg-muted"
        )}>
          {isMobile && (
            <Mic className={cn("h-6 w-6", isListening || isConnecting ? "text-white" : "text-muted-foreground")} />
          )}
        </div>
        <span className="text-base md:text-sm font-medium text-center">
          {polishedPreview ? "Ready to Insert" : isListening ? "Listening..." : isConnecting ? "Connecting..." : "Tap to speak"}
        </span>
      </div>

      {/* Polished preview with Send button */}
      {polishedPreview ? (
        <div className="space-y-4 md:space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-primary justify-center md:justify-start">
            <Sparkles className="h-4 w-4" />
            <span>AI Polished Message</span>
          </div>
          
          <Textarea
            value={polishedPreview}
            onChange={(e) => setPolishedPreview(e.target.value)}
            className="min-h-[120px] md:min-h-[100px] text-base md:text-sm resize-y"
          />
          
          <div className="flex gap-3 md:gap-2">
            <Button onClick={handleSend} size="lg" className="flex-1 h-12 md:h-10 gap-2 text-base md:text-sm">
              <Check className="h-5 w-5 md:h-4 md:w-4" />
              Insert
            </Button>
            <Button variant="outline" onClick={handleCancel} size="lg" className="h-12 md:h-10 gap-2 text-base md:text-sm">
              <X className="h-5 w-5 md:h-4 md:w-4" />
              Cancel
            </Button>
          </div>
          
          <Button
            variant="ghost"
            size="lg"
            onClick={() => {
              setPolishedPreview(null);
            }}
            className="w-full text-sm text-muted-foreground h-11 md:h-8"
          >
            <Edit3 className="h-4 w-4 md:h-3 md:w-3 mr-2" />
            Re-record
          </Button>
        </div>
      ) : (
        <>
          {/* Transcript preview */}
          <div className="min-h-[100px] md:min-h-[80px] max-h-[180px] md:max-h-[150px] overflow-y-auto p-4 md:p-3 rounded-xl bg-muted/50 border">
            {transcript ? (
              <p className="text-base md:text-sm whitespace-pre-wrap">{transcript}</p>
            ) : (
              <p className="text-base md:text-sm text-muted-foreground italic text-center md:text-left">
                {isListening ? "Speak now..." : "Tap Start to begin recording"}
              </p>
            )}
          </div>

          {/* Controls - larger on mobile */}
          <div className="flex gap-3 md:gap-2">
            {!isListening ? (
              <Button
                onClick={startListening}
                variant="outline"
                size="lg"
                className="flex-1 h-14 md:h-10 text-base md:text-sm"
                disabled={isProcessing || isConnecting}
              >
                {isConnecting ? (
                  <Loader2 className="h-5 w-5 md:h-4 md:w-4 mr-2 animate-spin" />
                ) : (
                  <Mic className="h-5 w-5 md:h-4 md:w-4 mr-2" />
                )}
                {isConnecting ? "Connecting..." : "Start"}
              </Button>
            ) : (
              <Button
                onClick={stopListening}
                variant="destructive"
                size="lg"
                className="flex-1 h-14 md:h-10 text-base md:text-sm"
              >
                <MicOff className="h-5 w-5 md:h-4 md:w-4 mr-2" />
                Stop
              </Button>
            )}

            {transcript && !isListening && (
              <Button
                onClick={handlePolishAndInsert}
                disabled={isProcessing}
                size="lg"
                className="flex-1 h-14 md:h-10 bg-gradient-to-r from-violet-500 to-violet-600 text-base md:text-sm"
              >
                {isProcessing ? (
                  <Loader2 className="h-5 w-5 md:h-4 md:w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-5 w-5 md:h-4 md:w-4 mr-2" />
                )}
                Polish
              </Button>
            )}
          </div>

          {transcript && !isListening && !isProcessing && (
            <Button
              onClick={handleInsertRaw}
              variant="ghost"
              size="lg"
              className="w-full text-sm text-muted-foreground h-11 md:h-8"
            >
              Use raw transcript instead
            </Button>
          )}

          <p className="text-sm md:text-xs text-muted-foreground text-center">
            AI will polish your speech into a professional {messageType}
          </p>
        </>
      )}
    </div>
  );

  // Mobile: Use Drawer (bottom sheet)
  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerTrigger asChild>
          {TriggerButton}
        </DrawerTrigger>
        <DrawerContent className="px-4 pb-8 pt-4 safe-area-bottom">
          {DictationContent}
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop: Use Popover
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {TriggerButton}
      </PopoverTrigger>
      <PopoverContent className="w-80 max-h-[85vh] overflow-y-auto" align="end" sideOffset={8} collisionPadding={16}>
        {DictationContent}
      </PopoverContent>
    </Popover>
  );
}
