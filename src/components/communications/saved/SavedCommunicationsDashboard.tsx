import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Archive,
  Search,
  Filter,
  Pin,
  Trash2,
  Edit,
  ExternalLink,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  Tag,
  Calendar,
  User,
  LayoutGrid,
  List,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

const AI_CATEGORY_CONFIG: Record<string, { label: string; icon: any }> = {
  deal_contract: { label: "Deal/Contract", icon: "📋" },
  action_item: { label: "Action Item", icon: "✅" },
  client_decision: { label: "Client Decision", icon: "🤔" },
  support_problem: { label: "Support", icon: "🔧" },
  price_quote: { label: "Price Quote", icon: "💰" },
  communication_record: { label: "Record", icon: "📝" },
};

const MESSAGE_TYPE_ICON: Record<string, any> = {
  email: Mail,
  sms: MessageSquare,
  call: Phone,
  personal_sms: MessageSquare,
  personal_call: Phone,
};

interface SavedCommunication {
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

export function SavedCommunicationsDashboard() {
  const [search, setSearch] = useState("");
  const [filterReason, setFilterReason] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("saved_at");
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  const queryClient = useQueryClient();

  const { data: savedComms = [], isLoading } = useQuery({
    queryKey: ["saved-communications", filterReason, filterCategory, sortBy],
    queryFn: async () => {
      let query = supabase
        .from("saved_communications")
        .select("*")
        .order(sortBy === "saved_at" ? "saved_at" : sortBy === "message_date" ? "message_date" : "sender_name", { ascending: false });

      if (filterReason !== "all") {
        query = query.eq("save_reason", filterReason);
      }
      if (filterCategory !== "all") {
        query = query.eq("ai_category", filterCategory);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as SavedCommunication[];
    },
  });

  const togglePinMutation = useMutation({
    mutationFn: async ({ id, isPinned }: { id: string; isPinned: boolean }) => {
      const { error } = await supabase
        .from("saved_communications")
        .update({ is_pinned: !isPinned })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-communications"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("saved_communications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Message removed from saved");
      queryClient.invalidateQueries({ queryKey: ["saved-communications"] });
      setDeleteId(null);
    },
  });

  const filteredComms = useMemo(() => {
    let result = [...savedComms];
    
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.sender_name.toLowerCase().includes(searchLower) ||
          c.message_subject?.toLowerCase().includes(searchLower) ||
          c.ai_summary?.toLowerCase().includes(searchLower) ||
          c.user_comment?.toLowerCase().includes(searchLower)
      );
    }

    // Sort pinned to top
    result.sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return 0;
    });

