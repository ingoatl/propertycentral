import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { OnboardingComment } from "@/types/onboarding";

interface TaskCommentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  taskTitle: string;
}

export const TaskCommentsDialog = ({
  open,
  onOpenChange,
  taskId,
  taskTitle,
}: TaskCommentsDialogProps) => {
  const [comments, setComments] = useState<OnboardingComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      loadComments();
    }
  }, [open, taskId]);

  const loadComments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("onboarding_comments")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setComments((data || []) as OnboardingComment[]);
    } catch (error) {
      console.error("Failed to load comments:", error);
      toast.error("Failed to load comments");
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) {
      toast.error("Comment cannot be empty");
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", user?.id)
        .single();

      const { error } = await supabase
        .from("onboarding_comments")
        .insert({
          task_id: taskId,
          user_id: user?.id,
          user_name: profile?.email || "Unknown",
          comment: newComment.trim(),
        });

      if (error) throw error;

      toast.success("Comment added");
      setNewComment("");
      loadComments();
    } catch (error) {
      console.error("Failed to add comment:", error);
      toast.error("Failed to add comment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Comments</DialogTitle>
          <DialogDescription className="text-xs">
            {taskTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No comments yet
            </p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="border rounded-lg p-3 space-y-1">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-medium">{comment.user_name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(comment.created_at), "MMM d, yyyy h:mm a")}
                  </span>
                </div>
                <p className="text-xs text-foreground">{comment.comment}</p>
              </div>
            ))
          )}
        </div>

        <div className="space-y-2 pt-4 border-t">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            rows={2}
            className="text-sm"
          />
          <Button
            onClick={handleAddComment}
            disabled={submitting || !newComment.trim()}
            className="w-full"
            size="sm"
          >
            {submitting ? (
              <>
                <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              "Add Comment"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
