import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { 
  Phone, 
  Mail, 
  MapPin, 
  DollarSign, 
  Sparkles, 
  MessageSquare, 
  Clock,
  FileText,
  Send,
  CalendarClock,
  Calendar
} from "lucide-react";
import { Lead, LeadStage, LeadTimeline, LeadCommunication, LEAD_STAGES, STAGE_CONFIG } from "@/types/leads";
import FollowUpManager from "./FollowUpManager";
import TestEmailButton from "./TestEmailButton";
import TestVoiceCallButton from "./TestVoiceCallButton";
import { ScheduleDiscoveryCallDialog } from "./ScheduleDiscoveryCallDialog";
import { SendContractButton } from "./SendContractButton";
import { AIVoiceCallButton } from "./AIVoiceCallButton";

interface LeadDetailModalProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => void;
}

const LeadDetailModal = ({ lead, open, onOpenChange, onRefresh }: LeadDetailModalProps) => {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState(lead?.notes || "");
  const [newMessage, setNewMessage] = useState("");
  const [messageType, setMessageType] = useState<"sms" | "email">("sms");
  const [showScheduleCall, setShowScheduleCall] = useState(false);

  // Fetch timeline
  const { data: timeline } = useQuery({
    queryKey: ["lead-timeline", lead?.id],
    queryFn: async () => {
      if (!lead?.id) return [];
      const { data, error } = await supabase
        .from("lead_timeline")
        .select("*")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as LeadTimeline[];
    },
    enabled: !!lead?.id,
  });

  // Fetch communications
  const { data: communications } = useQuery({
    queryKey: ["lead-communications", lead?.id],
    queryFn: async () => {
      if (!lead?.id) return [];
      const { data, error } = await supabase
        .from("lead_communications")
        .select("*")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as LeadCommunication[];
    },
    enabled: !!lead?.id,
  });

  // Update stage mutation
  const updateStage = useMutation({
    mutationFn: async (newStage: LeadStage) => {
      if (!lead) return;
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("leads")
        .update({ 
          stage: newStage,
          stage_changed_at: new Date().toISOString()
        })
        .eq("id", lead.id);

      if (error) throw error;

      await supabase.from("lead_timeline").insert({
        lead_id: lead.id,
        action: `Stage changed to ${STAGE_CONFIG[newStage].label}`,
        performed_by_user_id: user?.id,
        performed_by_name: user?.email,
        previous_stage: lead.stage,
        new_stage: newStage,
      });

      // Trigger automation
      try {
        await supabase.functions.invoke('process-lead-stage-change', {
          body: { leadId: lead.id, newStage, previousStage: lead.stage }
        });
      } catch (e) {
        console.log('Automation queued');
      }
    },
    onSuccess: () => {
      toast.success("Stage updated");
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead-timeline", lead?.id] });
      onRefresh();
    },
    onError: (error) => {
      toast.error("Failed to update: " + error.message);
    },
  });

  // Update notes mutation
  const updateNotes = useMutation({
    mutationFn: async () => {
      if (!lead) return;
      const { error } = await supabase
        .from("leads")
        .update({ notes })
        .eq("id", lead.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Notes saved");
      onRefresh();
    },
    onError: (error) => {
      toast.error("Failed to save notes: " + error.message);
    },
  });

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!lead || !newMessage.trim()) return;
      
      // First, create the communication record
      const { error: commError } = await supabase.from("lead_communications").insert({
        lead_id: lead.id,
        communication_type: messageType,
        direction: 'outbound',
        body: newMessage,
        status: 'pending',
      });
      if (commError) throw commError;

      // Then trigger the send via edge function
      const { error } = await supabase.functions.invoke('send-lead-notification', {
        body: {
          leadId: lead.id,
          type: messageType,
          message: newMessage,
          subject: messageType === 'email' ? 'Message from PeachHaus' : undefined,
        }
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${messageType.toUpperCase()} sent`);
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["lead-communications", lead?.id] });
    },
    onError: (error) => {
      toast.error("Failed to send: " + error.message);
    },
  });

  // AI qualify mutation
  const aiQualify = useMutation({
    mutationFn: async () => {
      if (!lead) return;
      const { error } = await supabase.functions.invoke('lead-ai-assistant', {
        body: { leadId: lead.id, action: 'qualify' }
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("AI analysis complete");
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      onRefresh();
    },
    onError: (error) => {
      toast.error("AI analysis failed: " + error.message);
    },
  });

  if (!lead) return null;

  const stageConfig = STAGE_CONFIG[lead.stage];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl">{lead.name}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Lead #{lead.lead_number} • {lead.opportunity_source || 'Unknown Source'}
              </p>
            </div>
            <Badge className={`${stageConfig.bgColor} ${stageConfig.color} border-0`}>
              {stageConfig.label}
            </Badge>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto pr-4">
        <div className="grid grid-cols-3 gap-4 py-4">
          {lead.phone && (
            <Button variant="outline" size="sm" asChild>
              <a href={`tel:${lead.phone}`}>
                <Phone className="h-4 w-4 mr-2" />
                {lead.phone}
              </a>
            </Button>
          )}
          {lead.email && (
            <Button variant="outline" size="sm" asChild>
              <a href={`mailto:${lead.email}`}>
                <Mail className="h-4 w-4 mr-2" />
                Email
              </a>
            </Button>
          )}
          {lead.opportunity_value > 0 && (
            <div className="flex items-center gap-2 text-green-600 font-medium">
              <DollarSign className="h-4 w-4" />
              ${lead.opportunity_value.toLocaleString()}
            </div>
          )}
        </div>

        {lead.property_address && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground pb-4">
            <MapPin className="h-4 w-4" />
            {lead.property_address}
          </div>
        )}

        <div className="flex items-center gap-4 pb-4">
          <Select
            value={lead.stage}
            onValueChange={(value) => updateStage.mutate(value as LeadStage)}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEAD_STAGES.map((stage) => (
                <SelectItem key={stage.stage} value={stage.stage}>
                  {stage.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => aiQualify.mutate()}
            disabled={aiQualify.isPending}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {aiQualify.isPending ? "Analyzing..." : "AI Qualify"}
          </Button>

          <TestEmailButton 
            leadId={lead.id} 
            leadEmail={lead.email} 
            currentStage={lead.stage} 
          />

          <TestVoiceCallButton
            leadId={lead.id}
            leadPhone={lead.phone}
            leadName={lead.name}
            propertyAddress={lead.property_address}
          />

          <AIVoiceCallButton
            leadId={lead.id}
            leadPhone={lead.phone}
            leadName={lead.name}
            leadStage={lead.stage}
          />

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowScheduleCall(true)}
          >
            <Calendar className="h-4 w-4 mr-2" />
            Schedule Call
          </Button>

          <SendContractButton lead={lead} onContractSent={onRefresh} />
        </div>

        {/* Schedule Discovery Call Dialog */}
        <ScheduleDiscoveryCallDialog
          open={showScheduleCall}
          onOpenChange={setShowScheduleCall}
          leadId={lead.id}
          leadName={lead.name}
          leadPhone={lead.phone || undefined}
          onScheduled={onRefresh}
        />

        {(lead.ai_summary || lead.ai_next_action) && (
          <div className="p-3 bg-muted/50 rounded-lg mb-4">
            <div className="flex items-center gap-2 text-sm font-medium mb-2">
              <Sparkles className="h-4 w-4" />
              AI Insights
            </div>
            {lead.ai_summary && (
              <p className="text-sm text-muted-foreground mb-2">{lead.ai_summary}</p>
            )}
            {lead.ai_next_action && (
              <p className="text-sm font-medium">Next: {lead.ai_next_action}</p>
            )}
            {lead.ai_qualification_score && (
              <Badge variant="outline" className="mt-2">
                Score: {lead.ai_qualification_score}/100
              </Badge>
            )}
          </div>
        )}

        <Tabs defaultValue="timeline" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="timeline">
              <Clock className="h-4 w-4 mr-2" />
              Timeline
            </TabsTrigger>
            <TabsTrigger value="transcripts">
              <Phone className="h-4 w-4 mr-2" />
              Calls
            </TabsTrigger>
            <TabsTrigger value="followups">
              <CalendarClock className="h-4 w-4 mr-2" />
              Follow-ups
            </TabsTrigger>
            <TabsTrigger value="messages">
              <MessageSquare className="h-4 w-4 mr-2" />
              Messages
            </TabsTrigger>
            <TabsTrigger value="notes">
              <FileText className="h-4 w-4 mr-2" />
              Notes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="timeline" className="mt-4">
            <ScrollArea className="h-[250px]">
              {timeline && timeline.length > 0 ? (
                <div className="space-y-3">
                  {timeline.map((entry) => {
                    const metadata = entry.metadata as Record<string, unknown> | null;
                    const hasTranscript = entry.action === 'call_transcribed' && metadata?.transcript_preview;
                    const insights = metadata?.insights as Record<string, unknown> | null;
                    
                    return (
                      <div key={entry.id} className="flex gap-3 text-sm">
                        <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                        <div className="flex-1">
                          <p className="font-medium">{entry.action}</p>
                          {hasTranscript && (
                            <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                              <p className="text-muted-foreground mb-1 font-medium">Transcript:</p>
                              <p className="italic">"{String(metadata?.transcript_preview)}"</p>
                              {insights && (
                                <div className="mt-2 pt-2 border-t">
                                  {insights.interest_level && (
                                    <Badge variant="outline" className="mr-1 text-xs">
                                      Interest: {String(insights.interest_level)}
                                    </Badge>
                                  )}
                                  {insights.sentiment && (
                                    <Badge variant="outline" className="mr-1 text-xs">
                                      {String(insights.sentiment)}
                                    </Badge>
                                  )}
                                  {Array.isArray(insights.key_points) && insights.key_points.length > 0 && (
                                    <ul className="mt-2 list-disc list-inside text-muted-foreground">
                                      {insights.key_points.map((point, i) => (
                                        <li key={i}>{String(point)}</li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {entry.performed_by_name} • {format(new Date(entry.created_at), 'MMM d, h:mm a')}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No timeline entries yet
                </p>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="transcripts" className="mt-4">
            <ScrollArea className="h-[250px]">
              {communications && communications.filter(c => c.communication_type === 'voice_call').length > 0 ? (
                <div className="space-y-4">
                  {communications
                    .filter(c => c.communication_type === 'voice_call')
                    .map((comm) => (
                      <div key={comm.id} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              {comm.direction === 'outbound' ? 'Outbound Call' : 'Inbound Call'}
                            </span>
                          </div>
                          <Badge 
                            variant={comm.status === 'completed' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {comm.status}
                          </Badge>
                        </div>
                        
                        {comm.body ? (
                          <div className="bg-muted/50 p-3 rounded text-sm">
                            <p className="text-xs text-muted-foreground mb-1 font-medium">Transcript:</p>
                            <p className="whitespace-pre-wrap">{comm.body}</p>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">
                            No transcript available
                          </p>
                        )}
                        
                        <p className="text-xs text-muted-foreground mt-2">
                          {format(new Date(comm.created_at), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No call transcripts yet
                </p>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="followups" className="mt-4">
            <FollowUpManager 
              leadId={lead.id} 
              isPaused={(lead as any).follow_up_paused || false}
              activeSequenceId={(lead as any).active_sequence_id || null}
            />
          </TabsContent>

          <TabsContent value="messages" className="mt-4">
            <div className="space-y-4">
              <div className="flex gap-2">
                <Select value={messageType} onValueChange={(v) => setMessageType(v as "sms" | "email")}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                  </SelectContent>
                </Select>
                <Textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={`Type your ${messageType} message...`}
                  className="flex-1"
                  rows={2}
                />
                <Button 
                  onClick={() => sendMessage.mutate()}
                  disabled={sendMessage.isPending || !newMessage.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              
              <ScrollArea className="h-[180px]">
                {communications && communications.length > 0 ? (
                  <div className="space-y-3">
                    {communications.map((comm) => (
                      <div 
                        key={comm.id} 
                        className={`p-3 rounded-lg text-sm ${
                          comm.direction === 'outbound' 
                            ? 'bg-primary/10 ml-4' 
                            : 'bg-muted mr-4'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            {comm.communication_type.toUpperCase()}
                          </Badge>
                          <Badge 
                            variant={comm.status === 'delivered' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {comm.status}
                          </Badge>
                        </div>
                        <p>{comm.body}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(comm.created_at), 'MMM d, h:mm a')}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No messages yet
                  </p>
                )}
              </ScrollArea>
            </div>
          </TabsContent>

          <TabsContent value="notes" className="mt-4">
            <div className="space-y-4">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about this lead..."
                rows={6}
              />
              <Button 
                onClick={() => updateNotes.mutate()}
                disabled={updateNotes.isPending}
              >
                {updateNotes.isPending ? "Saving..." : "Save Notes"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default LeadDetailModal;