    return result;
  }, [savedComms, search]);

  const stats = useMemo(() => {
    const total = savedComms.length;
    const thisWeek = savedComms.filter(
      (c) => new Date(c.saved_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ).length;
    return { total, thisWeek };
  }, [savedComms]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Stats Bar */}
      <div className="px-4 py-3 border-b bg-muted/30 flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <Archive className="h-4 w-4 text-primary" />
          <span className="font-medium">{stats.total}</span>
          <span className="text-muted-foreground">archived</span>
        </div>
        <div className="text-muted-foreground">•</div>
        <div className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span>{stats.thisWeek} this week</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-4 py-3 border-b flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search saved messages..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <Select value={filterReason} onValueChange={setFilterReason}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="Reason" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Reasons</SelectItem>
            {Object.entries(SAVE_REASON_CONFIG).map(([key, { label }]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {Object.entries(AI_CATEGORY_CONFIG).map(([key, { label }]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center border rounded-md">
          <Button
            variant={viewMode === "cards" ? "secondary" : "ghost"}
            size="sm"
            className="h-9 px-2.5 rounded-r-none"
            onClick={() => setViewMode("cards")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="sm"
            className="h-9 px-2.5 rounded-l-none"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {filteredComms.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <Archive className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">No archived messages yet</p>
            <p className="text-xs">Click the Archive button on any message to save it here</p>
          </div>
        ) : viewMode === "cards" ? (
          <div className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredComms.map((comm) => (
              <SavedCard
                key={comm.id}
                comm={comm}
                onPin={() => togglePinMutation.mutate({ id: comm.id, isPinned: comm.is_pinned })}
                onDelete={() => setDeleteId(comm.id)}
              />
            ))}
          </div>
        ) : (
          <div className="divide-y">
            {filteredComms.map((comm) => (
              <SavedRow
                key={comm.id}
                comm={comm}
                onPin={() => togglePinMutation.mutate({ id: comm.id, isPinned: comm.is_pinned })}
                onDelete={() => setDeleteId(comm.id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove saved message?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this message from your saved items.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SavedCard({
  comm,
  onPin,
  onDelete,
}: {
  comm: SavedCommunication;
  onPin: () => void;
  onDelete: () => void;
}) {
  const TypeIcon = MESSAGE_TYPE_ICON[comm.message_type] || Mail;
  const reasonConfig = SAVE_REASON_CONFIG[comm.save_reason] || SAVE_REASON_CONFIG.other;
  const categoryConfig = comm.ai_category ? AI_CATEGORY_CONFIG[comm.ai_category] : null;

  return (
    <div
      className={cn(
        "relative rounded-lg border p-4 hover:shadow-md transition-shadow",
        comm.is_pinned && "ring-2 ring-primary/20 bg-primary/[0.02]"
      )}
    >
      {comm.is_pinned && (
        <Pin className="absolute top-2 right-2 h-4 w-4 text-primary fill-primary" />
      )}

      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-semibold text-white">
            {comm.sender_name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{comm.sender_name}</p>
          <p className="text-xs text-muted-foreground">
            {format(new Date(comm.message_date), "MMM d, yyyy")}
          </p>
        </div>
        <TypeIcon className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Subject/Title */}
      {comm.message_subject && (
        <p className="text-sm font-medium mb-2 line-clamp-1">{comm.message_subject}</p>
      )}

      {/* AI Summary */}
      {comm.ai_summary && (
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{comm.ai_summary}</p>
      )}

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <Badge variant="secondary" className="text-[10px] gap-1">
          <span className={cn("w-1.5 h-1.5 rounded-full", reasonConfig.color)} />
          {reasonConfig.label}
        </Badge>
        {categoryConfig && (
          <Badge variant="outline" className="text-[10px]">
            {categoryConfig.icon} {categoryConfig.label}
          </Badge>
        )}
      </div>

      {/* User Comment */}
      {comm.user_comment && (
        <p className="text-xs text-muted-foreground italic border-l-2 pl-2 mb-3">
          "{comm.user_comment}"
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 pt-2 border-t">
        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onPin}>
          <Pin className={cn("h-3.5 w-3.5", comm.is_pinned && "fill-current")} />
        </Button>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
        <span className="flex-1" />
        <span className="text-[10px] text-muted-foreground">
          Saved {format(new Date(comm.saved_at), "MMM d")}
        </span>
      </div>
    </div>
  );
}

function SavedRow({
  comm,
  onPin,
  onDelete,
}: {
  comm: SavedCommunication;
  onPin: () => void;
  onDelete: () => void;
}) {
  const TypeIcon = MESSAGE_TYPE_ICON[comm.message_type] || Mail;
  const reasonConfig = SAVE_REASON_CONFIG[comm.save_reason] || SAVE_REASON_CONFIG.other;

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors",
        comm.is_pinned && "bg-primary/[0.02]"
      )}
    >
      {comm.is_pinned && <Pin className="h-3.5 w-3.5 text-primary fill-primary flex-shrink-0" />}
      
      <TypeIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{comm.sender_name}</span>
          <Badge variant="secondary" className="text-[10px] gap-1 flex-shrink-0">
            <span className={cn("w-1.5 h-1.5 rounded-full", reasonConfig.color)} />
            {reasonConfig.label}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground truncate">
          {comm.ai_summary || comm.message_subject || comm.message_snippet}
        </p>
      </div>

      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {format(new Date(comm.saved_at), "MMM d")}
      </span>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onPin}>
          <Pin className={cn("h-3.5 w-3.5", comm.is_pinned && "fill-current")} />
        </Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
