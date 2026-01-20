import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Video, X, Check, Upload, RefreshCw, Play, Pause, Square, Circle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface VideoCaptureProps {
  onVideoReady: (videoUrl: string, duration: number, storagePath: string) => void;
  onCancel?: () => void;
  className?: string;
  maxDuration?: number; // in seconds
}

// Detect if we're on a mobile device
const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export function VideoCapture({
  onVideoReady,
  onCancel,
  className,
  maxDuration = 180, // 3 minutes default
}: VideoCaptureProps) {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isWebcamMode, setIsWebcamMode] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [webcamError, setWebcamError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup URLs and streams on unmount
  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
      stopWebcam();
    };
  }, [videoUrl]);

  const stopWebcam = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    setIsWebcamMode(false);
    setRecordingTime(0);
  }, []);

  const startWebcam = async () => {
    setWebcamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      setIsWebcamMode(true);
      
      // Wait for the live video element to be available
      setTimeout(() => {
        if (liveVideoRef.current) {
          liveVideoRef.current.srcObject = stream;
          liveVideoRef.current.play().catch(console.error);
        }
      }, 100);
    } catch (error: any) {
      console.error("Webcam access error:", error);
      setWebcamError(error.message || "Could not access camera. Please check permissions.");
    }
  };

  const startRecording = () => {
    if (!streamRef.current) return;

    chunksRef.current = [];
    const mediaRecorder = new MediaRecorder(streamRef.current, {
      mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9") 
        ? "video/webm;codecs=vp9" 
        : "video/webm",
    });
    
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };
    
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const file = new File([blob], `recording_${Date.now()}.webm`, { type: "video/webm" });
      setVideoFile(file);
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
      stopWebcam();
    };
    
    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start(1000); // Collect data every second
    setIsRecording(true);
    setRecordingTime(0);
    
    // Start timer
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => {
        if (prev >= maxDuration - 1) {
          stopRecording();
          return prev;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
  };

  const handleOpenCamera = () => {
    if (isMobileDevice()) {
      // On mobile, use native camera app via file input
      fileInputRef.current?.click();
    } else {
      // On desktop, start webcam
      startWebcam();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type - accept video/* and QuickTime (.mov) files
    const validVideoTypes = [
      "video/mp4",
      "video/webm",
      "video/ogg",
      "video/quicktime", // .mov files
      "video/x-m4v",
      "video/3gpp",
      "video/3gpp2",
    ];
    
    const isValidVideo = file.type.startsWith("video/") || 
                         validVideoTypes.includes(file.type) ||
                         file.name.toLowerCase().endsWith(".mov") ||
                         file.name.toLowerCase().endsWith(".mp4");
    
    if (!isValidVideo) {
      setUploadError("Please select a video file");
      return;
    }

    // Validate file size (max 100MB)
    if (file.size > 100 * 1024 * 1024) {
      setUploadError("Video file is too large. Maximum size is 100MB.");
      return;
    }

    setUploadError(null);
    setVideoFile(file);
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const videoDuration = videoRef.current.duration;
      setDuration(videoDuration);

      // Check if video exceeds max duration
      if (videoDuration > maxDuration) {
        setUploadError(`Video is too long. Maximum duration is ${Math.floor(maxDuration / 60)} minutes.`);
      }
    }
  };

  const togglePlayback = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleVideoEnded = () => {
    setIsPlaying(false);
  };

  const resetCapture = () => {
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    stopWebcam();
    setVideoFile(null);
    setVideoUrl(null);
    setDuration(0);
    setUploadProgress(0);
    setUploadError(null);
    setIsPlaying(false);
    setWebcamError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadVideo = async () => {
    if (!videoFile) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    try {
      // Generate unique filename - ALWAYS use .mp4 extension for compatibility
      const timestamp = Date.now();
      const filename = `video_${timestamp}.mp4`;
      const storagePath = `videos/${filename}`;

      // Simulate progress for better UX (actual upload doesn't give progress)
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + Math.random() * 15;
        });
      }, 200);

      // Read file as ArrayBuffer
      const arrayBuffer = await videoFile.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // ALWAYS use video/mp4 content type for maximum compatibility
      const contentType = "video/mp4";

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("message-attachments")
        .upload(storagePath, uint8Array, {
          contentType: contentType,
          upsert: false,
        });

      clearInterval(progressInterval);

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      setUploadProgress(100);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("message-attachments")
        .getPublicUrl(storagePath);

      // Call callback with video info
      onVideoReady(urlData.publicUrl, duration, storagePath);
    } catch (error: any) {
      console.error("Video upload error:", error);
      setUploadError(error.message || "Failed to upload video");
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  const formatTime = (seconds: number): string => {
    // Handle Infinity, NaN, or invalid values
    if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) {
      return "0:00";
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Hidden file input for native camera capture */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />

      {isWebcamMode ? (
        // Desktop webcam recording mode
        <div className="flex flex-col gap-4">
          <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
            <video
              ref={liveVideoRef}
              className="w-full h-full object-cover mirror"
              autoPlay
              muted
              playsInline
              style={{ transform: 'scaleX(-1)' }}
            />
            {/* Recording indicator */}
            {isRecording && (
              <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-600 text-white text-sm font-medium">
                <Circle className="h-3 w-3 fill-current animate-pulse" />
                Recording • {formatTime(recordingTime)}
              </div>
            )}
            {/* Max duration badge */}
            <div className="absolute bottom-3 right-3 px-2 py-1 rounded bg-black/70 text-white text-sm">
              Max: {formatTime(maxDuration)}
            </div>
          </div>

          {webcamError && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {webcamError}
            </div>
          )}

          <div className="flex gap-2">
            {!isRecording ? (
              <Button
                onClick={startRecording}
                size="lg"
                className="flex-1 gap-2 bg-red-600 hover:bg-red-700"
              >
                <Circle className="h-5 w-5 fill-current" />
                Start Recording
              </Button>
            ) : (
              <Button
                onClick={stopRecording}
                size="lg"
                variant="destructive"
                className="flex-1 gap-2"
              >
                <Square className="h-5 w-5 fill-current" />
                Stop Recording
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                stopWebcam();
                resetCapture();
              }}
              disabled={isRecording}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
          </div>
        </div>
      ) : !videoUrl ? (
        // Initial state - show capture button
        <div className="flex flex-col items-center gap-4 p-8 border-2 border-dashed rounded-xl bg-muted/30">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Video className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center">
            <p className="font-medium">Record a Video Message</p>
            <p className="text-sm text-muted-foreground mt-1">
              {isMobileDevice() ? "Tap below to open your camera" : "Click below to start webcam recording"}
            </p>
          </div>
          <Button
            onClick={handleOpenCamera}
            size="lg"
            className="gap-2"
          >
            <Video className="h-5 w-5" />
            Open Camera
          </Button>
          <p className="text-xs text-muted-foreground">
            Maximum {Math.floor(maxDuration / 60)} minute{maxDuration >= 120 ? "s" : ""}
          </p>
        </div>
      ) : (
        // Video preview state
        <div className="flex flex-col gap-4">
          {/* Video Preview */}
          <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-full object-contain"
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={handleVideoEnded}
              playsInline
            />
            {/* Play/Pause overlay */}
            <button
              onClick={togglePlayback}
              className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors"
            >
              <div className="h-16 w-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                {isPlaying ? (
                  <Pause className="h-8 w-8 text-primary" />
                ) : (
                  <Play className="h-8 w-8 text-primary ml-1" />
                )}
              </div>
            </button>
            {/* Duration badge */}
            <div className="absolute bottom-3 right-3 px-2 py-1 rounded bg-black/70 text-white text-sm font-medium">
              {formatTime(duration)}
            </div>
          </div>

          {/* Error message */}
          {uploadError && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {uploadError}
            </div>
          )}

          {/* Upload progress */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Uploading video...</span>
                <span className="font-medium">{Math.round(uploadProgress)}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={resetCapture}
              disabled={isUploading}
              className="flex-1 gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Re-record
            </Button>
            <Button
              onClick={uploadVideo}
              disabled={isUploading || !!uploadError || duration > maxDuration}
              className="flex-1 gap-2"
            >
              {isUploading ? (
                <>
                  <Upload className="h-4 w-4 animate-pulse" />
                  Uploading...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Use Video
                </>
              )}
            </Button>
          </div>

          {/* Cancel button */}
          {onCancel && (
            <Button
              variant="ghost"
              onClick={() => {
                resetCapture();
                onCancel();
              }}
              disabled={isUploading}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
