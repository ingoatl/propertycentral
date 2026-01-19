import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Video, X, Check, Upload, RefreshCw, Play, Pause } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface VideoCaptureProps {
  onVideoReady: (videoUrl: string, duration: number, storagePath: string) => void;
  onCancel?: () => void;
  className?: string;
  maxDuration?: number; // in seconds
}

export function VideoCapture({
  onVideoReady,
  onCancel,
  className,
  maxDuration = 120,
}: VideoCaptureProps) {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Cleanup URLs on unmount
  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("video/")) {
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
    setVideoFile(null);
    setVideoUrl(null);
    setDuration(0);
    setUploadProgress(0);
    setUploadError(null);
    setIsPlaying(false);
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
      // Generate unique filename
      const timestamp = Date.now();
      const extension = videoFile.name.split(".").pop() || "mp4";
      const filename = `video_${timestamp}.${extension}`;
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

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("message-attachments")
        .upload(storagePath, uint8Array, {
          contentType: videoFile.type,
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

      {!videoUrl ? (
        // Initial state - show capture button
        <div className="flex flex-col items-center gap-4 p-8 border-2 border-dashed rounded-xl bg-muted/30">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Video className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center">
            <p className="font-medium">Record a Video Message</p>
            <p className="text-sm text-muted-foreground mt-1">
              Tap below to open your camera
            </p>
          </div>
          <Button
            onClick={() => fileInputRef.current?.click()}
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
