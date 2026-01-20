import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Video, Square, X, Camera, SwitchCamera, Play, Pause } from "lucide-react";
import { toast } from "sonner";

interface VideoRecordingButtonProps {
  onVideoRecorded: (file: File) => void;
  disabled?: boolean;
  hasVideo?: boolean;
}

export function VideoRecordingButton({ 
  onVideoRecorded, 
  disabled,
  hasVideo
}: VideoRecordingButtonProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [isPlaying, setIsPlaying] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Start camera when dialog opens
  useEffect(() => {
    if (showDialog && !recordedBlob) {
      startCamera();
    }
    return () => {
      stopCamera();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [showDialog, facingMode]);

  const startCamera = async () => {
    try {
      // Check if we're on a mobile device
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      // On desktop, use any available camera (webcam)
      // On mobile, use facingMode for front/back camera switching
      const videoConstraints = isMobile 
        ? { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }
        : { width: { ideal: 1280 }, height: { ideal: 720 } };
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: true
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Failed to access camera:", err);
      toast.error("Failed to access camera. Please check permissions.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    
    chunksRef.current = [];
    const options = { mimeType: 'video/webm;codecs=vp8,opus' };
    
    try {
      const mediaRecorder = new MediaRecorder(streamRef.current, options);
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);
        stopCamera();
      };
      
      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 60) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error("Failed to start recording:", err);
      toast.error("Failed to start recording");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const handleSwitchCamera = () => {
    setFacingMode(prev => prev === "user" ? "environment" : "user");
  };

  const handleRetake = () => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedBlob(null);
    setRecordedUrl(null);
    setRecordingTime(0);
    startCamera();
  };

  const handleUseVideo = () => {
    if (recordedBlob) {
      const file = new File([recordedBlob], `video-${Date.now()}.webm`, { type: 'video/webm' });
      onVideoRecorded(file);
      handleClose();
    }
  };

  const handleClose = () => {
    stopCamera();
    stopRecording();
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedBlob(null);
    setRecordedUrl(null);
    setRecordingTime(0);
    setIsRecording(false);
    setShowDialog(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <Button
        type="button"
        variant={hasVideo ? "default" : "outline"}
        size="sm"
        onClick={() => setShowDialog(true)}
        disabled={disabled}
        className="gap-2 touch-manipulation"
      >
        <Camera className="h-4 w-4" />
        {hasVideo ? "Video Added" : "Record Video"}
      </Button>

      <Dialog open={showDialog} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-hidden p-0">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Video className="h-5 w-5 text-primary" />
              Record Video
            </DialogTitle>
          </DialogHeader>

          <div className="relative bg-black aspect-video">
            {recordedUrl ? (
              <video
                ref={previewRef}
                src={recordedUrl}
                className="w-full h-full object-contain"
                controls
                playsInline
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
              />
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform scale-x-[-1]"
                  style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
                />
                
                {/* Recording Timer */}
                {isRecording && (
                  <div className="absolute top-3 left-3 flex items-center gap-2 bg-destructive text-destructive-foreground px-3 py-1.5 rounded-full text-sm font-medium">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    {formatTime(recordingTime)} / 1:00
                  </div>
                )}
                
                {/* Switch Camera Button */}
                {!isRecording && (
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={handleSwitchCamera}
                    className="absolute top-3 right-3 h-10 w-10 rounded-full bg-black/50 hover:bg-black/70 text-white border-0"
                  >
                    <SwitchCamera className="h-5 w-5" />
                  </Button>
                )}
              </>
            )}
          </div>

          <div className="p-4 space-y-3">
            {!recordedUrl ? (
              <div className="flex justify-center">
                {isRecording ? (
                  <Button
                    size="lg"
                    variant="destructive"
                    onClick={stopRecording}
                    className="h-14 w-14 rounded-full p-0"
                  >
                    <Square className="h-6 w-6 fill-current" />
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    onClick={startRecording}
                    className="h-14 w-14 rounded-full p-0 bg-destructive hover:bg-destructive/90"
                  >
                    <div className="h-6 w-6 rounded-full bg-white" />
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleRetake}
                  className="flex-1 touch-manipulation"
                >
                  Retake
                </Button>
                <Button
                  onClick={handleUseVideo}
                  className="flex-1 touch-manipulation"
                >
                  Use Video
                </Button>
              </div>
            )}

            <Button
              variant="ghost"
              onClick={handleClose}
              className="w-full touch-manipulation"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
