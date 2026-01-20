import { useState, useRef } from "react";
import { Play, Pause, Volume2, Download, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
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
}: CallRecordingPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration || 0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showTranscript, setShowTranscript] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const formatTime = (seconds: number) => {
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
    if (audioRef.current) {
      setAudioDuration(audioRef.current.duration);
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !audioRef.current) return;
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

  return (
    <div className="space-y-3">
      {/* Audio element */}
      <audio
        ref={audioRef}
        src={recordingUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        preload="metadata"
      />

      {/* Premium Audio Player Card */}
      <div className={cn(
        "rounded-xl border bg-card shadow-sm overflow-hidden",
        isOutbound ? "border-primary/20" : "border-border"
      )}>
        {/* Player Controls */}
        <div className="p-4">
          <div className="flex items-center gap-4">
            {/* Play Button - Large and prominent */}
            <button
              onClick={handlePlayPause}
              className={cn(
                "h-12 w-12 rounded-full flex items-center justify-center transition-all duration-200",
                "bg-primary text-primary-foreground shadow-md hover:shadow-lg hover:scale-105",
                "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2"
              )}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5 ml-0.5" />
              )}
            </button>

            {/* Progress Section */}
            <div className="flex-1 space-y-2">
              {/* Progress Bar */}
              <div 
                ref={progressRef}
                className="h-2 bg-muted rounded-full cursor-pointer group"
                onClick={handleProgressClick}
              >
                <div 
                  className="h-full bg-primary rounded-full transition-all relative"
                  style={{ width: `${progress}%` }}
                >
                  {/* Playhead dot */}
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 h-3 w-3 bg-primary rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              
              {/* Time Display */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium tabular-nums">{formatTime(currentTime)}</span>
                <span className="tabular-nums">{formatTime(audioDuration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1">
              {/* Playback Speed */}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                onClick={handlePlaybackRateChange}
              >
                {playbackRate}x
              </Button>

              {/* Volume Indicator */}
              <div className="h-8 w-8 flex items-center justify-center text-muted-foreground">
                <Volume2 className="h-4 w-4" />
              </div>

              {/* Download */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={handleDownload}
                title="Download recording"
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Transcript Section - Collapsed by default */}
        {transcript && (
          <div className="border-t border-border">
            <button
              onClick={() => setShowTranscript(!showTranscript)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <FileText className="h-4 w-4 text-primary" />
                <span>Call Transcript</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadTranscript();
                  }}
                >
                  <Download className="h-3 w-3 mr-1" />
                  Download
                </Button>
                {showTranscript ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </button>
            
            {/* Expanded Transcript */}
            {showTranscript && (
              <div className="px-4 pb-4">
                <div className="p-4 bg-muted/30 rounded-lg border border-border/50 max-h-64 overflow-y-auto">
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {transcript}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
