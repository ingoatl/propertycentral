import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  Archive,
  Search,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  Eye,
  ArchiveRestore,
  Trash2,
  MoreHorizontal,
  ChevronDown,
  X,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { ArchivedMessageViewModal } from "./ArchivedMessageViewModal";

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

const MESSAGE_TYPE_ICON: Record<string, React.ElementType> = {
  email: Mail,
  sms: MessageSquare,
  call: Phone,
  personal_sms: MessageSquare,
  personal_call: Phone,
};

export function ArchivedMessagesList() {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<string>("saved_at");
  const [filterType, setFilterType] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<ArchivedMessage | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);

  const queryClient = useQueryClient();

  const { data: archivedMessages = [], isLoading } = useQuery({
    queryKey: ["archived-messages", sortBy, filterType],
    queryFn: async () => {
      let query = supabase
        .from("saved_communications")
        .select("*")
        .order(sortBy === "saved_at" ? "saved_at" : sortBy === "message_date" ? "message_date" : "sender_name", { ascending: false });

      if (filterType !== "all") {
        query = query.eq("message_type", filterType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ArchivedMessage[];
    },
  });

  const unarchiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("saved_communications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Message unarchived - moved back to inbox");
      queryClient.invalidateQueries({ queryKey: ["archived-messages"] });
      setShowViewModal(false);
      setSelectedMessage(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("saved_communications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Message permanently deleted");
      queryClient.invalidateQueries({ queryKey: ["archived-messages"] });
      setDeleteId(null);
      setShowViewModal(false);
      setSelectedMessage(null);
    },
  });

  const filteredMessages = useMemo(() => {
    if (!search.trim()) return archivedMessages;

    const searchLower = search.toLowerCase();
    return archivedMessages.filter(
      (m) =>
        m.sender_name.toLowerCase().includes(searchLower) ||
        m.message_subject?.toLowerCase().includes(searchLower) ||
        m.ai_summary?.toLowerCase().includes(searchLower)
    );
  }, [archivedMessages, search]);

  const currentIndex = selectedMessage
    ? filteredMessages.findIndex((m) => m.id === selectedMessage.id)
    : -1;

  const handlePrev = () => {
    if (currentIndex > 0) {
      setSelectedMessage(filteredMessages[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (currentIndex < filteredMessages.length - 1) {
      setSelectedMessage(filteredMessages[currentIndex + 1]);
    }
  };

  const handleView = (message: ArchivedMessage) => {
    setSelectedMessage(message);
    setShowViewModal(true);
  };

  const handleUnarchive = (id: string) => {
    unarchiveMutation.mutate(id);
  };

  const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-5 py-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Archive className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Archived Messages</h2>
            <Badge variant="secondary" className="ml-1">
              {filteredMessages.length}
            </Badge>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search archived messages..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[130px] h-9">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="saved_at">Date Archived</SelectItem>
              <SelectItem value="message_date">Message Date</SelectItem>
              <SelectItem value="sender_name">Sender</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[100px] h-9">
              <Filter className="h-3.5 w-3.5 mr-1.5" />
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
              <SelectItem value="call">Call</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Message List */}
      <ScrollArea className="flex-1">
        {filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Archive className="h-16 w-16 mb-4 opacity-20" />
            <p className="text-base font-medium mb-1">No archived messages</p>
            <p className="text-sm">Click the Archive button on any message to save it here</p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredMessages.map((message) => (
              <ArchivedMessageRow
                key={message.id}
                message={message}
                onView={() => handleView(message)}
                onUnarchive={() => handleUnarchive(message.id)}
                onDelete={() => handleDelete(message.id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* View Modal */}
      <ArchivedMessageViewModal
        open={showViewModal}
        onOpenChange={setShowViewModal}
        message={selectedMessage}
        onUnarchive={handleUnarchive}
        onDelete={handleDelete}
        onPrev={handlePrev}
        onNext={handleNext}
        hasPrev={currentIndex > 0}
        hasNext={currentIndex < filteredMessages.length - 1}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this message from your archive. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ArchivedMessageRow({
  message,
  onView,
  onUnarchive,
  onDelete,
}: {
  message: ArchivedMessage;
  onView: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const TypeIcon = MESSAGE_TYPE_ICON[message.message_type] || Mail;

  return (
    <div
      className="group flex items-center gap-4 px-5 py-4 hover:bg-muted/50 transition-colors cursor-pointer"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onClick={onView}
    >
      {/* Avatar */}
      <Avatar className="h-10 w-10 flex-shrink-0">
        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-sm">
          {message.sender_name.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-semibold text-sm truncate">{message.sender_name}</span>
          <TypeIcon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        </div>
        <p className="text-sm text-foreground truncate font-medium">
          {message.message_subject || message.ai_summary || "No subject"}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Archived {formatDistanceToNow(new Date(message.saved_at), { addSuffix: true })}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {showActions ? (
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={(e) => {
                e.stopPropagation();
                onView();
              }}
            >
              <Eye className="h-3.5 w-3.5" />
              View
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                onUnarchive();
              }}
              title="Unarchive"
            >
              <ArchiveRestore className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">
            {format(new Date(message.saved_at), "MMM d")}
          </span>
        )}
      </div>
    </div>
  );
}
