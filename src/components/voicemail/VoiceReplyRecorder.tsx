import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Play, Pause, RotateCcw, Send, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface VoiceReplyRecorderProps {
  token: string;
  voicemailId: string;
  onReplySent: () => void;
  onCancel: () => void;
}

export default function VoiceReplyRecorder({ 
  token, 
  voicemailId,
  onReplySent, 
  onCancel 
}: VoiceReplyRecorderProps) {
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  const maxDuration = 120; // 2 minutes max for replies
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [recordedUrl]);

  const drawWaveform = useCallback(() => {
    if (!canvasRef.current || !analyserRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const draw = () => {
      if (!isRecording) return;
      
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);
      
      // Gradient background
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, "#fef3c7");
      gradient.addColorStop(1, "#fff7ed");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#f59e0b";
      ctx.beginPath();
      
      const sliceWidth = canvas.width / bufferLength;
      let x = 0;
      
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }
      
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };
    
    draw();
  }, [isRecording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4"
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);
        
        stream.getTracks().forEach(track => track.stop());
        audioContext.close();
      };
      
      mediaRecorder.start(100);
      setIsRecording(true);
      setDuration(0);
      
      timerRef.current = setInterval(() => {
        setDuration(prev => {
          if (prev >= maxDuration) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
      
      drawWaveform();
      
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setPermissionDenied(true);
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
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    }
  };

  const resetRecording = () => {
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }
    setRecordedBlob(null);
    setRecordedUrl(null);
    setDuration(0);
    setIsPlaying(false);
    setPlaybackProgress(0);
  };

  const togglePlayback = () => {
    if (!audioRef.current || !recordedUrl) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleAudioTimeUpdate = () => {
    if (audioRef.current) {
      const progress = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setPlaybackProgress(progress);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setPlaybackProgress(0);
  };

  const sendReply = async () => {
    if (!recordedBlob || isSending) return;
    
    setIsSending(true);
    
    try {
      // Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(",")[1];
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(recordedBlob);
      
      const audioBase64 = await base64Promise;
      
      // Get clean MIME type (strip codec info like "; codecs=opus")
      const cleanMimeType = recordedBlob.type.split(';')[0].trim();
      
      const { data, error } = await supabase.functions.invoke("voicemail-reply", {
        body: {
          token,
          voicemailId,
          audioBase64,
          duration,
          mimeType: cleanMimeType,
        },
      });
      
      if (error) throw error;
      
      toast({
        title: "Reply Sent!",
        description: "Your voice message has been sent to the PeachHaus team.",
      });
      
      onReplySent();
    } catch (err) {
      console.error("Error sending reply:", err);
      toast({
        variant: "destructive",
        title: "Failed to Send",
        description: "There was an error sending your reply. Please try again.",
      });
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (permissionDenied) {
    return (
      <div className="bg-red-50 rounded-xl p-6 text-center">
        <Mic className="h-10 w-10 text-red-400 mx-auto mb-3 opacity-50" />
        <p className="text-sm text-red-700 font-medium mb-1">Microphone Access Required</p>
        <p className="text-xs text-red-600">Please enable microphone access in your browser settings to record a reply.</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={onCancel}>
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Record Your Reply</h3>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 text-gray-400 hover:text-gray-600"
          onClick={onCancel}
          disabled={isSending}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Waveform / Recording visualization */}
      <div className="w-full h-20 bg-white rounded-xl overflow-hidden relative shadow-inner mb-4">
        {isRecording ? (
          <canvas 
            ref={canvasRef} 
            className="w-full h-full"
            width={400}
            height={80}
          />
        ) : recordedUrl ? (
          <div className="w-full h-full flex items-center px-4">
            <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-100 rounded-full"
                style={{ width: `${playbackProgress}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-sm text-gray-400">Tap the microphone to start recording</p>
          </div>
        )}
        
        {/* Timer overlay */}
        <div className="absolute top-2 right-2 bg-black/60 text-white px-2 py-0.5 rounded-md text-xs font-mono">
          {formatTime(duration)} / {formatTime(maxDuration)}
        </div>
        
        {/* Recording indicator */}
        {isRecording && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-red-500 text-white px-2 py-0.5 rounded-md text-xs font-medium">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            Recording
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        {!recordedUrl ? (
          <Button
            type="button"
            size="lg"
            variant={isRecording ? "destructive" : "default"}
            className={cn(
              "rounded-full h-16 w-16 shadow-lg",
              !isRecording && "bg-gradient-to-br from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600",
              isRecording && "animate-pulse"
            )}
            onClick={isRecording ? stopRecording : startRecording}
          >
            {isRecording ? (
              <Square className="h-6 w-6" />
            ) : (
              <Mic className="h-6 w-6" />
            )}
          </Button>
        ) : (
          <>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="rounded-full h-12 w-12"
              onClick={resetRecording}
              disabled={isSending}
            >
              <RotateCcw className="h-5 w-5" />
            </Button>
            
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="rounded-full h-14 w-14"
              onClick={togglePlayback}
              disabled={isSending}
            >
              {isPlaying ? (
                <Pause className="h-6 w-6" />
              ) : (
                <Play className="h-6 w-6 ml-0.5" />
              )}
            </Button>
            
            <Button
              type="button"
              size="lg"
              className="rounded-full h-14 px-6 gap-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 shadow-lg"
              onClick={sendReply}
              disabled={isSending}
            >
              {isSending ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  Send
                </>
              )}
            </Button>
          </>
        )}
      </div>

      {/* Hidden audio element for playback */}
      {recordedUrl && (
        <audio
          ref={audioRef}
          src={recordedUrl}
          onTimeUpdate={handleAudioTimeUpdate}
          onEnded={handleAudioEnded}
        />
      )}

      {/* Instructions */}
      <p className="text-xs text-gray-500 text-center mt-4">
        {isRecording 
          ? "Tap the stop button when you're done" 
          : recordedUrl 
            ? "Preview your message or tap send"
            : "Record a voice message up to 2 minutes"}
      </p>
    </div>
  );
}
