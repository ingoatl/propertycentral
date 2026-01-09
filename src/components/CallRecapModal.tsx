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
} from "lucide-react";
import { usePendingCallRecaps, PendingCallRecap } from "@/hooks/usePendingCallRecaps";
import {
  usePendingTaskConfirmations,
  PendingTaskConfirmation,
} from "@/hooks/usePendingTaskConfirmations";
import { formatDistanceToNow, format } from "date-fns";

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

interface RecapEditorProps {
  recap: PendingCallRecap;
  onSend: (subject: string, body: string) => void;
  onDismiss: () => void;
  isSending: boolean;
  isDismissing: boolean;
}

function RecapEditor({ recap, onSend, onDismiss, isSending, isDismissing }: RecapEditorProps) {
  const [subject, setSubject] = useState(recap.subject);
  const [emailBody, setEmailBody] = useState(recap.email_body);
  const [isPreview, setIsPreview] = useState(false);

  const SentimentIcon = sentimentConfig[recap.sentiment as keyof typeof sentimentConfig]?.icon || Meh;
  const sentimentStyles = sentimentConfig[recap.sentiment as keyof typeof sentimentConfig] || sentimentConfig.neutral;

  return (
    <div className="space-y-4">
      {/* Call Info Header */}
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
        <div className={`p-2 rounded-full ${sentimentStyles.bg}`}>
          <SentimentIcon className={`h-4 w-4 ${sentimentStyles.color}`} />
        </div>
      </div>

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
            Recap Email to {recap.recipient_name}
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
                Send to {recap.recipient_name}
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
                  We couldn't find an email for {recap.recipient_name}. You can dismiss this or add their email later.
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

  // Don't render if nothing to show
  if (!isEligibleUser || (pendingRecaps.length === 0 && callTasks.length === 0)) {
    return null;
  }

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

  return (
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
                  {!isUserCall && currentRecap.caller_user_id && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span>This call was made by another team member</span>
                    </div>
                  )}
                  <RecapEditor
                    recap={currentRecap}
                    onSend={handleSend}
                    onDismiss={handleDismiss}
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

        {/* Pagination for multiple recaps */}
        {displayedRecaps.length > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4 border-t">
            <span className="text-sm text-muted-foreground">
              {activeRecapIndex + 1} of {displayedRecaps.length} recaps
            </span>
            <div className="flex gap-1">
              {displayedRecaps.map((recap, idx) => (
                <button
                  key={recap.id}
                  onClick={() => setActiveRecapIndex(idx)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    idx === activeRecapIndex ? "bg-primary" : "bg-muted"
                  } ${recap.caller_user_id === currentUserId ? "ring-1 ring-primary" : ""}`}
                  title={recap.caller_user_id === currentUserId ? "Your call" : "Team call"}
                />
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Review Later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
