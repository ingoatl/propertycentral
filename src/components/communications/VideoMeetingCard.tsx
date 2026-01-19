import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { 
  UserPlus, 
  Mail, 
  FileText, 
  ChevronDown, 
  ChevronUp, 
  ExternalLink,
  Users,
  Clock,
  Loader2,
  Send
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface Participant {
  name: string;
  email?: string;
}

interface MeetingRecording {
  id: string;
  recall_bot_id: string;
  meeting_url: string;
  meeting_title: string | null;
  platform: string | null;
  status: string;
  transcript: string | null;
  participants: Participant[];
  duration_seconds: number | null;
  host_user_id: string | null;
  matched_owner_id: string | null;
  matched_lead_id: string | null;
  property_id: string | null;
  communication_id: string | null;
  created_at: string;
  updated_at: string;
  analyzed: boolean | null;
}

interface VideoMeetingCardProps {
  meeting: MeetingRecording;
  onCreateLead: () => void;
}

export function VideoMeetingCard({ meeting, onCreateLead }: VideoMeetingCardProps) {
  const [showFullTranscript, setShowFullTranscript] = useState(false);
  const queryClient = useQueryClient();

  // Send call recap mutation
  const sendRecapMutation = useMutation({
    mutationFn: async () => {
      // First check if a recap already exists
      const { data: existingRecap } = await supabase
        .from("pending_call_recaps")
        .select("id")
        .eq("communication_id", meeting.communication_id)
        .maybeSingle();

      if (existingRecap) {
        // Send existing recap
        const { data, error } = await supabase.functions.invoke("send-call-recap-email", {
          body: { recapId: existingRecap.id },
        });
        if (error) throw error;
        return data;
      } else {
        toast.error("No recap available for this meeting. Try analyzing the transcript first.");
        throw new Error("No recap available");
      }
    },
    onSuccess: () => {
      toast.success("Call recap sent!");
      queryClient.invalidateQueries({ queryKey: ["meeting-recordings"] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to send recap: ${error.message}`);
    },
  });

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "Unknown duration";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const truncateTranscript = (transcript: string | null, maxLength: number = 500) => {
    if (!transcript) return null;
    if (transcript.length <= maxLength) return transcript;
    return transcript.slice(0, maxLength) + "...";
  };

  const participants = meeting.participants || [];

  return (
    <div className="mt-4 pt-4 border-t space-y-4" onClick={(e) => e.stopPropagation()}>
      {/* Participants Section */}
      {participants.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Participants
          </h5>
          <div className="flex flex-wrap gap-2">
            {participants.map((p, idx) => (
              <Badge key={idx} variant="secondary" className="flex items-center gap-1">
                {p.name}
                {p.email && (
                  <span className="text-xs text-muted-foreground ml-1">({p.email})</span>
                )}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Transcript Section */}
      {meeting.transcript && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h5 className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Transcript
            </h5>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFullTranscript(!showFullTranscript)}
            >
              {showFullTranscript ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Show More
                </>
              )}
            </Button>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            {showFullTranscript ? (
              <ScrollArea className="h-[300px]">
                <pre className="text-sm whitespace-pre-wrap font-sans">{meeting.transcript}</pre>
              </ScrollArea>
            ) : (
              <pre className="text-sm whitespace-pre-wrap font-sans">
                {truncateTranscript(meeting.transcript)}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* Status indicators */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        {meeting.matched_lead_id && (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            Lead Matched
          </Badge>
        )}
        {meeting.matched_owner_id && (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            Owner Matched
          </Badge>
        )}
        {meeting.analyzed && (
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
            Analyzed
          </Badge>
        )}
      </div>

      <Separator />

      {/* Action Buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Create Lead - show if no lead matched and has participants */}
        {!meeting.matched_lead_id && participants.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={onCreateLead}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Create Lead from Participant
          </Button>
        )}

        {/* Send Recap - show if transcript exists and communication linked */}
        {meeting.transcript && meeting.communication_id && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => sendRecapMutation.mutate()}
            disabled={sendRecapMutation.isPending}
          >
            {sendRecapMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Send Call Recap
          </Button>
        )}

        {/* View Meeting Link */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.open(meeting.meeting_url, "_blank")}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Open Meeting
        </Button>
      </div>
    </div>
  );
}
