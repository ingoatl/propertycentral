import { useState, useRef, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { 
  Play, 
  Pause, 
  Loader2,
  AlertCircle,
  Mic,
  Check,
  MessageSquare,
  Send,
  Square,
  RotateCcw,
  ExternalLink,
  TrendingUp
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function RecapPlayer() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showVoiceReply, setShowVoiceReply] = useState(false);
  const [showTextReply, setShowTextReply] = useState(false);
  const [replySent, setReplySent] = useState(false);
  const [textMessage, setTextMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  
  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fallback params for legacy links
  const audioUrlParam = searchParams.get("audio");
  const propertyNameParam = searchParams.get("property") || "Your Property";
  const monthNameParam = searchParams.get("month") || "Monthly";
  const ownerIdParam = searchParams.get("owner");
  const propertyIdParam = searchParams.get("propertyId");

  // Fetch recap data if token provided (route param takes priority)
  const { data: recap, isLoading } = useQuery({
    queryKey: ["recap", token],
    queryFn: async () => {
      if (!token) return null;
      
      const { data, error } = await supabase
        .from("owner_monthly_recaps")
        .select("*, property_owners(*), properties(*)")
        .eq("id", token)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!token,
  });

  // Derive effective values - prioritize database data when token is used
  const effectiveAudioUrl = token ? recap?.audio_url : audioUrlParam;
  const effectivePropertyName = token ? recap?.properties?.name : propertyNameParam;
  const effectiveOwnerId = token ? recap?.owner_id : ownerIdParam;
  const effectivePropertyId = token ? recap?.property_id : propertyIdParam;
  const ownerName = recap?.property_owners?.name || "Owner";
  const effectiveMonthName = token && recap?.recap_month 
    ? new Date(recap.recap_month).toLocaleString('default', { month: 'long' })
    : monthNameParam;

  // Portal URL for owner
  const portalUrl = recap?.property_owners?.id 
    ? `https://propertycentral.lovable.app/owner?owner=${recap.property_owners.id}`
    : effectiveOwnerId 
      ? `https://propertycentral.lovable.app/owner?owner=${effectiveOwnerId}`
      : "https://propertycentral.lovable.app/owner";

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handlePlay = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
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
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    audioRef.current.currentTime = percentage * audioRef.current.duration;
  };

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds) || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Voice Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setRecordedBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration(d => {
          if (d >= 120) {
            stopRecording();
            return d;
          }
          return d + 1;
        });
      }, 1000);
    } catch (error) {
      console.error("Microphone access denied:", error);
      toast.error("Microphone access denied. Please allow microphone access.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const resetRecording = () => {
    setRecordedBlob(null);
    setRecordingDuration(0);
  };

  const handleSendVoice = async () => {
    if (!recordedBlob || !effectiveOwnerId) return;

    setIsSending(true);
    try {
      const fileName = `owner-messages/${effectiveOwnerId}/${Date.now()}.webm`;
      const { error: uploadError } = await supabase.storage
        .from("message-attachments")
        .upload(fileName, recordedBlob, { contentType: "audio/webm" });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("message-attachments")
        .getPublicUrl(fileName);

      const { error } = await supabase.functions.invoke("owner-send-message", {
        body: {
          owner_id: effectiveOwnerId,
          property_id: effectivePropertyId || null,
          message_type: "voicemail",
          body: `🎙️ Voice reply to ${effectiveMonthName} recap for ${effectivePropertyName} (${recordingDuration}s)`,
          subject: `Voice reply from owner - ${effectivePropertyName}`,
          attachment_url: urlData.publicUrl,
        }
      });

      if (error) throw error;

      setReplySent(true);
      toast.success("Voice message sent!");
    } catch (error) {
      console.error("Error sending voice message:", error);
      toast.error("Failed to send voice message");
    } finally {
      setIsSending(false);
    }
  };

  const handleSendText = async () => {
    if (!textMessage.trim() || !effectiveOwnerId) {
      toast.error("Please enter a message");
      return;
    }

    setIsSending(true);
    try {
      const { error } = await supabase.functions.invoke("owner-send-message", {
        body: {
          owner_id: effectiveOwnerId,
          property_id: effectivePropertyId || null,
          message_type: "sms",
          body: `Reply to ${effectiveMonthName} recap: ${textMessage}`,
          subject: `Text reply from owner - ${effectivePropertyName}`,
        }
      });

      if (error) throw error;

      setReplySent(true);
      toast.success("Message sent!");
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

  if (!effectiveAudioUrl) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 flex items-center justify-center p-4">
        <Card className="max-w-sm w-full p-8 text-center shadow-xl border-0">
          <img 
            src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png" 
            alt="PeachHaus" 
            className="h-10 mx-auto mb-6"
          />
          <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold mb-2 text-gray-900">Recap Not Found</h1>
          <p className="text-sm text-gray-500">
            This performance recap may have expired or doesn't exist.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 flex flex-col items-center justify-center p-4">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={effectiveAudioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        preload="metadata"
      />

      <Card className="max-w-md w-full overflow-hidden shadow-2xl border-0 rounded-3xl">
        {/* Header with branding */}
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 p-8 text-white text-center relative overflow-hidden">
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
              <TrendingUp className="w-8 h-8 text-amber-600" />
            </div>
            <p className="text-sm text-gray-500 mb-1">
              {effectiveMonthName} Performance Recap
            </p>
            <h2 className="text-2xl font-bold text-gray-900">{effectivePropertyName}</h2>
            {recap?.created_at && (
              <p className="text-sm text-gray-400 mt-2">
                {format(new Date(recap.created_at), "MMMM d, yyyy 'at' h:mm a")}
              </p>
            )}
          </div>

          {/* Audio Player - matching VoicemailPlayer style */}
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

          {/* Reply Section */}
          {showVoiceReply ? (
            <div className="space-y-4 mb-4">
              <div className="flex flex-col items-center gap-4">
                {!recordedBlob ? (
                  <>
                    <button
                      onClick={isRecording ? stopRecording : startRecording}
                      className={cn(
                        "w-20 h-20 rounded-full flex items-center justify-center transition-all",
                        isRecording 
                          ? "bg-red-500 text-white animate-pulse" 
                          : "bg-amber-500 text-white hover:bg-amber-600"
                      )}
                    >
                      {isRecording ? <Square className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
                    </button>
                    <p className="text-sm text-gray-500">
                      {isRecording ? `Recording... ${formatDuration(recordingDuration)}` : "Tap to start recording"}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-gray-700 font-medium">Recording Complete ({formatDuration(recordingDuration)})</p>
                    <div className="flex gap-3">
                      <Button variant="outline" onClick={resetRecording} className="border-gray-300">
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Re-record
                      </Button>
                      <Button onClick={handleSendVoice} disabled={isSending} className="bg-amber-500 hover:bg-amber-600">
                        {isSending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                        Send
                      </Button>
                    </div>
                  </>
                )}
              </div>
              <Button 
                variant="ghost" 
                className="w-full text-gray-500" 
                onClick={() => { setShowVoiceReply(false); resetRecording(); }}
              >
                Cancel
              </Button>
            </div>
          ) : showTextReply ? (
            <div className="space-y-4 mb-4">
              <Textarea
                value={textMessage}
                onChange={(e) => setTextMessage(e.target.value)}
                placeholder="Type your message..."
                rows={3}
                className="bg-white border-gray-200"
              />
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1 border-gray-300"
                  onClick={() => { setShowTextReply(false); setTextMessage(""); }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSendText} 
                  disabled={isSending}
                  className="flex-1 bg-amber-500 hover:bg-amber-600"
                >
                  {isSending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  Send
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {replySent ? (
                <div className="flex items-center justify-center gap-2 py-4 px-6 bg-green-50 rounded-xl border border-green-100">
                  <Check className="h-5 w-5 text-green-600" />
                  <span className="text-green-700 font-medium">Reply Sent Successfully</span>
                </div>
              ) : (
                <>
                  <Button
                    size="lg"
                    className="w-full gap-3 h-14 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md"
                    onClick={() => setShowVoiceReply(true)}
                  >
                    <Mic className="h-5 w-5" />
                    Reply with Voice Message
                  </Button>
                  
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full gap-3 h-14 rounded-xl border-2 border-blue-200 text-blue-700 hover:bg-blue-50"
                    onClick={() => setShowTextReply(true)}
                  >
                    <MessageSquare className="h-5 w-5" />
                    Reply with Text Message
                  </Button>
                </>
              )}
              
              {/* View Owner Portal Button */}
              <Button
                variant="outline"
                size="lg"
                className="w-full gap-3 h-14 rounded-xl border-2 hover:bg-amber-50"
                onClick={() => window.open(portalUrl, '_blank')}
              >
                <ExternalLink className="h-5 w-5" />
                View Owner Portal
              </Button>
            </div>
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
    </div>
  );
}
