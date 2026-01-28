import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  updated_at: string;
  // Joined data
  user_name?: string;
  user_email?: string;
}

export function useTaskComments(taskId: string | null) {
  const queryClient = useQueryClient();

  // Fetch comments for a task
  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["task-comments", taskId],
    queryFn: async () => {
      if (!taskId) return [];
      
      const { data, error } = await supabase
        .from("task_comments")
        .select(`
          id,
          task_id,
          user_id,
          comment,
          created_at,
          updated_at
        `)
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Fetch user profiles for the comments
      const userIds = [...new Set((data || []).map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, email")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return (data || []).map(comment => ({
        ...comment,
        user_name: profileMap.get(comment.user_id)?.first_name || "Unknown",
        user_email: profileMap.get(comment.user_id)?.email || "",
      })) as TaskComment[];
    },
    enabled: !!taskId,
  });

  // Add a comment
  const addComment = useMutation({
    mutationFn: async ({ taskId, comment }: { taskId: string; comment: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("task_comments")
        .insert({
          task_id: taskId,
          user_id: user.id,
          comment,
        })
        .select()
        .single();

      if (error) throw error;

      // Get the task to find who to notify
      const { data: task } = await supabase
        .from("user_tasks")
        .select("user_id, assigned_to, assigned_by, title")
        .eq("id", taskId)
        .single();

      if (task) {
        // Determine who to notify (the other party)
        const notifyUserId = user.id === task.assigned_to 
          ? (task.assigned_by || task.user_id) 
          : task.assigned_to;

        if (notifyUserId && notifyUserId !== user.id) {
          // Get commenter's name
          const { data: profile } = await supabase
            .from("profiles")
            .select("first_name, email")
            .eq("id", user.id)
            .single();

          const commenterName = profile?.first_name || profile?.email || "Someone";

          // Create notification
          await supabase.from("task_notifications").insert({
            user_id: notifyUserId,
            task_id: taskId,
            type: "comment",
            title: "New comment on task",
            message: `${commenterName} commented on "${task.title}": ${comment.substring(0, 100)}${comment.length > 100 ? "..." : ""}`,
          });
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-comments", taskId] });
      toast.success("Comment added");
    },
    onError: (error) => {
      toast.error(`Failed to add comment: ${error.message}`);
    },
  });

  // Delete a comment
  const deleteComment = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase
        .from("task_comments")
        .delete()
        .eq("id", commentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-comments", taskId] });
      toast.success("Comment deleted");
    },
    onError: (error) => {
      toast.error(`Failed to delete comment: ${error.message}`);
    },
  });

  return {
    comments,
    isLoading,
    addComment,
    deleteComment,
  };
}
