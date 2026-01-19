import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Video, Clock, Users, FileText, Loader2, RefreshCw, UserPlus, Play, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { VideoMeetingCard } from "./VideoMeetingCard";
import { CreateLeadFromMeetingDialog } from "./CreateLeadFromMeetingDialog";

interface MeetingRecording {
  id: string;
  recall_bot_id: string;
  meeting_url: string;
  meeting_title: string | null;
  platform: string | null;
  status: string;
  transcript: string | null;
  participants: any[];
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

export function VideoMeetingsList() {
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingRecording | null>(null);
  const [showCreateLead, setShowCreateLead] = useState(false);
  const [meetingForLead, setMeetingForLead] = useState<MeetingRecording | null>(null);
  const queryClient = useQueryClient();

  // Fetch meeting recordings
  const { data: meetings = [], isLoading, refetch } = useQuery({
    queryKey: ["meeting-recordings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_recordings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as MeetingRecording[];
    },
  });

  // Send bot to meeting mutation
  const sendBotMutation = useMutation({
    mutationFn: async (meetingUrl: string) => {
      const { data, error } = await supabase.functions.invoke("recall-send-bot", {
        body: { meetingUrl },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to send bot");
      return data;
    },
    onSuccess: () => {
      toast.success("Recording bot sent to meeting!");
      queryClient.invalidateQueries({ queryKey: ["meeting-recordings"] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to send bot: ${error.message}`);
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "joining":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Joining</Badge>;
      case "in_waiting_room":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Waiting Room</Badge>;
      case "in_call":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Recording</Badge>;
      case "completed":
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Completed</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPlatformIcon = (platform: string | null) => {
    switch (platform?.toLowerCase()) {
      case "google_meet":
        return "🎥";
      case "zoom":
        return "📹";
      case "teams":
        return "💼";
      default:
        return "📺";
    }
  };

  const handleCreateLead = (meeting: MeetingRecording) => {
    setMeetingForLead(meeting);
    setShowCreateLead(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Video className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Video Meetings</h3>
          <Badge variant="secondary">{meetings.length}</Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {meetings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Video className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-medium text-lg mb-2">No Video Meetings Recorded</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md">
              Use the "Record Zoom/Meet Call" option in the Sync Calls dropdown to send a recording bot to your next video call.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[600px]">
          <div className="space-y-3">
            {meetings.map((meeting) => (
              <Card
                key={meeting.id}
                className={`cursor-pointer transition-all hover:border-primary/50 ${
                  selectedMeeting?.id === meeting.id ? "border-primary ring-1 ring-primary" : ""
                }`}
                onClick={() => setSelectedMeeting(meeting.id === selectedMeeting?.id ? null : meeting)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="text-2xl">{getPlatformIcon(meeting.platform)}</div>
                      <div className="space-y-1">
                        <h4 className="font-medium">
                          {meeting.meeting_title || "Untitled Meeting"}
                        </h4>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {format(new Date(meeting.created_at), "MMM d, h:mm a")}
                          </span>
                          {meeting.duration_seconds && (
                            <span className="flex items-center gap-1">
                              <Play className="h-3.5 w-3.5" />
                              {Math.round(meeting.duration_seconds / 60)} min
                            </span>
                          )}
                          {meeting.participants && meeting.participants.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3.5 w-3.5" />
                              {meeting.participants.length} participants
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(meeting.status)}
                      {meeting.transcript && (
                        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                          <FileText className="h-3 w-3 mr-1" />
                          Transcript
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Expanded view */}
                  {selectedMeeting?.id === meeting.id && (
                    <VideoMeetingCard
                      meeting={meeting}
                      onCreateLead={() => handleCreateLead(meeting)}
                    />
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Create Lead Dialog */}
      {showCreateLead && meetingForLead && (
        <CreateLeadFromMeetingDialog
          meeting={meetingForLead}
          open={showCreateLead}
          onOpenChange={setShowCreateLead}
        />
      )}
    </div>
  );
}
