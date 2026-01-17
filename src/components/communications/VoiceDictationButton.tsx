import { useState, useCallback } from "react";
import { Mic, MicOff, Loader2, Sparkles, Check, X, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useScribe, CommitStrategy } from "@elevenlabs/react";

interface VoiceDictationButtonProps {
  onResult: (text: string) => void;
  messageType: "email" | "sms";
  contactName?: string;
  placeholder?: string;
  className?: string;
  showPreview?: boolean; // If true, show preview with Send button instead of auto-inserting
}

export function VoiceDictationButton({
  onResult,
  messageType,
  contactName,
  placeholder = "Hold to speak...",
  className,
  showPreview = true, // Default to preview mode
}: VoiceDictationButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Preview mode state
  const [polishedPreview, setPolishedPreview] = useState<string | null>(null);

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    onPartialTranscript: (data) => {
      console.log("[Scribe] Partial:", data.text);
      setTranscript(prev => {
        // Replace with the latest partial
        const parts = prev.split(/(?<=\. )/);
        if (parts.length > 0 && !data.text.includes('.')) {
          // This is an ongoing partial update for the current sentence
          parts[parts.length - 1] = data.text;
          return parts.join('');
        }
        return prev + data.text;
      });
    },
    onCommittedTranscript: (data) => {
      console.log("[Scribe] Committed:", data.text);
      setTranscript(prev => {
        // Append committed text with a space
        const cleaned = prev.replace(/[^.]*$/, ''); // Remove incomplete partial
        return (cleaned + ' ' + data.text).trim();
      });
    },
  });

  const startListening = useCallback(async () => {
    setIsConnecting(true);
    setTranscript("");
    setPolishedPreview(null);
    
    try {
      // Get token from our edge function
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

    setIsProcessing(true);

    try {
      // Use ai-message-assistant for better results
      const { data, error } = await supabase.functions.invoke("ai-message-assistant", {
        body: {
          action: "improve",
          currentMessage: transcript,
          contactName,
          messageType,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const polishedText = data?.message;

      if (polishedText) {
        if (showPreview) {
          // Show preview instead of auto-inserting
          setPolishedPreview(polishedText);
          toast.success("AI polished your message!");
        } else {
          // Legacy behavior: auto-insert
          onResult(polishedText);
          toast.success("Voice message polished and inserted!");
          setTranscript("");
          setIsOpen(false);
        }
      } else {
        // If AI failed to generate, show raw transcript in preview
        console.warn("AI returned empty, using raw transcript");
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
      console.error("Polish error:", error);
      // Still allow inserting raw transcript on error
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
      onResult(polishedPreview);
      toast.success("Message sent!");
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

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={isListening ? "destructive" : "outline"}
          size="sm"
          className={cn(
            "gap-2 transition-all border-2",
            isListening && "animate-pulse border-red-500",
            !isListening && "border-primary/50 hover:border-primary hover:bg-primary/10",
            className
          )}
          title="Voice dictation - Click to speak"
        >
          {isListening ? (
            <>
              <MicOff className="h-4 w-4" />
              <span className="text-xs font-medium">Listening...</span>
            </>
          ) : (
            <>
              <Mic className="h-4 w-4" />
              <span className="text-xs font-medium">Dictate</span>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className={cn(
              "h-3 w-3 rounded-full",
              isListening ? "bg-red-500 animate-pulse" : isConnecting ? "bg-yellow-500 animate-pulse" : polishedPreview ? "bg-green-500" : "bg-muted"
            )} />
            <span className="text-sm font-medium">
              {polishedPreview ? "Ready to Send" : isListening ? "Listening..." : isConnecting ? "Connecting..." : "Voice Dictation"}
            </span>
          </div>

          {/* Polished preview with Send button */}
          {polishedPreview ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Sparkles className="h-4 w-4" />
                <span>AI Polished Message</span>
              </div>
              
              <Textarea
                value={polishedPreview}
                onChange={(e) => setPolishedPreview(e.target.value)}
                className="min-h-[100px] text-sm resize-y"
              />
              
              <div className="flex gap-2">
                <Button onClick={handleSend} className="flex-1 gap-2">
                  <Check className="h-4 w-4" />
                  Send
                </Button>
                <Button variant="outline" onClick={handleCancel} className="gap-2">
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPolishedPreview(null);
                  // Allow re-recording
                }}
                className="w-full text-xs text-muted-foreground"
              >
                <Edit3 className="h-3 w-3 mr-1" />
                Re-record
              </Button>
            </div>
          ) : (
            <>
              {/* Transcript preview */}
              <div className="min-h-[80px] max-h-[150px] overflow-y-auto p-3 rounded-lg bg-muted/50 border">
                {transcript ? (
                  <p className="text-sm whitespace-pre-wrap">{transcript}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    {isListening ? "Speak now..." : "Click Start to begin recording"}
                  </p>
                )}
              </div>

              {/* Controls */}
              <div className="flex gap-2">
                {!isListening ? (
                  <Button
                    onClick={startListening}
                    variant="outline"
                    className="flex-1"
                    disabled={isProcessing || isConnecting}
                  >
                    {isConnecting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Mic className="h-4 w-4 mr-2" />
                    )}
                    {isConnecting ? "Connecting..." : "Start"}
                  </Button>
                ) : (
                  <Button
                    onClick={stopListening}
                    variant="destructive"
                    className="flex-1"
                  >
                    <MicOff className="h-4 w-4 mr-2" />
                    Stop
                  </Button>
                )}

                {transcript && !isListening && (
                  <Button
                    onClick={handlePolishAndInsert}
                    disabled={isProcessing}
                    className="flex-1 bg-gradient-to-r from-violet-500 to-violet-600"
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    Polish
                  </Button>
                )}
              </div>

              {transcript && !isListening && !isProcessing && (
                <Button
                  onClick={handleInsertRaw}
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-muted-foreground"
                >
                  Use raw transcript instead
                </Button>
              )}

              <p className="text-xs text-muted-foreground text-center">
                AI will polish your speech into a professional {messageType}
              </p>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
