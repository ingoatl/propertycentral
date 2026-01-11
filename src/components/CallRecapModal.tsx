import { useState, useCallback, useEffect, useMemo } from "react";
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
  Calendar,
  Check,
  History,
  Loader2,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { ConversationHistory, useConversationContext } from "@/components/communications/ConversationHistory";

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
  onMarkDone: () => void;
  onCallback: () => void;
  onSendSMS: (message: string) => void;
  onScheduleFollowUp: (days: number, method: 'sms' | 'email', message: string) => void;
  onSkipToNext: () => void;
  onAssignTo: (userId: string) => void;
  teamMembers: TeamMember[];
  currentUserId: string | null;
  currentUserFirstName: string | null;
  isSending: boolean;
  isDismissing: boolean;
  isMarkingDone: boolean;
  hasNext: boolean;
  hasPrevious: boolean;
  onPrevious: () => void;
}

function RecapEditor({ 
  recap, 
  onSend, 
  onDismiss, 
  onMarkDone,
  onCallback, 
  onSendSMS,
  onScheduleFollowUp,
  onSkipToNext, 
  onAssignTo,
  teamMembers,
  currentUserId,
  currentUserFirstName,
  isSending, 
  isDismissing,
  isMarkingDone,
  hasNext,
  hasPrevious,
  onPrevious,
}: RecapEditorProps) {
  const [subject, setSubject] = useState(recap.subject);
  const [emailBody, setEmailBody] = useState(recap.email_body);
  const [isPreview, setIsPreview] = useState(false);
  const [showSMSInput, setShowSMSInput] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [followUpDays, setFollowUpDays] = useState(3);
  const [followUpMethod, setFollowUpMethod] = useState<'sms' | 'email'>('sms');
  const [isGeneratingSmart, setIsGeneratingSmart] = useState(false);
  
  // Use smart greeting utility to avoid "Hi Unknown"
  const firstName = extractFirstName(recap.recipient_name);
  const greeting = createSmartGreeting(recap.recipient_name);
  
  // Get conversation context for smart follow-ups
  const { data: conversationContext, isLoading: isLoadingContext } = useConversationContext(
    recap.lead_id,
    recap.owner_id
  );
  
  const SCHEDULING_LINK = "https://propertycentral.lovable.app/book-discovery-call";
  
  // Create signature with user's name
  const signature = currentUserFirstName 
    ? `${currentUserFirstName} @ PeachHaus Group` 
    : 'PeachHaus Group';
  
  // Generate smart SMS based on conversation history + call transcript
  const generateSmsFromContext = useMemo(() => {
    const topics = recap.key_topics?.slice(0, 2).join(' and ') || 'your property';
    const summary = recap.transcript_summary?.slice(0, 80) || '';
    const firstName = recap.recipient_name?.split(' ')[0] || '';
    
    // Check if there are pending requests from previous conversations
    if (conversationContext?.hasAskedForInfo) {
      return `${greeting} wanted to check in - did you have a chance to get that info together? No rush at all. If you'd like to hop on a quick call, here's my calendar: ${SCHEDULING_LINK} - ${signature}`;
    }
    
    // Check last message context
    if (conversationContext?.lastMessage?.body && conversationContext.lastMessage.direction === "inbound") {
      const lastMsg = conversationContext.lastMessage.body.toLowerCase();
      if (lastMsg.includes("address") || lastMsg.includes("income") || lastMsg.includes("report")) {
        return `${greeting} got your message! I'll pull that together and send it over. Happy to chat through anything - schedule a call here if easier: ${SCHEDULING_LINK} - ${signature}`;
      }
    }
    
    // After a call - suggest scheduling a proper discovery call if they seem interested
    if (summary) {
      return `${greeting} great chatting with you about ${topics}! If you'd like to discuss in more detail, pick a time here: ${SCHEDULING_LINK} - ${signature}`;
    }
    return `${greeting} thanks for calling about ${topics}! If it's urgent, let us know and we'll get right back to you. Or schedule time to chat: ${SCHEDULING_LINK} - ${signature}`;
  }, [greeting, recap.key_topics, recap.transcript_summary, conversationContext, signature]);
  
  const [smsMessage, setSmsMessage] = useState(generateSmsFromContext);
  
  // Update SMS when context loads
  useEffect(() => {
    if (!isLoadingContext && conversationContext) {
      setSmsMessage(generateSmsFromContext);
    }
  }, [generateSmsFromContext, isLoadingContext, conversationContext]);
  
  // Generate smart follow-up message using AI with full context
  const generateSmartFollowUp = useCallback(async () => {
    setIsGeneratingSmart(true);
    try {
      // Use the enhanced contextForAI which includes pending requests
      const contextForAI = conversationContext?.contextForAI || conversationContext?.summary || "";
      const pendingReqs = conversationContext?.pendingRequests || [];
      const lastAsk = conversationContext?.lastOutboundAsk || "";
      
      const prompt = `Generate a warm, professional follow-up SMS for PeachHaus Group (property management company).

CONTACT INFO:
- Contact name: ${recap.recipient_name || "property owner"} (use their first name: ${recap.recipient_name?.split(' ')[0] || 'there'})
- Topics discussed: ${recap.key_topics?.join(", ") || "property management"}
- Call summary: ${recap.transcript_summary || "General inquiry call"}

CONVERSATION HISTORY:
${contextForAI || "This was their first contact with us - they called in"}

${pendingReqs.length > 0 ? `\n⚠️ PENDING INFO FROM THEM: ${pendingReqs.join(", ")}. Reference this naturally.` : ""}
${lastAsk ? `\nOur last question: "${lastAsk.slice(0, 200)}"` : ""}

SCHEDULING LINK (USE THIS): https://propertycentral.lovable.app/book-discovery-call

PSYCHOLOGY-BASED COMMUNICATION RULES:
1. RECIPROCITY: Offer value first (tip, insight, helpful info) before asking
2. SOCIAL PROOF: Reference that "many property owners in Atlanta" or similar
3. SCARCITY: If relevant, mention limited availability without being pushy
4. LIKING: Be genuinely warm - use their name, acknowledge their specific situation
5. COMMITMENT: Reference their interest to reinforce their engagement

MESSAGE STRUCTURE:
- Start with warmth (great chatting, appreciate you calling)
- Acknowledge their specific interest or need
- Provide a clear, low-pressure next step
- Include scheduling link for a discovery call
- If they sounded urgent, acknowledge that and offer faster callback option

TONE:
- Sound like a trusted advisor, not a salesperson
- Be concise but not cold
- Make them feel valued and understood
- Avoid corporate speak - write like a friendly professional

Keep under 280 characters. Sign off with "- ${signature}"

Generate ONLY the SMS text.`;

      const { data, error } = await supabase.functions.invoke("ai-assistant", {
        body: { prompt, type: "generate_followup" }
      });
      
      if (error) throw error;
      
      if (data?.message) {
        setSmsMessage(data.message);
        toast.success("Smart follow-up generated!");
      }
    } catch (e: unknown) {
      console.error("Error generating smart follow-up:", e);
      toast.error("Couldn't generate smart message");
    } finally {
      setIsGeneratingSmart(false);
    }
  }, [recap, conversationContext]);
  
  // Generate follow-up message from context - reference specific pending requests
  const generateFollowUpMessage = useMemo(() => {
    const topics = recap.key_topics?.slice(0, 2).join(' and ') || 'your property';
    const pendingReqs = conversationContext?.pendingRequests || [];
    
    // If we've asked them for something specific, reference it directly
    if (pendingReqs.length > 0) {
      if (pendingReqs.includes("their address")) {
        return `${greeting} just following up - did you have a chance to send over that address? Let me know if you need anything! - ${signature}`;
      }
      if (pendingReqs.includes("insurance documents")) {
        return `${greeting} checking in on the insurance documents. Let me know if you have any questions! - ${signature}`;
      }
      if (pendingReqs.includes("income report info")) {
        return `${greeting} wanted to follow up on the income report info. Have you had a chance to gather that? - ${signature}`;
      }
      return `${greeting} following up on our last conversation. Did you have a chance to get that info together? Happy to help! - ${signature}`;
    }
    
    return `${greeting} just checking in about ${topics}. Have you had a chance to think it over? Happy to answer any questions! - ${signature}`;
  }, [greeting, recap.key_topics, conversationContext, signature]);
  
  const [followUpMessage, setFollowUpMessage] = useState(generateFollowUpMessage);

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
          Send SMS
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onMarkDone}
          disabled={isMarkingDone}
          className="text-primary border-primary/30 hover:bg-primary/10"
        >
          <Check className="h-4 w-4 mr-1" />
          Done
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

      {/* Conversation History Toggle */}
      <Collapsible open={showHistory} onOpenChange={setShowHistory}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground hover:text-foreground">
            <History className="h-4 w-4 mr-2" />
            View Conversation History
            <ChevronRight className={`h-4 w-4 ml-auto transition-transform ${showHistory ? 'rotate-90' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <ConversationHistory 
            leadId={recap.lead_id} 
            ownerId={recap.owner_id}
            maxHeight="180px"
          />
        </CollapsibleContent>
      </Collapsible>

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

      {/* SMS Input with Smart AI */}
      {showSMSInput && (
        <div className="space-y-2 p-3 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-green-800">Quick SMS</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={generateSmartFollowUp}
              disabled={isGeneratingSmart}
              className="h-6 text-xs text-green-700 hover:text-green-900 hover:bg-green-100"
            >
              {isGeneratingSmart ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3 mr-1" />
              )}
              {isGeneratingSmart ? "Generating..." : "AI Smart Message"}
            </Button>
          </div>
          <Textarea
            value={smsMessage}
            onChange={(e) => setSmsMessage(e.target.value)}
            rows={2}
            placeholder="Quick SMS recap..."
            className="text-sm bg-white"
          />
          {conversationContext?.hasAskedForInfo && (
            <p className="text-[10px] text-green-700 italic">
              💡 Tip: You previously asked for information - the message above references that context
            </p>
          )}
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

      {/* Schedule Follow-up Section */}
      <Collapsible open={showFollowUp} onOpenChange={setShowFollowUp}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground hover:text-foreground">
            <Calendar className="h-4 w-4 mr-2" />
            Schedule Follow-up
            <ChevronRight className={`h-4 w-4 ml-auto transition-transform ${showFollowUp ? 'rotate-90' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 p-3 bg-muted/30 rounded-lg mt-2">
          <p className="text-xs text-muted-foreground">
            AI suggests: Based on the call sentiment ({recap.sentiment}), a follow-up in a few days may help continue the conversation.
          </p>
          <div className="flex gap-2">
            <Button
              variant={followUpDays === 1 ? "default" : "outline"}
              size="sm"
              onClick={() => setFollowUpDays(1)}
            >
              Tomorrow
            </Button>
            <Button
              variant={followUpDays === 3 ? "default" : "outline"}
              size="sm"
              onClick={() => setFollowUpDays(3)}
            >
              3 Days
            </Button>
            <Button
              variant={followUpDays === 7 ? "default" : "outline"}
              size="sm"
              onClick={() => setFollowUpDays(7)}
            >
              1 Week
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              variant={followUpMethod === 'sms' ? "default" : "outline"}
              size="sm"
              onClick={() => setFollowUpMethod('sms')}
            >
              <MessageSquare className="h-3 w-3 mr-1" />
              SMS
            </Button>
            <Button
              variant={followUpMethod === 'email' ? "default" : "outline"}
              size="sm"
              onClick={() => setFollowUpMethod('email')}
            >
              <Mail className="h-3 w-3 mr-1" />
              Email
            </Button>
          </div>
          <Textarea
            value={followUpMessage}
            onChange={(e) => setFollowUpMessage(e.target.value)}
            rows={2}
            placeholder="Follow-up message..."
            className="text-sm"
          />
          <Button
            size="sm"
            onClick={() => onScheduleFollowUp(followUpDays, followUpMethod, followUpMessage)}
            className="w-full"
          >
            <Calendar className="h-3 w-3 mr-1" />
            Schedule for {followUpDays === 1 ? 'Tomorrow' : `${followUpDays} Days`}
          </Button>
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* Email Editor - Only show if email exists */}
      {recap.recipient_email && (
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
              rows={8}
              className="text-sm font-mono"
            />
          )}
        </div>
      )}

      {/* Footer Actions - Simplified */}
      <div className="flex items-center justify-between pt-4 border-t">
        <button
          onClick={onDismiss}
          disabled={isDismissing}
          className="text-xs text-muted-foreground hover:text-destructive transition-colors"
        >
          Dismiss this recap
        </button>
        {recap.recipient_email && (
          <Button
            onClick={() => onSend(subject, emailBody)}
            disabled={isSending}
          >
            <Send className="h-4 w-4 mr-2" />
            Send & Done
          </Button>
        )}
      </div>
    </div>
  );
}

