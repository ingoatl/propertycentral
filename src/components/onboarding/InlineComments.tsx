import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Loader2, MessageSquare } from "lucide-react";
import { OnboardingComment } from "@/types/onboarding";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface InlineCommentsProps {
  taskId: string;
}

export const InlineComments = ({ taskId }: InlineCommentsProps) => {
  const [comments, setComments] = useState<OnboardingComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Only load comments when the section is opened (lazy loading)
  useEffect(() => {
    if (isOpen && !hasLoaded) {
      loadComments();
      setHasLoaded(true);
    }
  }, [isOpen, hasLoaded, taskId]);

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

      const { data, error } = await supabase
        .from("onboarding_comments")
        .insert({
          task_id: taskId,
          user_id: user?.id,
          user_name: profile?.email || "Unknown",
          comment: newComment.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const newCommentData = data as OnboardingComment;
        setComments([newCommentData, ...comments]);
        setNewComment("");
        toast.success("Comment added");
      }
    } catch (error) {
      console.error("Failed to add comment:", error);
      toast.error("Failed to add comment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-2">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start text-xs">
          <MessageSquare className="w-3 h-3 mr-2" />
          {comments.length > 0 ? `${comments.length} Comment${comments.length > 1 ? 's' : ''}` : 'Add Comment'}
        </Button>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="mt-2 space-y-2">
        {/* Add Comment Form */}
        <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            rows={2}
            className="text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleAddComment();
              }
            }}
          />
          <Button
            onClick={handleAddComment}
            disabled={submitting || !newComment.trim()}
            size="sm"
            className="w-full"
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

        {/* Comments List */}
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        ) : comments.length > 0 ? (
          <div className="space-y-2">
            {comments.map((comment) => (
              <div key={comment.id} className="border rounded-lg p-2 bg-card text-xs">
                <div className="flex justify-between items-start gap-2 mb-1">
                  <span className="font-medium text-foreground">{comment.user_name}</span>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {format(new Date(comment.created_at), "MMM d, h:mm a")}
                  </span>
                </div>
                <p className="text-foreground/90">{comment.comment}</p>
              </div>
            ))}
          </div>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
};
