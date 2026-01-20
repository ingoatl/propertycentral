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
  Loader2,
  AlertCircle,
  Mic,
  Check,
  Video,
  Maximize2,
  Minimize2
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import VoiceReplyRecorder from "@/components/voicemail/VoiceReplyRecorder";

export default function VoicemailPlayer() {
  const { token } = useParams<{ token: string }>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasTrackedOpen, setHasTrackedOpen] = useState(false);
  const [hasTrackedPlay, setHasTrackedPlay] = useState(false);
  const [showReplyRecorder, setShowReplyRecorder] = useState(false);
  const [replySent, setReplySent] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);

  // Fetch voicemail data
  const { data: voicemail, isLoading, error, refetch } = useQuery({
    queryKey: ["voicemail", token],
    queryFn: async () => {
      if (!token) throw new Error("No token provided");
      
      const { data, error } = await supabase
        .from("voicemail_messages")
        .select("*")
        .eq("token", token)
        .single();
      
      if (error) {
        throw error;
      }
      
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

  // Check if reply was already sent
  useEffect(() => {
    if (voicemail?.reply_audio_url) {
      setReplySent(true);
    }
  }, [voicemail]);

  const trackEvent = async (event: string, extraData?: Record<string, any>) => {
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
    const isVideo = voicemail?.media_type === "video";
    const mediaRef = isVideo ? videoRef.current : audioRef.current;
    if (!mediaRef) return;
    
    if (isPlaying) {
      mediaRef.pause();
      setIsPlaying(false);
    } else {
      mediaRef.play();
      setIsPlaying(true);
      
      if (!hasTrackedPlay) {
        trackEvent("play");
        setHasTrackedPlay(true);
      }
    }
  };

  const handleTimeUpdate = () => {
    const isVideo = voicemail?.media_type === "video";
    const mediaRef = isVideo ? videoRef.current : audioRef.current;
    if (mediaRef) {
      const progress = (mediaRef.currentTime / mediaRef.duration) * 100;
      setPlaybackProgress(progress);
      setCurrentTime(mediaRef.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    const isVideo = voicemail?.media_type === "video";
    const mediaRef = isVideo ? videoRef.current : audioRef.current;
    if (mediaRef) {
      setDuration(mediaRef.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setPlaybackProgress(0);
    setCurrentTime(0);
    
    if (duration > 0) {
      trackEvent("play", { duration: Math.round(duration) });
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const isVideo = voicemail?.media_type === "video";
    const mediaRef = isVideo ? videoRef.current : audioRef.current;
    if (!mediaRef) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    mediaRef.currentTime = percentage * mediaRef.duration;
  };

  const handleFullscreen = async () => {
    const container = videoContainerRef.current;
    const video = videoRef.current;
    
    if (!container || !video) return;
    
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setIsFullscreen(false);
      } else {
        // Try video element first for better mobile support
        if (video.requestFullscreen) {
          await video.requestFullscreen();
          setIsFullscreen(true);
        } else if ((video as any).webkitEnterFullscreen) {
          // iOS Safari
          (video as any).webkitEnterFullscreen();
          setIsFullscreen(true);
        } else if (container.requestFullscreen) {
          await container.requestFullscreen();
          setIsFullscreen(true);
        }
      }
    } catch (err) {
      console.error("Fullscreen error:", err);
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, []);

  const handleCallback = () => {
    trackEvent("callback");
    window.location.href = "tel:+14048005932";
  };

  const handleReplyClick = () => {
    trackEvent("voice_reply_started");
    setShowReplyRecorder(true);
  };

  const handleReplySent = () => {
    setReplySent(true);
    setShowReplyRecorder(false);
    refetch();
  };

  const handleReplyCancel = () => {
    trackEvent("voice_reply_cancelled");
    setShowReplyRecorder(false);
  };

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds) || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 flex items-center justify-center p-4">
        <div className="text-center">
          <img 
            src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png" 
            alt="PeachHaus" 
            className="h-12 mx-auto mb-6"
          />
          <Loader2 className="h-8 w-8 animate-spin text-amber-600 mx-auto" />
        </div>
      </div>
    );
  }

  if (error || !voicemail) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 flex items-center justify-center p-4">
        <Card className="max-w-sm w-full p-8 text-center shadow-xl border-0">
          <img 
            src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png" 
            alt="PeachHaus" 
            className="h-10 mx-auto mb-6"
          />
          <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold mb-2 text-gray-900">Message Not Found</h1>
          <p className="text-sm text-gray-500">
            This voice message may have expired or doesn't exist.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 flex flex-col items-center justify-center p-4">
      <Card className="max-w-md w-full overflow-hidden shadow-2xl border-0 rounded-3xl">
        {/* Header with branding */}
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 p-8 text-white text-center relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
          
          <div className="relative z-10">
            <img 
              src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png" 
              alt="PeachHaus" 
              className="h-12 mx-auto mb-3"
            />
            <p className="text-amber-100 text-sm font-medium">Property Management</p>
          </div>
        </div>

          {/* Message Info */}
          <div className="p-6 sm:p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full mb-4">
                {voicemail.media_type === "video" ? (
                  <Video className="w-8 h-8 text-amber-600" />
                ) : (
                  <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                )}
              </div>
              <p className="text-sm text-gray-500 mb-1">
                {voicemail.media_type === "video" ? "Video Message from" : "Voice Message from"}
              </p>
              <h2 className="text-2xl font-bold text-gray-900">{voicemail.sender_name || "PeachHaus Team"}</h2>
              <p className="text-sm text-gray-400 mt-2">
                {format(new Date(voicemail.created_at), "MMMM d, yyyy 'at' h:mm a")}
              </p>
              
              {/* Show transcript if available */}
              {voicemail.message_text && voicemail.message_text !== "(Video message)" && voicemail.message_text !== "(Voice recording)" && (
                <div className="mt-4 text-left bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 font-medium mb-1 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Transcript
                  </p>
                  <p className="text-sm text-gray-700 leading-relaxed">{voicemail.message_text}</p>
                </div>
              )}
            </div>

          {/* Media Player - Video or Audio */}
          {voicemail.media_type === "video" && voicemail.video_url ? (
            // VIDEO PLAYER - iOS Safari compatible with native controls
            <div className="bg-gradient-to-br from-gray-50 to-amber-50/50 rounded-2xl p-5 mb-6">
              <div 
                ref={videoContainerRef}
                className="relative rounded-xl overflow-hidden bg-black mb-4"
              >
                {/* 
                  iOS Safari fix: Use native controls for better compatibility.
                  crossOrigin removed as it can cause CORS issues on iOS.
                  webkit-playsinline added for older iOS versions.
                */}
                <video
                  ref={videoRef}
                  src={voicemail.video_url}
                  className="w-full h-auto max-h-[70vh] object-contain mx-auto"
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onEnded={handleEnded}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onError={(e) => {
                    const video = e.target as HTMLVideoElement;
                    console.error("Video error:", {
                      error: video.error,
                      networkState: video.networkState,
                      readyState: video.readyState,
                      src: video.src
                    });
                  }}
                  playsInline
                  webkit-playsinline="true"
                  preload="auto"
                  controls
                  controlsList="nodownload"
                  style={{ WebkitTransform: 'translateZ(0)' }}
                />
              </div>
              
              {/* Time display for context */}
              <div className="flex items-center justify-between text-sm text-gray-500 mt-2">
                <span className="font-mono">{formatTime(currentTime)}</span>
                <span className="font-mono">{formatTime(duration)}</span>
              </div>
            </div>
          ) : (
            // AUDIO PLAYER (existing waveform style)
            <div className="bg-gradient-to-br from-gray-50 to-amber-50/50 rounded-2xl p-5 mb-6">
              {/* Waveform-style progress bar */}
              <div 
                className="h-16 mb-5 bg-white rounded-xl overflow-hidden cursor-pointer relative shadow-inner"
                onClick={handleSeek}
              >
                <div className="absolute inset-0 flex items-center justify-center gap-[3px] px-3">
                  {Array.from({ length: 50 }).map((_, i) => {
                    const height = 25 + Math.sin(i * 0.4) * 20 + Math.sin(i * 0.8) * 10;
                    const isPlayed = (i / 50) * 100 <= playbackProgress;
                    return (
                      <div
                        key={i}
                        className={cn(
                          "w-1 rounded-full transition-all duration-150",
                          isPlayed 
                            ? "bg-gradient-to-t from-amber-500 to-orange-400" 
                            : "bg-gray-200"
                        )}
                        style={{ height: `${height}%` }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Time and Play Button */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 font-mono w-12">
                  {formatTime(currentTime)}
                </span>
                
                <Button
                  size="lg"
                  className="rounded-full h-20 w-20 bg-gradient-to-br from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-amber-500/30 transition-all hover:scale-105"
                  onClick={handlePlay}
                >
                  {isPlaying ? (
                    <Pause className="h-8 w-8" />
                  ) : (
                    <Play className="h-8 w-8 ml-1" />
                  )}
                </Button>
                
                <span className="text-sm text-gray-500 font-mono w-12 text-right">
                  {formatTime(duration)}
                </span>
              </div>
            </div>
          )}

          {/* Reply Section */}
          {showReplyRecorder ? (
            <VoiceReplyRecorder 
              token={token!}
              voicemailId={voicemail.id}
              onReplySent={handleReplySent}
              onCancel={handleReplyCancel}
            />
          ) : (
            <>
              {/* Call to Action Buttons */}
              <div className="space-y-3">
                {replySent ? (
                  <div className="flex items-center justify-center gap-2 py-4 px-6 bg-green-50 rounded-xl border border-green-100">
                    <Check className="h-5 w-5 text-green-600" />
                    <span className="text-green-700 font-medium">Reply Sent Successfully</span>
                  </div>
                ) : (
                  <Button
                    size="lg"
                    className="w-full gap-3 h-14 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md"
                    onClick={handleReplyClick}
                  >
                    <Mic className="h-5 w-5" />
                    Reply with Voice Message
                  </Button>
                )}
                
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full gap-3 h-14 rounded-xl border-2 hover:bg-amber-50"
                  onClick={handleCallback}
                >
                  <Phone className="h-5 w-5" />
                  Call Us Back
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 p-5 text-center border-t">
          <p className="text-xs text-gray-500">
            Questions? Call us at <a href="tel:+14048005932" className="text-amber-600 font-medium hover:underline">(404) 800-5932</a>
          </p>
        </div>
      </Card>

      {/* Powered by badge */}
      <p className="mt-6 text-xs text-gray-400">
        Powered by PeachHaus
      </p>

      {/* Hidden audio element (only for audio messages) */}
      {voicemail.media_type !== "video" && (
        <audio
          ref={audioRef}
          src={voicemail.audio_url}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
          preload="metadata"
        />
      )}
    </div>
  );
}
