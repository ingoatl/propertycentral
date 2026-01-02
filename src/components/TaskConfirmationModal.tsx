import { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  CheckCircle2, 
  XCircle, 
  Mail, 
  MessageSquare, 
  Phone, 
  FileText,
  Pencil,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Building2,
  User
} from "lucide-react";
import { 
  usePendingTaskConfirmations, 
  PendingTaskConfirmation 
} from "@/hooks/usePendingTaskConfirmations";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const sourceTypeConfig = {
  email: { icon: Mail, label: "Email", color: "bg-blue-500" },
  sms: { icon: MessageSquare, label: "SMS", color: "bg-green-500" },
  call_transcript: { icon: Phone, label: "Call", color: "bg-purple-500" },
  owner_conversation: { icon: FileText, label: "Document", color: "bg-orange-500" },
  manual: { icon: Pencil, label: "Manual", color: "bg-gray-500" },
};

const priorityColors = {
  high: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};

const phaseLabels: Record<number, string> = {
  1: "Property Setup",
  2: "Verification",
  3: "Owner Preferences",
  4: "Follow-up",
  5: "Maintenance",
};

interface TaskCardProps {
  confirmation: PendingTaskConfirmation;
  onApprove: (id: string, title?: string, description?: string) => void;
  onReject: (id: string, reason?: string) => void;
  isApproving: boolean;
  isRejecting: boolean;
}

function TaskCard({ 
  confirmation, 
  onApprove, 
  onReject, 
  isApproving, 
  isRejecting 
}: TaskCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(confirmation.task_title);
  const [editedDescription, setEditedDescription] = useState(
    confirmation.task_description || ""
  );
  const [showQuote, setShowQuote] = useState(false);

  const sourceConfig = sourceTypeConfig[confirmation.source_type as keyof typeof sourceTypeConfig] 
    || sourceTypeConfig.manual;
  const SourceIcon = sourceConfig.icon;

  const handleApprove = () => {
    if (isEditing) {
      onApprove(confirmation.id, editedTitle, editedDescription);
    } else {
      onApprove(confirmation.id);
    }
  };

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className={`p-1.5 rounded ${sourceConfig.color}`}>
              <SourceIcon className="h-3.5 w-3.5 text-white" />
            </div>
            {isEditing ? (
              <Input
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="text-sm font-medium"
              />
            ) : (
              <CardTitle className="text-sm font-medium truncate">
                {confirmation.task_title}
              </CardTitle>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Badge 
              variant="outline" 
              className={priorityColors[confirmation.priority as keyof typeof priorityColors] || priorityColors.medium}
            >
              {confirmation.priority}
            </Badge>
            {confirmation.phase_suggestion && (
              <Badge variant="secondary" className="text-xs">
                Phase {confirmation.phase_suggestion}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Property & Owner context */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {confirmation.property && (
            <div className="flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              <span className="truncate max-w-[150px]">{confirmation.property.name}</span>
            </div>
          )}
          {confirmation.owner && (
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span>{confirmation.owner.name}</span>
            </div>
          )}
        </div>

        {/* Description */}
        {isEditing ? (
          <Textarea
            value={editedDescription}
            onChange={(e) => setEditedDescription(e.target.value)}
            rows={3}
            className="text-sm"
          />
        ) : (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {confirmation.task_description}
          </p>
        )}

        {/* Source quote */}
        {confirmation.source_quote && (
          <Collapsible open={showQuote} onOpenChange={setShowQuote}>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-primary hover:underline">
              {showQuote ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              View source text
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <blockquote className="border-l-2 border-muted pl-3 text-xs text-muted-foreground italic">
                "{confirmation.source_quote}"
              </blockquote>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Category */}
        {confirmation.task_category && (
          <Badge variant="outline" className="text-xs">
            {confirmation.task_category}
          </Badge>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
            className="text-xs"
          >
            <Pencil className="h-3 w-3 mr-1" />
            {isEditing ? "Cancel Edit" : "Edit"}
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onReject(confirmation.id)}
              disabled={isRejecting}
              className="text-destructive hover:text-destructive"
            >
              <XCircle className="h-4 w-4 mr-1" />
              Reject
            </Button>
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={isApproving}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Approve
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TaskConfirmationModal() {
  const [isOpen, setIsOpen] = useState(true);
  
  const {
    pendingConfirmations,
    isLoading,
    isEligibleUser,
    approveTask,
    rejectTask,
    approveAllTasks,
    isApproving,
    isRejecting,
    isApprovingAll,
  } = usePendingTaskConfirmations();

  // Don't render if user isn't eligible or no pending confirmations
  if (!isEligibleUser || pendingConfirmations.length === 0) {
    return null;
  }

  const handleApprove = (id: string, title?: string, description?: string) => {
    approveTask({ confirmationId: id, editedTitle: title, editedDescription: description });
  };

  const handleReject = (id: string, reason?: string) => {
    rejectTask({ confirmationId: id, reason });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>New Tasks Detected</DialogTitle>
              <DialogDescription>
                {pendingConfirmations.length} task{pendingConfirmations.length !== 1 ? 's' : ''} extracted from owner communications
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh] pr-4">
          <div className="space-y-3">
            {pendingConfirmations.map((confirmation) => (
              <TaskCard
                key={confirmation.id}
                confirmation={confirmation}
                onApprove={handleApprove}
                onReject={handleReject}
                isApproving={isApproving}
                isRejecting={isRejecting}
              />
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
          >
            Review Later
          </Button>
          <Button
            onClick={() => approveAllTasks()}
            disabled={isApprovingAll}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Approve All ({pendingConfirmations.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
