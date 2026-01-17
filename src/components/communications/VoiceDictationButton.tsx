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
      if (event.error !== "aborted") {
        toast.error(`Microphone error: ${event.error}`);
      }
      setIsListening(false);
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
      const { data, error } = await supabase.functions.invoke("smart-compose", {
        body: {
          messageType,
          action: "from_bullets",
          context: transcript,
          recipientName: contactName,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const polishedText = messageType === "email" 
        ? data.body || data.message 
        : data.message || data.body;

      if (polishedText) {
        onResult(polishedText);
        toast.success("Voice message polished and inserted!");
        setTranscript("");
        setIsOpen(false);
      } else {
        throw new Error("No text generated");
      }
    } catch (error: any) {
      console.error("Polish error:", error);
      toast.error(`Failed to polish: ${error.message}`);
      // Still allow inserting raw transcript
      if (transcript.trim()) {
        onResult(transcript);
        setTranscript("");
        setIsOpen(false);
      }
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

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 rounded-full transition-all",
            isListening && "bg-red-100 text-red-600 animate-pulse",
            className
          )}
          title="Voice dictation"
        >
          {isListening ? (
            <MicOff className="h-4 w-4" />
          ) : (
            <Mic className="h-4 w-4" />
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
