import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Phone,
  Mail,
  Send,
  X,
  Eye,
  Edit3,
  Clock,
  User,
  Building2,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Meh,
  PhoneCall,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  Trash2,
} from "lucide-react";
import { usePendingCallRecaps, PendingCallRecap } from "@/hooks/usePendingCallRecaps";
import {
  usePendingTaskConfirmations,
  PendingTaskConfirmation,
} from "@/hooks/usePendingTaskConfirmations";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TwilioCallDialog } from "@/components/TwilioCallDialog";
import { createSmartGreeting, extractFirstName } from "@/lib/nameUtils";

const sentimentConfig = {
  positive: { icon: ThumbsUp, color: "text-green-500", bg: "bg-green-100" },
  neutral: { icon: Meh, color: "text-yellow-500", bg: "bg-yellow-100" },
  negative: { icon: ThumbsDown, color: "text-red-500", bg: "bg-red-100" },
};

interface CallTaskCardProps {
  task: PendingTaskConfirmation;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isApproving: boolean;
  isRejecting: boolean;
}

function CallTaskCard({ task, onApprove, onReject, isApproving, isRejecting }: CallTaskCardProps) {
  const priorityColors = {
    high: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  };

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm truncate">{task.task_title}</span>
          <Badge
            variant="outline"
            className={priorityColors[task.priority as keyof typeof priorityColors] || priorityColors.medium}
          >
            {task.priority}
          </Badge>
        </div>
        {task.task_description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{task.task_description}</p>
        )}
        {task.source_quote && (
          <p className="text-xs text-muted-foreground italic mt-1">"{task.source_quote}"</p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={() => onReject(task.id)}
          disabled={isRejecting}
        >
          <XCircle className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-green-600 hover:text-green-700"
          onClick={() => onApprove(task.id)}
          disabled={isApproving}
        >
          <CheckCircle2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

interface TeamMember {
  id: string;
  first_name: string | null;
}

interface RecapEditorProps {
  recap: PendingCallRecap;
  onSend: (subject: string, body: string) => void;
  onDismiss: () => void;
  onCallback: () => void;
  onSendSMS: (message: string) => void;
  onSkipToNext: () => void;
  onAssignTo: (userId: string) => void;
  teamMembers: TeamMember[];
  currentUserId: string | null;
  isSending: boolean;
  isDismissing: boolean;
  hasNext: boolean;
  hasPrevious: boolean;
  onPrevious: () => void;
}

function RecapEditor({ 
  recap, 
  onSend, 
  onDismiss, 
  onCallback, 
  onSendSMS, 
  onSkipToNext, 
  onAssignTo,
  teamMembers,
  currentUserId,
  isSending, 
  isDismissing, 
  hasNext,
  hasPrevious,
  onPrevious,
}: RecapEditorProps) {
  const [subject, setSubject] = useState(recap.subject);
  const [emailBody, setEmailBody] = useState(recap.email_body);
  const [isPreview, setIsPreview] = useState(false);
  const [showSMSInput, setShowSMSInput] = useState(false);
  
  // Use smart greeting utility to avoid "Hi Unknown"
  const firstName = extractFirstName(recap.recipient_name);
  const greeting = createSmartGreeting(recap.recipient_name);
  
  const [smsMessage, setSmsMessage] = useState(() => {
    const summary = recap.transcript_summary?.slice(0, 100) || 'our recent call';
    return `${greeting} following up on ${summary}. Let me know if you need anything else! - PeachHaus`;
  });

  const SentimentIcon = sentimentConfig[recap.sentiment as keyof typeof sentimentConfig]?.icon || Meh;
  const sentimentStyles = sentimentConfig[recap.sentiment as keyof typeof sentimentConfig] || sentimentConfig.neutral;

  return (
    <div className="space-y-4">
      {/* Call Info Header with Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <Phone className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{recap.recipient_name}</span>
              <Badge variant="outline" className="text-xs">
                {recap.recipient_type}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{format(new Date(recap.call_date), "MMM d, yyyy 'at' h:mm a")}</span>
              {recap.call_duration && (
                <>
                  <span>•</span>
                  <span>{Math.round(recap.call_duration / 60)} min</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-full ${sentimentStyles.bg}`}>
            <SentimentIcon className={`h-4 w-4 ${sentimentStyles.color}`} />
          </div>
        </div>
      </div>

      {/* Quick Action Buttons - Row 1 */}
      <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
        {hasPrevious && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onPrevious}
            className="text-muted-foreground"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onCallback}
          className="flex-1 text-blue-600 border-blue-200 hover:bg-blue-50"
        >
          <PhoneCall className="h-4 w-4 mr-2" />
          Call Back
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSMSInput(!showSMSInput)}
          className="flex-1 text-green-600 border-green-200 hover:bg-green-50"
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          SMS Recap
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onDismiss}
          disabled={isDismissing}
          className="text-destructive border-destructive/30 hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Dismiss
        </Button>
        {hasNext && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSkipToNext}
            className="text-muted-foreground"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>

      {/* Assign to Team Member */}
      <div className="flex items-center gap-2">
        <UserPlus className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Assign to:</span>
        <Select
          value={recap.assigned_to_user_id || ""}
          onValueChange={(value) => {
            if (value && value !== recap.assigned_to_user_id) {
              onAssignTo(value);
            }
          }}
        >
          <SelectTrigger className="w-40 h-8 text-sm">
            <SelectValue placeholder="Select team member" />
          </SelectTrigger>
          <SelectContent>
            {teamMembers
              .filter(m => m.id !== currentUserId)
              .map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.first_name || 'Unknown'}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {/* SMS Input */}
      {showSMSInput && (
        <div className="space-y-2 p-3 bg-green-50 rounded-lg border border-green-200">
          <Textarea
            value={smsMessage}
            onChange={(e) => setSmsMessage(e.target.value)}
            rows={2}
            placeholder="Quick SMS recap..."
            className="text-sm bg-white"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSMSInput(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onSendSMS(smsMessage);
                setShowSMSInput(false);
              }}
              className="bg-green-600 hover:bg-green-700"
            >
              <Send className="h-3 w-3 mr-1" />
              Send SMS
            </Button>
          </div>
        </div>
      )}

      {/* Summary */}
      {recap.transcript_summary && (
        <Card className="bg-muted/50">
          <CardContent className="p-3">
            <div className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-primary mt-0.5" />
              <p className="text-sm">{recap.transcript_summary}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Topics */}
      {recap.key_topics && recap.key_topics.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Key Topics</h4>
          <div className="flex flex-wrap gap-2">
            {recap.key_topics.map((topic, idx) => (
              <Badge key={idx} variant="secondary">
                {topic}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <Separator />

      {/* Email Editor */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Recap Email to {firstName || 'Contact'}
          </h4>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsPreview(!isPreview)}
          >
            {isPreview ? <Edit3 className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
            {isPreview ? "Edit" : "Preview"}
          </Button>
        </div>

        {recap.recipient_email ? (
          <>
            <div className="text-xs text-muted-foreground">
              To: {recap.recipient_email}
            </div>

            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
              className="font-medium"
              disabled={isPreview}
            />

            {isPreview ? (
              <Card>
                <CardContent className="p-4 prose prose-sm max-w-none">
                  <div dangerouslySetInnerHTML={{ __html: emailBody }} />
                </CardContent>
              </Card>
            ) : (
              <Textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                placeholder="Email body..."
                rows={10}
                className="text-sm font-mono"
              />
            )}

            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                onClick={onDismiss}
                disabled={isDismissing}
              >
                <X className="h-4 w-4 mr-2" />
                Skip Email
              </Button>
              <Button
                onClick={() => onSend(subject, emailBody)}
                disabled={isSending || !recap.recipient_email}
              >
                <Send className="h-4 w-4 mr-2" />
                Send to {firstName || 'Contact'}
              </Button>
            </div>
          </>
        ) : (
          <Card className="bg-yellow-50 border-yellow-200">
            <CardContent className="p-4 flex items-center gap-3">
              <Mail className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-sm font-medium text-yellow-800">No email address available</p>
                <p className="text-xs text-yellow-700">
                  We couldn't find an email for this contact. You can dismiss this or add their email later.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export function CallRecapModal() {
  const [isOpen, setIsOpen] = useState(true);
  const [activeRecapIndex, setActiveRecapIndex] = useState(0);
  const [showAllRecaps, setShowAllRecaps] = useState(false);
  
  // TwilioCallDialog state
  const [showCallDialog, setShowCallDialog] = useState(false);
  const [callDialogPhone, setCallDialogPhone] = useState<string | null>(null);
  const [callDialogContact, setCallDialogContact] = useState({ name: "", address: "" });
  const [callDialogMetadata, setCallDialogMetadata] = useState<{
    communicationId?: string;
    ownerId?: string;
    leadId?: string;
  }>({});

  const {
    pendingRecaps,
    userRecaps,
    teamRecaps,
    isLoading: isLoadingRecaps,
    sendRecap,
    dismissRecap,
    isSending,
    isDismissing,
    currentUserId,
  } = usePendingCallRecaps();

  const {
    pendingConfirmations,
    isLoading: isLoadingTasks,
    isEligibleUser,
    approveTask,
    rejectTask,
    approveAllTasks,
    isApproving,
    isRejecting,
    isApprovingAll,
  } = usePendingTaskConfirmations();

  // Fetch team members for assignment dropdown
  const { data: teamMembers = [] } = useQuery({
    queryKey: ["team-members-for-assignment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name")
        .order("first_name");
      if (error) throw error;
      return data as TeamMember[];
    },
  });

  // Show user's recaps first, then team recaps if toggled
  const displayedRecaps = showAllRecaps ? pendingRecaps : userRecaps.length > 0 ? userRecaps : pendingRecaps;

  // Filter tasks that came from call transcripts
  const callTasks = pendingConfirmations.filter(
    (task) => task.source_type === "call_transcript"
  );

  // Get current recap from displayed list
  const currentRecap = displayedRecaps[activeRecapIndex];

  // Get tasks for the current recap
  const currentRecapTasks = currentRecap
    ? callTasks.filter((task) => task.source_id === currentRecap.communication_id)
    : [];

  // Check if current recap is user's own call
  const isUserCall = currentRecap?.caller_user_id === currentUserId;
  
  // Check if current recap is assigned to current user
  const isAssignedToUser = currentRecap?.assigned_to_user_id === currentUserId;

  // ALL HOOKS MUST BE CALLED BEFORE ANY EARLY RETURNS
  const handleSend = useCallback(
    (subject: string, body: string) => {
      if (currentRecap) {
        sendRecap({ recapId: currentRecap.id, subject, emailBody: body });
        // Move to next recap or close
        if (activeRecapIndex < displayedRecaps.length - 1) {
          setActiveRecapIndex((prev) => prev + 1);
        }
      }
    },
    [currentRecap, sendRecap, activeRecapIndex, displayedRecaps.length]
  );

  const handleDismiss = useCallback(() => {
    if (currentRecap) {
      dismissRecap({ recapId: currentRecap.id });
      // Move to next recap or close
      if (activeRecapIndex < displayedRecaps.length - 1) {
        setActiveRecapIndex((prev) => prev + 1);
      }
    }
  }, [currentRecap, dismissRecap, activeRecapIndex, displayedRecaps.length]);

  const handleApproveTask = useCallback(
    (id: string) => {
      approveTask({ confirmationId: id });
    },
    [approveTask]
  );

  const handleRejectTask = useCallback(
    (id: string) => {
      rejectTask({ confirmationId: id });
    },
    [rejectTask]
  );

  const handleApproveAllTasks = useCallback(() => {
    approveAllTasks();
  }, [approveAllTasks]);

  // Handle assigning recap to another team member
  const handleAssignTo = useCallback(async (userId: string) => {
    if (!currentRecap) return;
    
    try {
      const { error } = await supabase
        .from("pending_call_recaps")
        .update({ assigned_to_user_id: userId })
        .eq("id", currentRecap.id);
      
      if (error) throw error;
      
      const assignedMember = teamMembers.find(m => m.id === userId);
      toast.success(`Assigned to ${assignedMember?.first_name || 'team member'}`);
      
      // Move to next recap after assigning
      if (activeRecapIndex < displayedRecaps.length - 1) {
        setActiveRecapIndex(prev => prev + 1);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to assign recap");
    }
  }, [currentRecap, teamMembers, activeRecapIndex, displayedRecaps.length]);

  // Handle callback using integrated Twilio calling
  const handleCallback = useCallback(async () => {
    if (!currentRecap) return;
    
    let phone: string | null = null;
    let address: string | null = null;
    
    if (currentRecap.owner_id) {
      const { data: owner } = await supabase
        .from("property_owners")
        .select("phone")
        .eq("id", currentRecap.owner_id)
        .single();
      phone = owner?.phone || null;
      // Get property address if available
      if (currentRecap.property_id) {
        const { data: property } = await supabase
          .from("properties")
          .select("address")
          .eq("id", currentRecap.property_id)
          .single();
        address = property?.address || null;
      }
    } else if (currentRecap.lead_id) {
      const { data: lead } = await supabase
        .from("leads")
        .select("phone, property_address")
        .eq("id", currentRecap.lead_id)
        .single();
      phone = lead?.phone || null;
      address = lead?.property_address || null;
    }
    
    if (phone) {
      const displayName = extractFirstName(currentRecap.recipient_name) || currentRecap.recipient_name || 'Contact';
      setCallDialogPhone(phone);
      setCallDialogContact({
        name: displayName,
        address: address || ""
      });
      setCallDialogMetadata({
        communicationId: currentRecap.communication_id || undefined,
        ownerId: currentRecap.owner_id || undefined,
        leadId: currentRecap.lead_id || undefined,
      });
      setShowCallDialog(true);
    } else {
      toast.error("No phone number on file");
    }
  }, [currentRecap]);

  // Don't render if nothing to show - AFTER all hooks
  if (!isEligibleUser || (pendingRecaps.length === 0 && callTasks.length === 0)) {
    return null;
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Phone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="flex items-center gap-2">
                  {displayedRecaps.length > 0
                    ? `Call${displayedRecaps.length > 1 ? "s" : ""} to Review`
                    : "Tasks from Calls"}
                  {userRecaps.length > 0 && (
                    <Badge variant="default" className="text-xs">
                      {userRecaps.length} Your Calls
                    </Badge>
                  )}
                  {isAssignedToUser && (
                    <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                      Assigned to You
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription>
                  {displayedRecaps.length > 0
                    ? `${displayedRecaps.length} call recap${displayedRecaps.length > 1 ? "s" : ""} ready to send`
                    : `${callTasks.length} task${callTasks.length !== 1 ? "s" : ""} detected`}
                  {callTasks.length > 0 && displayedRecaps.length > 0 && ` • ${callTasks.length} tasks detected`}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <Tabs defaultValue="recap" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="recap" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Recap Email
                {displayedRecaps.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {displayedRecaps.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="tasks" className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Extracted Tasks
                {callTasks.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {callTasks.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Toggle for showing all recaps vs just user's */}
            {teamRecaps.length > 0 && userRecaps.length > 0 && (
              <div className="flex justify-end mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllRecaps(!showAllRecaps)}
                >
                  <User className="h-4 w-4 mr-1" />
                  {showAllRecaps ? "Show My Calls" : `Show All (${pendingRecaps.length})`}
                </Button>
              </div>
            )}

            <ScrollArea className="flex-1 mt-2">
              <TabsContent value="recap" className="m-0">
                {currentRecap ? (
                  <div className="space-y-2">
                    {isAssignedToUser && (
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 text-xs text-blue-700 border border-blue-200">
                        <User className="h-3 w-3" />
                        <span>This caller requested to speak with you</span>
                      </div>
                    )}
                    {!isUserCall && !isAssignedToUser && currentRecap.caller_user_id && (
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span>This call was made by another team member</span>
                      </div>
                    )}
                    <RecapEditor
                      recap={currentRecap}
                      onSend={handleSend}
                      onDismiss={handleDismiss}
                      onCallback={handleCallback}
                      onSendSMS={async (message) => {
                        let phone: string | null = null;
                        
                        if (currentRecap.owner_id) {
                          const { data: owner } = await supabase
                            .from("property_owners")
                            .select("phone")
                            .eq("id", currentRecap.owner_id)
                            .single();
                          phone = owner?.phone || null;
                        } else if (currentRecap.lead_id) {
                          const { data: lead } = await supabase
                            .from("leads")
                            .select("phone")
                            .eq("id", currentRecap.lead_id)
                            .single();
                          phone = lead?.phone || null;
                        }
                        
                        if (phone) {
                          try {
                            await supabase.functions.invoke('ghl-send-sms', {
                              body: { to: phone, message }
                            });
                            const displayName = extractFirstName(currentRecap.recipient_name) || 'Contact';
                            toast.success(`SMS sent to ${displayName}`);
                          } catch (e: any) {
                            toast.error(e.message || "Failed to send SMS");
                          }
                        } else {
                          toast.error("No phone number on file");
                        }
                      }}
                      onSkipToNext={() => {
                        if (activeRecapIndex < displayedRecaps.length - 1) {
                          setActiveRecapIndex(prev => prev + 1);
                        }
                      }}
                      onAssignTo={handleAssignTo}
                      teamMembers={teamMembers}
                      currentUserId={currentUserId}
                      hasNext={activeRecapIndex < displayedRecaps.length - 1}
                      hasPrevious={activeRecapIndex > 0}
                      onPrevious={() => setActiveRecapIndex(prev => Math.max(0, prev - 1))}
                      isSending={isSending}
                      isDismissing={isDismissing}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Mail className="h-12 w-12 mb-4 opacity-50" />
                    <p>No recap emails pending</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="tasks" className="m-0 space-y-3">
                {callTasks.length > 0 ? (
                  <>
                    {callTasks.map((task) => (
                      <CallTaskCard
                        key={task.id}
                        task={task}
                        onApprove={handleApproveTask}
                        onReject={handleRejectTask}
                        isApproving={isApproving}
                        isRejecting={isRejecting}
                      />
                    ))}
                    <div className="flex justify-end pt-2">
                      <Button onClick={handleApproveAllTasks} disabled={isApprovingAll}>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Approve All ({callTasks.length})
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mb-4 opacity-50" />
                    <p>No tasks detected from calls</p>
                  </div>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>

          {/* Back/Forward Navigation for multiple recaps */}
          {displayedRecaps.length > 1 && (
            <div className="flex items-center justify-center gap-4 pt-4 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveRecapIndex(prev => Math.max(0, prev - 1))}
                disabled={activeRecapIndex === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {activeRecapIndex + 1} of {displayedRecaps.length}
                </span>
                <div className="flex gap-1">
                  {displayedRecaps.map((recap, idx) => (
                    <button
                      key={recap.id}
                      onClick={() => setActiveRecapIndex(idx)}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        idx === activeRecapIndex ? "bg-primary" : "bg-muted"
                      } ${recap.caller_user_id === currentUserId ? "ring-1 ring-primary" : ""} ${
                        recap.assigned_to_user_id === currentUserId ? "ring-1 ring-blue-500" : ""
                      }`}
                      title={
                        recap.assigned_to_user_id === currentUserId
                          ? "Assigned to you"
                          : recap.caller_user_id === currentUserId
                          ? "Your call"
                          : "Team call"
                      }
                    />
                  ))}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveRecapIndex(prev => Math.min(displayedRecaps.length - 1, prev + 1))}
                disabled={activeRecapIndex === displayedRecaps.length - 1}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Review Later
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Twilio Call Dialog */}
      <TwilioCallDialog
        isOpen={showCallDialog}
        onOpenChange={setShowCallDialog}
        phoneNumber={callDialogPhone}
        contactName={callDialogContact.name}
        contactAddress={callDialogContact.address}
        onCallComplete={() => {
          // Move to next recap after call completes
          if (activeRecapIndex < displayedRecaps.length - 1) {
            setActiveRecapIndex(prev => prev + 1);
          }
        }}
      />
    </>
  );
}
