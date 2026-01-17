import { useState, useRef, useCallback } from "react";
import { Mic, MicOff, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface VoiceDictationButtonProps {
  onResult: (text: string) => void;
  messageType: "email" | "sms";
  contactName?: string;
  placeholder?: string;
  className?: string;
}

export function VoiceDictationButton({
  onResult,
  messageType,
  contactName,
  placeholder = "Hold to speak...",
  className,
}: VoiceDictationButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const recognitionRef = useRef<any>(null);

  const startListening = useCallback(() => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      toast.error("Speech recognition is not supported in your browser. Try Chrome.");
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
      setTranscript("");
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      setTranscript(prev => {
        if (finalTranscript) {
          return prev + finalTranscript;
        }
        return prev + interimTranscript;
      });
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
      
      // Provide helpful error messages based on error type
      if (event.error === "aborted") {
        return; // User cancelled, no need to show error
      }
      
      if (event.error === "network") {
        toast.error("Speech recognition requires a secure connection (HTTPS). Try on the published app.");
        return;
      }
      
      if (event.error === "not-allowed") {
        toast.error("Microphone access denied. Please allow microphone permissions.");
        return;
      }
      
      if (event.error === "no-speech") {
        toast.info("No speech detected. Try speaking louder or closer to the mic.");
        return;
      }
      
      toast.error(`Speech error: ${event.error}`);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const handlePolishAndInsert = async () => {
    if (!transcript.trim()) {
      toast.error("No speech detected. Try again.");
      return;
    }

    setIsProcessing(true);

    try {
      // Use ai-message-assistant for better results - it handles context better
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
        onResult(polishedText);
        toast.success("Voice message polished and inserted!");
        setTranscript("");
        setIsOpen(false);
      } else {
        // If AI failed to generate, just use the raw transcript
        console.warn("AI returned empty, using raw transcript");
        onResult(transcript);
        toast.info("Inserted raw transcript");
        setTranscript("");
        setIsOpen(false);
      }
    } catch (error: any) {
      console.error("Polish error:", error);
      // Still allow inserting raw transcript on error
      onResult(transcript);
      toast.info("Inserted raw transcript (AI unavailable)");
      setTranscript("");
      setIsOpen(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInsertRaw = () => {
    if (transcript.trim()) {
      onResult(transcript);
      toast.success("Raw transcript inserted");
      setTranscript("");
      setIsOpen(false);
    }
  };

  // Check browser support
  const isSupported = typeof window !== "undefined" && 
    (("webkitSpeechRecognition" in window) || ("SpeechRecognition" in window));

  if (!isSupported) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn("gap-2 text-muted-foreground cursor-not-allowed", className)}
        disabled
        title="Voice dictation not supported in this browser. Use Chrome for best results."
      >
        <Mic className="h-4 w-4" />
        <span className="text-xs">Use Chrome</span>
      </Button>
    );
  }

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
              isListening ? "bg-red-500 animate-pulse" : "bg-muted"
            )} />
            <span className="text-sm font-medium">
              {isListening ? "Listening..." : "Voice Dictation"}
            </span>
          </div>

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
                disabled={isProcessing}
              >
                <Mic className="h-4 w-4 mr-2" />
                Start
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
              <>
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
                  Polish & Insert
                </Button>
              </>
            )}
          </div>

          {transcript && !isListening && !isProcessing && (
            <Button
              onClick={handleInsertRaw}
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground"
            >
              Insert raw transcript instead
            </Button>
          )}

          <p className="text-xs text-muted-foreground text-center">
            AI will polish your speech into a professional {messageType}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
