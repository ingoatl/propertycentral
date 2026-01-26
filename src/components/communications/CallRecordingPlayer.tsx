import { useState, useRef } from "react";
import { Play, Pause, Download, FileText, ChevronDown } from "lucide-react";
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

      {/* Compact Player Controls */}
      <div className="bg-muted/50 rounded-lg p-2.5 flex items-center gap-2.5">
        {/* Play Button */}
        <button
          onClick={handlePlayPause}
          className={cn(
            "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
            "bg-primary text-primary-foreground",
            "hover:bg-primary/90 transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
          )}
        >
          {isPlaying ? (
            <Pause className="h-3.5 w-3.5" />
          ) : (
            <Play className="h-3.5 w-3.5 ml-0.5" />
          )}
        </button>

        {/* Progress Bar */}
        <div className="flex-1 flex items-center gap-2">
          <div 
            ref={progressRef}
            className="flex-1 h-1 bg-border rounded-full cursor-pointer relative group"
            onClick={handleProgressClick}
          >
            <div 
              className="h-full bg-primary rounded-full transition-all relative"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm" />
            </div>
          </div>
          
          {/* Time */}
          <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
            {formatTime(currentTime)} / {displayDuration}
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
            onClick={handlePlaybackRateChange}
          >
            {playbackRate}x
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={handleDownload}
            title="Download recording"
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
          {transcript && (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 text-muted-foreground hover:text-foreground",
                showTranscript && "bg-accent text-foreground"
              )}
              onClick={() => setShowTranscript(!showTranscript)}
              title={showTranscript ? "Hide transcript" : "Show transcript"}
            >
              <FileText className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Transcript Section - Only visible when toggled */}
      {transcript && (
        <Collapsible open={showTranscript} onOpenChange={setShowTranscript}>
          <CollapsibleContent>
            <div className="bg-muted/30 rounded-lg border border-border/50">
              <div className="px-3 py-2 flex items-center justify-between border-b border-border/50">
                <div className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Transcript</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={handleDownloadTranscript}
                >
                  <Download className="h-3 w-3 mr-1" />
                  Download
                </Button>
              </div>
              <div className="p-3 max-h-48 overflow-y-auto">
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {transcript}
                </p>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
