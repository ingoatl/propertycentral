import { useEffect, useCallback } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  ArrowRight,
  Archive,
  Trash2,
  Reply,
  Forward,
  MoreHorizontal,
  Mail,
  MessageSquare,
  Phone,
  X,
  User,
  Calendar,
  Tag,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface ArchivedMessage {
  id: string;
  message_id: string;
  message_type: string;
  message_content: string;
  message_subject: string | null;
  message_snippet: string | null;
  sender_name: string;
  sender_email: string | null;
  sender_phone: string | null;
  message_date: string;
  save_reason: string;
  user_comment: string | null;
  ai_summary: string | null;
  ai_category: string | null;
  tags: string[];
  is_pinned: boolean;
  saved_by: string;
  saved_at: string;
}

interface ArchivedMessageViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: ArchivedMessage | null;
  onUnarchive: (id: string) => void;
  onDelete: (id: string) => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

const MESSAGE_TYPE_ICON: Record<string, React.ElementType> = {
  email: Mail,
  sms: MessageSquare,
  call: Phone,
  personal_sms: MessageSquare,
  personal_call: Phone,
};

const SAVE_REASON_CONFIG: Record<string, { label: string; color: string }> = {
  important_decision: { label: "Decision", color: "bg-purple-500" },
  client_request: { label: "Client Request", color: "bg-blue-500" },
  action_item: { label: "Action Item", color: "bg-orange-500" },
  price_quote: { label: "Price Quote", color: "bg-green-500" },
  contract: { label: "Contract", color: "bg-red-500" },
  follow_up_needed: { label: "Follow-up", color: "bg-amber-500" },
  legal_compliance: { label: "Legal", color: "bg-slate-500" },
  other: { label: "Other", color: "bg-gray-500" },
};

export function ArchivedMessageViewModal({
  open,
  onOpenChange,
  message,
  onUnarchive,
  onDelete,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
}: ArchivedMessageViewModalProps) {
  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open || !message) return;

      if (e.key === "Escape") {
        onOpenChange(false);
      } else if (e.key === "ArrowLeft" && hasPrev && onPrev) {
        onPrev();
      } else if (e.key === "ArrowRight" && hasNext && onNext) {
        onNext();
      } else if (e.key === "u" || e.key === "U") {
        onUnarchive(message.id);
      }
    },
    [open, message, hasPrev, hasNext, onPrev, onNext, onUnarchive, onOpenChange]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!message) return null;

  const TypeIcon = MESSAGE_TYPE_ICON[message.message_type] || Mail;
  const reasonConfig = SAVE_REASON_CONFIG[message.save_reason] || SAVE_REASON_CONFIG.other;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[85vw] w-full max-h-[90vh] h-full p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <span className="text-xs font-semibold text-white">
                  {message.sender_name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="font-medium text-sm">{message.sender_name}</p>
                <p className="text-xs text-muted-foreground">
                  {message.sender_email || message.sender_phone}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onUnarchive(message.id)}
              className="gap-1.5"
            >
              <Archive className="h-4 w-4" />
              Unarchive
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {message.message_type === "email" && (
                  <>
                    <DropdownMenuItem>
                      <Reply className="h-4 w-4 mr-2" />
                      Reply
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Forward className="h-4 w-4 mr-2" />
                      Forward
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => onDelete(message.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Permanently
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {/* Subject & Metadata */}
            <div className="space-y-4">
              {message.message_subject && (
                <h2 className="text-xl font-semibold">{message.message_subject}</h2>
              )}

              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <TypeIcon className="h-4 w-4" />
                  <span className="capitalize">{message.message_type}</span>
                </div>
                <span>•</span>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(message.message_date), "MMM d, yyyy 'at' h:mm a")}
                </div>
                <span>•</span>
                <div className="flex items-center gap-1.5">
                  <Archive className="h-4 w-4" />
                  Archived {format(new Date(message.saved_at), "MMM d, yyyy")}
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="gap-1">
                  <span className={cn("w-2 h-2 rounded-full", reasonConfig.color)} />
                  {reasonConfig.label}
                </Badge>
                {message.tags?.map((tag) => (
                  <Badge key={tag} variant="outline" className="gap-1">
                    <Tag className="h-3 w-3" />
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            {/* AI Summary */}
            {message.ai_summary && (
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">AI Summary</p>
                <p className="text-sm">{message.ai_summary}</p>
              </div>
            )}

            {/* User Comment */}
            {message.user_comment && (
              <div className="bg-primary/5 border-l-4 border-primary rounded-r-lg p-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">Your Note</p>
                <p className="text-sm italic">"{message.user_comment}"</p>
              </div>
            )}

            {/* Message Content */}
            <div className="bg-background border rounded-lg p-6">
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: message.message_content }}
              />
            </div>
          </div>
        </ScrollArea>

        {/* Footer Navigation */}
        <div className="px-6 py-4 border-t flex items-center justify-between bg-muted/30">
          <Button
            variant="outline"
            size="sm"
            onClick={onPrev}
            disabled={!hasPrev}
            className="gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
            Previous
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onUnarchive(message.id)}
              className="gap-1.5"
            >
              <Archive className="h-4 w-4" />
              Unarchive
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(message.id)}
              className="gap-1.5 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onNext}
            disabled={!hasNext}
            className="gap-1.5"
          >
            Next
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Keyboard shortcuts hint */}
        <div className="px-6 py-2 border-t bg-muted/20 text-center">
          <p className="text-xs text-muted-foreground">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">←</kbd>{" "}
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">→</kbd> Navigate •{" "}
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">U</kbd> Unarchive •{" "}
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">ESC</kbd> Close
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
