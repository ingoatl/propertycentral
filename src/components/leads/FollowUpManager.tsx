import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  Pause, 
  Play,
  SkipForward,
  Send,
  AlertCircle,
  Calendar
} from "lucide-react";

interface FollowUpManagerProps {
  leadId: string;
  isPaused: boolean;
  activeSequenceId: string | null;
}

interface FollowUpSchedule {
  id: string;
  lead_id: string;
  sequence_id: string | null;
  step_id: string | null;
  step_number: number;
  scheduled_for: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  lead_follow_up_sequences?: {
    name: string;
  };
  lead_follow_up_steps?: {
    template_content: string;
    action_type: string;
    template_subject: string | null;
  };
}

const FollowUpManager = ({ leadId, isPaused, activeSequenceId }: FollowUpManagerProps) => {
  const queryClient = useQueryClient();

  // Fetch scheduled follow-ups
  const { data: schedules, isLoading } = useQuery({
    queryKey: ["lead-follow-ups", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_follow_up_schedules")
        .select(`
          *,
          lead_follow_up_sequences(name),
          lead_follow_up_steps(template_content, action_type, template_subject)
        `)
        .eq("lead_id", leadId)
        .order("scheduled_for", { ascending: true });
      
      if (error) throw error;
      return data as FollowUpSchedule[];
    },
  });

  // Fetch active sequence info
  const { data: activeSequence } = useQuery({
    queryKey: ["active-sequence", activeSequenceId],
    queryFn: async () => {
      if (!activeSequenceId) return null;
      const { data, error } = await supabase
        .from("lead_follow_up_sequences")
        .select("*, lead_follow_up_steps(count)")
        .eq("id", activeSequenceId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!activeSequenceId,
  });

  // Toggle pause mutation
  const togglePause = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("leads")
        .update({ follow_up_paused: !isPaused })
        .eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(isPaused ? "Follow-ups resumed" : "Follow-ups paused");
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (error) => {
      toast.error("Failed to update: " + error.message);
    },
  });

  // Cancel single follow-up
  const cancelFollowUp = useMutation({
    mutationFn: async (scheduleId: string) => {
      const { error } = await supabase
        .from("lead_follow_up_schedules")
        .update({ status: "cancelled" })
        .eq("id", scheduleId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Follow-up cancelled");
      queryClient.invalidateQueries({ queryKey: ["lead-follow-ups", leadId] });
    },
    onError: (error) => {
      toast.error("Failed to cancel: " + error.message);
    },
  });

  // Send now mutation
  const sendNow = useMutation({
    mutationFn: async (scheduleId: string) => {
      const { error } = await supabase
        .from("lead_follow_up_schedules")
        .update({ scheduled_for: new Date().toISOString() })
        .eq("id", scheduleId);
      if (error) throw error;

      // Trigger the processing function
      await supabase.functions.invoke("process-scheduled-follow-ups");
    },
    onSuccess: () => {
      toast.success("Sending follow-up now...");
      queryClient.invalidateQueries({ queryKey: ["lead-follow-ups", leadId] });
    },
    onError: (error) => {
      toast.error("Failed to send: " + error.message);
    },
  });

  const pendingSchedules = schedules?.filter(s => s.status === "pending") || [];
  const completedSchedules = schedules?.filter(s => s.status !== "pending") || [];
  const completedCount = schedules?.filter(s => s.status === "sent").length || 0;
  const totalSteps = schedules?.length || 0;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "sent": return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed": return <XCircle className="h-4 w-4 text-red-500" />;
      case "cancelled": return <XCircle className="h-4 w-4 text-muted-foreground" />;
      case "skipped": return <SkipForward className="h-4 w-4 text-yellow-500" />;
      default: return <Clock className="h-4 w-4 text-blue-500" />;
    }
  };

  const getActionBadge = (actionType: string) => {
    switch (actionType) {
      case "sms": return <Badge variant="outline" className="text-xs">SMS</Badge>;
      case "email": return <Badge variant="outline" className="text-xs">Email</Badge>;
      case "both": return <Badge variant="outline" className="text-xs">SMS + Email</Badge>;
      default: return null;
    }
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading follow-ups...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Sequence Progress */}
      {activeSequence && (
        <div className="p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="font-medium text-sm">{activeSequence.name}</span>
            </div>
            <Badge variant={isPaused ? "secondary" : "default"}>
              {isPaused ? "Paused" : "Active"}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Step {completedCount} of {totalSteps}</span>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all"
                style={{ width: `${totalSteps > 0 ? (completedCount / totalSteps) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Pause/Resume Control */}
      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
        <div className="flex items-center gap-2">
          {isPaused ? (
            <Pause className="h-4 w-4 text-yellow-500" />
          ) : (
            <Play className="h-4 w-4 text-green-500" />
          )}
          <Label htmlFor="pause-toggle" className="text-sm">
            {isPaused ? "Follow-ups paused" : "Follow-ups active"}
          </Label>
        </div>
        <Switch
          id="pause-toggle"
          checked={!isPaused}
          onCheckedChange={() => togglePause.mutate()}
        />
      </div>

      {/* Pending Follow-ups */}
      {pendingSchedules.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Upcoming ({pendingSchedules.length})
          </h4>
          <ScrollArea className="h-[200px]">
            <div className="space-y-2">
              {pendingSchedules.map((schedule) => (
                <div key={schedule.id} className="p-3 border rounded-lg bg-card">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">
                          Step {schedule.step_number}
                        </span>
                        {schedule.lead_follow_up_steps && getActionBadge(schedule.lead_follow_up_steps.action_type)}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {schedule.lead_follow_up_steps?.template_content?.substring(0, 60)}...
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Scheduled: {format(new Date(schedule.scheduled_for), "MMM d, h:mm a")}
                        <span className="ml-1">
                          ({formatDistanceToNow(new Date(schedule.scheduled_for), { addSuffix: true })})
                        </span>
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => sendNow.mutate(schedule.id)}
                        title="Send now"
                      >
                        <Send className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => cancelFollowUp.mutate(schedule.id)}
                        title="Cancel"
                      >
                        <XCircle className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Completed/Past Follow-ups */}
      {completedSchedules.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            History ({completedSchedules.length})
          </h4>
          <ScrollArea className="h-[150px]">
            <div className="space-y-2">
              {completedSchedules.map((schedule) => (
                <div key={schedule.id} className="p-2 border rounded-lg bg-muted/30 opacity-75">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(schedule.status)}
                    <span className="text-sm">Step {schedule.step_number}</span>
                    <Badge variant="secondary" className="text-xs">
                      {schedule.status}
                    </Badge>
                    {schedule.sent_at && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        {format(new Date(schedule.sent_at), "MMM d, h:mm a")}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {schedules?.length === 0 && (
        <div className="text-center py-6 text-muted-foreground">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No follow-up sequences scheduled</p>
          <p className="text-xs">Sequences are triggered automatically when leads enter certain stages</p>
        </div>
      )}
    </div>
  );
};

export default FollowUpManager;
