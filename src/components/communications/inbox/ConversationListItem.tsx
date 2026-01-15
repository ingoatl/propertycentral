import { format, isToday, isYesterday, parseISO } from "date-fns";
import { Phone, Mail, MessageSquare, Bot, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PriorityBadge } from "../PriorityBadge";
import { VoiceAIBadge, isVoiceAITranscript } from "../VoiceAIBadge";
import { ConversationQuickActions } from "../ConversationQuickActions";

type ConversationPriority = "urgent" | "important" | "normal" | "low";
type ConversationStatusType = "open" | "snoozed" | "done" | "archived" | "awaiting";

interface ConversationListItemProps {
  id: string;
  type: "sms" | "email" | "call" | "gmail" | "draft" | "personal_sms" | "personal_call";
  direction: "inbound" | "outbound";
  body: string;
  subject?: string;
  created_at: string;
  contact_name: string;
  contact_type: string;
  priority?: ConversationPriority;
  conversation_status?: ConversationStatusType;
  isSelected: boolean;
  onClick: () => void;
  onMarkDone: () => void;
  onSnooze: (hours: number) => void;
  onReopen: () => void;
  onMarkAwaiting?: () => void;
  isUpdating?: boolean;
}

export function ConversationListItem({
  id,
  type,
  direction,
  body,
  subject,
  created_at,
  contact_name,
  contact_type,
  priority = "normal",
  conversation_status = "open",
  isSelected,
  onClick,
  onMarkDone,
  onSnooze,
  onReopen,
  onMarkAwaiting,
  isUpdating,
}: ConversationListItemProps) {
  const isVoiceAI = isVoiceAITranscript(body);
  const isDone = conversation_status === "done";
  const isAwaiting = conversation_status === "awaiting";
  const isSnoozed = conversation_status === "snoozed";

  const formatTime = (dateStr: string) => {
    try {
      const date = parseISO(dateStr);
      if (isToday(date)) {
        return format(date, "h:mm a");
      } else if (isYesterday(date)) {
        return "Yesterday";
      }
      return format(date, "MMM d");
    } catch {
      return "";
    }
  };

  const getTypeIcon = () => {
    if (isVoiceAI) return <Bot className="h-4 w-4 text-violet-500" />;
    switch (type) {
      case "call":
      case "personal_call":
        return <Phone className="h-4 w-4 text-blue-500" />;
      case "email":
      case "gmail":
        return <Mail className="h-4 w-4 text-amber-500" />;
      default:
        return <MessageSquare className="h-4 w-4 text-green-500" />;
    }
  };

  const getContactTypeIcon = () => {
    switch (contact_type) {
      case "owner":
        return <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-purple-50 text-purple-700 border-purple-200">Owner</Badge>;
      case "lead":
        return <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-blue-50 text-blue-700 border-blue-200">Lead</Badge>;
      case "tenant":
        return <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-emerald-50 text-emerald-700 border-emerald-200">Tenant</Badge>;
      default:
        return null;
    }
  };

  // Status dot indicator
  const getStatusDot = () => {
    const colors: Record<ConversationStatusType, string> = {
      open: "bg-blue-500",
      awaiting: "bg-cyan-500",
      snoozed: "bg-amber-500",
      done: "bg-green-500",
      archived: "bg-muted-foreground",
    };
    return (
      <div
        className={cn("h-2 w-2 rounded-full", colors[conversation_status])}
        title={conversation_status}
      />
    );
  };

  // Truncate body to preview length
  const previewText = body?.slice(0, 80) + (body?.length > 80 ? "..." : "") || "";

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative flex items-start gap-3 p-3 cursor-pointer border-b hover:bg-muted/50",
        // Smooth transitions for status changes (color, opacity)
        "transition-all duration-300 ease-out",
        isSelected && "bg-primary/5 border-l-2 border-l-primary",
        // Done status: green left border with fade effect
        isDone && "border-l-2 border-l-green-500 opacity-50 bg-green-50/30 dark:bg-green-950/10",
        // Snoozed status: amber left border with fade effect  
        isSnoozed && "border-l-2 border-l-amber-500 opacity-50 bg-amber-50/30 dark:bg-amber-950/10",
        // Awaiting status: cyan left border
        isAwaiting && !isDone && !isSnoozed && "border-l-2 border-l-cyan-500",
        // Inbound messages: blue left border (lowest priority)
        direction === "inbound" && !isDone && !isSnoozed && !isAwaiting && !isSelected && "border-l-2 border-l-blue-400"
      )}
    >
      {/* Type Icon */}
      <div className="shrink-0 mt-0.5">
        {getTypeIcon()}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header row */}
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium text-sm truncate">{contact_name}</span>
            {getContactTypeIcon()}
            {isVoiceAI && <VoiceAIBadge />}
            {priority !== "normal" && <PriorityBadge priority={priority} compact />}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-xs text-muted-foreground">{formatTime(created_at)}</span>
            {getStatusDot()}
          </div>
        </div>

        {/* Subject (for emails) */}
        {subject && (
          <p className="text-sm font-medium text-foreground/90 truncate mb-0.5">
            {subject}
          </p>
        )}

        {/* Preview */}
        <p className="text-xs text-muted-foreground line-clamp-2">
          {previewText}
        </p>
      </div>

      {/* Quick actions - show on hover */}
      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm rounded-md p-0.5">
        <ConversationQuickActions
          status={conversation_status}
          onMarkDone={onMarkDone}
          onSnooze={onSnooze}
          onReopen={onReopen}
          onMarkAwaiting={onMarkAwaiting}
          isUpdating={isUpdating}
          compact
        />
      </div>
    </div>
  );
}
