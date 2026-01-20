import { useState, useRef } from "react";
import { Phone, Play, Pause, Square, Volume2, Download, FileText, FileDown, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface CallRecordingPlayerProps {
  recordingUrl: string;
  duration?: number;
  transcript?: string;
  isOutbound?: boolean;
  compact?: boolean;
}

export function CallRecordingPlayer({ 
  recordingUrl, 
  duration, 
  transcript,
  isOutbound = false,
  compact = false
}: CallRecordingPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration || 0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showTranscript, setShowTranscript] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleStop = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setCurrentTime(0);
    setIsPlaying(false);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setAudioDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const handlePlaybackRateChange = () => {
    const rates = [1, 1.25, 1.5, 2];
    const currentIndex = rates.indexOf(playbackRate);
    const nextRate = rates[(currentIndex + 1) % rates.length];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleDownload = () => {
    window.open(recordingUrl, "_blank");
  };

  const handleDownloadTranscript = () => {
    if (!transcript) return;
    const blob = new Blob([transcript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `call-transcript-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={cn(
      "rounded-lg border",
      isOutbound ? "bg-primary/5 border-primary/20" : "bg-muted/60 border-border"
    )}>
      {/* Audio element */}
      <audio
        ref={audioRef}
        src={recordingUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        preload="metadata"
      />

      {/* Header */}
      <div className={cn(
        "flex items-center gap-2 px-3 py-2",
        isOutbound ? "text-primary" : "text-foreground"
      )}>
        <Phone className="h-4 w-4 text-green-600" />
        <span className="text-sm font-medium">
          {isOutbound ? "Outgoing Call" : "Inbound Call"}
        </span>
      </div>

      {/* Player controls */}
      <div className="px-3 pb-2 space-y-2">
        <div className="flex items-center gap-2">
          {/* Stop button */}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handleStop}
          >
            <Square className="h-3 w-3" />
          </Button>

          {/* Play/Pause button */}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handlePlayPause}
          >
            {isPlaying ? (
              <Pause className="h-3 w-3" />
            ) : (
              <Play className="h-3 w-3 ml-0.5" />
            )}
          </Button>

          {/* Progress bar */}
          <div className="flex-1 flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-10 text-right">
              {formatTime(currentTime)}
            </span>
            <Slider
              value={[currentTime]}
              max={audioDuration || 1}
              step={0.1}
              onValueChange={handleSeek}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-10">
              {formatTime(audioDuration)}
            </span>
          </div>

          {/* Volume indicator */}
          <Volume2 className="h-4 w-4 text-muted-foreground shrink-0" />

          {/* Playback rate */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs font-medium text-primary hover:text-primary"
            onClick={handlePlaybackRateChange}
          >
            x{playbackRate}
          </Button>

          {/* Download Recording */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handleDownload}
            title="Download recording"
          >
            <Download className="h-3.5 w-3.5" />
          </Button>

          {/* Download Transcript */}
          {transcript && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={handleDownloadTranscript}
              title="Download transcript"
            >
              <FileDown className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* Transcript toggle */}
        {transcript && (
          <Collapsible open={showTranscript} onOpenChange={setShowTranscript}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs gap-1.5 text-primary hover:text-primary"
              >
                <FileText className="h-3 w-3" />
                {showTranscript ? "Hide" : "View"} Transcript
                {showTranscript ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 p-3 bg-background rounded-md border text-sm text-muted-foreground whitespace-pre-wrap max-h-48 overflow-y-auto">
                {transcript}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Note about recording */}
        <p className="text-[11px] text-muted-foreground italic">
          This call will be recorded for quality purposes....{" "}
          {transcript && !showTranscript && (
            <button
              onClick={() => setShowTranscript(true)}
              className="text-primary hover:underline not-italic"
            >
              View Transcript
            </button>
          )}
        </p>
      </div>
    </div>
  );
}
