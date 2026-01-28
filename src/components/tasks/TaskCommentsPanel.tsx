import { useState } from "react";
import { MessageCircle, Send, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTaskComments } from "@/hooks/useTaskComments";
import { format } from "date-fns";

interface TaskCommentsPanelProps {
  taskId: string;
  currentUserId?: string;
}

export function TaskCommentsPanel({ taskId, currentUserId }: TaskCommentsPanelProps) {
  const [newComment, setNewComment] = useState("");
  const { comments, isLoading, addComment, deleteComment } = useTaskComments(taskId);

  const handleSubmit = async () => {
    if (!newComment.trim()) return;
    
    await addComment.mutateAsync({
      taskId,
      comment: newComment.trim(),
    });
    setNewComment("");
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <MessageCircle className="h-4 w-4" />
        Comments ({comments.length})
      </div>

      {comments.length > 0 && (
        <ScrollArea className="max-h-48">
          <div className="space-y-3 pr-2">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-2 group">
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {getInitials(comment.user_name || "?")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium">{comment.user_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(comment.created_at), "MMM d, h:mm a")}
                    </span>
                    {comment.user_id === currentUserId && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => deleteComment.mutate(comment.id)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
                    {comment.comment}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Add comment form */}
      <div className="flex gap-2">
        <Textarea
          placeholder="Add a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className="min-h-[60px] resize-none text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              handleSubmit();
            }
          }}
        />
        <Button
          size="icon"
          onClick={handleSubmit}
          disabled={!newComment.trim() || addComment.isPending}
          className="shrink-0"
        >
          {addComment.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Press ⌘+Enter to send
      </p>
    </div>
  );
}