export function CallRecapModal() {
  const [isOpen, setIsOpen] = useState(true);
  const [activeRecapIndex, setActiveRecapIndex] = useState(0);
  const [showAllRecaps, setShowAllRecaps] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  
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
    markDone,
    isSending,
    isDismissing,
    isMarkingDone,
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

  // Get current user's first name for signature
  const currentUserFirstName = useMemo(() => {
    if (!currentUserId) return null;
    const currentMember = teamMembers.find(m => m.id === currentUserId);
    return currentMember?.first_name || null;
  }, [currentUserId, teamMembers]);

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

  const handleMarkDone = useCallback(() => {
    if (currentRecap) {
      markDone({ recapId: currentRecap.id });
      // Move to next recap or close
      if (activeRecapIndex < displayedRecaps.length - 1) {
        setActiveRecapIndex((prev) => prev + 1);
      }
    }
  }, [currentRecap, markDone, activeRecapIndex, displayedRecaps.length]);

  const handleScheduleFollowUp = useCallback(async (days: number, method: 'sms' | 'email', message: string) => {
    if (!currentRecap) return;
    
    try {
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + days);
      
      // Create a follow-up schedule entry
      const { error } = await supabase
        .from("lead_follow_up_schedules")
        .insert({
          lead_id: currentRecap.lead_id,
          sequence_id: null, // Manual follow-up
          step_id: null,
          scheduled_for: scheduledDate.toISOString(),
          action_type: method,
          subject: method === 'email' ? `Follow-up: ${currentRecap.subject}` : null,
          content: message,
          status: "pending",
        });
      
      if (error) throw error;
      
      toast.success(`Follow-up scheduled for ${days === 1 ? 'tomorrow' : `${days} days from now`}`);
      
      // Mark the recap as done after scheduling
      markDone({ recapId: currentRecap.id });
      
      if (activeRecapIndex < displayedRecaps.length - 1) {
        setActiveRecapIndex((prev) => prev + 1);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to schedule follow-up");
    }
  }, [currentRecap, markDone, activeRecapIndex, displayedRecaps.length]);

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

  // Helper to get phone from lead_communications metadata as fallback
  const getPhoneFromMetadata = useCallback(async (communicationId: string | null): Promise<string | null> => {
    if (!communicationId) return null;
    const { data: comm } = await supabase
      .from("lead_communications")
      .select("metadata")
      .eq("id", communicationId)
      .single();
    
    // Try to extract phone from GHL metadata
    const metadata = comm?.metadata as Record<string, any> | null;
    const ghlData = metadata?.ghl_data;
    if (ghlData?.fromNumber) return ghlData.fromNumber;
    if (ghlData?.toNumber) return ghlData.toNumber;
    if (metadata?.from_phone) return metadata.from_phone;
    if (metadata?.phone) return metadata.phone;
    return null;
  }, []);

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
    
    // Fallback: Get phone from communication metadata if not on lead/owner record
    if (!phone && currentRecap.communication_id) {
      phone = await getPhoneFromMetadata(currentRecap.communication_id);
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
  }, [currentRecap, getPhoneFromMetadata]);

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
                      key={currentRecap.id}
                      recap={currentRecap}
                      onSend={handleSend}
                      onDismiss={handleDismiss}
                      onMarkDone={handleMarkDone}
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
                        
                        // Fallback: Get phone from communication metadata
                        if (!phone && currentRecap.communication_id) {
                          phone = await getPhoneFromMetadata(currentRecap.communication_id);
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
                      onScheduleFollowUp={handleScheduleFollowUp}
                      onSkipToNext={() => {
                        if (activeRecapIndex < displayedRecaps.length - 1) {
                          setActiveRecapIndex(prev => prev + 1);
                        }
                      }}
                      onAssignTo={handleAssignTo}
                      teamMembers={teamMembers}
                      currentUserId={currentUserId}
                      currentUserFirstName={currentUserFirstName}
                      hasNext={activeRecapIndex < displayedRecaps.length - 1}
                      hasPrevious={activeRecapIndex > 0}
                      onPrevious={() => setActiveRecapIndex(prev => Math.max(0, prev - 1))}
                      isSending={isSending}
                      isDismissing={isDismissing}
                      isMarkingDone={isMarkingDone}
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
