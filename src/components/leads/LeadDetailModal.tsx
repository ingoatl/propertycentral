import { useState, useEffect, useCallback, memo } from "react";
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
import { Input } from "@/components/ui/input";
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
  Calendar,
  Circle,
  Pencil,
  Check,
  X,
  Trash2,
  MessageCircle
} from "lucide-react";
import { Lead, LeadStage, LeadTimeline, LeadCommunication, LEAD_STAGES, STAGE_CONFIG } from "@/types/leads";
import FollowUpManager from "./FollowUpManager";
import TestVoiceCallButton from "./TestVoiceCallButton";
import { ScheduleDiscoveryCallDialog } from "./ScheduleDiscoveryCallDialog";
import { SendContractButton } from "./SendContractButton";
import { AIVoiceCallButton } from "./AIVoiceCallButton";
import { LeadConversationThread } from "./LeadConversationThread";
import { SendEmailDialog } from "@/components/communications/SendEmailDialog";
import { SendSMSDialog } from "@/components/communications/SendSMSDialog";
import DirectCallButton from "./DirectCallButton";
import { SendStripeAuthButton } from "./SendStripeAuthButton";
import { ExpandableMessageInput } from "@/components/communications/ExpandableMessageInput";
import { UnifiedConversationThread } from "@/components/communications/UnifiedConversationThread";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useIsMobile } from "@/hooks/use-mobile";

interface LeadDetailModalProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => void;
}

