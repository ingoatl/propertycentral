import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface UserTask {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  priority: "urgent" | "high" | "medium" | "low";
  status: "pending" | "in_progress" | "completed" | "cancelled";
  due_date: string | null;
  source_type: string | null;
  source_id: string | null;
  related_contact_type: string | null;
  related_contact_id: string | null;
  property_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  category: string | null;
  is_pinned: boolean;
  estimated_minutes: number | null;
  // New assignment fields
  assigned_to: string | null;
  assigned_by: string | null;
  assigned_at: string | null;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: "urgent" | "high" | "medium" | "low";
  due_date?: string;
  source_type?: string;
  source_id?: string;
  related_contact_type?: string;
  related_contact_id?: string;
  property_id?: string;
  assigned_to?: string;
}

export function useUserTasks() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey: ["user-tasks"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Fetch tasks where user is owner OR assigned_to
      const { data, error } = await supabase
        .from("user_tasks")
        .select("*")
        .or(`user_id.eq.${user.id},assigned_to.eq.${user.id}`)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as UserTask[];
    },
  });

  const createTask = useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Build insert object with proper typing
      const insertData = {
        user_id: user.id,
        title: input.title,
        description: input.description || null,
        priority: input.priority || "medium",
        due_date: input.due_date || null,
        source_type: input.source_type || "manual",
        source_id: input.source_id || null,
        related_contact_type: input.related_contact_type || null,
        related_contact_id: input.related_contact_id || null,
        property_id: input.property_id || null,
        assigned_to: input.assigned_to && input.assigned_to !== user.id ? input.assigned_to : null,
        assigned_by: input.assigned_to && input.assigned_to !== user.id ? user.id : null,
        assigned_at: input.assigned_to && input.assigned_to !== user.id ? new Date().toISOString() : null,
      };

      const { data, error } = await supabase
        .from("user_tasks")
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["user-tasks"] });
      
      // If task was assigned to someone, create notification
      if (variables.assigned_to) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Get assigner's name
          const { data: profile } = await supabase
            .from("profiles")
            .select("first_name, email")
            .eq("id", user.id)
            .single();
          
          const assignerName = profile?.first_name || profile?.email || "Someone";
          
          await supabase.from("task_notifications").insert([{
            user_id: variables.assigned_to,
            task_id: data.id,
            type: "assignment",
            title: "New task assigned to you",
            message: `${assignerName} assigned you: "${variables.title}"`,
          }]);
        }
        toast({ title: "Task assigned" });
      } else {
        toast({ title: "Task created" });
      }
    },
    onError: (error) => {
      toast({ title: "Failed to create task", description: error.message, variant: "destructive" });
    },
  });

  // Assign existing task to team member
  const assignTask = useMutation({
    mutationFn: async ({ taskId, assignToUserId }: { taskId: string; assignToUserId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("user_tasks")
        .update({
          assigned_to: assignToUserId,
          assigned_by: user.id,
          assigned_at: new Date().toISOString(),
        })
        .eq("id", taskId)
        .select()
        .single();

      if (error) throw error;
      return { task: data, assignedBy: user.id };
    },
    onSuccess: async ({ task, assignedBy }) => {
      queryClient.invalidateQueries({ queryKey: ["user-tasks"] });
      
      // Create notification for assignee
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, email")
        .eq("id", assignedBy)
        .single();
      
      const assignerName = profile?.first_name || profile?.email || "Someone";
      
      await supabase.from("task_notifications").insert([{
        user_id: task.assigned_to,
        task_id: task.id,
        type: "assignment",
        title: "Task assigned to you",
        message: `${assignerName} assigned you: "${task.title}"`,
      }]);
      
      toast({ title: "Task assigned successfully" });
    },
    onError: (error) => {
      toast({ title: "Failed to assign task", description: error.message, variant: "destructive" });
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<UserTask> & { id: string }) => {
      const updateData: Record<string, unknown> = { ...updates };
      
      if (updates.status === "completed" as const) {
        updateData.completed_at = new Date().toISOString();
      } else if (updates.status) {
        updateData.completed_at = null;
      }

      const { data, error } = await supabase
        .from("user_tasks")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-tasks"] });
    },
    onError: (error) => {
      toast({ title: "Failed to update task", description: error.message, variant: "destructive" });
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("user_tasks")
        .update({ status: "cancelled" })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-tasks"] });
      toast({ title: "Task removed" });
    },
    onError: (error) => {
      toast({ title: "Failed to delete task", description: error.message, variant: "destructive" });
    },
  });

  const completeTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("user_tasks")
        .update({ 
          status: "completed",
          completed_at: new Date().toISOString()
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-tasks"] });
      toast({ title: "Task completed! 🎉" });
    },
    onError: (error) => {
      toast({ title: "Failed to complete task", description: error.message, variant: "destructive" });
    },
  });

  // Group tasks by priority and due date
  const urgentTasks = tasks.filter(t => t.priority === "urgent" && t.status !== "completed");
  const todayTasks = tasks.filter(t => {
    if (t.status === "completed" || t.priority === "urgent") return false;
    if (!t.due_date) return false;
    const today = new Date().toISOString().split("T")[0];
    return t.due_date === today;
  });
  const upcomingTasks = tasks.filter(t => {
    if (t.status === "completed" || t.priority === "urgent") return false;
    if (!t.due_date) return true;
    const today = new Date().toISOString().split("T")[0];
    return t.due_date > today;
  });
  const completedTasks = tasks.filter(t => t.status === "completed");

  return {
    tasks,
    urgentTasks,
    todayTasks,
    upcomingTasks,
    completedTasks,
    isLoading,
    error,
    createTask,
    updateTask,
    deleteTask,
    completeTask,
    assignTask,
  };
}
