import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Play, Pause, RotateCcw, Sparkles, Volume2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { 
  VOICEMAIL_TEMPLATES, 
  VOICE_OPTIONS, 
  processVoicemailTemplate,
  type VoicemailTemplate 
} from "./voicemailTemplates";

interface AIVoiceGeneratorProps {
  recipientName?: string;
  senderName?: string;
  propertyAddress?: string;
  onAudioGenerated: (audioBlob: Blob, messageText: string, voiceId: string) => void;
  className?: string;
}

export function AIVoiceGenerator({
  recipientName,
  senderName,
  propertyAddress,
  onAudioGenerated,
  className,
}: AIVoiceGeneratorProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [customMessage, setCustomMessage] = useState("");
  const [selectedVoice, setSelectedVoice] = useState(VOICE_OPTIONS[0].id);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [generatedBlob, setGeneratedBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const firstName = recipientName?.split(" ")[0] || "there";

  const getCurrentMessage = (): string => {
    if (selectedTemplate) {
      const template = VOICEMAIL_TEMPLATES.find(t => t.id === selectedTemplate);
      if (template) {
        return processVoicemailTemplate(template.message, {
          firstName,
          name: recipientName,
          senderName: senderName || "your representative",
          propertyAddress,
        });
      }
    }
    return customMessage;
  };

  const handleTemplateSelect = (templateId: string) => {
    if (templateId === selectedTemplate) {
      setSelectedTemplate(null);
    } else {
      setSelectedTemplate(templateId);
      const template = VOICEMAIL_TEMPLATES.find(t => t.id === templateId);
      if (template) {
        setCustomMessage(processVoicemailTemplate(template.message, {
          firstName,
          name: recipientName,
          senderName: senderName || "your representative",
          propertyAddress,
        }));
      }
    }
  };

  const generateAudio = async () => {
    const message = getCurrentMessage();
    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }

    setIsGenerating(true);
    
    try {
      // Clean up previous audio
      if (generatedAudioUrl) {
        URL.revokeObjectURL(generatedAudioUrl);
      }

      // Call ElevenLabs TTS via edge function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ 
            text: message, 
            voiceId: selectedVoice 
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to generate audio");
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      setGeneratedBlob(audioBlob);
      setGeneratedAudioUrl(audioUrl);
      toast.success("Audio generated successfully!");
    } catch (error) {
      console.error("Error generating audio:", error);
      toast.error("Failed to generate audio. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const togglePlayback = () => {
    if (!audioRef.current || !generatedAudioUrl) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleAudioTimeUpdate = () => {
    if (audioRef.current) {
      const progress = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setPlaybackProgress(progress);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setPlaybackProgress(0);
  };

  const resetAudio = () => {
    if (generatedAudioUrl) {
      URL.revokeObjectURL(generatedAudioUrl);
    }
    setGeneratedAudioUrl(null);
    setGeneratedBlob(null);
    setIsPlaying(false);
    setPlaybackProgress(0);
  };

  const confirmAudio = () => {
    if (generatedBlob) {
      onAudioGenerated(generatedBlob, getCurrentMessage(), selectedVoice);
    }
  };

  // Group templates by category
  const templatesByCategory = VOICEMAIL_TEMPLATES.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, VoicemailTemplate[]>);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Voice Selection */}
      <div className="space-y-2">
        <Label>Voice</Label>
        <Select value={selectedVoice} onValueChange={setSelectedVoice}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VOICE_OPTIONS.map((voice) => (
              <SelectItem key={voice.id} value={voice.id}>
                <div className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-muted-foreground" />
                  <span>{voice.name}</span>
                  <span className="text-xs text-muted-foreground">({voice.description})</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Template Selection */}
      <div className="space-y-2">
        <Label>Quick Templates</Label>
        <div className="flex flex-wrap gap-2">
          {Object.entries(templatesByCategory).map(([category, templates]) => (
            templates.map((template) => (
              <Button
                key={template.id}
                type="button"
                variant={selectedTemplate === template.id ? "default" : "outline"}
                size="sm"
                onClick={() => handleTemplateSelect(template.id)}
                className="text-xs"
              >
                {template.label}
              </Button>
            ))
          ))}
        </div>
      </div>

      {/* Message Input */}
      <div className="space-y-2">
        <Label>Message</Label>
        <Textarea
          value={customMessage}
          onChange={(e) => {
            setCustomMessage(e.target.value);
            setSelectedTemplate(null);
          }}
          placeholder="Type your message or select a template above..."
          rows={5}
          className="resize-none"
        />
        <p className="text-xs text-muted-foreground">
          Supports variables: {"{{first_name}}"}, {"{{sender_name}}"}, {"{{property_address}}"}
        </p>
      </div>

      {/* Generate / Preview */}
      {!generatedAudioUrl ? (
        <Button 
          type="button"
          onClick={generateAudio} 
          disabled={isGenerating || !customMessage.trim()}
          className="gap-2"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate Audio Preview
            </>
          )}
        </Button>
      ) : (
        <div className="space-y-3">
          {/* Audio Player */}
          <div className="bg-muted rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="rounded-full h-10 w-10"
                onClick={togglePlayback}
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5 ml-0.5" />
                )}
              </Button>
              
              <div className="flex-1">
                <div className="h-2 bg-muted-foreground/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-100"
                    style={{ width: `${playbackProgress}%` }}
                  />
                </div>
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground text-center">
              {VOICE_OPTIONS.find(v => v.id === selectedVoice)?.name} voice
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 gap-2"
              onClick={resetAudio}
            >
              <RotateCcw className="h-4 w-4" />
              Regenerate
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={confirmAudio}
            >
              Use This Audio
            </Button>
          </div>
        </div>
      )}

      {/* Hidden audio element */}
      {generatedAudioUrl && (
        <audio
          ref={audioRef}
          src={generatedAudioUrl}
          onTimeUpdate={handleAudioTimeUpdate}
          onEnded={handleAudioEnded}
        />
      )}
    </div>
  );
}
