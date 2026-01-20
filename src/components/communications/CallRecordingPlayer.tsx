import { useState, useRef } from "react";
import { Play, Pause, Volume2, Download, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
}: CallRecordingPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration || 0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showTranscript, setShowTranscript] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const formatTime = (seconds: number) => {
    if (!seconds || !isFinite(seconds) || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current && isFinite(audioRef.current.duration)) {
      setAudioDuration(audioRef.current.duration);
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !audioRef.current || !audioDuration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * audioDuration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handlePlaybackRateChange = () => {
    const rates = [1, 1.5, 2];
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
    a.download = `transcript-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const progress = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0;
  const displayDuration = audioDuration > 0 && isFinite(audioDuration) ? formatTime(audioDuration) : "--:--";

  return (
    <div className="space-y-2">
      {/* Audio element */}
      <audio
        ref={audioRef}
        src={recordingUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        preload="metadata"
      />

      {/* Compact inline player */}
      <div className="flex items-center gap-3">
        {/* Play Button */}
        <button
          onClick={handlePlayPause}
          className={cn(
            "h-10 w-10 rounded-full flex items-center justify-center shrink-0 transition-all",
            "bg-primary text-primary-foreground hover:opacity-90",
            "focus:outline-none focus:ring-2 focus:ring-primary/30"
          )}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4 ml-0.5" />
          )}
        </button>

        {/* Progress & Time */}
        <div className="flex-1 flex items-center gap-3 min-w-0">
          {/* Progress Bar */}
          <div 
            ref={progressRef}
            className="flex-1 h-1.5 bg-muted rounded-full cursor-pointer"
            onClick={handleProgressClick}
          >
            <div 
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          
          {/* Time */}
          <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
            {formatTime(currentTime)} / {displayDuration}
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-muted-foreground"
            onClick={handlePlaybackRateChange}
          >
            {playbackRate}x
          </Button>
          <Volume2 className="h-4 w-4 text-muted-foreground" />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={handleDownload}
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Transcript - Collapsed by default, expand on click */}
      {transcript && (
        <Collapsible open={showTranscript} onOpenChange={setShowTranscript}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 text-sm text-primary hover:underline">
              <FileText className="h-4 w-4" />
              <span>{showTranscript ? "Hide Transcript" : "View Transcript"}</span>
              {showTranscript ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 p-3 bg-muted/40 rounded-lg border text-sm leading-relaxed max-h-48 overflow-y-auto">
              {transcript}
              <div className="mt-3 pt-2 border-t flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-primary"
                  onClick={handleDownloadTranscript}
                >
                  <Download className="h-3 w-3 mr-1" />
                  Download Transcript
                </Button>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
