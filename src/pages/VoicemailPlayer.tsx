import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  Play, 
  Pause, 
  Phone, 
  MessageSquare, 
  Volume2, 
  Loader2,
  Home,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function VoicemailPlayer() {
  const { token } = useParams<{ token: string }>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasTrackedOpen, setHasTrackedOpen] = useState(false);
  const [hasTrackedPlay, setHasTrackedPlay] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch voicemail data
  const { data: voicemail, isLoading, error } = useQuery({
    queryKey: ["voicemail", token],
    queryFn: async () => {
      if (!token) throw new Error("No token provided");
      
      const { data, error } = await supabase
        .from("voicemail_messages")
        .select("*")
        .eq("token", token)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!token,
  });

  // Track page open
  useEffect(() => {
    if (voicemail && !hasTrackedOpen) {
      trackEvent("open");
      setHasTrackedOpen(true);
    }
  }, [voicemail, hasTrackedOpen]);

  const trackEvent = async (event: "open" | "play" | "callback" | "reply", extraData?: Record<string, any>) => {
    if (!token) return;
    
    try {
      await supabase.functions.invoke("voicemail-track", {
        body: { token, event, ...extraData },
      });
    } catch (err) {
      console.error("Failed to track event:", err);
    }
  };

  const handlePlay = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
      
      if (!hasTrackedPlay) {
        trackEvent("play");
        setHasTrackedPlay(true);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const progress = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setPlaybackProgress(progress);
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setPlaybackProgress(0);
    setCurrentTime(0);
    
    // Track listen duration
    if (duration > 0) {
      trackEvent("play", { duration: Math.round(duration) });
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    audioRef.current.currentTime = percentage * audioRef.current.duration;
  };

  const handleCallback = () => {
    trackEvent("callback");
    // Open phone dialer with Peachhaus number
    window.location.href = "tel:+14048005932";
  };

  const handleReply = () => {
    trackEvent("reply");
    // Open SMS composer
    window.location.href = "sms:+14048005932";
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    );
  }

  if (error || !voicemail) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center p-4">
        <Card className="max-w-sm w-full p-6 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-lg font-semibold mb-2">Message Not Found</h1>
          <p className="text-sm text-muted-foreground">
            This voice message may have expired or doesn't exist.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex flex-col items-center justify-center p-4">
      <Card className="max-w-sm w-full overflow-hidden shadow-xl">
        {/* Header with branding */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-6 text-white text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Home className="h-6 w-6" />
            <span className="text-xl font-bold">Peachhaus</span>
          </div>
          <p className="text-orange-100 text-sm">Property Management</p>
        </div>

        {/* Message Info */}
        <div className="p-6">
          <div className="text-center mb-6">
            <p className="text-sm text-muted-foreground mb-1">Voice Message from</p>
            <h2 className="text-xl font-semibold">{voicemail.sender_name || "Peachhaus Team"}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {format(new Date(voicemail.created_at), "MMMM d, yyyy 'at' h:mm a")}
            </p>
          </div>

          {/* Audio Player */}
          <div className="bg-muted rounded-xl p-4 mb-6">
            {/* Waveform-style progress bar */}
            <div 
              className="h-12 mb-4 bg-muted-foreground/10 rounded-lg overflow-hidden cursor-pointer relative"
              onClick={handleSeek}
            >
              {/* Fake waveform visualization */}
              <div className="absolute inset-0 flex items-center justify-center gap-0.5 px-2">
                {Array.from({ length: 40 }).map((_, i) => {
                  const height = 20 + Math.sin(i * 0.5) * 15 + Math.random() * 10;
                  const isPlayed = (i / 40) * 100 <= playbackProgress;
                  return (
                    <div
                      key={i}
                      className={cn(
                        "w-1 rounded-full transition-colors",
                        isPlayed ? "bg-orange-500" : "bg-muted-foreground/30"
                      )}
                      style={{ height: `${height}%` }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Time and Play Button */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground font-mono">
                {formatTime(currentTime)}
              </span>
              
              <Button
                size="lg"
                className="rounded-full h-16 w-16 bg-orange-500 hover:bg-orange-600"
                onClick={handlePlay}
              >
                {isPlaying ? (
                  <Pause className="h-7 w-7" />
                ) : (
                  <Play className="h-7 w-7 ml-1" />
                )}
              </Button>
              
              <span className="text-sm text-muted-foreground font-mono">
                {formatTime(duration)}
              </span>
            </div>
          </div>

          {/* Call to Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              size="lg"
              className="gap-2"
              onClick={handleCallback}
            >
              <Phone className="h-4 w-4" />
              Call Back
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="gap-2"
              onClick={handleReply}
            >
              <MessageSquare className="h-4 w-4" />
              Reply
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-muted/50 p-4 text-center">
          <p className="text-xs text-muted-foreground">
            Questions? Call us at (404) 800-5932
          </p>
        </div>
      </Card>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={voicemail.audio_url}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        preload="metadata"
      />
    </div>
  );
}