const LeadDetailModal = ({ lead, open, onOpenChange, onRefresh }: LeadDetailModalProps) => {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [notes, setNotes] = useState(lead?.notes || "");
  const [newMessage, setNewMessage] = useState("");
  const [messageType, setMessageType] = useState<"sms" | "email">("sms");
  const [showScheduleCall, setShowScheduleCall] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showSMSDialog, setShowSMSDialog] = useState(false);
  const [showFullConversation, setShowFullConversation] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(lead?.name || "");
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [editedEmail, setEditedEmail] = useState(lead?.email || "");
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [editedPhone, setEditedPhone] = useState(lead?.phone || "");

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
    staleTime: 30000,
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
    staleTime: 15000, // Refresh communications more frequently
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

  // Update name mutation
  const updateName = useMutation({
    mutationFn: async (newName: string) => {
      if (!lead || !newName.trim()) return;
      const { error } = await supabase
        .from("leads")
        .update({ name: newName.trim() })
        .eq("id", lead.id);
      if (error) throw error;
      
      // Log timeline
      await supabase.from("lead_timeline").insert({
        lead_id: lead.id,
        action: `Name updated to "${newName.trim()}"`,
        metadata: { previousName: lead.name, newName: newName.trim() },
      });
    },
    onSuccess: () => {
      toast.success("Name updated");
      setIsEditingName(false);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      onRefresh();
    },
    onError: (error) => {
      toast.error("Failed to update name: " + error.message);
    },
  });

  // Update email mutation
  const updateEmail = useMutation({
    mutationFn: async (newEmail: string) => {
      if (!lead) return;
      const { error } = await supabase
        .from("leads")
        .update({ email: newEmail.trim() || null })
        .eq("id", lead.id);
      if (error) throw error;
      
      await supabase.from("lead_timeline").insert({
        lead_id: lead.id,
        action: `Email updated to "${newEmail.trim() || 'none'}"`,
        metadata: { previousEmail: lead.email, newEmail: newEmail.trim() || null },
      });
    },
    onSuccess: () => {
      toast.success("Email updated");
      setIsEditingEmail(false);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      onRefresh();
    },
    onError: (error) => {
      toast.error("Failed to update email: " + error.message);
    },
  });

  // Update phone mutation
  const updatePhone = useMutation({
    mutationFn: async (newPhone: string) => {
      if (!lead) return;
      const { error } = await supabase
        .from("leads")
        .update({ phone: newPhone.trim() || null })
        .eq("id", lead.id);
      if (error) throw error;
      
      await supabase.from("lead_timeline").insert({
        lead_id: lead.id,
        action: `Phone updated to "${newPhone.trim() || 'none'}"`,
        metadata: { previousPhone: lead.phone, newPhone: newPhone.trim() || null },
      });
    },
    onSuccess: () => {
      toast.success("Phone updated");
      setIsEditingPhone(false);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      onRefresh();
    },
    onError: (error) => {
      toast.error("Failed to update phone: " + error.message);
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
      
      if (messageType === "sms" && lead.phone) {
        // Use GHL for SMS (404-800-6804 number)
        const { data, error } = await supabase.functions.invoke('ghl-send-sms', {
          body: {
            leadId: lead.id,
            phone: lead.phone,
            message: newMessage,
            fromNumber: "+14048006804", // The GHL number
          }
        });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || "Failed to send SMS");
      } else if (messageType === "email" && lead.email) {
        // Use existing email flow
        const { error: commError } = await supabase.from("lead_communications").insert({
          lead_id: lead.id,
          communication_type: "email",
          direction: 'outbound',
          body: newMessage,
          status: 'pending',
        });
        if (commError) throw commError;

        const { error } = await supabase.functions.invoke('send-lead-notification', {
          body: {
            leadId: lead.id,
            type: "email",
            message: newMessage,
            subject: 'Message from PeachHaus',
          }
        });
        if (error) throw error;
      } else {
        throw new Error("Missing contact info for " + messageType);
      }
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

  // Delete lead mutation
  const deleteLead = useMutation({
    mutationFn: async () => {
      if (!lead) return;
      
      // Delete related records first (timeline, communications, etc.)
      await supabase.from("lead_timeline").delete().eq("lead_id", lead.id);
      await supabase.from("lead_communications").delete().eq("lead_id", lead.id);
      await supabase.from("follow_up_reminders").delete().eq("lead_id", lead.id);
      
      // Delete the lead itself
      const { error } = await supabase
        .from("leads")
        .delete()
        .eq("id", lead.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      onOpenChange(false);
      onRefresh();
    },
    onError: (error) => {
      toast.error("Failed to delete lead: " + error.message);
    },
  });

  // Transform communications for UnifiedConversationThread
  const threadMessages = (communications || [])
    .filter(c => c.communication_type !== 'voice_call')
    .map(c => ({
      id: c.id,
      type: c.communication_type as "sms" | "email" | "call",
      direction: c.direction as "inbound" | "outbound",
      body: c.body,
      subject: c.subject,
      created_at: c.created_at,
      status: c.status,
    }))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  // Reset edited values when lead changes
  useEffect(() => {
    if (lead) {
      setEditedName(lead.name);
      setIsEditingName(false);
      setEditedEmail(lead.email || "");
      setIsEditingEmail(false);
      setEditedPhone(lead.phone || "");
      setIsEditingPhone(false);
      // Set default message type based on available contact info
      if (lead.phone) {
        setMessageType("sms");
      } else if (lead.email) {
        setMessageType("email");
      }
    }
  }, [lead?.id, lead?.name, lead?.email, lead?.phone]);

  const handleSaveName = useCallback(() => {
    if (editedName.trim() && editedName.trim() !== lead?.name) {
      updateName.mutate(editedName.trim());
    } else {
      setIsEditingName(false);
      setEditedName(lead?.name || "");
    }
  }, [editedName, lead?.name, updateName]);

  const handleCancelNameEdit = useCallback(() => {
    setIsEditingName(false);
    setEditedName(lead?.name || "");
  }, [lead?.name]);

  if (!lead) return null;

  const stageConfig = STAGE_CONFIG[lead.stage];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="text-xl font-semibold h-9 max-w-[300px]"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveName();
                      if (e.key === "Escape") handleCancelNameEdit();
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                    onClick={handleSaveName}
                    disabled={updateName.isPending}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={handleCancelNameEdit}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <DialogTitle className="text-xl">{lead.name}</DialogTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setIsEditingName(true)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
              )}
              <p className="text-sm text-muted-foreground mt-1">
                Lead #{lead.lead_number} • {lead.opportunity_source || 'Unknown Source'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={`${stageConfig.bgColor} ${stageConfig.color} border-0`}>
                {stageConfig.label}
              </Badge>
              
              {/* Delete Button */}
              <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Lead</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete <strong>{lead.name}</strong>? This will permanently remove the lead and all associated communications, timeline entries, and follow-ups. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteLead.mutate()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deleteLead.isPending ? "Deleting..." : "Delete Lead"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto pr-4">
        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 py-4 border-b mb-4">
          {lead.phone && (
            <DirectCallButton 
              leadId={lead.id}
              leadPhone={lead.phone}
              leadName={lead.name}
              leadAddress={lead.property_address}
            />
          )}
          {lead.email && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowEmailDialog(true)}
            >
              <Mail className="h-4 w-4 mr-2" />
              Email
            </Button>
          )}
          {lead.phone && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowSMSDialog(true)}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Text
            </Button>
          )}
          
          {/* Full Conversation Button */}
          <Button 
            variant="default" 
            size="sm"
            onClick={() => setShowFullConversation(true)}
            className="bg-gradient-to-br from-primary to-primary/80"
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            Full Conversation
            {communications && communications.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                {communications.length}
              </Badge>
            )}
          </Button>
        </div>

        {/* Lead Info */}
        <div className="space-y-3 pb-4">
          {/* Email */}
          <div className="flex items-center gap-2 group">
            <Mail className="h-4 w-4 text-muted-foreground" />
            {isEditingEmail ? (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  type="email"
                  value={editedEmail}
                  onChange={(e) => setEditedEmail(e.target.value)}
                  className="h-8 max-w-[250px]"
                  autoFocus
                  placeholder="email@example.com"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") updateEmail.mutate(editedEmail);
                    if (e.key === "Escape") {
                      setIsEditingEmail(false);
                      setEditedEmail(lead.email || "");
                    }
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-50"
                  onClick={() => updateEmail.mutate(editedEmail)}
                  disabled={updateEmail.isPending}
                >
                  <Check className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setIsEditingEmail(false);
                    setEditedEmail(lead.email || "");
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <>
                <span className="text-sm">{lead.email || "No email"}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => setIsEditingEmail(true)}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>

          {/* Phone */}
          <div className="flex items-center gap-2 group">
            <Phone className="h-4 w-4 text-muted-foreground" />
            {isEditingPhone ? (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  type="tel"
                  value={editedPhone}
                  onChange={(e) => setEditedPhone(e.target.value)}
                  className="h-8 max-w-[200px]"
                  autoFocus
                  placeholder="+1 (555) 000-0000"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") updatePhone.mutate(editedPhone);
                    if (e.key === "Escape") {
                      setIsEditingPhone(false);
                      setEditedPhone(lead.phone || "");
                    }
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-50"
                  onClick={() => updatePhone.mutate(editedPhone)}
                  disabled={updatePhone.isPending}
                >
                  <Check className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setIsEditingPhone(false);
                    setEditedPhone(lead.phone || "");
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <>
                <span className="text-sm">{lead.phone || "No phone"}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => setIsEditingPhone(true)}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>

          {/* Other Info Row */}
          <div className="flex items-center gap-4">
            {lead.opportunity_value > 0 && (
              <div className="flex items-center gap-2 text-green-600 font-medium">
                <DollarSign className="h-4 w-4" />
                ${lead.opportunity_value.toLocaleString()}
              </div>
            )}
            {lead.property_address && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {lead.property_address}
              </div>
            )}
          </div>
        </div>

        {/* Stage and Actions */}
        <div className="flex flex-wrap items-center gap-3 pb-4">
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

          <SendStripeAuthButton
            leadId={lead.id}
            email={lead.email}
            name={lead.name}
            propertyAddress={lead.property_address}
            stage={lead.stage}
          />
        </div>

        {/* Dialogs */}
        <ScheduleDiscoveryCallDialog
          open={showScheduleCall}
          onOpenChange={setShowScheduleCall}
          leadId={lead.id}
          leadName={lead.name}
          leadPhone={lead.phone || undefined}
          onScheduled={onRefresh}
        />

        {lead.email && (
          <SendEmailDialog
            open={showEmailDialog}
            onOpenChange={setShowEmailDialog}
            contactName={lead.name}
            contactEmail={lead.email}
            contactType="lead"
            contactId={lead.id}
          />
        )}

        {lead.phone && (
          <SendSMSDialog
            open={showSMSDialog}
            onOpenChange={setShowSMSDialog}
            contactName={lead.name}
            contactPhone={lead.phone}
            contactType="lead"
            contactId={lead.id}
          />
        )}

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
            <TabsTrigger value="messages" className="relative">
              <MessageSquare className="h-4 w-4 mr-2" />
              Messages
              {(lead as any).has_unread_messages && (
                <Circle className="h-2 w-2 fill-destructive text-destructive absolute -top-1 -right-1" />
              )}
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
            <div className="flex flex-col h-[350px]">
              {/* Chat bubble conversation thread - scrollable */}
              <div className="flex-1 min-h-0 overflow-hidden">
                <LeadConversationThread 
                  communications={communications || []}
                  leadName={lead.name}
                />
              </div>
              
              {/* Message input - always visible at bottom */}
              {lead.phone || lead.email ? (
                <div className="flex gap-2 pt-3 mt-3 border-t flex-shrink-0 items-start">
                  <Select value={messageType} onValueChange={(v) => setMessageType(v as "sms" | "email")}>
                    <SelectTrigger className="w-24 flex-shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {lead.phone && <SelectItem value="sms">SMS</SelectItem>}
                      {lead.email && <SelectItem value="email">Email</SelectItem>}
                    </SelectContent>
                  </Select>
                  <div className="flex-1">
                    <ExpandableMessageInput
                      value={newMessage}
                      onChange={setNewMessage}
                      onSend={() => sendMessage.mutate()}
                      placeholder={`Type your ${messageType} message...`}
                      messageType={messageType}
                      contactName={lead.name}
                      contactId={lead.id}
                      contactType="lead"
                      minRows={2}
                      maxRows={4}
                      showCharacterCount={messageType === "sms"}
                      showSegmentCount={messageType === "sms"}
                      showVoiceDictation={true}
                      showAIAssistant={true}
                      disabled={sendMessage.isPending}
                    />
                  </div>
                  <Button 
                    onClick={() => sendMessage.mutate()}
                    disabled={sendMessage.isPending || !newMessage.trim()}
                    className="self-start mt-1 flex-shrink-0"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Send
                  </Button>
                </div>
              ) : (
                <div className="pt-3 mt-3 border-t text-center">
                  <p className="text-sm text-muted-foreground mb-3">
                    No phone or email on file. Add contact info to send messages.
                  </p>
                  <div className="flex justify-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setIsEditingPhone(true)}
                    >
                      <Phone className="h-4 w-4 mr-2" />
                      Add Phone
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setIsEditingEmail(true)}
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Add Email
                    </Button>
                  </div>
                </div>
              )}
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

      {/* Full Conversation Drawer/Dialog */}
      {isMobile ? (
        <Drawer open={showFullConversation} onOpenChange={setShowFullConversation}>
          <DrawerContent className="max-h-[95vh] flex flex-col">
            <DrawerHeader className="border-b px-4 py-3 flex-shrink-0">
              <DrawerTitle className="flex items-center gap-3">
                <MessageCircle className="h-5 w-5 text-primary" />
                <div>
                  <span className="text-lg font-semibold">Conversation with {lead.name}</span>
                  <p className="text-sm text-muted-foreground font-normal">
                    {communications?.length || 0} messages
                    {lead.phone && ` • ${lead.phone}`}
                    {lead.email && !lead.phone && ` • ${lead.email}`}
                  </p>
                </div>
              </DrawerTitle>
            </DrawerHeader>
            
            {/* Conversation Thread */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {threadMessages.length > 0 ? (
                <UnifiedConversationThread
                  messages={threadMessages}
                  contactName={lead.name}
                  onImageClick={(url) => window.open(url, '_blank')}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
                  <MessageCircle className="h-12 w-12 mb-3 opacity-30" />
                  <p className="text-base font-medium">No messages yet</p>
                  <p className="text-sm">
                    {!lead.phone && !lead.email 
                      ? "Add phone or email to start a conversation"
                      : "Start the conversation below"
                    }
                  </p>
                </div>
              )}
            </div>
            
            {/* Message Input */}
            <div className="border-t p-4 flex-shrink-0 safe-area-bottom">
              {lead.phone || lead.email ? (
                <div className="flex gap-3 items-start">
                  <Select value={messageType} onValueChange={(v) => setMessageType(v as "sms" | "email")}>
                    <SelectTrigger className="w-24 flex-shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {lead.phone && <SelectItem value="sms">SMS</SelectItem>}
                      {lead.email && <SelectItem value="email">Email</SelectItem>}
                    </SelectContent>
                  </Select>
                  <div className="flex-1">
                    <ExpandableMessageInput
                      value={newMessage}
                      onChange={setNewMessage}
                      onSend={() => {
                        sendMessage.mutate();
                        queryClient.invalidateQueries({ queryKey: ["lead-communications", lead.id] });
                      }}
                      placeholder={`Type your ${messageType} message...`}
                      messageType={messageType}
                      contactName={lead.name}
                      contactId={lead.id}
                      contactType="lead"
                      minRows={2}
                      maxRows={4}
                      showCharacterCount={messageType === "sms"}
                      showSegmentCount={messageType === "sms"}
                      showVoiceDictation={true}
                      showAIAssistant={true}
                      disabled={sendMessage.isPending}
                    />
                  </div>
                  <Button 
                    onClick={() => {
                      sendMessage.mutate();
                      queryClient.invalidateQueries({ queryKey: ["lead-communications", lead.id] });
                    }}
                    disabled={sendMessage.isPending || !newMessage.trim()}
                    className="self-start mt-1 flex-shrink-0 h-11"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Send
                  </Button>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-2">
                    No phone or email on file. Add contact info to send messages.
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setShowFullConversation(false);
                      setIsEditingPhone(true);
                    }}
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Add Phone
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="ml-2"
                    onClick={() => {
                      setShowFullConversation(false);
                      setIsEditingEmail(true);
                    }}
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Add Email
                  </Button>
                </div>
              )}
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={showFullConversation} onOpenChange={setShowFullConversation}>
          <DialogContent className="max-w-2xl w-[90vw] max-h-[85vh] flex flex-col p-0">
            <DialogHeader className="border-b px-6 py-4 flex-shrink-0">
              <DialogTitle className="flex items-center gap-3">
                <MessageCircle className="h-5 w-5 text-primary" />
                <div>
                  <span className="text-lg font-semibold">Conversation with {lead.name}</span>
                  <p className="text-sm text-muted-foreground font-normal">
                    {communications?.length || 0} messages
                    {lead.phone && ` • ${lead.phone}`}
                    {lead.email && !lead.phone && ` • ${lead.email}`}
                  </p>
                </div>
              </DialogTitle>
            </DialogHeader>
            
            {/* Conversation Thread */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {threadMessages.length > 0 ? (
                <UnifiedConversationThread
                  messages={threadMessages}
                  contactName={lead.name}
                  onImageClick={(url) => window.open(url, '_blank')}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground py-12">
                  <MessageCircle className="h-12 w-12 mb-3 opacity-30" />
                  <p className="text-base font-medium">No messages yet</p>
                  <p className="text-sm">
                    {!lead.phone && !lead.email 
                      ? "Add phone or email to start a conversation"
                      : "Start the conversation below"
                    }
                  </p>
                </div>
              )}
            </div>
            
            {/* Message Input */}
            <div className="border-t p-4 flex-shrink-0">
              {lead.phone || lead.email ? (
                <div className="flex gap-3 items-start">
                  <Select value={messageType} onValueChange={(v) => setMessageType(v as "sms" | "email")}>
                    <SelectTrigger className="w-24 flex-shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {lead.phone && <SelectItem value="sms">SMS</SelectItem>}
                      {lead.email && <SelectItem value="email">Email</SelectItem>}
                    </SelectContent>
                  </Select>
                  <div className="flex-1">
                    <ExpandableMessageInput
                      value={newMessage}
                      onChange={setNewMessage}
                      onSend={() => {
                        sendMessage.mutate();
                        queryClient.invalidateQueries({ queryKey: ["lead-communications", lead.id] });
                      }}
                      placeholder={`Type your ${messageType} message...`}
                      messageType={messageType}
                      contactName={lead.name}
                      contactId={lead.id}
                      contactType="lead"
                      minRows={2}
                      maxRows={4}
                      showCharacterCount={messageType === "sms"}
                      showSegmentCount={messageType === "sms"}
                      showVoiceDictation={true}
                      showAIAssistant={true}
                      disabled={sendMessage.isPending}
                    />
                  </div>
                  <Button 
                    onClick={() => {
                      sendMessage.mutate();
                      queryClient.invalidateQueries({ queryKey: ["lead-communications", lead.id] });
                    }}
                    disabled={sendMessage.isPending || !newMessage.trim()}
                    className="self-start mt-1 flex-shrink-0"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Send
                  </Button>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-2">
                    No phone or email on file. Add contact info to send messages.
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setShowFullConversation(false);
                      setIsEditingPhone(true);
                    }}
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Add Phone
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="ml-2"
                    onClick={() => {
                      setShowFullConversation(false);
                      setIsEditingEmail(true);
                    }}
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Add Email
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
};

export default LeadDetailModal;
