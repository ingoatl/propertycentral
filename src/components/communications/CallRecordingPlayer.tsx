import { useState, useRef } from "react";
import { Play, Pause, Square, Volume2, Download } from "lucide-react";
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

  const progress = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0;

  return (
    <div className="space-y-1">
      {/* Audio element */}
      <audio
        ref={audioRef}
        src={recordingUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        preload="metadata"
      />

      {/* Inline player controls - matches screenshot 2 */}
      <div className={cn(
        "flex items-center gap-1.5 py-1",
        isOutbound ? "text-primary" : "text-muted-foreground"
      )}>
        {/* Stop button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 hover:bg-muted"
          onClick={handleStop}
        >
          <Square className="h-3.5 w-3.5 fill-current" />
        </Button>

        {/* Play/Pause button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 hover:bg-muted"
          onClick={handlePlayPause}
        >
          {isPlaying ? (
            <Pause className="h-3.5 w-3.5 fill-current" />
          ) : (
            <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
          )}
        </Button>

        {/* Progress bar - clickable */}
        <div 
          ref={progressRef}
          className="flex-1 h-1.5 bg-muted rounded-full cursor-pointer min-w-[80px] max-w-[120px]"
          onClick={handleProgressClick}
        >
          <div 
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Time display */}
        <span className="text-xs tabular-nums whitespace-nowrap">
          {formatTime(currentTime)}
        </span>
        <span className="text-xs text-muted-foreground/60">/</span>
        <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
          {formatTime(audioDuration)}
        </span>

        {/* Volume indicator */}
        <Volume2 className="h-3.5 w-3.5 shrink-0" />

        {/* Playback rate */}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-xs font-medium hover:bg-muted min-w-[28px]"
          onClick={handlePlaybackRateChange}
        >
          x{playbackRate}
        </Button>

        {/* Download Recording */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 hover:bg-muted"
          onClick={handleDownload}
          title="Download recording"
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Transcript section - below player */}
      {transcript && (
        <div className="space-y-1">
          {/* Transcript preview + View link */}
          <p className="text-xs text-primary line-clamp-1">
            {transcript.slice(0, 80)}...{" "}
            <button
              onClick={() => setShowTranscript(!showTranscript)}
              className="text-primary hover:underline font-medium"
            >
              {showTranscript ? "Hide Transcript" : "View Transcript"}
            </button>
          </p>
          
          {/* Expanded transcript */}
          {showTranscript && (
            <div className="mt-2 p-3 bg-muted/50 rounded-md border text-sm text-muted-foreground whitespace-pre-wrap max-h-48 overflow-y-auto">
              {transcript}
              <div className="mt-2 pt-2 border-t">
                <button
                  onClick={handleDownloadTranscript}
                  className="text-xs text-primary hover:underline"
                >
                  Download Transcript
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
